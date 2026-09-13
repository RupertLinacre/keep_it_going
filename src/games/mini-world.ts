import { Box3, Vector3 } from "three";
import type { MiniSection, MiniTrack } from "./mini-track";

const bounds = new WeakMap<MiniSection, Box3>();
const revisions = new WeakMap<MiniSection, number>();
/** Immutable geometry bounds, cached once per section rather than scanned per frame. */
export function sectionBounds(section: MiniSection) {
  let box = bounds.get(section);
  if (!box || revisions.get(section) !== section.revision) {
    box = new Box3();
    for (const frame of section.frames) box.expandByPoint(frame.position);
    bounds.set(section, box);
    revisions.set(section, section.revision);
  }
  return box;
}
export function trackBounds(track: MiniTrack) {
  const box = new Box3();
  for (const section of track.sections) box.union(sectionBounds(section));
  // Trees and water banks also need solid ground beneath them.
  box.min.z = Math.min(box.min.z - 4, -12);
  box.max.z = Math.max(box.max.z + 4, 12);
  return box;
}

/** Widen ahead of approaching elements, never snap inward as old rail is pruned.
 * Both tracks share this single offset, including trains, effects and scenery. */
export class RaceSpacing {
  offset = 0;
  private target = 0;
  private time?: number;
  updateAt(track: MiniTrack, time: number) {
    const dt = this.time === undefined ? 0 : Math.max(0, time - this.time);
    this.time = time;
    return this.update(track, dt);
  }
  update(track: MiniTrack, dt: number) {
    const required = Math.max(14, 9 - Math.min(...track.sections.map(s => sectionBounds(s).min.z)));
    this.target = Math.max(this.target, required);
    if (!this.offset) this.offset = this.target;
    else this.offset += Math.min(6 * Math.max(0, dt), (this.target - this.offset) * (1 - Math.exp(-Math.max(0, dt) * 0.7)));
    return this.offset;
  }
}

/** Cover every loaded element in both lanes, plus the camera's nearby ground.
 * A wide margin puts the growing island's edges away from the action. */
export function groundBounds(track: MiniTrack, laneOffset: number, focus: Vector3, height: number, aspect: number) {
  const box = trackBounds(track);
  if (laneOffset) {
    const extent = Math.max(Math.abs(box.min.z + laneOffset), Math.abs(box.max.z + laneOffset));
    box.min.z = -extent; box.max.z = extent;
  }
  const radius = height * Math.max(1, aspect) * .75;
  box.expandByPoint(new Vector3(focus.x - radius, 0, focus.z - height));
  box.expandByPoint(new Vector3(focus.x + radius, 0, focus.z + height));
  box.min.x -= 24; box.max.x += 24;
  box.min.z -= 14; box.max.z += 14;
  return box;
}
