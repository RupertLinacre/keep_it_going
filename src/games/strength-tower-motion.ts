/** A reversible bonus ride. A zero climbing speed is a score, never a death. */
export class StrengthTowerMotion {
  phase: 'approach' | 'climb' | 'celebrate' | 'descend' | 'exit' | 'done' = 'approach';
  time = 0;
  height = 0;
  speed: number;
  peak = 0;
  progress = 0;
  banked = 0;
  climbingAnswers = 0;
  constructor(entrySpeed = 26) { this.speed = Math.max(22, Math.min(36, entrySpeed)); }
  answer() {
    if (this.phase === 'approach' || this.phase === 'climb') {
      this.speed += 9 / (1 + this.climbingAnswers * .12);
      this.climbingAnswers++;
    }
    else if (this.phase !== 'done') this.banked = Math.min(18, this.banked + 4);
  }
  update(dt: number) {
    // Small bounded steps keep peak height and direction changes stable at low FPS.
    for (let left = Math.min(.25, Math.max(0, dt)); left > 1e-8;) {
      const step = Math.min(left, 1 / 120); left -= step; this.time += step;
      if (this.phase === 'approach') {
        this.progress = Math.min(1, this.progress + this.speed * step / 48);
        this.speed = Math.min(48, this.speed + 2 * step);
        if (this.progress >= 1) { this.phase = 'climb'; this.time = 0; }
      } else if (this.phase === 'climb') {
        const next = Math.max(0, this.speed - 7.5 * step);
        this.height += (this.speed + next) * .5 * step;
        this.speed = next; this.peak = this.height;
        if (!next) { this.phase = 'celebrate'; this.time = 0; this.speed = 0; }
      } else if (this.phase === 'celebrate' && this.time >= 2.8) {
        this.phase = 'descend'; this.time = 0;
      } else if (this.phase === 'descend') {
        this.speed = Math.min(36, this.speed + 10 * step);
        this.height = Math.max(0, this.height - this.speed * step);
        if (!this.height) { this.phase = 'exit'; this.time = 0; this.progress = 0; }
      } else if (this.phase === 'exit') {
        this.progress = Math.min(1, this.progress + step * .32);
        if (this.progress >= 1) this.phase = 'done';
      }
    }
  }
  get score() { return Math.round(this.peak * 10); }
  get exitSpeed() { return 28 + this.banked; }
}
