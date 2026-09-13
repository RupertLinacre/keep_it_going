import { Matrix4, Quaternion, Vector3 } from "three";
import type { Mini } from "../games/mini";
import type { MiniTrack } from "../games/mini-track";
import { clamp } from "../math";
import type { Body, Quat, RideState, Vec } from "./protocol";

export function snapshotRide(game: Mini, seq: number): RideState {
  const distance = game.physics.renderDistance;
  return {
    seq, time: game.elapsed, distance: game.physics.distance, speed: game.ended ? 0 : game.physics.velocity,
    correct: game.correct, ended: game.ended,
    bodies: [
      ...game.carriages.poses(distance, game.physics.renderAlpha).map(({ coach, frame }): Body => ({
        id: `coach-${coach.id}`, color: coach.id, cargo: coach.cargo, cargoAge: coach.cargoAge,
        position: frame.position.toArray(), rotation: frame.rotation.toArray(),
      })),
      ...game.carriages.flights.map((cart, i): Body => ({ id: `flight-${game.carriages.lost}-${i}`, color: cart.colorIndex,
        cargo: cart.cargo, cargoAge: 1, position: cart.position.toArray(), rotation: cart.rotation.toArray() })),
    ],
    impacts: game.carriages.explosions.map((e, i) => ({ id: game.carriages.impacts - game.carriages.explosions.length + i,
      position: e.position.toArray(), age: e.age, color: e.colorIndex, water: !!e.water,
      particles: e.particles.map(p => ({ position: p.position.toArray(), size: p.size })) })),
    parcels: game.carriages.parcels.map(p => ({ position: p.position.toArray(), rotation: p.rotation.toArray() })),
    links: game.carriages.links(distance).map(link => ({ start: link.start.toArray(), end: link.end.toArray(), stress: link.stress })),
  };
}

const lerpVec = (a: Vec, b: Vec, t: number): Vec => a.map((n, i) => n + (b[i] - n) * t) as Vec;
const lerpQuat = (a: Quat, b: Quat, t: number): Quat => new Quaternion(...a).slerp(new Quaternion(...b), t).toArray();
/** A short jitter buffer produces display-rate motion from 12 Hz snapshots.
 * Interpolate only: missing packets must never make a stopped train drive away. */
export class OpponentGhost {
  private samples: { at: number; state: RideState }[] = [];
  latest?: RideState;
  push(state: RideState, now = performance.now()) {
    if (this.latest && state.seq <= this.latest.seq) return;
    this.latest = state; this.samples.push({ at: now, state });
    if (this.samples.length > 10) this.samples.shift();
  }
  sample(now = performance.now()): RideState | undefined {
    if (!this.samples.length) return;
    const at = now - 110;
    while (this.samples.length > 2 && this.samples[1].at <= at) this.samples.shift();
    const a = this.samples[0], b = this.samples[1] ?? a;
    const t = b.at > a.at ? clamp((at - a.at) / (b.at - a.at), 0, 1) : 1;
    if (t === 1) return b.state;
    const previous = new Map(a.state.bodies.map(body => [body.id, body]));
    return {
      ...b.state,
      distance: a.state.distance + (b.state.distance - a.state.distance) * t,
      bodies: b.state.bodies.map(body => {
        const old = previous.get(body.id);
        return old ? { ...body, position: lerpVec(old.position, body.position, t), rotation: lerpQuat(old.rotation, body.rotation, t) } : body;
      }),
      links: b.state.links.map((link, i) => {
        const old = a.state.links[i];
        return old ? { ...link, start: lerpVec(old.start, link.start, t), end: lerpVec(old.end, link.end, t) } : link;
      }),
      impacts: b.state.impacts.map(impact => {
        const old = a.state.impacts.find(e => e.id === impact.id);
        return old ? { ...impact, age: old.age + (impact.age - old.age) * t,
          particles: impact.particles.map((p, i) => ({ ...p, position: old.particles[i] ? lerpVec(old.particles[i].position, p.position, t) : p.position })) } : impact;
      }),
      parcels: b.state.parcels.map((p, i) => {
        const old = a.state.parcels[i];
        return old && a.state.parcels.length === b.state.parcels.length
          ? { position: lerpVec(old.position, p.position, t), rotation: lerpQuat(old.rotation, p.rotation, t) } : p;
      }),
    };
  }
}

/** Opposing depth excursions point outwards, with a clear aisle between rails.
 * Choose the offset once per generated window, using the complete rail bounds. */
export function raceLaneOffset(track: MiniTrack) {
  let minZ = 0;
  for (const section of track.sections) for (const frame of section.frames) minZ = Math.min(minZ, frame.position.z);
  return 7 - minZ;
}
export const lanePosition = (point: Vector3, offset: number, opponent = false) =>
  new Vector3(point.x, point.y, (point.z + offset) * (opponent ? -1 : 1));

/** Reflect forward and up, then rebuild a proper right-handed car orientation.
 * This avoids negative instance scales, including at verticals and inversions. */
export function mirrorRotation(rotation: Quaternion) {
  const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
  forward.z *= -1; up.z *= -1;
  const right = forward.clone().cross(up).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, forward.negate()));
}
