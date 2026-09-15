import { rideResistance } from "../difficulty";
import type { Difficulty } from "../types";
import { seededRandom } from "./mini-rail";
import type { MiniTrack } from "./mini-track";
import type { MiniPhysics } from "./mini-physics";
import type { MiniCarriages } from "./mini-carriages";
import { downhillTilt, tiltedGravity } from "./mini-tilt";

export const POWER_DURATION = 20;
export const POWER_ANSWERS = 4;
export const POWERUPS = {
  ice: { name: "Ice glide", icon: "❄", color: "#367fab", sky: "#e0f0f6", description: "Less friction. More glide.", instruction: "Icicles on board · resistance reduced by 75%" },
  reverse: { name: "Gravity flip", icon: "↑", color: "#8962c1", sky: "#e9e1f3", description: "Up is the new down.", instruction: "2g up on climbs · 1g down on descents" },
  cargo: { name: "Cargo carnival", icon: "▣", color: "#bb7133", sky: "#f6edda", description: "Double cargo. A few surprises.", instruction: "8 boxes per wagon · red TNT bursts when spilled" },
  lift: { name: "Sky lift", icon: "↟", color: "#418b69", sky: "#e4f1d9", description: "Your answers raise the railway.", instruction: "Lift the track · struggling climbs also get a boost" },
  heavy: { name: "Heavy metal", icon: "↓", color: "#b46c45", sky: "#efe4db", description: "Bigger drops. Heavier climbs.", instruction: "1g uphill · 3g downhill" },
  wind: { name: "Tailwind", icon: "»", color: "#427f81", sky: "#e0eee9", description: "The wind is on your side.", instruction: "A steady push carries you along the rails" },
  tilt: { name: "Downhill drift", icon: "↘", color: "#b27f32", sky: "#f2ebd8", description: "The whole board tips downhill.", instruction: "22° downhill tilt · gravity builds your speed" },
} as const;
export type PowerKind = keyof typeof POWERUPS;
export const POWER_KINDS = Object.keys(POWERUPS) as PowerKind[];
export const RACE_POWER_KINDS = ["ice", "reverse", "cargo", "heavy", "wind", "lift"] as const;
export type RacePowerKind = typeof RACE_POWER_KINDS[number];
export const isRacePower = (kind: unknown): kind is RacePowerKind => RACE_POWER_KINDS.includes(kind as RacePowerKind);
export type PowerGate = { kind: PowerKind; distance: number; id: number };
export type PowerVisualState = { seed: number; active?: PowerKind; remaining: number; age: number; gate?: PowerGate };
export type RacePowerState = { active?: RacePowerKind; remaining: number; age: number; collected: number; answers?: number; gate?: { kind: RacePowerKind; distance: number; id: number } };

/** Shared by the local simulation and short opponent prediction. */
export function powerPhysics(kind: PowerKind | undefined, difficulty: Difficulty) {
  const base = rideResistance(difficulty);
  return {
    gravity: kind === "reverse" ? -9.81*2 : kind === "heavy" ? 9.81*3 : 9.81,
    uphillGravity: kind === "reverse" ? -9.81*2 : 9.81,
    downhillGravity: kind === "heavy" ? 9.81*3 : 9.81,
    drag: base.drag * (kind === "ice" ? .25 : 1),
    rolling: base.rolling * (kind === "ice" ? .25 : 1),
    tailwind: kind === "wind" ? 3.2 : 0,
  };
}

/** Separate RNG from track/question generation: scene timing never changes the
 * power order. One timed effect at a time; physics derives from the base difficulty. */
export class RidePowerups {
  active?: PowerKind;
  remaining = 0;
  age = 0;
  gate?: PowerGate;
  collected = 0;
  answers = 0;
  answered() { this.answers = Math.min(POWER_ANSWERS, this.answers + 1); }
  private cooldown = 0;
  private bag: PowerKind[] = [];
  private random: () => number;
  private last?: PowerKind;
  snapshot(): RacePowerState {
    // BinaryPack encodes explicit undefined properties as null. Omit absent
    // fields so strict wire validation sees the same state on the other peer.
    return { ...(isRacePower(this.active) ? { active: this.active } : {}), remaining: this.remaining, age: this.age, collected: this.collected, answers: this.answers,
      ...(this.gate && isRacePower(this.gate.kind) ? { gate: { ...this.gate, kind: this.gate.kind } } : {}) };
  }
  get tilt() { return this.active === "tilt" ? downhillTilt(this.age, this.remaining) : 0; }
  constructor(readonly seed: number, readonly difficulty: Difficulty, readonly multiplayer = false) {
    this.random = seededRandom(seed ^ 0x70a3e12b);
  }
  private nextKind() {
    if (!this.bag.length) {
      this.bag = this.multiplayer ? [...RACE_POWER_KINDS] : [...POWER_KINDS];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random()*(i+1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      if (this.bag.at(-1) === this.last) [this.bag[0], this.bag[this.bag.length-1]] = [this.bag.at(-1)!, this.bag[0]];
    }
    return this.bag.pop()!;
  }
  private placeGate(track: MiniTrack, distance: number) {
    let at = distance + (this.collected ? 28 + this.random()*30 : 65);
    track.ensure(distance, 300);
    for (let i = 0; i < 40; i++, at += 3) {
      if (track.hasRail(at) && track.sectionAt(at).kind !== "splash" && Math.abs(track.slope(at)) < .6) break;
    }
    this.gate = { kind: this.nextKind(), distance: at, id: this.collected };
  }
  activate(kind: PowerKind, physics: MiniPhysics, carriages: MiniCarriages) {
    if (this.multiplayer && !isRacePower(kind)) return;
    this.active = kind; this.last = kind; this.remaining = POWER_DURATION; this.age = 0;
    this.gate = undefined; this.collected++; this.answers = 0;
    this.apply(physics, carriages);
  }
  apply(physics: MiniPhysics, carriages: MiniCarriages) {
    const kind = this.active;
    Object.assign(physics.options, powerPhysics(kind, this.difficulty));
    physics.options.worldTilt = this.tilt;
    const gravity = tiltedGravity(physics.options.gravity, this.tilt);
    carriages.gravity = gravity.down;
    carriages.gravityX = gravity.x;
    carriages.setCargoRush(kind === "cargo");
  }
  update(dt: number, track: MiniTrack, physics: MiniPhysics, carriages: MiniCarriages) {
    const before = this.active;
    if (this.active) {
      this.age += dt;
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining < 1e-8) this.remaining = 0;
      if (!this.remaining) { this.active = undefined; this.cooldown = 3; }
    } else this.cooldown = Math.max(0, this.cooldown - dt);
    this.apply(physics, carriages);
    if (!this.active && !this.gate && !this.cooldown && this.answers >= POWER_ANSWERS) this.placeGate(track, physics.distance);
    if (this.gate && !physics.flight && physics.distance >= this.gate.distance) this.activate(this.gate.kind, physics, carriages);
    return before !== this.active;
  }
  finish(physics: MiniPhysics, carriages: MiniCarriages) {
    this.active = undefined; this.remaining = 0; this.gate = undefined; this.apply(physics, carriages);
  }
}
