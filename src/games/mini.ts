import { BaseGame } from "./base";
import { MiniTrack } from "./mini-track";
import { MiniPhysics } from "./mini-physics";
import { MiniView } from "./mini-view";
import { MiniReadouts } from "./mini-readouts";
import { MiniCarriages } from "./mini-carriages";
import { numberPad } from "./input";
import { multiplication } from "../math";
import { gradient, line, roundRect, circle } from "../draw";
import { record } from "../storage";
import {
  isParcelWagon,
} from "./mini-config";
import type { Host } from "../types";
import { Vector3 } from "three";

export class Mini extends BaseGame {
  readonly track: MiniTrack;
  readonly physics: MiniPhysics;
  readonly carriages: MiniCarriages;
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
  private jumpBonusUntil = 0;
  private readouts?: MiniReadouts;
  constructor(host: Host, seed?: number) {
    super(host);
    this.track = new MiniTrack(seed);
    this.physics = new MiniPhysics(this.track);
    this.carriages = new MiniCarriages(this.track, this.physics.options.gravity);
    this.carriages.sample = distance => this.physics.sample(distance);
    this.next();
    this.hud();
    try {
      this.setup();
    } catch (error) {
      console.warn("WebGL unavailable; using the miniature side view.", error);
    }
  }
  setup() {
    this.readouts = new MiniReadouts(this.host.stage);
    this.view = new MiniView(this.host.stage, this.track);
  }
  get travelled() {
    return this.physics.distance - this.physics.options.initialDistance;
  }
  get cartCount() {
    return this.carriages.coaches.length;
  }
  next() {
    [this.a, this.b] = multiplication(this.host.difficulty);
    this.answer = "";
    this.panel();
  }
  panel() {
    this.host.panel(
      `<div class="prompt"><h2>${this.a} × ${this.b} = <span class="answer-display" role="status">${this.answer || "?"}</span></h2><p class="keyboard-hint">Type your answer · <kbd>Enter</kbd> to boost</p></div><div class="coaster-controls">${numberPad()}<button class="camera-switch" data-action="camera"><span>${this.close ? "Close side view" : "Miniature side view"}</span><kbd>C</kbd></button></div>`,
    );
  }
  hud() {
    this.host.stats([
      { label: "SPEED", value: `${(this.physics.velocity * 3.6).toFixed(0)} km/h` },
      { label: "DISTANCE", value: `${Math.floor(this.travelled)} m` },
      { label: "YOUR TRAIN", value: `${this.cartCount} ${this.cartCount === 1 ? "coach" : "coaches"}` },
      { label: "BEST JUMP", value: this.physics.bestJump ? `${this.physics.bestJump.toFixed(1)} m` : "—" },
    ]);
  }
  action(value: string) {
    if (this.ended) return;
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
        this.lock = 0.18;
        this.next();
      } else {
        this.bad(
          `Try ${this.a} equal groups of ${this.b}. Keep going!`,
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
  private endRide(water: boolean) {
    this.hud();
    if (water) this.carriages.splash(this.physics.sample(this.physics.distance));
    this.host.sound("bad");
    record("mini", this.host.difficulty, this.score);
    this.finish(false, `${water ? "Splash! Build more speed before the water jump." : "The train stopped. Keep solving to keep it going!"} You travelled ${Math.floor(this.travelled)} m${this.physics.bestJump ? ` and jumped ${this.physics.bestJump.toFixed(1)} m` : ""}.`);
  }
  update(dt: number) {
    this.step(dt);
    this.lock -= dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.ended) {
      this.carriages.update(dt, this.physics.distance, 0, false);
      return;
    }
    this.track.ensure(this.physics.distance + this.physics.velocity * dt);
    let shed = false;
    const previousSpills = this.carriages.spilled;
    const previousImpacts = this.carriages.impacts;
    const previousArrivals = this.carriages.arrived;
    const previousJumps = this.physics.jumps;
    this.physics.update(dt, (step) => {
      shed = this.carriages.update(step, this.physics.distance, this.physics.velocity) || shed;
      if (this.physics.crashed || this.physics.held) {
        this.endRide(this.physics.crashed);
        return false;
      }
    });
    if (this.ended) return;
    if (this.physics.jumps > previousJumps) {
      const distance = this.physics.lastJumpDistance;
      const bonus = Math.round(distance * 10);
      this.score += bonus;
      this.jumpBonusUntil = this.elapsed + 4;
      this.host.feedback(`${distance.toFixed(1)} m jump! +${bonus} bonus points`);
      this.host.sound("win");
    } else if (shed) {
      this.host.feedback("The train whipped over that hump! Coaches away!", false);
      this.host.sound("bad");
    } else if (this.carriages.arrived > previousArrivals) {
      this.host.feedback(`A coach caught up! ${this.cartCount} coaches and counting.`);
      this.host.sound("jump");
    } else if (this.carriages.spilled > previousSpills) {
      this.host.feedback("Parcels away! A bigger load is on its way.");
    }
    if (this.carriages.impacts > previousImpacts) this.host.sound("bad");
    if (this.elapsed >= this.hudAt) {
      this.hud();
      this.hudAt = this.elapsed + 0.1;
    }
    if (this.elapsed >= this.recordedAt + 10) {
      record("mini", this.host.difficulty, this.score);
      this.recordedAt = this.elapsed;
    }
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
        this.carriages,
        this.elapsed,
      );
    } else this.fallback(ctx);
    this.readouts?.render({
      held: this.ended,
      incoming: !!this.carriages.incoming,
      jump: this.physics.flight && !this.ended
        ? { distance: this.physics.flight.position.x - this.physics.flight.startX, landed: false }
        : this.elapsed < this.jumpBonusUntil ? { distance: this.physics.lastJumpDistance, landed: true } : undefined,
      correct: this.correct,
      bestRun: this.physics.bestRun,
      feature: this.track.sectionAt(this.physics.distance).kind,
      boost: this.flash > 0 ? Math.round(this.lastImpulse * 3.6) : null,
    });
    this.drawParticles(ctx);
  }
  private fallback(ctx: CanvasRenderingContext2D) {
    gradient(ctx, "#e1eee4", "#f5efd9");
    const frame = this.physics.sample(this.physics.distance);
    const baseScale = this.close ? 28 : 19;
    let scale = baseScale;
    let centerX = frame.position.x + 200 / scale;
    let centerY = Math.max(0, frame.position.y - 10) + 65 / scale;
    const subjects = [
      ...this.carriages.poses(this.physics.distance).filter(p => p.frame.airborne || p.coach === this.carriages.incoming).map(p => p.frame.position),
      ...this.carriages.flights.map(c => c.position),
      ...this.carriages.parcels.map(p => p.position),
      ...this.carriages.explosions.flatMap(e => e.particles.map(p => p.position)),
    ];
    if (subjects.length) {
      const left = Math.min(centerX - 500 / scale, ...subjects.map(p => p.x - 3));
      const right = Math.max(centerX + 500 / scale, ...subjects.map(p => p.x + 3));
      const bottom = Math.min(centerY - 195 / scale, ...subjects.map(p => p.y - 3));
      const top = Math.max(centerY + 195 / scale, ...subjects.map(p => p.y + 3));
      centerX = (left + right) / 2; centerY = (bottom + top) / 2;
      scale = Math.min(scale, 1000 / (right - left), 390 / (top - bottom));
    }
    const project = (x: number, y: number): [number, number] => [
      550 + (x - centerX) * scale,
      300 - (y - centerY) * scale,
    ];
    for (const section of this.track.sections) {
      if (section.kind === "jump") {
        const [x, y] = project(section.origin.x + section.width * 0.2, 0.4);
        roundRect(ctx, x, y, section.width * 0.44 * scale, 18, 4, "#58b9c9");
      }
      let points: [number, number][] = [];
      const drawRail = () => { if (points.length > 1) { line(ctx, points, "#78a296", 8); line(ctx, points, "#f3d68f", 3); } points = []; };
      for (let i = 0; i < section.frames.length; i += 3) {
        if (!section.hasRail(section.start + section.distances[i])) { drawRail(); continue; }
        const f = section.frames[i]; points.push(project(f.position.x, f.position.y));
      }
      drawRail();
    }
    const palette = ["#d7e99b", "#e9a8a7", "#9fbddd", "#c6b0e5", "#eec987"];
    for (const { coach, frame: cart } of this.carriages.poses(this.physics.distance).reverse()) {
      const index = coach.id;
      const [x, y] = project(cart.position.x, cart.position.y);
      if (x < -50 || x > 1150) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.atan2(cart.tangent.y, cart.tangent.x));
      ctx.scale(scale / baseScale, scale / baseScale);
      roundRect(
        ctx,
        -18,
        isParcelWagon(index) ? -14 : -25,
        36,
        isParcelWagon(index) ? 11 : 22,
        4,
        palette[index % palette.length],
        "#779486",
      );
      for (let i = 0; i < coach.cargo; i++) {
        const x = i % 2 ? 2 : -15, y = -27 - Math.floor(i / 2) * 14;
        roundRect(ctx, x, y, 13, 13, 1, "#c89560");
        roundRect(ctx, x + 5, y, 3, 13, 0, "#f9e8b9");
      }
      circle(ctx, -10, 0, 4, "#738779");
      circle(ctx, 10, 0, 4, "#738779");
      ctx.restore();
    }
    for (const cart of this.carriages.flights) {
      const [x, y] = project(cart.position.x, cart.position.y);
      const direction = new Vector3(0, 0, -1).applyQuaternion(cart.rotation);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.atan2(direction.y, direction.x));
      ctx.scale(scale / baseScale, scale / baseScale);
      roundRect(ctx, -18, -25, 36, 22, 4, palette[cart.colorIndex % palette.length], "#779486");
      circle(ctx, -10, 0, 4, "#738779");
      circle(ctx, 10, 0, 4, "#738779");
      ctx.restore();
    }
    for (const parcel of this.carriages.parcels) {
      const [x, y] = project(parcel.position.x, parcel.position.y);
      const size = scale * 0.68;
      ctx.save(); ctx.translate(x, y); ctx.rotate(parcel.age * 2);
      roundRect(ctx, -size / 2, -size / 2, size, size, 1, "#c89560");
      roundRect(ctx, -size / 10, -size / 2, size / 5, size, 0, "#f9e8b9");
      ctx.restore();
    }
    for (const explosion of this.carriages.explosions) {
      if (explosion.age < 0.3 && !explosion.water) {
        const [x, y] = project(explosion.position.x, explosion.position.y);
        circle(ctx, x, y, 2.2 * scale * (1 - explosion.age / 0.3), "#ffe6a6");
      }
      for (const [i, particle] of explosion.particles.entries()) {
        const [x, y] = project(particle.position.x, particle.position.y);
        const size = particle.size * 2 * scale * (1 - explosion.age / 2);
        roundRect(ctx, x - size / 2, y - size / 2, size, size, 1,
          explosion.water ? "#58b9c9" : i % 3 ? palette[explosion.colorIndex % palette.length] : "#ffa451");
      }
    }
  }
  destroy() {
    record("mini", this.host.difficulty, this.score);
    this.readouts?.destroy();
    this.view?.destroy();
  }
}
