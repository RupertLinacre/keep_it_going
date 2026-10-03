import { MathUtils } from 'three';
import type { MiniSection } from './mini-track';
import { carouselCenter } from './world-night';

/** Exact train-following angular displacement, followed by frame-rate-independent
 * drag. Only three scalar values change per frame; replay/scrub starts cleanly. */
export class CarouselMotion {
  readonly first: number;
  readonly last: number;
  angle = 0;
  speed = 0;
  private time: number | undefined;
  private distance = -Infinity;
  private readonly phases: Float64Array;
  private readonly startIndex: number;
  private readonly endIndex: number;
  private readonly centerX: number;
  private readonly centerZ: number;
  private readonly drag = .62;

  constructor(private readonly section: MiniSection) {
    const center=carouselCenter(section);
    this.centerX=section.origin.x+center.x;this.centerZ=section.origin.z+center.z;
    this.startIndex = Math.round(section.resolution * .1);
    this.endIndex = Math.round(section.resolution * .78);
    this.first = section.start + section.distances[this.startIndex];
    this.last = section.start + section.distances[this.endIndex];
    this.phases = new Float64Array(section.frames.length);
    const first=section.frames[this.startIndex].position;
    let previous = Math.atan2(first.x-this.centerX,first.z-this.centerZ), unwrapped = previous;
    this.phases[this.startIndex] = previous;
    for (let i = this.startIndex + 1; i <= this.endIndex; i++) {
      const p=section.frames[i].position,next = Math.atan2(p.x-this.centerX,p.z-this.centerZ);
      unwrapped += Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
      this.phases[i] = unwrapped; previous = next;
    }
  }

  /** Use the sampled rail angle, with the correct turn number at wraparound. */
  private phase(distance: number) {
    const d = MathUtils.clamp(distance, this.first, this.last) - this.section.start;
    let a = this.startIndex, b = this.endIndex;
    while (b - a > 1) { const middle = (a + b) >> 1; if (this.section.distances[middle] <= d) a = middle; else b = middle; }
    const blend=(d-this.section.distances[a])/(this.section.distances[b]-this.section.distances[a]);
    const p=this.section.frames[a].position,q=this.section.frames[b].position;
    const raw = Math.atan2(p.x+(q.x-p.x)*blend-this.centerX,p.z+(q.z-p.z)*blend-this.centerZ), base = this.phases[a];
    return base + Math.atan2(Math.sin(raw - base), Math.cos(raw - base));
  }

  private coast(dt: number) {
    const remaining = Math.exp(-this.drag * dt);
    this.angle += this.speed * (1 - remaining) / this.drag;
    this.speed *= remaining;
    if (Math.abs(this.speed) < .0001) this.speed = 0;
  }

  update(time: number, distance: number, reduced = false) {
    const previousTime = this.time, previousDistance = this.distance;
    const reset = previousTime === undefined || time < previousTime || distance < previousDistance - .01;
    this.time = time; this.distance = distance;
    if (reduced) { this.angle = 0; this.speed = 0; return this.angle; }
    if (reset) { this.angle = distance < this.first ? this.phase(this.first) : this.phase(distance); this.speed = 0; return this.angle; }
    const dt = time - previousTime;
    if (dt <= 0) return this.angle;
    if (distance < this.first) { this.angle = this.phase(this.first); this.speed = 0; return this.angle; }
    if (distance <= this.last) {
      const activeTime = previousDistance < this.first && distance > previousDistance
        ? dt * (distance - this.first) / (distance - previousDistance) : dt;
      this.speed = activeTime > 0 ? (this.phase(distance) - this.phase(previousDistance)) / activeTime : 0;
      this.angle = this.phase(distance);
    } else if (previousDistance <= this.last && previousDistance >= this.first) {
      const insideTime = dt * (this.last - previousDistance) / (distance - previousDistance);
      if (insideTime > 0) this.speed = (this.phase(this.last) - this.phase(previousDistance)) / insideTime;
      this.angle = this.phase(this.last);
      this.coast(dt - insideTime);
    } else this.coast(dt);
    return this.angle;
  }
}
