import { gravityRoll, rollFrame } from "../games/ride-roll";
import { Quaternion, Vector3 } from "three";
import { clamp } from "../math";
import { powerPhysics, type RacePowerState } from "../games/ride-powerups";
import { railAcceleration } from "../games/mini-physics";
import type { Difficulty } from "../types";
import type { MiniTrack } from "../games/mini-track";
import { HeightTrack } from "../games/height-track";
import type { Body, Motion, Quat, RideState, Vec } from "./protocol";

const lerpVec = (a: Vec, b: Vec, t: number): Vec => a.map((n, i) => n + (b[i] - n) * t) as Vec;
const lerpQuat = (a: Quat, b: Quat, t: number): Quat => new Quaternion(...a).slerp(new Quaternion(...b), t).toArray();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Clamped tangents keep scalar interpolation monotone even across a boost/stop.
const curve = (a: number, b: number, va: number, vb: number, span: number, t: number) => {
  const delta = b - a, sign = Math.sign(delta);
  const tangent = (v: number) => sign * clamp(sign * v * span, 0, Math.abs(delta) * 1.5);
  return (2*t*t*t - 3*t*t + 1)*a + (t*t*t - 2*t*t + t)*tangent(va)
    + (-2*t*t*t + 3*t*t)*b + (t*t*t - t*t)*tangent(vb);
};
function motion<T extends Motion>(a: T, b: T, span: number, t: number): T {
  const position = a.velocity && b.velocity
    ? a.position.map((v, i) => curve(v, b.position[i], a.velocity![i], b.velocity![i], span, t)) as Vec
    : lerpVec(a.position, b.position, t);
  return { ...a, position, rotation: lerpQuat(a.rotation, b.rotation, t) };
}
function drift<T extends Motion>(body: T, dt: number, gravity = 9.81): T {
  if (!body.velocity) return body;
  const position = body.position.map((v, i) => v + body.velocity![i]*dt) as Vec;
  // Only predict airborne motion briefly. The next authoritative state handles contact.
  const g = body.id?.startsWith("coach-") && (gravity < 0 || gravity > 9.81 && body.velocity[1] > 0) ? 9.81 : gravity;
  position[1] = Math.max(.15, position[1] - .5*g*dt*dt);
  const rotation = new Quaternion(...body.rotation);
  if (body.spin) {
    const spin = new Vector3(...body.spin), rate = spin.length();
    if (rate) rotation.premultiply(new Quaternion().setFromAxisAngle(spin.divideScalar(rate), rate*dt));
  }
  return { ...body, position, rotation: rotation.toArray() };
}

function powerAt(power: RacePowerState | undefined, dt: number) {
  if (!power?.active) return power;
  const remaining = Math.max(0, power.remaining - dt);
  return { ...power, remaining, age: Math.min(20, power.age+dt), active: remaining ? power.active : undefined };
}

/** Display the opponent on their simulation clock, independent of packet arrivals.
 * Buffer jitter, sample rail geometry locally, and predict short gaps using the
 * rider's resistance. Snapshots remain authoritative; prediction cannot award boosts
 * or decide a race. A long outage eases to rest after at most 200 ms of motion. */
