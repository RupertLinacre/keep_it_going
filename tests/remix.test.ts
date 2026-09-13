import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import { MiniTrack } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import { Mini } from "../src/games/mini.ts";
import { HeightTrack } from "../src/games/height-track.ts";
import { POWER_DURATION, POWER_KINDS, RidePowerups } from "../src/games/ride-powerups.ts";
import { courseSeed } from "../src/games/course-seed.ts";
import { rideResistance } from "../src/difficulty.ts";
import { simulateRemix } from "../scripts/playtest-remix.ts";
import type { Host } from "../src/types.ts";

const rig = (seed = 42) => {
  const track = new HeightTrack(seed, { generative: true }), physics = new MiniPhysics(track);
  const carriages = new MiniCarriages(track), power = new RidePowerups(seed, "normal");
  return { track, physics, carriages, power };
};
class Headless extends Mini { setup() {} }
const host: Host = { stage: {} as HTMLElement, difficulty: "normal", panel() {}, stats() {}, feedback() {}, sound() {}, finish() {} };
const answer = (game: Mini) => { for (const d of String(game.a * game.b)) game.key(d); };

test("remix seeds reproduce courses but different seeds vary the opening and later elements", () => {
  const shape = (seed: number) => {
    const track = new MiniTrack(seed, { generative: true });
    const output: string[] = [], seen = new Set<number>();
    for (let distance = track.startDistance; distance < 5000; distance += 100) {
      track.ensure(distance);
      for (const s of track.sections) if (!seen.has(s.id)) { seen.add(s.id); output.push(`${s.kind}:${s.width}:${s.amplitude}:${s.turns}`); }
    }
    return output;
  };
  assert.deepEqual(shape(123), shape(123));
  assert.notDeepEqual(shape(123).slice(0, 8), shape(456).slice(0, 8));
  assert.ok(new Set(shape(123).map(s => s.split(":")[0])).size >= 15);
  assert.equal(courseSeed("RIVER"), courseSeed("RIVER"));
  assert.equal(courseSeed("0"), 0); assert.equal(courseSeed(""), undefined);
});

test("varied course pieces join and retain finite orthonormal geometry across many seeds", () => {
  for (const seed of [1,18,42,73,127,731]) {
    const track = new MiniTrack(seed, { generative: true });
    for (let distance = 0; distance < 6000; distance += 240) {
      track.ensure(distance);
      for (let i = 1; i < track.sections.length; i++) {
        const a = track.sections[i-1], b = track.sections[i];
        assert.ok(a.frames.at(-1)!.position.distanceTo(b.frames[0].position) < .001);
        assert.ok(a.frames.at(-1)!.tangent.dot(b.frames[0].tangent) > .99);
      }
      for (const s of track.sections) for (let i = 0; i < s.frames.length; i += 47) {
        const f = s.frames[i];
        assert.ok(f.position.toArray().every(Number.isFinite));
        assert.ok(Math.abs(f.up.dot(f.tangent)) < .0001);
        assert.ok(Math.abs(f.tangent.length() - 1) < .0001);
      }
    }
  }
});

test("power-up bags are seeded, include every effect, and never cut another effect short", () => {
  const sequence = (seed: number) => {
    const { track, physics, carriages, power } = rig(seed), kinds: string[] = [];
    for (let i = 0; i < POWER_KINDS.length * 2; i++) {
      power.update(3, track, physics, carriages);
      assert.ok(power.gate);
      const kind = power.gate.kind;
      physics.distance = power.gate.distance;
      power.update(0, track, physics, carriages);
      assert.equal(power.active, kind); assert.equal(power.remaining, POWER_DURATION);
      assert.equal(power.gate, undefined);
      kinds.push(kind);
      power.update(19.9, track, physics, carriages); assert.equal(power.active, kind);
      power.update(.11, track, physics, carriages); assert.equal(power.active, undefined);
    }
    assert.equal(new Set(kinds.slice(0,POWER_KINDS.length)).size, POWER_KINDS.length);
    assert.ok(!kinds.includes("splash"));
    return kinds;
  };
  assert.deepEqual(sequence(42), sequence(42)); assert.notDeepEqual(sequence(42), sequence(18));
});

