import test from "node:test";
import assert from "node:assert/strict";
import { HeightTrack, HEIGHT_PER_ANSWER } from "../src/games/height-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { Mini } from "../src/games/mini.ts";
import { bestRide, recordRide } from "../src/storage.ts";
import { sectionBounds } from "../src/games/mini-world.ts";
import type { Host } from "../src/types.ts";

class Headless extends Mini { setup() {} }
const host: Host = { stage: {} as HTMLElement, difficulty: "normal", panel() {}, stats() {}, feedback() {}, sound() {}, finish() {} };

test("height answers lift the occupied section and train without an instant speed impulse", () => {
  const game = new Headless(host, 42, { heightMode: true, tables: [2] });
  const track = game.track as HeightTrack, s = game.physics.distance, section = track.sectionAt(s);
  const initialSpeed = game.physics.velocity;
  const heights = [section.start, s - 22, s, section.end].map(s => track.height(s));
  for (const digit of String(game.a * game.b)) game.key(digit);
  assert.equal(game.physics.velocity, initialSpeed);
  assert.equal(game.correct, 1);
  assert.equal(track.height(s), heights[2], "lift animates instead of teleporting");
  track.advance(.5);
  assert.ok(Math.abs(track.height(s) - heights[2] - HEIGHT_PER_ANSWER/2) < .01);
  track.advance(.5);
  [section.start, s - 22, s, section.end].forEach((at, i) => assert.ok(Math.abs(track.height(at) - heights[i] - HEIGHT_PER_ANSWER) < .01));
  assert.equal(game.physics.velocity, initialSpeed);
  assert.equal(game.cartCount, 6);
});

test("raised joins remain connected, frames remain orthonormal and bounds follow the rail", () => {
  const track = new HeightTrack(18);
  const section = track.sectionAt(track.startDistance), before = sectionBounds(section).max.y;
  track.raise(track.startDistance); track.raise(track.startDistance); track.advance(1);
  assert.ok(sectionBounds(section).max.y > before + 59);
  for (let i = 1; i < track.sections.length; i++) {
    const a = track.sections[i-1].sample(track.sections[i-1].end), b = track.sections[i].sample(track.sections[i].start);
    assert.ok(a.position.distanceTo(b.position) < .001);
    assert.ok(a.tangent.dot(b.tangent) > .995);
  }
  for (const s of track.sections) for (let i = 0; i < s.frames.length; i += 13) {
    const f = s.frames[i];
    assert.ok(Math.abs(f.tangent.length() - 1) < .0001);
    assert.ok(Math.abs(f.tangent.dot(f.up)) < .0001);
    assert.ok(f.position.toArray().every(Number.isFinite));
    assert.ok(s.metric(s.start + s.distances[i]) > 0);
  }
});

test("gravity converts earned height into speed and static raised rail conserves energy", () => {
  const track = new HeightTrack(42);
  track.raise(track.startDistance); track.advance(1);
  const p = new MiniPhysics(track, { drag: 0, rolling: 0 });
  const energy = p.energy;
  while (p.time < 10 && !p.held && !p.crashed) p.update(1/120);
  assert.ok(p.velocity > 15);
  assert.ok(Math.abs(p.energy - energy) / energy < .003, `energy drift ${p.energy - energy}`);
});

test("height records do not overwrite classic ride records", () => {
  const original = bestRide("easy");
  recordRide("easy", 9876, 88, "height");
  assert.deepEqual(bestRide("easy"), original);
  assert.ok(bestRide("easy", "height").distance >= 9876);
});

test("raising the approach preserves an upward water takeoff", () => {
  const track = new HeightTrack(42);
  const dip = track.sections.find(s => s.kind === "dip")!;
  const jump = track.sections.find(s => s.kind === "jump")!;
  const before = jump.launchTangent.clone();
  track.raise(dip.start + 1); track.raise(dip.start + 1); track.advance(1);
  assert.ok(jump.launchTangent.y > 0);
  assert.ok(jump.launchTangent.dot(before) > .999);
  const physics = new MiniPhysics(track, { initialDistance: jump.takeoff - .1, initialSpeed: 25 });
  physics.update(.01);
  assert.ok(physics.flight);
  assert.ok(physics.flight.position.y > jump.origin.y + jump.amplitude + 55);
});

test("stretched connections preserve physical coach spacing", () => {
  const track = new HeightTrack(1);
  track.raise(track.startDistance); track.advance(1);
  const lift = track.lifts[0];
  const head = lift.end + 30, tail = track.followerDistance(head, 2.4);
  let length = 0;
  for (let s = tail; s < head;) {
    const end = Math.min(head, s + .01);
    length += (end - s) * track.metric((s + end) / 2); s = end;
  }
  assert.ok(Math.abs(length - 2.4) < .025, `spacing ${length}`);
});

test("a correct answer in flight saves height until landing without changing airborne speed", () => {
  const game = new Headless(host, 42, { heightMode: true, tables: [2] });
  const jump = game.track.sections.find(s => s.kind === "jump")!;
  game.physics.distance = jump.takeoff - .05; game.physics.velocity = 35;
  game.physics.update(.01);
  assert.ok(game.physics.flight);
  const speed = game.physics.velocity, track = game.track as HeightTrack;
  for (const digit of String(game.a * game.b)) game.key(digit);
  assert.equal(game.physics.velocity, speed);
  assert.equal(track.lifts.length, 0);
  for (let i = 0; i < 600 && game.physics.flight && !game.ended; i++) game.update(1/60);
  assert.equal(game.ended, false);
  assert.equal(game.physics.flight, undefined);
  game.update(1/60);
  assert.equal(track.lifts.length, 1);
});

test("extending the course after lifting a long final piece does not create a height step", () => {
  const track = new HeightTrack(42);
  track.ensure(9000);
  const current = track.sectionAt(9000), index = track.sections.indexOf(current);
  track.sections.splice(index + 1);
  track.raise(current.start + 1); track.advance(1);
  track.ensure(current.end - 1);
  for (let i = 1; i < track.sections.length; i++) {
    const a = track.sections[i-1], b = track.sections[i];
    assert.ok(a.sample(a.end).position.distanceTo(b.sample(b.start).position) < .001, `gap at ${a.id}/${b.id}`);
  }
});
