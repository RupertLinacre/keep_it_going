import test from "node:test";
import assert from "node:assert/strict";
import { HeightTrack } from "../src/games/height-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import { POWER_KINDS, RidePowerups } from "../src/games/ride-powerups.ts";

function course(seed = 42) {
  const track = new HeightTrack(seed, { generative: true });
  track.ensure(track.startDistance, 2000);
  const pool = track.sections.find(s => s.kind === "splash")!;
  assert.ok(pool, "The seeded course contains a flooded track piece");
  return { track, pool };
}

test("flooded sections have continuous rails, dry approaches and shallow submerged centres", () => {
  for (const seed of [1,18,42,73,127,731]) {
    const { pool } = course(seed);
    assert.equal(pool.waterDepth(pool.start), 0);
    assert.equal(pool.waterDepth(pool.end), 0);
    assert.ok(pool.waterDepth((pool.start + pool.end)/2) > .5);
    assert.ok(pool.frames.every(f => f.position.y > 1));
    for (let s = pool.start; s <= pool.end; s += .5) assert.ok(pool.hasRail(s));
    assert.ok(pool.frames[0].tangent.x > .9999);
    assert.ok(pool.frames.at(-1)!.tangent.x > .9999);
    assert.ok(pool.frames[0].position.y === pool.frames.at(-1)!.position.y);
  }
  assert.equal(POWER_KINDS.length, 7);
  assert.ok(!(POWER_KINDS as string[]).includes("splash"));
});

test("water slows a passing train continuously and stops adding drag on exit", () => {
  const { pool } = course();
  const wet = new MiniPhysics(pool, { initialDistance: pool.start, initialSpeed: 32 });
  const dry = new MiniPhysics({ sample: s => pool.sample(s), height: s => pool.height(s), slope: s => pool.slope(s) },
    { initialDistance: pool.start, initialSpeed: 32 });
  const start = wet.velocity;
  wet.update(1/120); dry.update(1/120);
  assert.ok(Math.abs(wet.velocity - start) < .1, "No instantaneous pickup speed penalty");
  for (const p of [wet, dry]) for (let i = 0; i < 2400 && p.distance < pool.end && !p.held; i++) p.update(1/120);
  assert.ok(wet.distance >= pool.end);
  assert.ok(wet.velocity < dry.velocity * .8, "The flooded stretch visibly removes momentum");
  assert.equal(wet.dragAt(pool.end + .1), wet.options.drag);
  assert.equal(wet.crashed, false); assert.equal(wet.jumps, 0);
});

test("a flooded track emits an entry plume and bounded wake without replacing a power-up", () => {
  const { track, pool } = course();
  const physics = new MiniPhysics(track, { initialDistance: pool.start, initialSpeed: 32 });
  const carriages = new MiniCarriages(track), power = new RidePowerups(42, "normal");
  power.activate("ice", physics, carriages);
  let largest = 0, deepest = 0;
  for (let i = 0; i < 900 && physics.distance < pool.end + 30 && !physics.held; i++) {
    power.update(1/120, track, physics, carriages);
    physics.update(1/120, dt => { carriages.update(dt, physics.distance, physics.velocity); });
    largest = Math.max(largest, ...carriages.explosions.map(e => e.particles.length));
    deepest = Math.max(deepest, track.waterDepth(physics.distance));
    assert.ok(carriages.explosions.length <= 6);
  }
  assert.equal(carriages.floodEntries, 1);
  assert.ok(deepest > .5 && largest >= 56, "A double-sided entry burst, followed by smaller wake bursts");
  assert.equal(power.active, "ice");
  assert.ok(physics.distance > pool.end);
  for (let i = 0; i < 400; i++) carriages.update(1/120, pool.end + 40, 0, false);
  assert.equal(carriages.explosions.length, 0, "Spray clears after the train leaves");
});

test("Sky lift raises the railway out of the stationary flood water", () => {
  const { track, pool } = course(), at = (pool.start + pool.end)/2;
  const physics = new MiniPhysics(track), waterLevel = pool.waterLevel;
  assert.ok(physics.dragAt(at) > physics.options.drag);
  track.raise(at); track.advance(1);
  assert.equal(pool.waterLevel, waterLevel);
  assert.equal(track.waterDepth(at), 0);
  assert.equal(physics.dragAt(at), physics.options.drag);
});
