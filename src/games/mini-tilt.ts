import { Vector3 } from "three";

export const DOWNHILL_TILT = 22 * Math.PI / 180; // Clearly visible board pitch; about 3.7 m/s² on a flat.
const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t*t*t*(t*(t*6-15)+10); };

/** Ease the board in and out without an abrupt change in slope or acceleration. */
export const downhillTilt = (age: number, remaining: number) =>
  DOWNHILL_TILT * ease(age / 1.4) * ease(remaining / 1.4);

/** The simulation stays in board coordinates. Rendering rotates the entire
 * world clockwise, so world-down gravity gains a forward component here. */
export const tiltedGravity = (gravity: number, angle: number) => ({
  x: gravity * Math.sin(angle), down: gravity * Math.cos(angle),
});

export function tiltPoint(point: Vector3, pivot: Vector3, angle: number) {
  const x = point.x - pivot.x, y = point.y - pivot.y;
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Vector3(pivot.x + c*x + s*y, pivot.y - s*x + c*y, point.z);
}
