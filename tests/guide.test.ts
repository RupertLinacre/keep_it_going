import test from "node:test";
import assert from "node:assert/strict";
import { MiniTrack } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { jumpApproach } from "../src/games/mini-guide.ts";

test("jump guidance agrees with the actual coast and landing across generated ramps", () => {
  let safe = 0, unsafe = 0;
  for (const seed of [1, 12, 42, 93]) {
    const track = new MiniTrack(seed), jump = track.sections.find(s => s.kind === "jump")!;
    for (const before of [0.1, 12, 60]) for (const speed of [12, 20, 28, 36]) {
      const physics = new MiniPhysics(track, { initialDistance: jump.takeoff - before, initialSpeed: speed });
      const guidance = jumpApproach(track, physics)!;
      assert.ok(guidance);
      for (let i = 0; i < 2400 && !physics.held && !physics.crashed && !physics.jumps; i++) physics.update(1 / 120);
      if (guidance.ready) {
        safe++;
        assert.equal(physics.jumps, 1, `Seed ${seed}, ${before} m before ramp at ${speed} m/s was marked safe`);
      } else if (guidance.clearance < -0.5) {
        unsafe++;
        assert.equal(physics.jumps, 0, "A predicted shortfall fails to clear the lip");
        assert.ok(physics.crashed || physics.held);
      }
    }
  }
  assert.ok(safe > 10 && unsafe > 10, "Exercise both ready and insufficient-speed predictions");
});

test("jump guidance reacts to a boost without advancing or changing the ride", () => {
  const track = new MiniTrack(42), jump = track.sections.find(s => s.kind === "jump")!;
  const physics = new MiniPhysics(track, { initialDistance: jump.takeoff - 12, initialSpeed: 12 });
  const before = { distance: physics.distance, velocity: physics.velocity, energy: physics.energy, time: physics.time };
  assert.equal(jumpApproach(track, physics)?.ready, false);
  assert.deepEqual({ distance: physics.distance, velocity: physics.velocity, energy: physics.energy, time: physics.time }, before);
  physics.impulse();
  assert.equal(jumpApproach(track, physics)?.ready, true);
  physics.distance = jump.takeoff - 76;
  assert.equal(jumpApproach(track, physics), undefined, "Distant jumps do not obscure the current track feature");
  physics.distance = jump.takeoff - 0.01;
  physics.update(1 / 120);
  assert.ok(physics.flight);
  assert.equal(jumpApproach(track, physics), undefined, "Airtime replaces approach guidance after takeoff");
});
