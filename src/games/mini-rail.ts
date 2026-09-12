import type * as THREE from "three";

export interface RailFrame {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  rotation: THREE.Quaternion;
  curvature: THREE.Vector3;
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
