import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { WORLD_LAP } from "../src/games/adventure-worlds.ts";
import { createMiniSection, MiniTrack, type MiniSection } from "../src/games/mini-track.ts";

test("generative courses put one strength tower at the first complete boundary after each four-world lap", () => {
  for (const multiplayer of [false, true]) for (const seed of [1, 42, 2026]) {
    const track = new MiniTrack(seed, { generative: true, multiplayer });
    track.ensure(0, WORLD_LAP * 3.5);
    const towers = track.sections.filter(section => section.kind === "strengthtower");
    assert.equal(towers.length, 3);
    towers.forEach((tower, i) => {
      const threshold = (i + 1) * WORLD_LAP;
      const index = track.sections.indexOf(tower);
      const previous = track.sections[index - 1];
      const next = track.sections[index + 1];
      assert.ok(previous.start < threshold, "finish the element which crosses the lap boundary");
      assert.ok(previous.end >= threshold);
      assert.equal(tower.start, previous.end);
      assert.equal(next.start, tower.end);
      assert.equal(tower.width, 100);
      assert.ok(Math.abs(tower.length - 100) < 1e-8);
      assert.ok(tower.frames[0].position.distanceTo(previous.frames.at(-1)!.position) < 1e-8);
      assert.ok(tower.frames.at(-1)!.position.distanceTo(next.frames[0].position) < 1e-8);
      assert.ok(tower.frames[0].tangent.dot(previous.frames.at(-1)!.tangent) > .9999);
      assert.ok(tower.frames.at(-1)!.tangent.dot(next.frames[0].tangent) > .9999);
    });
  }
});

test("tower scheduling is seeded and independent of streamed lookahead or pruning", () => {
  const end = WORLD_LAP * 2.5;
  const complete = new MiniTrack(741, { generative: true });
  complete.ensure(0, end);
  const streamed = new MiniTrack(741, { generative: true });
  const seen = new Map<number, MiniSection>();
  for (let distance = 0; distance <= end; distance += 100) {
    streamed.ensure(distance, 280);
    for (const section of streamed.sections) seen.set(section.id, section);
  }
  const description = (section: MiniSection) => ({
    kind: section.kind, start: section.start, length: section.length,
    width: section.width, amplitude: section.amplitude, origin: section.origin.toArray(),
  });
  for (const section of complete.sections) assert.deepEqual(description(seen.get(section.id)!), description(section));
  assert.equal([...seen.values()].filter(section => section.kind === "strengthtower").length, 2);
  assert.ok(streamed.sections[0].start > WORLD_LAP * 2, "past towers really were pruned");
});

test("tower connectors remain level and tangent even at late difficulty or lateral course offsets", () => {
  for (const multiplayer of [false, true]) {
    const origin = new Vector3(175, 27, -3);
    const tower = createMiniSection("strengthtower", WORLD_LAP * 40, origin, 2000,
      () => { throw new Error("Fixed tower geometry must not consume random course picks"); }, true, multiplayer);
    assert.equal(tower.amplitude, 0);
    assert.equal(tower.shift, 0);
    for (const frame of tower.frames) {
      assert.equal(frame.position.y, origin.y);
      assert.equal(frame.position.z, origin.z);
      assert.ok(frame.tangent.distanceTo(new Vector3(1, 0, 0)) < 1e-8);
      assert.ok(frame.up.distanceTo(new Vector3(0, 1, 0)) < 1e-8);
    }
  }
});

test("classic courses do not introduce strength towers", () => {
  const track = new MiniTrack(42);
  track.ensure(0, WORLD_LAP * 2);
  assert.equal(track.sections.filter(section => section.kind === "strengthtower").length, 0);
});
