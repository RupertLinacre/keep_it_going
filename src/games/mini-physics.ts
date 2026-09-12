import * as THREE from "three";
import type { RailFrame } from "./mini-rail";
import type { MiniSection, MiniRail } from "./mini-track";
import { MINI_BOOST_ENERGY, MINI_START_SPEED } from "./mini-config";

export interface MiniPhysicsOptions {
  gravity: number;
  mass: number;
  drag: number;
  rolling: number;
  initialSpeed: number;
  initialDistance: number;
}

/** Metres, seconds, kilograms. A one-way catch supplies the constraint force at rest.
 * Positive velocity is freely driven by gravity and drag. Answers are impulses only. */
export class MiniPhysics {
  distance: number;
  velocity: number;
  time = 0;
  acceleration = 0;
  stops = 0;
  uninterrupted = 0;
  bestRun = 0;
  peakSpeed = 0;
  readonly options: MiniPhysicsOptions;
  private accumulator = 0;
  crashed = false;
  jumps = 0;
  lastJumpDistance = 0;
  bestJump = 0;
  flight?: { section: MiniSection; position: THREE.Vector3; velocity: THREE.Vector3; startX: number; missed?: boolean };
  private traces: { start: number; end: number; points: { distance: number; frame: RailFrame }[] }[] = [];
  private launched = new Set<number>();

