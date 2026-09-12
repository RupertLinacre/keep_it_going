import * as THREE from "three";
import { seededRandom, type RailFrame } from "./mini-rail";
import { clamp } from "../math";
import { MINI_TRAIL_DISTANCE } from "./mini-config";

export type MiniKind =
  "station" | "hill" | "skyhill" | "dip" | "loop" | "corkscrew";
export interface MiniRail {
  sample(distance: number): RailFrame;
  slope(distance: number): number;
  height(distance: number): number;
}
const smooth = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));

/** One immutable, metre-scale piece. Its rail frames are shared by rendering and physics. */
export class MiniSection implements MiniRail {
  readonly frames: RailFrame[] = [];
  readonly distances: number[] = [];
  readonly length: number;
  readonly end: number;
  readonly resolution = 420;
  constructor(
    readonly id: number,
    readonly kind: MiniKind,
    readonly start: number,
    readonly origin: THREE.Vector3,
    readonly width: number,
    readonly amplitude: number,
    readonly shift: number,
    readonly hand: number,
  ) {
    const point = (t: number) => {
      const ease = smooth(t),
        theta = Math.PI * 2 * (kind === "loop" ? t : ease);
      let x = width * t,
        y = 0,
        z = shift * ease;
      if (kind === "hill" || kind === "skyhill" || kind === "dip")
        y = amplitude * Math.sin(Math.PI * t) ** 4;
      if (kind === "loop") {
        x = amplitude * Math.sin(theta) + width * ease;
        y = amplitude * (1 - Math.cos(theta));
      }
      if (kind === "corkscrew") {
        y = amplitude * Math.sin(theta);
        z += hand * amplitude * (1 - Math.cos(theta));
      }
      return origin.clone().add(new THREE.Vector3(x, y, z));
    };
    const matrix = new THREE.Matrix4();
    let length = 0;
    for (let i = 0; i <= this.resolution; i++) {
      const t = i / this.resolution,
        position = point(t);
      const tangent = point(Math.min(1, t + 0.00001))
        .sub(point(Math.max(0, t - 0.00001)))
        .normalize();
      const theta = Math.PI * 2 * (kind === "loop" ? t : smooth(t));
      const up =
        kind === "loop"
          ? new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0)
          : kind === "corkscrew"
            ? new THREE.Vector3(0, Math.cos(theta), hand * Math.sin(theta))
            : new THREE.Vector3(0, 1, 0);
      up.addScaledVector(tangent, -up.dot(tangent)).normalize();
      const right = tangent.clone().cross(up).normalize();
      up.copy(right).cross(tangent).normalize();
      matrix.makeBasis(right, up, tangent.clone().negate());
      if (i) length += position.distanceTo(this.frames[i - 1].position);
      this.distances.push(length);
      this.frames.push({
        position,
        tangent,
        up,
        right,
        rotation: new THREE.Quaternion().setFromRotationMatrix(matrix),
        curvature: new THREE.Vector3(),
      });
    }
    this.length = length;
    this.end = start + length;
    for (let i = 0; i <= this.resolution; i++) {
      const a = Math.max(0, i - 1),
        b = Math.min(this.resolution, i + 1);
      this.frames[i].curvature
        .copy(this.frames[b].tangent)
        .sub(this.frames[a].tangent)
        .divideScalar(this.distances[b] - this.distances[a]);
    }
  }
  private indices(distance: number) {
    const s = clamp(distance - this.start, 0, this.length);
    let a = 0,
      b = this.resolution;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (this.distances[m] <= s) a = m;
      else b = m;
    }
    return {
      a,
      b,
      blend: (s - this.distances[a]) / (this.distances[b] - this.distances[a]),
    };
  }
  height(distance: number) {
    const { a, b, blend } = this.indices(distance);
    return THREE.MathUtils.lerp(
      this.frames[a].position.y,
      this.frames[b].position.y,
      blend,
    );
  }
  slope(distance: number) {
    const { a, b } = this.indices(distance);
    return (
      (this.frames[b].position.y - this.frames[a].position.y) /
      (this.distances[b] - this.distances[a])
    );
  }
  sample(distance: number): RailFrame {
    const { a, b, blend } = this.indices(distance),
      f = this.frames[a],
      g = this.frames[b];
    const rotation = f.rotation.clone().slerp(g.rotation, blend);
    return {
      position: f.position.clone().lerp(g.position, blend),
      rotation,
      tangent: new THREE.Vector3(0, 0, -1).applyQuaternion(rotation),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(rotation),
      curvature: f.curvature.clone().lerp(g.curvature, blend),
    };
  }
}