test("all physics modifiers restore the chosen difficulty exactly when they expire", () => {
  const { track, physics, carriages } = rig(), power = new RidePowerups(42, "hard");
  for (const kind of POWER_KINDS) {
    power.activate(kind, physics, carriages);
    for (let i = 0; i < 10; i++) power.apply(physics, carriages);
    if (kind === "ice") assert.equal(physics.options.drag, rideResistance("hard").drag*.25);
    if (kind === "reverse") assert.ok(physics.options.gravity < 0);
    if (kind === "heavy") assert.equal(physics.options.gravity, 9.81*1.65);
    if (kind === "wind") assert.equal(physics.options.tailwind, 3.2);
    power.update(20, track, physics, carriages);
    assert.equal(physics.options.gravity, 9.81); assert.equal(carriages.gravity, 9.81);
    assert.equal(physics.options.drag, rideResistance("hard").drag);
    assert.equal(physics.options.rolling, rideResistance("hard").rolling);
    assert.equal(physics.options.worldTilt, 0); assert.equal(carriages.gravityX, 0);
    assert.equal(physics.options.tailwind, 0); assert.equal(carriages.cargoRush, false);
  }
});

test("normal remix answers boost; Sky lift raises the rail; expiration restores boosting", () => {
  const game = new Headless(host, 42, { remixMode: true, tables: [2] });
  const track = game.track as HeightTrack;
  answer(game); assert.ok(game.physics.velocity > 20); assert.equal(track.lifts.length, 0);
  game.powerups!.activate("lift", game.physics, game.carriages);
  const speed = game.physics.velocity;
  answer(game); assert.equal(game.physics.velocity, speed); assert.equal(track.lifts.length, 1);
  game.powerups!.update(20, track, game.physics, game.carriages);
  answer(game); assert.ok(game.physics.velocity > speed);
});

test("cargo carnival temporarily doubles slots and dynamite detonates on impact", () => {
  const { power, physics, carriages } = rig();
  power.activate("cargo", physics, carriages);
  assert.equal(carriages.coaches[1].cargo, 8); assert.ok(carriages.coaches[1].dynamite);
  carriages.parcels.push({ position: new Vector3(0,.1,0), velocity: new Vector3(1,-2,0), rotation: new Quaternion(),
    angularVelocity: new Vector3(), age: 0, groundedFor: 0, bounces: 0, dynamite: true, fuse: 2 });
  carriages.update(.02, physics.distance, 0, false);
  assert.equal(carriages.parcels.length, 0); assert.ok(carriages.explosions.some(e => e.dynamite));
  power.finish(physics, carriages);
  assert.ok(carriages.coaches.every(c => c.cargo <= 4));
});

test("loose parcels rise under reversed gravity and fall after it expires", () => {
  const { power, physics, carriages } = rig();
  power.activate("reverse", physics, carriages);
  const parcel = { position: new Vector3(0,5,0), velocity: new Vector3(), rotation: new Quaternion(), angularVelocity: new Vector3(), age: 0, groundedFor: 0, bounces: 0 };
  carriages.parcels.push(parcel); carriages.update(.5, physics.distance, 0, false);
  assert.ok(parcel.position.y > 5); assert.ok(parcel.velocity.y > 0);
  power.finish(physics, carriages); carriages.update(1, physics.distance, 0, false);
  assert.ok(parcel.velocity.y < 0);
});

test("the lead train retains a bounded landing arc through gravity-flip water jumps", () => {
  const track = new MiniTrack(42), jump = track.sections.find(s => s.kind === "jump")!;
  const physics = new MiniPhysics(track, { initialDistance: jump.takeoff - .01, initialSpeed: 30, gravity: -7.2 });
  for (let i = 0; i < 600 && !physics.jumps && !physics.crashed; i++) {
    track.ensure(physics.distance);
    physics.update(1/120);
  }
  assert.equal(physics.crashed, false);
  assert.equal(physics.jumps, 1);
  assert.equal(physics.flight, undefined);
  assert.ok(physics.lastJumpDistance > jump.landingX - (jump.origin.x + jump.width*.2));
  assert.ok(physics.lastJumpDistance < 150);
  assert.equal(physics.options.gravity, -7.2, "Rail-bound gravity still points upward after landing");
});

test("generated rides with power-ups remain finite and reward answering", () => {
  for (const seed of [1,18,42]) {
    const quiet = simulateRemix(seed, 0, 35), playing = simulateRemix(seed, 2, 60);
    assert.ok(playing.finite); assert.ok(playing.metres > quiet.metres);
    assert.ok(playing.carts <= 10); assert.ok(playing.parcels <= 64);
    assert.ok(playing.effects.length >= 1);
  }
});
