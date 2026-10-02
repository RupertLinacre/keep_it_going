/** A small flywheel driven by the train: builds speed under load, then coasts.
 * Per-rider state keeps the two attractions independent without network traffic. */
export class AttractionDrive {
  angle = 0;
  speed = 0;
  private time?: number;
  private distance?: number;
  update(time: number, distance: number, start: number, end: number, reduced = false) {
    const dt = this.time === undefined ? 0 : Math.max(0, Math.min(.1, time - this.time));
    const travel = this.distance === undefined ? 0 : distance - this.distance;
    this.time = time; this.distance = distance;
    if (!dt || reduced) return;
    // Teleports, gallery wraparound and stale network corrections cannot kick it.
    const velocity = travel >= 0 && travel < 20 ? Math.min(80, travel / dt) : 0;
    const entering = Math.max(0, Math.min(1, (distance - start + 8) / 12));
    const leaving = Math.max(0, Math.min(1, (end + 22 - distance) / 22));
    const target = Math.min(2.8, velocity * .065) * entering * leaving;
    const response = target > this.speed ? 3.2 : .65;
    this.speed += (target - this.speed) * (1 - Math.exp(-response * dt));
    this.angle += (.08 + this.speed) * dt;
  }
}
