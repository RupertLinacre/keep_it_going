import { MINI_CART_SPACING } from "../games/mini-config";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Mini } from "../games/mini";
import { sectionBounds } from "../games/mini-world";
import type { MiniTrack } from "../games/mini-track";
import type { Body, RideState } from "./protocol";
import { HeightTrack } from "../games/height-track";

const entityIds = new WeakMap<object, string>();
let nextEntity = 0;
const impactIds = new WeakMap<object, number>();
let nextImpact = 0;
const impactId = (impact: object) => {
  if (!impactIds.has(impact)) impactIds.set(impact, nextImpact++);
  return impactIds.get(impact)!;
};
const entityId = (entity: object, prefix: string) => {
  let id = entityIds.get(entity);
  if (!id) { id = `${prefix}-${nextEntity++}`; entityIds.set(entity, id); }
  return id;
};
export function snapshotRide(game: Mini, seq: number): RideState {
  const distance = game.physics.renderDistance;
  const incoming = game.carriages.incoming;
  const closing = incoming ? Math.min(2 + game.physics.velocity * .7,
    Math.max(0, incoming.offset - game.carriages.coaches.at(-1)!.offset - MINI_CART_SPACING) * 5) : 0;
  return {
    seq, time: game.elapsed, distance: game.physics.distance, speed: game.ended ? 0 : game.physics.velocity,
    correct: game.correct, ended: game.ended,
    ...(game.powerups ? { power: game.powerups.snapshot() } : {}),
    ...(game.track instanceof HeightTrack ? { heights: game.track.snapshot(!game.physics.flight && !game.ended) } : {}),
    bodies: [
      ...game.carriages.poses(distance, game.physics.renderAlpha).map(({ coach, frame }): Body => ({
        id: `coach-${coach.id}`, color: coach.id, cargo: coach.cargo, cargoAge: coach.cargoAge,
        bombs: (coach.dynamite ?? 0) & ((1 << coach.cargo)-1),
        position: frame.position.toArray(), rotation: frame.rotation.toArray(),
        velocity: frame.tangent.clone().multiplyScalar(game.physics.velocity + (coach === incoming ? closing : 0)).add(new Vector3(0, coach.liftVelocity, 0)).toArray(),
        ...(!game.physics.sample(game.track.followerDistance(distance, coach.offset)).airborne ? { rail: {
          distance: game.track.followerDistance(distance, coach.offset), speed: game.physics.velocity + (coach === incoming ? closing : 0),
          lift: coach.previousLift + (coach.lift - coach.previousLift) * game.physics.renderAlpha,
          liftSpeed: coach.liftVelocity, coupled: coach !== game.carriages.incoming,
        } } : {}),
      })),
      ...game.carriages.flights.map((cart): Body => ({ id: entityId(cart, "flight"), color: cart.colorIndex,
        velocity: cart.velocity.toArray(), spin: cart.angularVelocity.toArray(), cargo: cart.cargo, cargoAge: 1, position: cart.position.toArray(), rotation: cart.rotation.toArray() })),
    ],
    impacts: game.carriages.explosions.map(e => ({ id: impactId(e),
      position: e.position.toArray(), age: e.age, color: e.colorIndex, water: !!e.water,
      dynamite: !!e.dynamite, ...(e.flood ? { flood: { rotation: e.flood.rotation.toArray(), strength: e.flood.strength } } : {}),
      particles: e.particles.map(p => ({ position: p.position.toArray(), size: p.size })) })),
    parcels: game.carriages.parcels.map(p => ({ id: entityId(p, "parcel"), dynamite: !!p.dynamite, velocity: p.velocity.toArray(), spin: p.angularVelocity.toArray(), position: p.position.toArray(), rotation: p.rotation.toArray() })),
    links: game.carriages.links(distance).map(link => ({ start: link.start.toArray(), end: link.end.toArray(), stress: link.stress })),
  };
}

/** Opposing depth excursions point outwards, with a clear aisle between rails.
 * Choose the offset once per generated window, using the complete rail bounds. */
export function raceLaneOffset(track: MiniTrack) {
  let minZ = 0;
  for (const section of track.sections) minZ = Math.min(minZ, sectionBounds(section).min.z);
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

export { OpponentGhost } from "./playback";
