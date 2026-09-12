import { Vector3 } from "three";
import { MiniTrack, MiniSection, type MiniKind } from "../src/games/mini-track.ts";

/** Real generated hill geometry with flat approaches to isolate one hill passage. */
export function isolatedHill(kind: MiniKind = "skyhill", seed = 42) {
  const track = new MiniTrack(seed);
  const hill = track.sections.find(section => section.kind === kind)!;
  track.sections.splice(0, track.sections.length,
    new MiniSection(hill.id - 1, "station", hill.start - 100,
      hill.origin.clone().sub(new Vector3(100, 0, 0)), 100, 0, 0, 1),
    hill,
    new MiniSection(hill.id + 1, "station", hill.end,
      hill.frames.at(-1)!.position.clone(), 400, 0, 0, 1));
  return { track, hill };
}
