import { WORLD_LAP } from "../src/games/adventure-worlds.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { HeightTrack } from "../src/games/height-track.ts";
import { MiniSection, MiniTrack } from "../src/games/mini-track.ts";
import { groundBounds, RaceSpacing, sectionAnchorY, sectionBounds } from "../src/games/mini-world.ts";
import { towerEntrance, towerExit } from "../src/games/strength-tower-rail.ts";

test("multiplayer tower spacing reserves the real junction and keeps the mirrored vertical rails apart", () => {
  for (const z of [-2, 0, 3]) {
    const track = new MiniTrack(42, { generative: true, multiplayer: true });
    const tower = new MiniSection(800, "strengthtower", 500, new Vector3(100, 4, z), 100, 0, 0, 1);
    track.sections.splice(0, track.sections.length, tower);
    const bounds = sectionBounds(tower);
    const spacing = new RaceSpacing().update(track, 1 / 60);
    const earth = groundBounds(track, spacing, tower.origin, 40, 1.6);
    for (const curve of [towerEntrance, towerExit]) for (const p of curve.getPoints(1000)) {
      const center = p.add(tower.origin);
      assert.ok(bounds.containsPoint(center), "virtual flat frames must not hide the curved physical rail bounds");
      for (const side of [-1, 1]) {
        const lane = center.clone(); lane.z = (lane.z + spacing) * side;
        assert.ok(Math.abs(lane.z) >= 9, "both routes retain the central aisle through the mast and junction");
        assert.ok(lane.x >= earth.min.x && lane.x <= earth.max.x && lane.z >= earth.min.z && lane.z <= earth.max.z);
      }
    }
    const mast = tower.origin.z - 14 + spacing;
    assert.ok(mast >= 9);
    assert.ok(2 * mast >= 18, "paired vertical rails never coincide on the centreline");
  }
});

test("each player's tower anchor follows their own raised entrance, with cached bounds refreshed after lifts", () => {
  const players = [1, 2].map(answers => {
    const track = new HeightTrack(42, { generative: true, multiplayer: true });
    track.ensure(0, WORLD_LAP + 600);
    const tower = track.sections.find(s => s.kind === "strengthtower")!;
    const before = sectionBounds(tower).clone();
    for (let i = 0; i < answers; i++) track.raise(tower.start - 1);
    track.advance(1);
    // A seeded course can leave a sub-metre connector before the tower.
    // Its entrance then lies in the smooth end of the preceding lift field.
    assert.ok(Math.abs(sectionAnchorY(tower) - (tower.origin.y + track.elevation(tower.start))) < 1e-8);
    assert.ok(Math.abs(track.elevation(tower.start) - answers * 30) < .01);
    assert.equal(sectionAnchorY(tower), tower.sample(tower.start).position.y);
    assert.ok(sectionBounds(tower).max.y > before.max.y + answers * 30 - 1);
    const ordinary = track.sections.find(s => s.kind !== "strengthtower" && s.revision > 0)!;
    assert.equal(sectionAnchorY(ordinary), ordinary.origin.y, "normal rail vertices already contain their lift");
    return tower;
  });
  assert.ok(Math.abs(sectionAnchorY(players[1]) - sectionAnchorY(players[0]) - 30) < .01,
    "the mirrored tower uses its rider's raised anchor rather than the local or original height");
});
