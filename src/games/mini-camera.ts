import * as THREE from "three";

export const MINI_CAMERA_DIRECTION = new THREE.Vector3(8, 17, 38).normalize();
const right = new THREE.Vector3(38, 0, -8).normalize();
const up = MINI_CAMERA_DIRECTION.clone().cross(right).normalize();

/** Fit airborne action without changing the horizon or losing the train. */
export class MiniCameraRig {
  readonly focus = new THREE.Vector3();
  height = 0;
  settled = false;

  update(base: THREE.Vector3, baseHeight: number, aspect: number, subjects: readonly THREE.Vector3[], dt: number) {
    let left = -baseHeight * aspect / 2, rightEdge = -left;
    let bottom = -baseHeight / 2, top = -bottom;
    for (const point of subjects) {
      const offset = point.clone().sub(base);
      const x = offset.dot(right), y = offset.dot(up);
      left = Math.min(left, x - 4); rightEdge = Math.max(rightEdge, x + 4);
      bottom = Math.min(bottom, y - 4); top = Math.max(top, y + 4);
    }
    const target = base.clone().addScaledVector(right, (left + rightEdge) / 2)
      .addScaledVector(up, (bottom + top) / 2);
    const targetHeight = Math.max(baseHeight, (rightEdge - left) / aspect, top - bottom);
    if (!this.height) { this.focus.copy(target); this.height = targetHeight; }
    const motion = 1 - Math.exp(-Math.max(0, dt) * 5);
    this.focus.lerp(target, motion);
    this.height += (targetHeight - this.height) * (1 - Math.exp(-Math.max(0, dt) * 2.5));
    // Pan gently, but widen immediately to keep flying objects clear of the HUD.
    for (const point of subjects.length ? [base, ...subjects] : [base]) {
      const offset = point.clone().sub(this.focus);
      this.height = Math.max(this.height,
        2 * (Math.abs(offset.dot(right)) + 4) / (aspect * 0.84),
        2 * (Math.abs(offset.dot(up)) + 4) / 0.72);
    }
    this.settled = subjects.length === 0 && this.focus.distanceTo(target) < 0.01
      && Math.abs(this.height - targetHeight) < 0.01;
    return this;
  }
}
