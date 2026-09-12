import * as THREE from "three";
import { seededRandom, type RailFrame } from "./mini-rail";
import { clamp } from "../math";
import { MINI_TRAIL_DISTANCE } from "./mini-config";

export type MiniKind =
  "station" | "hill" | "skyhill" | "dip" | "loop" | "corkscrew" | "helix"
  | "triplehelix" | "invertedhill" | "verticalhill";
export const isHump = (kind: MiniKind) =>
  ["hill", "skyhill", "invertedhill", "verticalhill"].includes(kind);
export interface MiniRail {
  sample(distance: number): RailFrame;
  slope(distance: number): number;
  height(distance: number): number;
}
const smooth = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));

/** Circular transitions joined to genuinely vertical straight rail. */
function verticalHill(t: number, width: number, height: number) {
  const radius = width / 4;
  const quarter = Math.PI * radius / 2;
  const straight = height - 2 * radius;
  let s = t * (4 * quarter + 2 * straight);
  if (s <= quarter) {
    const angle = s / radius;
    return [radius * Math.sin(angle), radius * (1 - Math.cos(angle))];
  }
  s -= quarter;
  if (s <= straight) return [radius, radius + s];
  s -= straight;
  if (s <= 2 * quarter) {
    const angle = s / radius;
    return [2 * radius - radius * Math.cos(angle), height - radius + radius * Math.sin(angle)];
  }
  s -= 2 * quarter;
  if (s <= straight) return [3 * radius, height - radius - s];
  const angle = (s - straight) / radius;
  return [4 * radius - radius * Math.cos(angle), radius * (1 - Math.sin(angle))];
}

/** One immutable, metre-scale piece. Its rail frames are shared by rendering and physics. */
export class MiniSection implements MiniRail {
  readonly frames: RailFrame[] = [];
  readonly distances: number[] = [];
  readonly length: number;
  readonly end: number;
  readonly resolution: number;
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
    this.resolution = kind === "triplehelix" ? 1260 : kind === "verticalhill" ? 600 : 420;
    const point = (t: number) => {
      const ease = smooth(t),
        theta = Math.PI * 2 * (kind === "loop" ? t : ease);
      let x = width * t,
        y = 0,
        z = shift * ease;
      if (kind === "hill" || kind === "skyhill" || kind === "invertedhill" || kind === "dip")
        y = amplitude * Math.sin(Math.PI * t) ** 4;
      if (kind === "verticalhill") [x, y] = verticalHill(t, width, amplitude);
      if (kind === "loop") {
        x = amplitude * Math.sin(theta) + width * ease;
        y = amplitude * (1 - Math.cos(theta));
      }
      if (kind === "corkscrew") {
        y = amplitude * Math.sin(theta);
        z += hand * amplitude * (1 - Math.cos(theta));
      }
      if (kind === "helix") {
        // A full rising horizontal spiral, followed by a smooth exit ramp.
        // Separate entry/exit elevations keep the crossing rails apart.
        const coil = 0.76;
        const turn = Math.PI * 2 * Math.min(t / coil, 1);
        if (t <= coil) {
          x = amplitude * Math.sin(turn) + width * 0.3 * smooth(t / coil);
          y = amplitude * 1.4 * smooth(t / coil);
          z += hand * amplitude * (1 - Math.cos(turn));
        } else {
          const exit = (t - coil) / (1 - coil);
          x = width * (0.3 + 0.7 * exit);
          y = amplitude * 1.4 * (1 - smooth(exit));
        }
      }
      if (kind === "triplehelix") {
        const radius = width * 0.095;
        const lead = width * 0.68;
        const drift = radius * 0.4;
        if (t < 0.3) {
          x = lead * t / 0.3;
          y = amplitude * smooth(t / 0.3);
        } else if (t <= 0.9) {
          const u = (t - 0.3) / 0.6;
          const turn = 6 * Math.PI * u;
          x = lead + radius * Math.sin(turn) + drift * smooth(u);
          y = amplitude * (1 - smooth(u));
          z += hand * radius * (1 - Math.cos(turn));
        } else {
          x = lead + drift + (width - lead - drift) * (t - 0.9) / 0.1;
        }
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
      if (kind === "helix" && t < 0.76) {
        const turn = Math.PI * 2 * t / 0.76;
        const bank = 0.95 * Math.sin(Math.PI * t / 0.76) ** 2;
        up.set(
          -Math.sin(turn) * Math.sin(bank),
          Math.cos(bank),
          hand * Math.cos(turn) * Math.sin(bank),
        );
      }
      if (kind === "triplehelix" && t >= 0.3 && t <= 0.9) {
        const u = (t - 0.3) / 0.6;
        const turn = 6 * Math.PI * u;
        const bank = 0.95 * smooth(clamp(Math.min(u, 1 - u) / 0.08, 0, 1));
        up.set(-Math.sin(turn) * Math.sin(bank), Math.cos(bank), hand * Math.cos(turn) * Math.sin(bank));
      }
      if (kind === "verticalhill") {
        // A world-up projection collapses on vertical rail; the planar normal doesn't.
        up.set(-tangent.y, tangent.x, 0);
      }
      if (kind === "invertedhill") {
        const roll = Math.PI * smooth(clamp(Math.min(t - 0.06, 0.94 - t) / 0.22, 0, 1));
        up.set(-tangent.y, tangent.x, 0).normalize().applyAxisAngle(tangent, hand * roll);
      }
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
  private bags = 0;
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
    this.append("helix");
    this.append("dip");
    this.append("invertedhill");
    this.append("verticalhill");
    this.append("triplehelix");
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
    if (kind === "helix") {
      amplitude = r(4.1, 4.8);
      width = amplitude * r(4.8, 5.6);
    }
    if (kind === "skyhill" || kind === "invertedhill") {
      amplitude = r(17, 23);
      width = r(48, 62);
    }
    if (kind === "verticalhill") {
      width = r(20, 25);
      amplitude = r(19, 23);
      shift = 0;
    }
    if (kind === "triplehelix") {
      width = r(48, 55);
      amplitude = r(21, 23);
      shift = 0;
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
        this.bag = ["hill", "skyhill", "dip", "loop", "corkscrew", "helix", "invertedhill", "verticalhill"];
        if (++this.bags % 3 === 0) this.bag.push("triplehelix");
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
