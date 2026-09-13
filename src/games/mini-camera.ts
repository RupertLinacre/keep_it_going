import * as THREE from "three";
import { clamp } from "../math";

export const MINI_CAMERA_DIRECTION = new THREE.Vector3(8, 17, 38).normalize();
export const MINI_MAX_ZOOM_OUT = 3;
export const MINI_CARGO_ZOOM_OUT = 1.3;
const right = new THREE.Vector3(38, 0, -8).normalize();
const up = MINI_CAMERA_DIRECTION.clone().cross(right).normalize();

/** Show the silhouette of ordinary elements; follow the train up enormous
 * structures instead of shrinking it to a dot, especially on a phone. */
export function coasterFraming(lead: THREE.Vector3, skyline: number, aspect: number, close: boolean, shortStage = false, compact = aspect < 1.1, elevation = 0) {
  const height = (close ? 26 : Math.min(compact ? 48 : 100, Math.max(32, (skyline - elevation) * 1.25 + 10)))
    * (shortStage ? 1.22 : 1);
  const focus = new THREE.Vector3(
    lead.x + (close ? 3 : 9) * clamp(aspect - 1, 0, 1),
    Math.max(4.1, close ? lead.y - 4 : clamp(elevation + (skyline - elevation) * 0.43, lead.y - height * 0.2, lead.y + height * 0.15)),
    lead.z * (compact ? 0.8 : 0.35),
  );
  return { focus, height };
}

/** Fit airborne action without changing the horizon or losing the train. */
export class MiniCameraRig {
  readonly focus = new THREE.Vector3();
  height = 0;
  settled = false;

  update(base: THREE.Vector3, baseHeight: number, aspect: number, subjects: readonly THREE.Vector3[], dt: number, cargo: readonly THREE.Vector3[] = []) {
    const previousHeight = this.height;
    const maxHeight = baseHeight * MINI_MAX_ZOOM_OUT;
    // Preserve the normal train view inside the safe area even if a loose
    // object flies beyond the zoom budget. It can leave the screen.
    const maxPanX = Math.max(0, (maxHeight * 0.84 - baseHeight) * aspect / 2);
    const maxPanY = Math.max(0, (maxHeight * 0.72 - baseHeight) / 2);
    let left = -baseHeight * aspect / 2, rightEdge = -left;
    let bottom = -baseHeight / 2, top = -bottom;
    // Optional action gets only a little extra room, eased in rather than
    // demanding an immediate zoom. The train alone can use the full 3× budget.
    const cargoX = baseHeight * aspect * MINI_CARGO_ZOOM_OUT / 2;
    const cargoY = baseHeight * MINI_CARGO_ZOOM_OUT / 2;
    for (const point of cargo) {
      const offset = point.clone().sub(base), x = offset.dot(right), y = offset.dot(up);
      left = Math.min(left, Math.max(-cargoX, x - 3)); rightEdge = Math.max(rightEdge, Math.min(cargoX, x + 3));
      bottom = Math.min(bottom, Math.max(-cargoY, y - 3)); top = Math.max(top, Math.min(cargoY, y + 3));
    }
    for (const point of subjects) {
      const offset = point.clone().sub(base);
      const x = offset.dot(right), y = offset.dot(up);
      left = Math.min(left, x - 4); rightEdge = Math.max(rightEdge, x + 4);
      bottom = Math.min(bottom, y - 4); top = Math.max(top, y + 4);
    }
    const target = base.clone().addScaledVector(right, clamp((left + rightEdge) / 2, -maxPanX, maxPanX))
      .addScaledVector(up, clamp((bottom + top) / 2, -maxPanY, maxPanY));
    const targetHeight = Math.min(maxHeight, Math.max(baseHeight, (rightEdge - left) / aspect, top - bottom));
    if (!this.height) { this.focus.copy(target); this.height = targetHeight; }
    const motion = 1 - Math.exp(-Math.max(0, dt) * 5);
    this.focus.lerp(target, motion);
    // Apply the pan limit to the current camera too: resizing or switching to
    // close view can shrink the allowed area before the easing catches up.
    const offset = this.focus.clone().sub(base);
    const panX = offset.dot(right), panY = offset.dot(up);
    this.focus.addScaledVector(right, clamp(panX, -maxPanX, maxPanX) - panX)
      .addScaledVector(up, clamp(panY, -maxPanY, maxPanY) - panY);
    this.height += (targetHeight - this.height) * (1 - Math.exp(-Math.max(0, dt) * 2.5));
    // Pan gently, but widen immediately to keep the train clear of the HUD.
    for (const point of subjects.length ? [base, ...subjects] : [base]) {
      const offset = point.clone().sub(this.focus);
      this.height = Math.max(this.height,
        2 * (Math.abs(offset.dot(right)) + 4) / (aspect * 0.84),
        2 * (Math.abs(offset.dot(up)) + 4) / 0.72);
    }
    this.height = Math.min(this.height, maxHeight);
    this.settled = this.focus.distanceTo(target) < 0.01
      && Math.abs(this.height - previousHeight) < 0.01;
    return this;
  }
}
