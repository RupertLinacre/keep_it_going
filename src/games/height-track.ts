import { Matrix4, Quaternion, Vector3 } from "three";
import { MiniTrack, type MiniSection } from "./mini-track";
import type { RailFrame } from "./mini-rail";

export const HEIGHT_PER_ANSWER = 30;
export type Lift = { id: number; start: number; end: number; height: number; target: number; from: number; age: number };
export type HeightState = { since: number; advancing: boolean; lifts: Lift[] };
const smooth = (t: number) => t * t * t * (10 + t * (-15 + t * 6));
const weight = (s: number, lift: Lift) => s < lift.start
  ? smooth(Math.max(0, 1 - (lift.start - s) / 60))
  : s > lift.end ? smooth(Math.max(0, 1 - (s - lift.end) / 60)) : 1;

/** Answers do work by raising the railway, never by changing train speed.
 * Keep the original route coordinate stable while its physical arc length changes.
 * Adjacent sections share the same smooth displacement field, including at joins. */
export class HeightTrack extends MiniTrack {
  readonly lifts: Lift[] = [];
  private bases = new WeakMap<MiniSection, RailFrame[]>();
  private matrix = new Matrix4();
  revision = 0;
  protected override endOrigin(section: MiniSection) {
    return this.bases?.get(section)?.at(-1)?.position.clone() ?? super.endOrigin(section);
  }

  raise(distance: number) {
    this.ensure(distance);
    const section = this.sectionAt(distance);
    let lift = this.lifts.find(l => l.id === section.id);
    if (!lift) {
      // Never turn an upcoming jump's upward takeoff into a downhill ramp.
      // Carry the level lift past the lip, then descend through the open gap.
      const jump = this.sections.find(s => s.kind === "jump" && s.takeoff > section.end && s.takeoff < section.end + 60);
      // Include the entire ten-coach train even just after entering a new piece.
      lift = { id: section.id, start: section.start - 26, end: jump ? jump.takeoff + 2 : section.end, height: 0, target: 0, from: 0, age: 0 };
      this.lifts.push(lift);
    }
    lift.target += HEIGHT_PER_ANSWER;
    lift.from = lift.height; lift.age = 0;
    return HEIGHT_PER_ANSWER;
  }

  elevation(distance: number) { return this.lifts.reduce((y, lift) => y + weight(distance, lift) * lift.height, 0); }
  get moving() { return this.lifts.some(l => l.target !== l.height); }

  snapshot(advancing = true): HeightState {
    return { since: this.sections[0].start, advancing, lifts: this.lifts.map(l => ({ ...l })) };
  }

  /** Apply the other rider's lift animation on their buffered display clock.
   * Preserve older elevations still in our viewport after that rider prunes them. */
  receive(state: HeightState, ahead = 0) {
    const next = state.lifts.map(l => {
      const age = Math.min(1, l.age + (state.advancing ? Math.max(0, ahead) : 0));
      return { ...l, age, height: l.from + (l.target - l.from) * smooth(age) };
    });
    next.push(...this.lifts.filter(l => l.end + 60 < state.since && !next.some(n => n.id === l.id)));
    const changed = [...this.lifts.filter(l => !next.some(n => n.id === l.id)),
      ...next.filter(l => !this.lifts.some(old => old.id === l.id && old.height === l.height))];
    this.lifts.splice(0, this.lifts.length, ...next);
    this.refresh(changed);
  }

  override followerDistance(distance: number, offset: number) {
    // Coach offsets are real metres, even where connecting rail has stretched.
    for (let left = offset; left > 0;) {
      const step = Math.min(2, left);
      const mid = distance - step / this.metric(distance) / 2;
      distance -= step / this.metric(mid); left -= step;
    }
    return distance;
  }

  advance(dt: number) {
    const changed: Lift[] = [];
    for (const lift of this.lifts) {
      if (lift.height === lift.target) continue;
      lift.age = Math.min(1, lift.age + Math.max(0, dt));
      lift.height = lift.from + (lift.target - lift.from) * smooth(lift.age);
      changed.push(lift);
    }
    this.refresh(changed);
  }

  private refresh(changed: Lift[]) {
    if (!changed.length) return;
    this.revision++;
    for (const section of this.sections) {
      if (!changed.some(l => section.end >= l.start - 60 && section.start <= l.end + 60)) continue;
      let base = this.bases.get(section);
      if (!base) {
        base = section.frames.map(f => ({ position: f.position.clone(), tangent: f.tangent.clone(),
          up: f.up.clone(), right: f.right.clone(), rotation: f.rotation.clone(), curvature: f.curvature.clone() }));
        this.bases.set(section, base);
      }
      const frames = section.frames;
      const turn = new Quaternion(), backward = new Vector3();
      for (let i = 0; i < frames.length; i++) {
        frames[i].position.copy(base[i].position);
        frames[i].position.y += this.elevation(section.start + section.distances[i]);
      }
      for (let i = 0; i < frames.length; i++) {
        const s = section.start + section.distances[i];
        const derivative = (this.elevation(s + .01) - this.elevation(s - .01)) / .02;
        const f = frames[i];
        f.tangent.copy(base[i].tangent); f.tangent.y += derivative; f.tangent.normalize();
        // Transport the original bank through the change in slope, preserving inversions.
        turn.setFromUnitVectors(base[i].tangent, f.tangent);
        f.up.copy(base[i].up).applyQuaternion(turn);
        f.right.crossVectors(f.tangent, f.up).normalize();
        f.up.crossVectors(f.right, f.tangent).normalize();
        f.rotation.setFromRotationMatrix(this.matrix.makeBasis(f.right, f.up, backward.copy(f.tangent).negate()));
      }
      for (let i = 0; i < frames.length; i++) {
        const a = frames[Math.max(0, i - 1)], b = frames[Math.min(frames.length - 1, i + 1)];
        frames[i].curvature.copy(b.tangent).sub(a.tangent).divideScalar(Math.max(.00001, b.position.distanceTo(a.position)));
      }
      section.revision++;
      if (section.kind === "jump") section.launchLiftSlope = (this.elevation(section.takeoff + .01) - this.elevation(section.takeoff - .01)) / .02;
    }
    const oldest = this.sections[0].start;
    for (let i = this.lifts.length - 1; i >= 0; i--) if (this.lifts[i].end + 60 < oldest) this.lifts.splice(i, 1);
  }

  override ensure(distance: number, lookahead = 230) {
    // Build beyond the complete current piece before it can move. Otherwise a
    // long lifted piece could later seed the next piece from an elevated end,
    // giving that join the same height twice (origin plus displacement field).
    const end = this.sectionAt(distance).end;
    const generated = this.generated;
    super.ensure(distance, Math.max(lookahead, end - distance + 180));
    // The base constructor calls ensure before our fields are initialised.
    if (!this.lifts) return;
    if (this.generated !== generated) this.refresh(this.lifts);
    const oldest = this.sections[0].start;
    for (let i = this.lifts.length - 1; i >= 0; i--) if (this.lifts[i].end + 60 < oldest) this.lifts.splice(i, 1);
  }
}
