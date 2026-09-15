/** Small scenery props respond to gravity without becoming camera subjects.
 * Air resistance and a soft upper limit keep the flight readable beside the ride. */
export class SceneryFlight {
  height = 0;
  velocity = 0;
  angle = 0;
  private reversedFor = 0;
  constructor(readonly phase = 0) {}
  update(dt: number, gravity: number) {
    let remaining = Math.max(0, Math.min(.1, dt));
    while (remaining > 1e-8) {
      const h = Math.min(1/120, remaining); remaining -= h;
      this.reversedFor = gravity < 0 ? this.reversedFor + h : 0;
      if (gravity < 0 && this.reversedFor < (Math.sin(this.phase) + 1) * .18) continue;
      if (gravity >= 0 && this.height === 0 && this.velocity === 0) continue;
      const ceiling = 16 + (Math.sin(this.phase * 2.7) + 1) * 3;
      const acceleration = -gravity - this.velocity * 1.7 - Math.max(0, this.height - ceiling) * 7;
      this.velocity += acceleration * h;
      this.height += this.velocity * h;
      this.angle += h * (.35 + Math.abs(this.velocity) * .035);
      if (this.height < 0) {
        this.height = 0;
        this.velocity = this.velocity < -2 ? -this.velocity * .16 : 0;
      }
    }
  }
}
