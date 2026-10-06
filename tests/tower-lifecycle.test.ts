import { WORLD_LAP } from "../src/games/adventure-worlds";
import test from "node:test";
import assert from "node:assert/strict";
import { Mini } from "../src/games/mini.ts";
import type { Host, Result } from "../src/types.ts";

class Headless extends Mini { setup() {} }
function ride(demo = false) {
  const finishes: Result[] = [];
  const host: Host = { difficulty: "normal", stage: {} as HTMLElement,
    panel() {}, stats() {}, feedback() {}, sound() {}, finish(result) { finishes.push(result); } };
  return { game: new Headless(host, 42, { remixMode: true, towerDemo: demo }), finishes };
}
function answer(game: Mini) { for (const digit of String(game.a * game.b)) game.key(digit); }

test("the playable demo naturally enters the tower and returns to the normal game without a game-over", () => {
  const { game, finishes } = ride(true);
  const seen = new Set<string>();
  let entered = false;
  let lastTower: Mini['tower'];
  for (let frame = 0; frame < 60 * 50; frame++) {
    game.update(1 / 60);
    if (game.tower) { entered = true; lastTower=game.tower; seen.add(game.tower.motion.phase); }
    if (entered && !game.tower) break;
  }
  assert.ok(entered);
  assert.deepEqual([...seen], ["approach", "climb", "celebrate", "descend", "exit"]);
  assert.equal(game.tower, undefined);
  assert.equal(game.ended, false);
  assert.deepEqual(finishes, []);
  assert.ok(game.physics.velocity>0);
  assert.equal(game.physics.velocity,lastTower!.motion.exitSpeed,"normal physics inherits the actual return speed");
  const distance = game.physics.distance;
  for (let frame = 0; frame < 10; frame++) game.update(1 / 60);
  assert.ok(game.physics.distance > distance);
  assert.equal(game.tower, undefined, "the completed tower must not start again");
  assert.equal(game.ended, false);
});

test("entering a real five-world tower at rest suspends normal powers and accepts climb and exit answers", () => {
  const { game, finishes } = ride();
  game.track.ensure(0, WORLD_LAP + 600);
  const section = game.track.sections.find(s => s.kind === "strengthtower")!;
  game.physics.relocate(section.start + .01, 0);
  game.carriages.incoming = { ...game.carriages.coaches.at(-1)!, id: 99, offset: 48 };
  game.powerups!.activate("lift", game.physics, game.carriages);
  game.update(1 / 60);
  assert.ok(game.tower);
  assert.equal(game.carriages.incoming, undefined, "an approaching arrival must not resume on the hidden connector after the tower");
  assert.equal(game.powerups!.active, undefined);
  assert.equal(game.liftingAnswers, false);
  assert.equal(game.ended, false, "a stalled tower entrant gets the bonus instead of game-over");
  const speed = game.tower.motion.speed;
  answer(game);
  assert.ok(game.tower.motion.speed > speed);
  assert.equal(game.correct, 1);
  for (let frame = 0; frame < 2000 && game.tower.motion.phase !== "celebrate"; frame++) game.update(1 / 60);
  assert.equal(game.tower.motion.phase, "celebrate");
  const peak = game.tower.motion.peak;
  answer(game);
  assert.equal(game.correct, 2);
  assert.equal(game.tower.motion.peak, peak);
  assert.equal(game.tower.motion.banked, 4);
  const exitDistance = game.tower.exitDistance;
  const returningTower=game.tower;
  for (let frame = 0; frame < 3000 && game.tower; frame++) game.update(1 / 60);
  assert.equal(game.tower, undefined);
  assert.equal(game.physics.distance, exitDistance);
  assert.equal(game.physics.renderDistance, exitDistance, "exit resets interpolation as well as logical distance");
  assert.equal(game.physics.velocity, returningTower.motion.exitSpeed);
  assert.ok(game.physics.peakSpeed>=game.physics.velocity,"tower speeds count toward the ride's top speed");
  assert.deepEqual(finishes, []);
});

test("a water-jump flight is not interrupted merely because its distance crosses the tower entrance", () => {
  const { game } = ride();
  game.track.ensure(0, WORLD_LAP + 600);
  const section = game.track.sections.find(s => s.kind === "strengthtower")!;
  game.physics.relocate(section.start + 1, 24);
  const frame = game.track.sample(game.physics.distance);
  game.physics.flight = { section, position: frame.position.clone(), velocity: frame.tangent.clone().multiplyScalar(24), startX: frame.position.x };
  game.update(0);
  assert.equal(game.tower, undefined);
  assert.ok(game.physics.flight);
  game.physics.flight = undefined;
  game.update(0);
  assert.ok(game.tower, "once landed, the train may enter the guided attraction");
});
