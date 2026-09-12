import { BaseGame } from "./base";
import { MiniTrack } from "./mini-track";
import { MiniPhysics } from "./mini-physics";
import { MiniView } from "./mini-view";
import { numberPad } from "./input";
import { multiplication } from "../math";
import { gradient, label, line, roundRect, circle } from "../draw";
import { record } from "../storage";
import {
  miniCartCount,
  MINI_ANSWERS_PER_CART,
  MINI_CART_SPACING,
  MINI_VISIBLE_CARTS,
} from "./mini-config";
import type { Host } from "../types";

export class Mini extends BaseGame {
  readonly track: MiniTrack;
  readonly physics: MiniPhysics;
  view?: MiniView;
  a = 3;
  b = 4;
  answer = "";
  lock = 0;
  flash = 0;
  close = false;
  lastImpulse = 0;
  private hudAt = 0;
  private recordedAt = 0;
  private previousStops = 0;
  constructor(host: Host, seed?: number) {
    super(host);
    this.track = new MiniTrack(seed);
    this.physics = new MiniPhysics(this.track);
    this.next();
    this.hud();
    try {
      this.setup();
    } catch (error) {
      console.warn("WebGL unavailable; using the miniature side view.", error);
    }
  }
  setup() {
    this.view = new MiniView(this.host.stage, this.track);
  }
  get travelled() {
    return this.physics.distance - this.physics.options.initialDistance;
  }
  get cartCount() {
    return miniCartCount(this.correct);
  }
  next() {
    [this.a, this.b] = multiplication(this.host.difficulty);
    this.answer = "";
    this.panel();
  }
  panel() {
    this.host.panel(
      `<div class="prompt"><h2>${this.a} × ${this.b} = <span class="answer-display" role="status">${this.answer || "?"}</span></h2></div><div class="coaster-controls">${numberPad()}<button class="camera-switch" data-action="camera"><span>${this.close ? "Close side view" : "Miniature side view"}</span><kbd>C</kbd></button></div>`,
    );
  }
  hud() {
    this.host.stats([
      {
        label: this.physics.held ? "SAFETY CATCH" : "SPEED",
        value: this.physics.held
          ? "Held"
          : `${(this.physics.velocity * 3.6).toFixed(0)} km/h`,
      },
      {
        label: "WITHOUT STOPPING",
        value: `${Math.floor(this.physics.uninterrupted)} m`,
      },
      {
        label: "YOUR TRAIN",
        value: `${this.cartCount} carts`,
      },
      { label: "TOTAL DISTANCE", value: `${Math.floor(this.travelled)} m` },
    ]);
  }
  action(value: string) {
    if (value === "camera") {
      this.close = !this.close;
      this.panel();
      return;
    }
    if (this.lock > 0) return;
    if (/^digit:\d$/.test(value) && this.answer.length < 3)
      this.answer += value.slice(6);
    if (value === "back") this.answer = this.answer.slice(0, -1);
    if (value === "submit" && this.answer) {
      if (Number(this.answer) === this.a * this.b) {
        this.lastImpulse = this.physics.impulse();
        this.flash = 0.5;
        this.good(
          `${this.a} × ${this.b} = ${this.a * this.b}. Big forward boost!`,
        );
        if (this.correct % MINI_ANSWERS_PER_CART === 0) {
          this.host.feedback(
            `New cart! Your train now has ${this.cartCount} carts. Keep rolling!`,
          );
          this.burst(560, 325, "#edca88");
        }
        this.lock = 0.18;
        this.next();
      } else {
        this.bad(
          `Try ${this.a} equal groups of ${this.b}. Your train is still here.`,
        );
        this.answer = "";
        this.lock = 0.2;
      }
    }
    this.panel();
    this.hud();
  }
  key(key: string) {
    if (/^\d$/.test(key)) this.action(`digit:${key}`);
    if (key === "Enter") this.action("submit");
    if (key === "Backspace") this.action("back");
    if (key.toLowerCase() === "c") this.action("camera");
  }
  update(dt: number) {
    this.step(dt);
    this.lock -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.track.ensure(this.physics.distance + this.physics.velocity * dt);
    this.physics.update(dt);
    if (this.physics.stops > this.previousStops) {
      this.previousStops = this.physics.stops;
      this.host.feedback(
        "The safety catch is holding you. Solve a product to push forwards again.",
        false,
      );
    }
    if (this.elapsed >= this.hudAt) {
      this.hud();
      this.hudAt = this.elapsed + 0.1;
    }
    if (this.elapsed >= this.recordedAt + 10) {
      record("mini", this.host.difficulty, this.score);
      this.recordedAt = this.elapsed;
    }
    // Deliberately no finish condition. Stalls are pauses in the journey, never game over.
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.view) {
      ctx.clearRect(0, 0, 1100, 570);
      this.view.render(
        this.physics.distance,
        this.physics.velocity,
        this.flash,
        this.close,
        this.cartCount,
      );
    } else this.fallback(ctx);
    roundRect(ctx, 24, 447, 328, 80, 14, "#fffffff0");
    label(
      ctx,
      this.physics.held
        ? "HELD · SOLVE TO ROLL AGAIN"
        : "KEEP THE LITTLE TRAIN ROLLING",
      42,
      468,
      12,
      "#638c80",
      "left",
    );
    label(
      ctx,
      `${this.correct} boosts · best run ${Math.floor(this.physics.bestRun)} m`,
      42,
      502,
      14,
      "#819285",
      "left",
    );
    const feature = this.track.sectionAt(this.physics.distance).kind;
    roundRect(
      ctx,
      846,
      120,
      230,
      43,
      12,
      this.flash > 0 ? "#edffb9" : "#ffffffdb",
    );
    label(
      ctx,
      this.flash > 0
        ? `+${Math.round(this.lastImpulse * 3.6)} km/h · BOOST`
        : feature === "skyhill"
          ? "SKY-HIGH CLIMB"
          : feature.toUpperCase(),
      961,
      142,
      17,
      "#6c8c71",
    );
    this.drawParticles(ctx);
  }
  private fallback(ctx: CanvasRenderingContext2D) {
    gradient(ctx, "#e1eee4", "#f5efd9");
    const frame = this.track.sample(this.physics.distance),
      scale = this.close ? 28 : 19;
    const project = (x: number, y: number): [number, number] => [
      350 + (x - frame.position.x) * scale,
      365 - (y - Math.max(0, frame.position.y - 10)) * scale,
    ];
    for (const section of this.track.sections) {
      const points = section.frames
        .filter((_, i) => i % 3 === 0)
        .map((f) => project(f.position.x, f.position.y));
      line(ctx, points, "#78a296", 8);
      line(ctx, points, "#f3d68f", 3);
    }
    const palette = ["#d7e99b", "#e9a8a7", "#9fbddd", "#c6b0e5", "#eec987"];
    for (
      let index = Math.min(this.cartCount, MINI_VISIBLE_CARTS) - 1;
      index >= 0;
      index--
    ) {
      const cart = this.track.sample(
        this.physics.distance - index * MINI_CART_SPACING,
      );
      const [x, y] = project(cart.position.x, cart.position.y);
      if (x < -50 || x > 1150) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.atan2(cart.tangent.y, cart.tangent.x));
      roundRect(
        ctx,
        -18,
        -25,
        36,
        22,
        4,
        palette[index % palette.length],
        "#779486",
      );
      circle(ctx, -10, 0, 4, "#738779");
      circle(ctx, 10, 0, 4, "#738779");
      ctx.restore();
    }
    label(ctx, "MINIATURE RAILWAY · 2D FALLBACK", 550, 113, 12, "#8ca397");
  }
  destroy() {
    record("mini", this.host.difficulty, this.score);
    this.view?.destroy();
  }
}
