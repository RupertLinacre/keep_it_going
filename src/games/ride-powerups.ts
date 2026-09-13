import { rideResistance } from "../difficulty";
import type { Difficulty } from "../types";
import { seededRandom } from "./mini-rail";
import type { MiniTrack } from "./mini-track";
import type { MiniPhysics } from "./mini-physics";
import type { MiniCarriages } from "./mini-carriages";

export const POWER_DURATION = 20;
export const POWERUPS = {
  ice: { name: "Ice glide", icon: "❄", color: "#367fab", sky: "#e0f0f6", description: "Less friction. More glide.", instruction: "Snowy rails · resistance reduced by 75%" },
  reverse: { name: "Gravity flip", icon: "↑", color: "#8962c1", sky: "#e9e1f3", description: "Up is the new down.", instruction: "Climbs build speed · loose cargo floats upward" },
  cargo: { name: "Cargo carnival", icon: "▣", color: "#bb7133", sky: "#f6edda", description: "Double cargo. A few surprises.", instruction: "8 boxes per wagon · red TNT bursts when spilled" },
  splash: { name: "Splash zone", icon: "≈", color: "#168aa1", sky: "#dceef0", description: "Make waves. Keep answering.", instruction: "Deep spray slows the train · answer to push through" },
  lift: { name: "Sky lift", icon: "↟", color: "#418b69", sky: "#e4f1d9", description: "Your answers raise the railway.", instruction: "Correct answers lift this section by 30 m" },
  heavy: { name: "Heavy metal", icon: "↓", color: "#b46c45", sky: "#efe4db", description: "Bigger drops. Heavier climbs.", instruction: "1.65× gravity · save momentum for climbs" },
  wind: { name: "Tailwind", icon: "»", color: "#427f81", sky: "#e0eee9", description: "The wind is on your side.", instruction: "A steady push carries you along the rails" },
} as const;
export type PowerKind = keyof typeof POWERUPS;
export const POWER_KINDS = Object.keys(POWERUPS) as PowerKind[];
export type PowerGate = { kind: PowerKind; distance: number; id: number };

/** Separate RNG from track/question generation: scene timing never changes the
 * power order. One timed effect at a time; physics derives from the base difficulty. */
export class RidePowerups {
  active?: PowerKind;
  remaining = 0;
  age = 0;
  gate?: PowerGate;
  collected = 0;
  private cooldown = 0;
  private bag: PowerKind[] = [];
  private random: () => number;
  private last?: PowerKind;
  private sprayAt = 0;
  constructor(readonly seed: number, readonly difficulty: Difficulty) {
    this.random = seededRandom(seed ^ 0x70a3e12b);
  }
  private nextKind() {
    if (!this.bag.length) {
      this.bag = [...POWER_KINDS];
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
      if (track.hasRail(at) && Math.abs(track.slope(at)) < .6) break;
    }
    this.gate = { kind: this.nextKind(), distance: at, id: this.collected };
  }
  activate(kind: PowerKind, physics: MiniPhysics, carriages: MiniCarriages) {
    this.active = kind; this.last = kind; this.remaining = POWER_DURATION; this.age = 0;
    this.gate = undefined; this.collected++; this.sprayAt = 0;
    this.apply(physics, carriages);
    if (kind === "splash") {
      physics.velocity *= .84;
      carriages.splash(physics.sample(physics.distance), 1.8);
      this.sprayAt = 1.5;
    }
  }
  apply(physics: MiniPhysics, carriages: MiniCarriages) {
    const base = rideResistance(this.difficulty), kind = this.active;
    physics.options.gravity = kind === "reverse" ? -7.2 : kind === "heavy" ? 9.81*1.65 : 9.81;
    physics.options.drag = base.drag * (kind === "ice" ? .25 : kind === "splash" ? 1.5 : 1);
    physics.options.rolling = base.rolling * (kind === "ice" ? .25 : 1) + (kind === "splash" ? .35 : 0);
    physics.options.tailwind = kind === "wind" ? 3.2 : 0;
    carriages.gravity = physics.options.gravity;
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
    if (!this.active && !this.gate && !this.cooldown) this.placeGate(track, physics.distance);
    if (this.gate && !physics.flight && physics.distance >= this.gate.distance) this.activate(this.gate.kind, physics, carriages);
    if (this.active === "splash" && this.age >= this.sprayAt && !physics.flight) {
      carriages.splash(physics.sample(physics.distance), 1.3); this.sprayAt = this.age + 1.5;
    }
    return before !== this.active;
  }
  finish(physics: MiniPhysics, carriages: MiniCarriages) {
    this.active = undefined; this.remaining = 0; this.gate = undefined; this.apply(physics, carriages);
  }
}