  private airFrame(): RailFrame {
    const flight = this.flight!;
    const tangent = flight.velocity.clone().normalize();
    const right = new THREE.Vector3(0, 0, 1);
    const up = right.clone().cross(tangent).normalize();
    return {
      position: flight.position.clone(), tangent, right, up,
      rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, tangent.clone().negate())),
      curvature: new THREE.Vector3(), airborne: true,
    };
  }
  /** Followers traverse the same ballistic arc with their normal spacing. */
  sample(distance: number): RailFrame {
    const trace = this.traces.find(t => distance >= t.start && distance <= t.end);
    if (!trace) return this.track.sample(distance);
    const points = trace.points;
    let a = 0, b = points.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (points[m].distance <= distance) a = m; else b = m; }
    const f = points[a].frame, g = points[b].frame;
    const blend = a === b ? 0 : (distance - points[a].distance) / (points[b].distance - points[a].distance);
    const rotation = f.rotation.clone().slerp(g.rotation, blend);
    return {
      position: f.position.clone().lerp(g.position, blend), rotation,
      tangent: new THREE.Vector3(0, 0, -1).applyQuaternion(rotation),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(rotation),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
      curvature: new THREE.Vector3(), airborne: true,
    };
  }
  private startJump(section: MiniSection) {
    this.launched.add(section.id);
    this.distance = section.takeoff;
    const frame = section.sample(section.takeoff - 0.05);
    frame.position.copy(section.sample(section.takeoff).position);
    this.flight = { section, position: frame.position.clone(), velocity: frame.tangent.clone().multiplyScalar(this.velocity), startX: frame.position.x };
    this.traces.push({ start: this.distance, end: this.distance, points: [{ distance: this.distance, frame: this.airFrame() }] });
  }
  private stepJump(h: number) {
    const flight = this.flight!;
    const previous = flight.position.clone();
    if (previous.x < flight.section.landingX && previous.x + flight.velocity.x * h >= flight.section.landingX) {
      const crossingTime = (flight.section.landingX - previous.x) / flight.velocity.x;
      const crossingHeight = previous.y + flight.velocity.y * crossingTime - 0.5 * this.options.gravity * crossingTime ** 2;
      flight.missed = crossingHeight < flight.section.origin.y;
    }
    flight.position.addScaledVector(flight.velocity, h);
    flight.position.y -= 0.5 * this.options.gravity * h * h;
    flight.velocity.y -= this.options.gravity * h;
    const endX = flight.section.origin.x + flight.section.width;
    this.distance = this.track.distanceAtWorldX?.(flight.position.x, this.distance) ?? (flight.position.x <= endX
      ? flight.section.distanceAtX(flight.position.x)
      : flight.section.end + flight.position.x - endX);
    this.velocity = flight.velocity.length();
    const rail = this.track.sample(this.distance);
    const landed = !flight.missed && (this.track.hasRail?.(this.distance) ?? true)
      && flight.position.x >= flight.section.landingX
      && flight.velocity.y < 0 && flight.position.y <= rail.position.y;
    if (landed) {
      this.lastJumpDistance = flight.position.x - flight.startX;
      this.bestJump = Math.max(this.bestJump, this.lastJumpDistance);
      this.jumps++;
      flight.position.copy(rail.position);
      this.velocity *= 0.94;
    }
    if (!landed && flight.position.y <= 0.4) {
      flight.position.y = 0.4; this.crashed = true; this.velocity = 0;
    }
    const trace = this.traces.at(-1)!;
    trace.end = this.distance;
    trace.points.push({ distance: this.distance, frame: landed ? rail : this.airFrame() });
    if (landed) this.flight = undefined;
  }
  constructor(
    readonly track: MiniRail,
    options: Partial<MiniPhysicsOptions> = {},
  ) {
    this.options = {
      gravity: 9.81,
      mass: 40,
      drag: 0.004,
      rolling: 0.06,
      initialSpeed: MINI_START_SPEED,
      initialDistance: track.startDistance ?? 8,
      ...options,
    };
    this.distance = this.options.initialDistance;
    this.velocity = this.options.initialSpeed;
  }
  get held() {
    return this.velocity === 0;
  }
  impulse(momentum?: number) {
    if (this.crashed) return 0;
    const before = this.velocity;
    this.velocity =
      momentum === undefined
        ? Math.sqrt(this.velocity ** 2 + 2 * MINI_BOOST_ENERGY)
        : this.velocity + momentum / this.options.mass;
    if (this.flight) this.flight.velocity.setLength(this.velocity);
    this.peakSpeed = Math.max(this.peakSpeed, this.velocity);
    return this.velocity - before;
  }
  private force(s: number, v: number) {
    return (
      -this.options.gravity * this.track.slope(s) -
      this.options.drag * v * v -
      this.options.rolling * Math.tanh(v * 5)
    );
  }
  update(dt: number, afterStep?: (dt: number) => boolean | void) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    const h = 1 / 120;
    while (this.accumulator + 1e-10 >= h) {
      this.accumulator -= h;
      if (this.crashed) { if (afterStep?.(h) === false) { this.accumulator = 0; return; } continue; }
      this.time += h;
      if (this.flight) {
        const before = this.distance;
        this.stepJump(h);
        this.peakSpeed = Math.max(this.peakSpeed, this.velocity);
        this.uninterrupted += this.distance - before;
        this.bestRun = Math.max(this.bestRun, this.uninterrupted);
        if (afterStep?.(h) === false) { this.accumulator = 0; return; }
        continue;
      }
      const s = this.distance,
        v = this.velocity,
        a1 = this.force(s, v);
      if (v === 0 && a1 <= 0) {
        this.acceleration = 0;
        if (afterStep?.(h) === false) { this.accumulator = 0; return; }
        continue;
      }
      // Clamp RK stages to nonnegative speed: the safety catch cannot do forward work.
      const v2 = Math.max(0, v + (a1 * h) / 2),
        a2 = this.force(s + (v * h) / 2, v2);
      const v3 = Math.max(0, v + (a2 * h) / 2),
        a3 = this.force(s + (v2 * h) / 2, v3);
      const v4 = Math.max(0, v + a3 * h),
        a4 = this.force(s + v3 * h, v4);
      this.distance += (h / 6) * (v + 2 * v2 + 2 * v3 + v4);
      this.velocity = Math.max(0, v + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4));
      if (this.velocity < 0.05 && a1 <= 0) this.velocity = 0;
      const jump = this.track.jumpAt?.(this.distance);
      if (jump && this.velocity > 0 && !this.launched.has(jump.id)) this.startJump(jump);
      this.traces = this.traces.filter(t => t.end >= this.distance - 200);
      if (jump) for (const id of this.launched) if (id < jump.id - 30) this.launched.delete(id);
      this.acceleration = a1;
      this.uninterrupted += this.distance - s;
      this.bestRun = Math.max(this.bestRun, this.uninterrupted);
      this.peakSpeed = Math.max(this.peakSpeed, this.velocity);
      if (v > 0 && this.velocity === 0) {
        this.stops++;
        this.uninterrupted = 0;
      }
      if (afterStep?.(h) === false) { this.accumulator = 0; return; }
    }
  }
  get energy() {
    return (
      this.options.mass *
      (0.5 * this.velocity ** 2 +
        this.options.gravity * (this.flight?.position.y ?? this.track.height(this.distance)))
    );
  }
}
