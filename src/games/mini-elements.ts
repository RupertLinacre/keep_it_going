import * as THREE from "three";
import { clamp } from "../math";

export type SpecialKind = "heartline" | "zerogstall" | "waveturn" | "doubledip"
  | "tophat" | "immelmann" | "diveloop" | "ascendinghelix" | "interlockingloops" | "nestedloop";
export const SPECIAL_KINDS: readonly SpecialKind[] = ["heartline", "zerogstall", "waveturn", "doubledip",
  "tophat", "immelmann", "diveloop", "ascendinghelix", "interlockingloops", "nestedloop"];
const TAU = 2 * Math.PI;
const ease = (t: number) => { t = clamp(t, 0, 1); return t * t * t * (10 + t * (-15 + 6 * t)); };
const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
const planarUp = (tangent: THREE.Vector3) => v(-tangent.y, tangent.x).normalize();
export interface ElementShape {
  point(t: number): THREE.Vector3;
  up(t: number, tangent: THREE.Vector3): THREE.Vector3;
}

/** Original metre-scale interpretations of coaster elements. Every complete piece
 * returns to its entry elevation and +X heading, including its connecting curves. */
export function specialElement(kind: string, width: number, height: number, hand: number, turns: number): ElementShape | undefined {
  const banked = (point: ElementShape["point"], roll: (t: number) => number): ElementShape => ({
    point, up: (t, tangent) => v(0, 1).addScaledVector(tangent, -tangent.y).normalize().applyAxisAngle(tangent, hand * roll(t)),
  });
  if (kind === "heartline") {
    // Rotate around a passenger's heart line, one metre above the rail.
    return banked(t => { const a = TAU * ease(t); return v(width * t, 1 - Math.cos(a), -hand * Math.sin(a)); }, t => TAU * ease(t));
  }
  if (kind === "zerogstall") {
    return banked(t => v(width * t, height * ease(Math.min(t, 1 - t) / 0.35)),
      t => Math.PI * (ease(t / 0.3) + ease((t - 0.7) / 0.3)));
  }
  if (kind === "waveturn") {
    return banked(t => v(width * t, height * Math.sin(Math.PI * t) ** 4,
      hand * Math.min(12, width * 0.2) * Math.sin(Math.PI * t) ** 4),
    t => Math.PI * 0.49 * Math.sin(Math.PI * t) ** 4);
  }
  if (kind === "doubledip") {
    // Three decreasing crests: the two dips between them produce a quick rhythm.
    const peaks = [1, 0.7, 0.42];
    return banked(t => {
      const index = Math.min(2, Math.floor(t * 3)), u = t * 3 - index;
      return v(width * t, height * peaks[index] * Math.sin(Math.PI * u) ** 4);
    }, () => 0);
  }
  if (kind === "tophat") {
    // A broad, flat crown between genuinely vertical sides, with quarter-circle transitions.
    const r = width * 0.14, flat = width - 4 * r, straight = height - 2 * r;
    const quarter = Math.PI * r / 2, length = 4 * quarter + 2 * straight + flat;
    return { point(t) {
      let s = t * length;
      if (s <= quarter) return v(r * Math.sin(s / r), r * (1 - Math.cos(s / r)));
      s -= quarter;
      if (s <= straight) return v(r, r + s);
      s -= straight;
      if (s <= quarter) return v(2 * r - r * Math.cos(s / r), height - r + r * Math.sin(s / r));
      s -= quarter;
      if (s <= flat) return v(2 * r + s, height);
      s -= flat;
      if (s <= quarter) return v(2 * r + flat + r * Math.sin(s / r), height - r + r * Math.cos(s / r));
      s -= quarter;
      if (s <= straight) return v(3 * r + flat, height - r - s);
      s -= straight;
      return v(width - r * Math.cos(s / r), r * (1 - Math.sin(s / r)));
    }, up: (_t, tangent) => planarUp(tangent) };
  }
  if (kind === "ascendinghelix") {
    const radius = width * 0.12, lead = width * 0.2, drift = radius * 0.65;
    const coilEnd = 0.78;
    // Almost linear rise keeps clearance between the first and last turns too.
    const rise = (u: number) => {
      const ramp = Math.min(0.06, 0.25 / turns);
      return (u < ramp ? u * u / (2 * ramp) : u > 1 - ramp
        ? 1 - ramp - (1 - u) ** 2 / (2 * ramp) : u - ramp / 2) / (1 - ramp);
    };
    return banked(t => {
      if (t < 0.1) return v(lead * t / 0.1, 0);
      if (t <= coilEnd) {
        const u = (t - 0.1) / (coilEnd - 0.1), a = TAU * turns * u;
        return v(lead + radius * Math.sin(a) + drift * ease(u), height * rise(u), hand * radius * (1 - Math.cos(a)));
      }
      const u = (t - coilEnd) / (1 - coilEnd);
      return v(lead + drift + (width - lead - drift) * u, height * (1 - ease(u)));
    }, t => 0.85 * ease(Math.min(t - 0.1, coilEnd - t) / 0.045));
  }
  if (kind === "nestedloop" || kind === "interlockingloops") {
    const nested = kind === "nestedloop", lead = width * (nested ? 0.28 : 0.15);
    const advance = width * (nested ? 0.35 : 0.6), lane = nested ? 10 : 16;
    return { point(t) {
      if (t < 0.08) return v(lead * t / 0.08, 0);
      if (t > 0.86) {
        const u = (t - 0.86) / 0.14;
        return v(lead + advance + (width - lead - advance) * u, 0, hand * lane * (1 - ease(u)));
      }
      const u = (t - 0.08) / 0.78;
      let x: number, y: number;
      if (nested) {
        const radius = height / 2, small = radius * 0.34;
        if (u < 0.35) { const a = Math.PI * u / 0.35; x = radius * Math.sin(a); y = radius * (1 - Math.cos(a)); }
        else if (u <= 0.65) { const a = TAU * (u - 0.35) / 0.3; x = -small * Math.sin(a); y = height - small * (1 - Math.cos(a)); }
        else { const a = Math.PI + Math.PI * (u - 0.65) / 0.35; x = radius * Math.sin(a); y = radius * (1 - Math.cos(a)); }
        x += advance * ease(u);
      } else {
        const second = u >= 0.5, at = second ? (u - 0.5) * 2 : u * 2;
        const radius = height / 2 * (second ? 0.82 : 1), a = TAU * at;
        x = (second ? advance / 2 : 0) + radius * Math.sin(a) + advance / 2 * ease(at);
        y = radius * (1 - Math.cos(a));
      }
      // Each crossing occupies a different lane. A connecting S-curve returns
      // to the forward corridor after the complete inversion combination.
      return v(lead + x, y, hand * lane * ease(u));
    }, up: (_t, tangent) => planarUp(tangent) };
  }
  if (kind === "immelmann" || kind === "diveloop") {
    // Half loop -> half roll -> banked U-turn -> descending S-curve.
    // The dive-loop interpretation traverses this composition in reverse.
    const r = height / 2, lead = width * 0.32, run = width * 0.18, bend = Math.min(8, r * 0.75);
    const k = 0.5522847498;
    const controls: THREE.Vector3[][] = [
      [v(0, 0), v(lead / 3, 0), v(lead * 2 / 3, 0), v(lead, 0)],
      [v(lead, 0), v(lead + k * r, 0), v(lead + r, r - k * r), v(lead + r, r)],
      [v(lead + r, r), v(lead + r, r + k * r), v(lead + k * r, height), v(lead, height)],
      [v(lead, height), v(lead - run / 3, height), v(lead - run * 2 / 3, height), v(lead - run, height)],
      [v(lead - run, height), v(lead - run - k * bend, height), v(lead - run - bend, height, hand * (bend - k * bend)), v(lead - run - bend, height, hand * bend)],
      [v(lead - run - bend, height, hand * bend), v(lead - run - bend, height, hand * (bend + k * bend)), v(lead - run - k * bend, height, hand * 2 * bend), v(lead - run, height, hand * 2 * bend)],
      [v(lead - run, height, hand * 2 * bend), v(width * 0.6, height, hand * 2 * bend), v(width * 0.65, 0), v(width, 0)],
    ];
    const curves = controls.map(p => new THREE.CubicBezierCurve3(p[0], p[1], p[2], p[3]));
    const slot = (t: number) => { const at = Math.min(6, Math.floor(t * 7)); return { at, u: t * 7 - at }; };
    const point = (t: number) => { const { at, u } = slot(t); return curves[at].getPoint(u); };
    const up = (t: number, tangent: THREE.Vector3) => {
      const { at, u } = slot(t);
      if (at === 1 || at === 2) return planarUp(tangent);
      if (at === 3) return v(0, -1).applyAxisAngle(tangent, hand * Math.PI * ease(u));
      return v(0, 1).addScaledVector(tangent, -tangent.y).normalize()
        .applyAxisAngle(tangent, at === 4 || at === 5 ? hand * 0.6 * Math.sin(Math.PI * (at - 4 + u) / 2) ** 2 : 0);
    };
    return kind === "immelmann" ? { point, up } : {
      point(t) { const p = point(1 - t); p.x = width - p.x; return p; },
      up(t, tangent) { const oldTangent = v(tangent.x, -tangent.y, -tangent.z); const normal = up(1 - t, oldTangent); normal.x *= -1; return normal; },
    };
  }
}