/** A sliding window of generated track. No finish, lap reset or cumulative descent. */
export class MiniTrack implements MiniRail {
  readonly sections: MiniSection[] = [];
  readonly seed: number;
  generated = 0;
  private random: () => number;
  private bag: MiniKind[] = [];
  constructor(seed = Math.floor(Math.random() * 0xffffffff)) {
    this.seed = seed >>> 0;
    this.random = seededRandom(this.seed);
    // A flat lead-in lets newly earned trailing carts sit on real rail even
    // if a player answers very quickly near the launch point.
    this.sections.push(
      new MiniSection(
        -1,
        "station",
        -MINI_TRAIL_DISTANCE,
        new THREE.Vector3(-MINI_TRAIL_DISTANCE, 4, 0),
        MINI_TRAIL_DISTANCE,
        0,
        0,
        1,
      ),
    );
    this.append("station");
    this.append("hill");
    this.append("loop");
    this.append("skyhill");
    this.append("corkscrew");
    this.append("dip");
    this.ensure(8);
  }
  get end() {
    return this.sections.at(-1)!.end;
  }
  private append(kind: MiniKind) {
    const r = (min: number, max: number) => min + this.random() * (max - min);
    const previous = this.sections.at(-1),
      origin = previous
        ? previous.frames.at(-1)!.position.clone()
        : new THREE.Vector3(0, 4, 0);
    let width = r(20, 28),
      amplitude = kind === "dip" ? -r(1.7, 2.5) : r(5, 10);
    const hand =
      origin.z > 1 ? -1 : origin.z < -1 ? 1 : this.random() > 0.5 ? 1 : -1;
    let shift = clamp(origin.z + r(-2.5, 2.5), -3.5, 3.5) - origin.z;
    if (kind === "station") {
      width = 12;
      amplitude = 0;
      shift = 0;
    }
    if (kind === "loop") {
      amplitude = r(4.5, 6.5);
      width = amplitude * r(0.7, 0.9);
      shift = hand * 2.2;
    }
    if (kind === "corkscrew") {
      amplitude = r(2.2, 2.8);
      width = r(23, 29);
    }
    if (kind === "skyhill") {
      amplitude = r(17, 23);
      width = r(48, 62);
    }
    this.sections.push(
      new MiniSection(
        this.generated++,
        kind,
        previous?.end ?? 0,
        origin,
        width,
        amplitude,
        shift,
        hand,
      ),
    );
  }
  ensure(distance: number) {
    while (this.end < distance + 230) {
      if (!this.bag.length) {
        this.bag = ["hill", "skyhill", "dip", "loop", "corkscrew"];
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      this.append(this.bag.pop()!);
    }
    while (
      this.sections.length > 2 &&
      this.sections[0].end < distance - MINI_TRAIL_DISTANCE
    )
      this.sections.shift();
  }
  sectionAt(distance: number) {
    return (
      this.sections.find((s) => distance <= s.end) ?? this.sections.at(-1)!
    );
  }
  sample(distance: number) {
    return this.sectionAt(distance).sample(distance);
  }
  slope(distance: number) {
    return this.sectionAt(distance).slope(distance);
  }
  height(distance: number) {
    return this.sectionAt(distance).height(distance);
  }
}

export class MiniRailCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    readonly section: MiniSection,
    readonly offset: number,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const f = this.section.sample(this.section.start + t * this.section.length);
    return target
      .copy(f.position)
      .sub(this.section.origin)
      .addScaledVector(f.right, this.offset);
  }
}
