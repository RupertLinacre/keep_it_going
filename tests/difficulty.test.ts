import test from "node:test";
import assert from "node:assert/strict";
import { DIFFICULTIES, normalizeDifficulty, rideResistance } from "../src/difficulty.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { MiniTrack } from "../src/games/mini-track.ts";
import { parseWire } from "../src/multiplayer/protocol.ts";

test("five levels retain successively less momentum with identical launch and boosts", () => {
  const speeds = DIFFICULTIES.map(level => {
    const track = new MiniTrack(42);
    track.slope = () => 0;
    const physics = new MiniPhysics(track, { ...rideResistance(level), initialSpeed: 25 });
    for (let i = 0; i < 120; i++) physics.update(1 / 60);
    return physics.velocity;
  });
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i-1] > speeds[i]);
  assert.deepEqual(rideResistance("normal"), { drag: .004, rolling: .06 });
  assert.equal(normalizeDifficulty("invalid"), "normal");
});

test("multiplayer requires a valid shared difficulty", () => {
  for (const difficulty of DIFFICULTIES) {
    const round = { id: "test", seed: 42, questionSeed: 9, tables: [7], difficulty };
    assert.ok(parseWire({ kind: "prepare", round }));
    assert.ok(parseWire({ kind: "lobby", name: "Sam", tables: [7], difficulty }));
  }
  assert.equal(parseWire({kind: "prepare", round: { id: "test", seed: 42, questionSeed: 9, tables: [7], difficulty: "impossible" }}), undefined);
});
