import type { MiniRail } from "./mini-track";
import { MINI_BOOST_ENERGY } from "./mini-config";

export interface MiniPhysicsOptions {
  gravity: number;
  mass: number;
  drag: number;
  rolling: number;
  initialSpeed: number;
  initialDistance: number;
}

/** Metres, seconds, kilograms. A one-way catch supplies the constraint force at rest.
 * Positive velocity is freely driven by gravity and drag. Answers are impulses only. */
export class MiniPhysics {
  distance: number;
  velocity: number;
  time = 0;
  acceleration = 0;
  stops = 0;
  uninterrupted = 0;
  bestRun = 0;
  peakSpeed = 0;
  readonly options: MiniPhysicsOptions;
  private accumulator = 0;
  constructor(
    readonly track: MiniRail,
    options: Partial<MiniPhysicsOptions> = {},
  ) {
    this.options = {
      gravity: 9.81,
      mass: 40,
      drag: 0.004,
      rolling: 0.06,
      initialSpeed: 14,
      initialDistance: 8,
      ...options,
    };
    this.distance = this.options.initialDistance;
    this.velocity = this.options.initialSpeed;
  }
  get held() {
    return this.velocity === 0;
  }
  impulse(momentum?: number) {
    const before = this.velocity;
    this.velocity =
      momentum === undefined
        ? Math.sqrt(this.velocity ** 2 + 2 * MINI_BOOST_ENERGY)
        : this.velocity + momentum / this.options.mass;
    this.peakSpeed = Math.max(this.peakSpeed, this.velocity);
    return this.velocity - before;
  }
  private force(s: number, v: number) {
    return (
      -this.options.gravity * this.track.slope(s) -
      this.options.drag * v * v -
      this.options.rolling * Math.tanh(v * 5)
    );
  }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    const h = 1 / 120;
    while (this.accumulator + 1e-10 >= h) {
      this.accumulator -= h;
      this.time += h;
      const s = this.distance,
        v = this.velocity,
        a1 = this.force(s, v);
      if (v === 0 && a1 <= 0) {
        this.acceleration = 0;
        continue;
      }
      // Clamp RK stages to nonnegative speed: the safety catch cannot do forward work.
      const v2 = Math.max(0, v + (a1 * h) / 2),
        a2 = this.force(s + (v * h) / 2, v2);
      const v3 = Math.max(0, v + (a2 * h) / 2),
        a3 = this.force(s + (v2 * h) / 2, v3);
      const v4 = Math.max(0, v + a3 * h),
        a4 = this.force(s + v3 * h, v4);
      this.distance += (h / 6) * (v + 2 * v2 + 2 * v3 + v4);
      this.velocity = Math.max(0, v + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4));
      this.acceleration = a1;
      this.uninterrupted += this.distance - s;
      this.bestRun = Math.max(this.bestRun, this.uninterrupted);
      this.peakSpeed = Math.max(this.peakSpeed, this.velocity);
      if (v > 0 && this.velocity === 0) {
        this.stops++;
        this.uninterrupted = 0;
      }
    }
  }
  get energy() {
    return (
      this.options.mass *
      (0.5 * this.velocity ** 2 +
        this.options.gravity * this.track.height(this.distance))
    );
  }
}
