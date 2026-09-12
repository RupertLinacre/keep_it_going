import type { Game, Host } from "../types";
import { circle } from "../draw";
export abstract class BaseGame implements Game {
  score = 0;
  correct = 0;
  mistakes = 0;
  elapsed = 0;
  combo = 0;
  ended = false;
  particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
  }[] = [];
  constructor(public host: Host) {}
  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;
  abstract action(value: string): void;
  key(_key: string) {}
  step(dt: number) {
    this.elapsed += dt;
    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }
  burst(x: number, y: number, color = "#dbff80") {
    for (let i = 0; i < 23; i++)
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 330,
        vy: (Math.random() - 0.7) * 300,
        life: 0.6 + Math.random() * 0.5,
        color,
      });
  }
  drawParticles(ctx: CanvasRenderingContext2D) {
    this.particles.forEach((p) => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      circle(ctx, p.x, p.y, 3, p.color);
    });
    ctx.globalAlpha = 1;
  }
  good(message: string, points = 100) {
    this.correct++;
    this.combo++;
    this.score += points + Math.min(this.combo - 1, 10) * 10;
    this.host.feedback(message);
    this.host.sound("good");
  }
  bad(message: string) {
    this.mistakes++;
    this.combo = 0;
    this.host.feedback(message, false);
    this.host.sound("bad");
  }
  finish(won: boolean, message: string) {
    if (this.ended) return;
    this.ended = true;
    this.host.finish({
      score: this.score,
      won,
      message,
      correct: this.correct,
      mistakes: this.mistakes,
    });
  }
}
