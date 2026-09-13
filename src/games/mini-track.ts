import { adventureAt } from "./adventure-worlds";
import * as THREE from "three";
import { seededRandom, type RailFrame } from "./mini-rail";
import { clamp } from "../math";
import { MINI_TRAIL_DISTANCE } from "./mini-config";
import { specialElement, type SpecialKind } from "./mini-elements";
import { rideProgress, RECOVERY, CHALLENGES } from "./mini-progression";

export type MiniKind =
  "station" | "firsthill" | "hill" | "skyhill" | "dip" | "loop" | "corkscrew" | "helix"
  | "mountainpass" | "tunnel" | "lanternrun" | "pumpkinhop"
  | "triplehelix" | "invertedhill" | "verticalhill" | "jump" | "splash" | SpecialKind;
export const isHump = (kind: MiniKind) =>
  ["mountainpass", "lanternrun", "pumpkinhop", "firsthill", "hill", "skyhill", "invertedhill", "verticalhill", "tophat", "doubledip", "waveturn"].includes(kind);
export interface MiniRail {
  metric?(distance: number): number;
  readonly startDistance?: number;
  jumpAt?(distance: number): MiniSection | undefined;
  hasRail?(distance: number): boolean;
  distanceAtWorldX?(x: number, after: number): number;
  sample(distance: number): RailFrame;
  slope(distance: number): number;
  height(distance: number): number;
  waterDepth?(distance: number): number;
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
  revision = 0;
  launchLiftSlope = 0;
  readonly frames: RailFrame[] = [];
  readonly distances: number[] = [];
  readonly length: number;
  readonly end: number;
  readonly resolution: number;
  readonly runout: number;
  get span() { return this.width + this.runout; }
  constructor(
    readonly id: number,
    readonly kind: MiniKind,
    readonly start: number,
    readonly origin: THREE.Vector3,
    readonly width: number,
    readonly amplitude: number,
    readonly shift: number,
    readonly hand: number,
    readonly turns = kind === "triplehelix" ? 3 : 1,
  ) {
    this.runout = 0;
    const special = specialElement(kind, width, amplitude, hand, turns);
    this.resolution = Math.min(16384, Math.max(kind === "triplehelix" ? 1260 : kind === "verticalhill" ? 600 : special ? 840 : 420,
      kind === "ascendinghelix" ? turns * 420 : 0, Math.ceil((this.span + Math.abs(amplitude) * turns) * 5)));
    const point = (t: number) => {
      if (special) return special.point(t).add(new THREE.Vector3(0, 0, shift * smooth(t))).add(origin);
      const ease = smooth(t),
        theta = Math.PI * 2 * (kind === "loop" ? t : ease);
      let x = this.span * t,
        y = 0,
        z = shift * ease;
      if (kind === "firsthill" || kind === "hill" || kind === "skyhill" || kind === "invertedhill" || kind === "dip")
        y = amplitude * Math.sin(Math.PI * t) ** 4;
      if (kind === "mountainpass") {
        y = amplitude * Math.sin(Math.PI * t) ** 2;
        z += hand * width * .1 * Math.sin(Math.PI * t) ** 2 * Math.sin(2 * Math.PI * t);
      }
      if (kind === "tunnel") y = -amplitude * Math.sin(Math.PI * t) ** 4;
      if (kind === "lanternrun" || kind === "pumpkinhop") {
        y = amplitude * Math.sin(Math.PI * t) ** 2 * (.62 + .38 * Math.cos((kind === "pumpkinhop" ? 6 : 4) * Math.PI * t));
        z += hand * 3 * Math.sin(Math.PI * t) ** 2 * Math.sin(2 * Math.PI * t);
      }
      if (kind === "splash")
        y = -amplitude * smooth(Math.min(1, t / .24)) * smooth(Math.min(1, (1 - t) / .24));
      if (kind === "jump") {
        // The middle is a virtual distance guide only: neither rails nor sleepers span the water.
        const takeoff = width * 0.2, landing = width * 0.64;
        if (x <= takeoff) y = amplitude * (x / takeoff) ** 2;
        else if (x < landing) y = amplitude * (1 - smooth((x - takeoff) / (landing - takeoff)));
      }
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
      if (special) up.copy(special.up(t, tangent));
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
  distanceAtX(x: number) {
    const t = clamp((x - this.origin.x) / this.span, 0, 1) * this.resolution;
    const i = Math.min(this.resolution - 1, Math.floor(t));
    return this.start + THREE.MathUtils.lerp(this.distances[i], this.distances[i + 1], t - i);
  }
  /** Exact tangent of the quadratic launch ramp, independent of mesh sampling. */
  get launchTangent() {
    const tangent = new THREE.Vector3(1, 10 * this.amplitude / this.width, 0).normalize();
    tangent.y += this.launchLiftSlope;
    return tangent.normalize();
  }
  get takeoff() { return this.distanceAtX(this.origin.x + this.width * 0.2); }
  get landingX() { return this.origin.x + this.width * 0.64; }
  get waterLevel() { return this.origin.y - this.amplitude + .55; }
  waterDepth(distance: number) {
    return this.kind === "splash" && distance >= this.start && distance <= this.end
      ? Math.max(0, this.waterLevel - this.height(distance)) : 0;
  }
  hasRail(distance: number) {
    return this.kind !== "jump" || distance < this.takeoff - 0.02
      || this.sample(distance).position.x >= this.landingX;
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
      ((this.distances[b] - this.distances[a]) * this.metric(distance))
    );
  }
  /** Physical metres per route metre; only a raised track changes this ratio. */
  metric(distance: number) {
    if (!this.revision) return 1;
    const { a, b } = this.indices(distance);
    return this.frames[b].position.distanceTo(this.frames[a].position) / (this.distances[b] - this.distances[a]);
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

/** Shared piece factory for the game and the track gallery. */
export function createMiniSection(kind: MiniKind, start: number, origin: THREE.Vector3,
  generated: number, random: () => number, varied = false): MiniSection {
    const r = (min: number, max: number) => min + random() * (max - min);
    const progress = rideProgress(start);
    // Familiar opening pieces keep their established scale. Later climbs grow
    // taller faster than they grow wider, demanding sustained, timely answers.
    const scale = generated < 11 ? 1 : progress.scale;
    let turns = kind === "triplehelix" ? 3 : 1;
    let width = r(20, 28),
      amplitude = kind === "dip" ? -r(1.7, 2.5) : r(5, 10);
    const hand =
      origin.z > 1 ? -1 : origin.z < -1 ? 1 : random() > 0.5 ? 1 : -1;
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
    if (kind === "jump") {
      width = generated < 11 ? r(60, 64) : r(70, 78);
      amplitude = 3.8;
      shift = 0;
    }
    if (kind === "splash") {
      width = r(66, 88) * Math.min(1.35, 1 + (scale - 1) * .08);
      amplitude = r(2.6, 2.9); shift = 0;
    }
    if (kind === "triplehelix") {
      width = r(48, 55);
      amplitude = r(21, 23);
      shift = 0;
    }
    if (kind === "heartline") { width = r(24, 32); amplitude = 2; }
    if (kind === "zerogstall") { width = r(52, 64); amplitude = r(14, 18); }
    if (kind === "waveturn") { width = r(38, 46); amplitude = r(6, 9); }
    if (kind === "doubledip") { width = r(70, 85); amplitude = r(8, 12); shift = 0; }
    if (kind === "tophat") { width = r(30, 36); amplitude = r(26, 30); shift = 0; }
    if (kind === "immelmann" || kind === "diveloop") { width = r(68, 80); amplitude = r(18, 22); shift = 0; }
    if (kind === "ascendinghelix") { width = r(62, 70); amplitude = r(24, 28); turns = progress.turns; shift = 0; }
    if (kind === "interlockingloops") { amplitude = r(21, 25); width = amplitude * 1.3; shift = 0; }
    if (kind === "noninvertingloop") { amplitude = r(20, 24); width = amplitude * 0.9; shift = 0; }
    if (kind === "cobraroll" || kind === "pretzelknot") { amplitude = r(22, 26); width = amplitude * (kind === "pretzelknot" ? 4.5 : 3.8); shift = 0; }
    if (kind === "nestedloop") { amplitude = r(30, 34); width = amplitude * 0.9; shift = 0; }
    if (!["station", "dip", "heartline", "jump", "splash", "corkscrew"].includes(kind)) {
      const recovery = RECOVERY.includes(kind);
      const growth = recovery ? 1 + (scale - 1) * 0.25 : scale;
      amplitude *= growth * (kind === "ascendinghelix" ? 1 + (turns - 2) * 0.18 : 1);
      // Preserve the proportions of inversions; make hills increasingly steep.
      const round = ["loop", "interlockingloops", "nestedloop", "noninvertingloop", "cobraroll", "pretzelknot"].includes(kind);
      width *= round ? growth : Math.sqrt(growth);
    }
    if (varied) {
      // Keep the clearance/proportions of compound inversions, while allowing
      // much broader silhouettes and hill steepness than the classic course.
      const opening = start < 350 && !RECOVERY.includes(kind) ? .72 : 1;
      const size = r(.76, 1.3) * opening;
      if (kind !== "station" && kind !== "jump" && kind !== "splash") {
        amplitude *= size;
        const round = ["loop", "interlockingloops", "nestedloop", "noninvertingloop", "cobraroll", "pretzelknot", "helix", "ascendinghelix"].includes(kind);
        width *= round ? size : Math.sqrt(size) * r(.95, 1.15);
        if (kind === "verticalhill") amplitude = Math.max(amplitude, width * .58);
      }
      if (kind === "ascendinghelix") turns = Math.min(8, Math.max(2, turns + Math.floor(r(-1, 2))));
      if (kind === "station") width = r(10, 20);
    }
    if (kind === "mountainpass") { width = r(85, 110); amplitude = r(19, 27); shift = 0; }
    if (kind === "tunnel") { width = r(45, 58); amplitude = 1.1; shift = 0; }
    if (kind === "lanternrun") { width = r(62, 78); amplitude = r(5, 8); shift = 0; }
    if (kind === "pumpkinhop") { width = r(70, 90); amplitude = r(7, 10); shift = 0; }
    if (varied) {
      const world = adventureAt(start).world;
      const doubleHeight = ["loop", "nestedloop", "interlockingloops", "noninvertingloop"].includes(kind) ? 2 : 1;
      const shrink = Math.min(1, world.maxHeight / Math.max(1, Math.abs(amplitude) * doubleHeight));
      amplitude *= shrink; width *= shrink;
      turns = Math.min(4, turns);
      if (kind === "verticalhill") amplitude = Math.max(amplitude, width * .58);
    }
    return new MiniSection(generated, kind, start, origin, width, amplitude, shift, hand, turns);
}

/** A sliding window of generated track. No finish, lap reset or cumulative descent. */
export class MiniTrack implements MiniRail {
  readonly sections: MiniSection[] = [];
  readonly seed: number;
  readonly startDistance: number;
  generated = 0;
  private random: () => number;
  private bag: MiniKind[] = [];
  private bags = 0;
  private bagWorld = -1;
  constructor(seed = Math.floor(Math.random() * 0xffffffff), readonly options: { generative?: boolean } = {}) {
    this.seed = seed >>> 0;
    this.random = seededRandom(this.seed);
    // Retain real rail behind the six coaches on the opening hill.
    this.sections.push(
      new MiniSection(
        -2,
        "station",
        -MINI_TRAIL_DISTANCE,
        new THREE.Vector3(-MINI_TRAIL_DISTANCE, 4, 0),
        MINI_TRAIL_DISTANCE,
        0,
        0,
        1,
      ),
    );
    const firstHill = new MiniSection(-1, "firsthill", 0, new THREE.Vector3(0, 4, 0),
      options.generative ? 80 + this.random()*28 : 90, options.generative ? 22 + this.random()*6 : 22, 0, 1);
    this.sections.push(firstHill);
    // Just over the broad crest: a gentle roll immediately gains speed from gravity.
    this.startDistance = firstHill.start + firstHill.length / 2 + 2;
    this.append("station");
    if (options.generative) {
      const gentle: MiniKind[] = ["hill", "dip", "heartline", "corkscrew", "waveturn"];
      this.append(gentle[Math.floor(this.random()*gentle.length)]);
    } else {
      this.append("hill");
      this.append("loop");
      this.append("skyhill");
      this.append("corkscrew");
      this.append("helix");
      this.append("dip");
      this.append("jump");
      this.append("invertedhill");
      this.append("verticalhill");
      this.append("triplehelix");
    }
    this.ensure(this.startDistance);
  }
  get end() {
    return this.sections.at(-1)!.end;
  }
  private append(kind: MiniKind) {
    const previous = this.sections.at(-1);
    this.sections.push(createMiniSection(kind, previous?.end ?? 0,
      previous ? previous.frames.at(-1)!.position.clone() : new THREE.Vector3(0, 4, 0),
      this.generated++, this.random, !!this.options.generative));
  }
  ensure(distance: number, lookahead = 230) {
    while (this.end < distance + lookahead) {
      const adventure = adventureAt(this.end);
      if (this.options.generative && this.bagWorld !== adventure.stage) {
        this.bag = []; this.bagWorld = adventure.stage;
      }
      if (!this.bag.length) {
        const shuffle = (items: readonly MiniKind[]) => {
          const result = [...items];
          for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
          }
          return result;
        };
        const { chapter } = rideProgress(this.end);
        const challenges = shuffle(this.options.generative ? adventure.world.challenges : CHALLENGES[chapter]).slice(0, 6);
        const recovery = shuffle(RECOVERY);
        // A tower or water jump is an occasional event, followed by a breather.
        if (!this.options.generative) {
          if (++this.bags % 2 === 0) challenges[4] = "jump";
          if (this.bags % 2 === 1) challenges[5] = "triplehelix";
        }
        const sequence = challenges.flatMap((kind, i) => [recovery[i % recovery.length], kind]);
        if (this.options.generative && adventure.index > 0) sequence.unshift(adventure.world.challenges[0]);
        this.bag = sequence.reverse();
      }
      this.append(this.bag.pop()!);
      this.prune(distance);
    }
    this.prune(distance);
  }
  private prune(distance: number) {
    while (
      this.sections.length > 2 &&
      this.sections[0].end < distance - MINI_TRAIL_DISTANCE
    )
      this.sections.shift();
  }
  distanceAtWorldX(x: number, after: number) {
    for (const section of this.sections) {
      if (section.end < after) continue;
      for (let i = 1; i < section.frames.length; i++) {
        const a = section.frames[i - 1].position.x, b = section.frames[i].position.x;
        if (b <= a || x < a || x > b) continue;
        const at = section.start + THREE.MathUtils.lerp(section.distances[i - 1], section.distances[i], (x - a) / (b - a));
        if (at >= after) return at;
      }
    }
    const last = this.sections.at(-1)!;
    return Math.max(after, last.end + x - last.frames.at(-1)!.position.x);
  }
  hasRail(distance: number) { return this.sectionAt(distance).hasRail(distance); }
  waterDepth(distance: number) { return this.sectionAt(distance).waterDepth(distance); }
  jumpAt(distance: number) {
    const section = this.sectionAt(distance);
    return section.kind === "jump" && distance >= section.takeoff && distance < section.end
      ? section : undefined;
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
  metric(distance: number) { return this.sectionAt(distance).metric(distance); }
  followerDistance(distance: number, offset: number) { return distance - offset; }
  height(distance: number) {
    return this.sectionAt(distance).height(distance);
  }
}

export class MiniRailCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    readonly section: MiniSection,
    readonly offset: number,
    readonly from = section.start,
    readonly to = section.end,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const f = this.section.sample(this.from + t * (this.to - this.from));
    return target
      .copy(f.position)
      .sub(this.section.origin)
      .addScaledVector(f.right, this.offset);
  }
}
