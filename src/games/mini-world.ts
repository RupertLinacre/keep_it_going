import { Box3, Vector3 } from "three";
import type { MiniSection, MiniTrack } from "./mini-track";
import { towerEntrance, towerExit } from "./strength-tower-rail";

const bounds = new WeakMap<MiniSection, Box3>();
const revisions = new WeakMap<MiniSection, number>();
// The tower's logical connector is flat, while its actual two-way junction
// bends inward by fourteen metres. Reserve its physical rail gauge as well.
const towerFootprint = new Box3().setFromPoints([
  ...towerEntrance.getPoints(160), ...towerExit.getPoints(160),
]).expandByScalar(.8);

/** Ordinary rails bake their lift into vertices; the tower is a rigid scene
 * child anchored to its raised entrance, with its exit warped separately. */
export const sectionAnchorY = (section: MiniSection) =>
  section.kind === "strengthtower" ? section.frames[0].position.y : section.origin.y;

/** Immutable geometry bounds, cached once per section rather than scanned per frame. */
export function sectionBounds(section: MiniSection) {
  let box = bounds.get(section);
  if (!box || revisions.get(section) !== section.revision) {
    box = new Box3();
    for (const frame of section.frames) box.expandByPoint(frame.position);
    if (section.kind === "strengthtower") {
      const entrance = section.frames[0].position, exit = section.frames.at(-1)!.position;
      const actual = towerFootprint.clone().translate(entrance);
      actual.min.y += Math.min(0, exit.y - entrance.y);
      actual.max.y += Math.max(0, exit.y - entrance.y);
      box.union(actual);
    }
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

/** Widen ahead of approaching elements, then gently return as they recede.
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
    this.target = required;
    if (!this.offset) this.offset = this.target;
    else {
      const change = (this.target - this.offset) * (1 - Math.exp(-Math.max(0, dt) * 0.7));
      this.offset += Math.sign(change) * Math.min((change > 0 ? 6 : 2) * Math.max(0, dt), Math.abs(change));
    }
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
