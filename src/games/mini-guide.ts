import { MiniPhysics } from "./mini-physics";
import type { MiniTrack } from "./mini-track";

export interface JumpApproach {
  distance: number;
  clearance: number;
  ready: boolean;
}

/** Warn only if coasting would actually stop the train in the next few seconds. */
export function approachingStall(physics: MiniPhysics): boolean {
  if (physics.held || physics.crashed || physics.flight) return false;
  const coast = new MiniPhysics(physics.track, { ...physics.options,
    initialDistance: physics.distance, initialSpeed: physics.velocity });
  for (let i = 0; i < 35; i++) {
    coast.update(0.1);
    if (coast.flight || coast.crashed) return false;
    if (coast.held) return true;
  }
  return false;
}

/** Coasting prediction: include hills and drag before estimating height at the far lip. */
export function jumpApproach(track: MiniTrack, physics: MiniPhysics): JumpApproach | undefined {
  if (physics.flight || physics.crashed || physics.held) return;
  const jump = track.sections.find(section => section.kind === "jump"
    && section.takeoff > physics.distance && section.takeoff - physics.distance <= 75);
  if (!jump) return;
  const { gravity, rolling } = physics.options;
  let speedSquared = physics.velocity ** 2;
  let at = physics.distance;
  let height = track.height(at);
  while (at < jump.takeoff) {
    const step = Math.min(0.25, jump.takeoff - at);
    const nextHeight = track.height(at + step);
    const drag = physics.dragAt(at + step/2);
    const resistance = gravity * (nextHeight - height) / step + rolling;
    const decay = Math.exp(-2 * drag * step);
    speedSquared = drag > 0
      ? speedSquared * decay - resistance * -Math.expm1(-2 * drag * step) / drag
      : speedSquared - 2 * resistance * step;
    if (speedSquared <= 0) return { distance: jump.takeoff - physics.distance, clearance: -99, ready: false };
    at += step;
    height = nextHeight;
  }
  const tangent = jump.launchTangent;
  const launch = jump.origin.clone();
  launch.x += jump.width * 0.2; launch.y += jump.amplitude;
  const speed = Math.sqrt(speedSquared);
  const time = (jump.landingX - launch.x) / (speed * tangent.x);
  const clearance = launch.y + speed * tangent.y * time - gravity * time * time / 2 - jump.origin.y;
  // A little margin avoids calling a barely grazing landing safe.
  return { distance: jump.takeoff - physics.distance, clearance, ready: clearance >= 0.75 };
}