export class OpponentGhost {
  private samples: RideState[] = [];
  private arrivals: { offset: number; now: number }[] = [];
  private cursor?: number;
  private lastNow?: number;
  private paused = false;
  private playing = false;
  private corrections = new Map<string, { distance?: number; lift?: number; position?: Vector3; rotation?: Quaternion }>();
  private displayed?: RideState;
  latest?: RideState;
  track?: MiniTrack;
  private sourceTrack?: MiniTrack;
  constructor(track?: MiniTrack, private difficulty: Difficulty = "normal") { if(track)this.configure(track,difficulty); }
  configure(track: MiniTrack, difficulty: Difficulty) {
    this.sourceTrack = track;
    this.track = track instanceof HeightTrack ? new HeightTrack(track.seed, track.options) : track;
    this.difficulty = difficulty;
  }
  private heights(state: RideState, ahead = 0) {
    if (!(this.track instanceof HeightTrack) || !this.sourceTrack) return;
    const start = this.sourceTrack.sections[0].end;
    this.track.ensure(start, Math.max(600, this.sourceTrack.end - start));
    this.track.receive(state.heights ?? { since: 0, advancing: false, lifts: [] }, ahead);
  }
  setPaused(paused: boolean, now = performance.now()) {
    if (paused === this.paused) return;
    if (paused) this.sample(now);
    this.paused = paused; this.lastNow = now;
    // Paused simulation time must not be mistaken for network latency.
    this.arrivals = [];
  }
  push(state: RideState, now = performance.now()) {
    if (this.latest && (state.seq <= this.latest.seq || state.time < this.latest.time)) return;
    this.latest = state;
    if (this.samples.at(-1)?.time === state.time) this.samples.pop();
    this.samples.push(state);
    if (this.samples.length > 32) this.samples.shift();
    // Reconcile at the current display time. A late boost/checkpoint changes the
    // prediction underneath us; keep its visible pose continuous and ease out
    // the small residual instead of jumping to the newly arrived position.
    if (this.displayed && this.cursor !== undefined && !this.paused) {
      const corrected = new Map(this.displayed.bodies.map(b => [b.id, b]));
      this.corrections.clear();
      for (const body of this.evaluate().bodies) {
        const old = corrected.get(body.id);
        if (!old) continue;
        this.corrections.set(body.id, old.rail && body.rail ? {
          distance: old.rail.distance - body.rail.distance, lift: old.rail.lift - body.rail.lift,
        } : { position: new Vector3(...old.position).sub(new Vector3(...body.position)),
          rotation: new Quaternion(...old.rotation).multiply(new Quaternion(...body.rotation).invert()) });
      }
    }
    if (!this.paused) {
      this.arrivals.push({ offset: now - state.time * 1000, now });
      this.arrivals = this.arrivals.filter(a => now - a.now < 6000).slice(-64);
    }
  }
  private railBody(body: Body, power?: RacePowerState): Body {
    if (!body.rail || !this.track || body.rail.distance < this.track.sections[0].start || body.rail.distance > this.track.end) return body;
    const frame = rollFrame(this.track.sample(body.rail.distance),gravityRoll(power?.active,power?.age??0,power?.remaining??0));
    frame.position.y += body.rail.lift;
    return { ...body, position: frame.position.toArray(), rotation: frame.rotation.toArray() };
  }
  private routeSpeed(speed: number, distance: number) {
    return speed / (this.track?.metric(distance) ?? 1);
  }
  private blend(a: RideState, b: RideState, t: number): RideState {
    const span = b.time - a.time;
    this.heights(a, span*t);
    const gravity = powerPhysics(a.power?.active, this.difficulty).gravity;
    const next = new Map(b.bodies.map(body => [body.id, body]));
    const parcels = new Map(b.parcels.filter(p => p.id).map(p => [p.id, p]));
    return {
      ...a, time: lerp(a.time, b.time, t),
      power: powerAt(a.power, span*t),
      distance: curve(a.distance, b.distance, this.routeSpeed(a.speed,a.distance), this.routeSpeed(b.speed,b.distance), span, t), speed: lerp(a.speed, b.speed, t),
      bodies: a.bodies.map(body => {
        const end = next.get(body.id);
        if (!end) return drift(body, span*t, gravity);
        let blended = { ...motion(body, end, span, t), cargoAge: lerp(body.cargoAge, end.cargoAge, t) };
        if (body.rail && end.rail) blended = { ...blended, rail: { ...body.rail,
          distance: curve(body.rail.distance, end.rail.distance, this.routeSpeed(body.rail.speed,body.rail.distance), this.routeSpeed(end.rail.speed,end.rail.distance), span, t),
          speed: lerp(body.rail.speed, end.rail.speed, t),
          lift: Math.max(0, curve(body.rail.lift, end.rail.lift, body.rail.liftSpeed, end.rail.liftSpeed, span, t)),
        } };
        // Crossing a jump lip uses the authoritative airborne arc, not virtual rail.
        if (!!body.rail !== !!end.rail) blended = { ...blended, rail: undefined };
        return this.railBody(blended,powerAt(a.power,span*t));
      }),
      impacts: a.impacts.map(impact => {
        const end = b.impacts.find(e => e.id === impact.id);
        return end ? { ...impact, age: lerp(impact.age, end.age, t),
          particles: impact.particles.map((p, i) => ({ ...p, position: end.particles[i] ? lerpVec(p.position, end.particles[i].position, t) : p.position })) } : impact;
      }),
      parcels: a.parcels.map(p => {
        const end = p.id ? parcels.get(p.id) : undefined;
        return end ? motion(p, end, span, t) : drift(p, span*t, gravity);
      }),
      links: a.links.map((link, i) => ({ ...link,
        start: b.links[i] ? lerpVec(link.start, b.links[i].start, t) : link.start,
        end: b.links[i] ? lerpVec(link.end, b.links[i].end, t) : link.end })),
    };
  }
  private predict(state: RideState, ahead: number): RideState {
    const dt = .2 * (1 - Math.exp(-Math.max(0,ahead) / .2));
    this.heights(state, dt);
    if (state.ended || ahead <= 0) return state;
    const resistance = powerPhysics(state.power?.active, this.difficulty);
    const bodies = state.bodies.map(body => {
      if (!body.rail || !this.track) return drift(body, dt, resistance.gravity);
      let distance = body.rail.distance, speed = body.rail.speed;
      if (distance < this.track.sections[0].start || distance > this.track.end) return drift(body, dt);
      for (let elapsed = 0; elapsed < dt;) {
        const h = Math.min(1/120, dt - elapsed);
        const options = state.power?.active && elapsed >= state.power.remaining ? powerPhysics(undefined,this.difficulty) : resistance;
        const nextSpeed = Math.max(0, speed + h * railAcceleration(this.track, distance, speed, options));
        const nextDistance = distance + (speed + nextSpeed)*.5*h / this.track.metric(distance);
        if (!this.track.hasRail(nextDistance) || nextDistance > this.track.end) break;
        distance = nextDistance; speed = nextSpeed; elapsed += h;
      }
      return this.railBody({ ...body, rail: { ...body.rail, distance, speed,
        lift: Math.max(0, body.rail.lift + body.rail.liftSpeed*dt - 15*dt*dt) } },powerAt(state.power,dt));
    });
    return { ...state, time: state.time+dt, distance: bodies[0]?.rail?.distance ?? state.distance + state.speed*dt, bodies, power: powerAt(state.power, dt),
      parcels: state.parcels.map(p => drift(p, dt, resistance.gravity)) };
  }
  private evaluate(): RideState {
    const cursor = this.cursor ?? this.samples[0].time;
    while (this.samples.length > 2 && this.samples[1].time <= cursor) this.samples.shift();
    const a = this.samples[0], b = this.samples[1];
    return b && cursor < b.time
      ? this.blend(a, b, clamp((cursor - a.time)/(b.time - a.time), 0, 1))
      : this.predict(b ?? a, cursor - (b ?? a).time);
  }
  private reconcile(state: RideState, dt: number) {
    const decay = Math.exp(-dt * 12);
    return { ...state, bodies: state.bodies.map(body => {
      const error = this.corrections.get(body.id);
      if (!error) return body;
      if (body.rail && error.distance !== undefined) {
        error.distance *= decay; error.lift! *= decay;
        return this.railBody({ ...body, rail: { ...body.rail,
          distance: body.rail.distance + error.distance, lift: Math.max(0, body.rail.lift + error.lift!) } },state.power);
      }
      if (!error.position || !error.rotation) return body;
      error.position.multiplyScalar(decay); error.rotation.slerp(new Quaternion(), 1 - decay);
      return { ...body, position: new Vector3(...body.position).add(error.position).toArray(),
        rotation: error.rotation.clone().multiply(new Quaternion(...body.rotation)).toArray() };
    }) };
  }
  private links(state: RideState) {
    // Rebuild couplers from displayed coaches so interpolation/prediction cannot
    // leave a link hanging at its previous network position.
    const coaches = state.bodies.filter(b => b.rail?.coupled);
    if (coaches.length > 1 && coaches.length - 1 === state.links.length) state.links = coaches.slice(1).map((b, i) => {
      const end = (body: Body, front: boolean): Vec => new Vector3(0, .3, front ? -1.02 : 1.02)
        .applyQuaternion(new Quaternion(...body.rotation)).add(new Vector3(...body.position)).toArray();
      return { ...state.links[i], start: end(coaches[i], false), end: end(b, true) };
    });
    return state;
  }
  sample(now = performance.now()): RideState | undefined {
    if (!this.samples.length) return;
    if (this.paused && this.displayed) return this.displayed;
    if (this.lastNow !== undefined && now <= this.lastNow && this.displayed) return this.displayed;
    const offsets = this.arrivals.map(a => a.offset).sort((a,b) => a-b);
    const offset = offsets[0] ?? now - this.latest!.time*1000;
    const jitter = offsets.length ? offsets[Math.floor((offsets.length-1)*.9)] - offset : 0;
    const delay = clamp(150 + jitter, 150, 350) / 1000;
    const target = (now - offset)/1000 - delay;
    const dt = this.lastNow === undefined ? 0 : clamp((now - this.lastNow)/1000, 0, .1);
    this.lastNow = now;
    if (this.cursor === undefined) this.cursor = this.samples[0].time;
    if (!this.playing) {
      // Fill the initial jitter buffer before moving, rather than starting early
      // and repeatedly starving while the buffer tries to catch up.
      if (target > this.cursor) { this.playing = true; this.cursor = target; }
    } else if (!this.paused) this.cursor += dt * clamp(1 + (target - this.cursor)*.5, .9, 1.1);
    this.displayed = this.links(this.reconcile(this.evaluate(), dt));
    return this.displayed;
  }
}
