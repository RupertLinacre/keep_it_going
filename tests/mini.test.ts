import test from "node:test";
import assert from "node:assert/strict";
import { MiniTrack, type MiniRail } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { Mini } from "../src/games/mini.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import {
  MINI_BOOST_ENERGY,
  miniCartCount,
  MINI_VISIBLE_CARTS,
  MINI_CART_SPACING,
} from "../src/games/mini-config.ts";
import type { Host } from "../src/types.ts";

const slopeRail = (grade: number): MiniRail => ({
  slope: () => grade,
  height: (s) => 4 + grade * s,
  sample: () => {
    throw new Error("Physics only needs the rail's height and slope");
  },
});
function advance(
  physics: { update(dt: number): void },
  seconds: number,
  fps = 60,
) {
  for (let i = 0; i < Math.round(seconds * fps); i++) physics.update(1 / fps);
}
const harness = () => {
  const finishes: unknown[] = [];
  const host: Host = {
    difficulty: "normal",
    stage: {} as HTMLElement,
    panel() {},
    stats() {},
    feedback() {},
    sound() {},
    finish(r) {
      finishes.push(r);
    },
  };
  return { host, finishes };
};
class HeadlessMini extends Mini {
  setup() {}
}
function answer(game: Mini) {
  for (const d of String(game.a * game.b)) game.key(d);
  game.key("Enter");
}

test("mini gravity agrees with analytical downhill acceleration", () => {
  const p = new MiniPhysics(slopeRail(-0.5), {
    initialSpeed: 0,
    initialDistance: 0,
    drag: 0,
    rolling: 0,
  });
  advance(p, 2);
  assert.ok(Math.abs(p.velocity - 9.81) < 1e-8);
  assert.ok(Math.abs(p.distance - 9.81) < 1e-8);
});
test("the safety catch stops an uphill train at the physical stopping point and never reverses", () => {
  const p = new MiniPhysics(slopeRail(0.5), {
    initialSpeed: 5,
    initialDistance: 0,
    drag: 0,
    rolling: 0,
  });
  let previous = 0;
  for (let i = 0; i < 600; i++) {
    p.update(1 / 60);
    assert.ok(p.distance >= previous);
    assert.ok(p.velocity >= 0);
    previous = p.distance;
  }
  assert.equal(p.velocity, 0);
  assert.equal(p.stops, 1);
  assert.ok(Math.abs(p.distance - 25 / 9.81) < 0.001);
  const stoppedAt = p.distance;
  advance(p, 60);
  assert.equal(p.distance, stoppedAt);
  assert.equal(p.uninterrupted, 0);
  assert.ok(p.bestRun > 2.5);
  p.impulse();
  assert.equal(p.velocity, Math.sqrt(2 * MINI_BOOST_ENERGY));
  advance(p, 0.2);
  assert.ok(p.distance > stoppedAt);
});
test("answers add momentum once, with no lingering motor force or minimum speed", () => {
  const p = new MiniPhysics(slopeRail(0), {
    initialSpeed: 0,
    initialDistance: 0,
  });
  p.impulse();
  assert.equal(p.velocity, Math.sqrt(2 * MINI_BOOST_ENERGY));
  const boostedSpeed = p.velocity;
  const addedEnergy = p.energy;
  advance(p, 1);
  assert.ok(p.velocity < boostedSpeed);
  assert.ok(p.energy < addedEnergy);
  const heavy = new MiniPhysics(slopeRail(0), { mass: 80, initialSpeed: 0 });
  heavy.impulse(140);
  assert.equal(heavy.velocity, 1.75);
});
test("mini motion and stopping are independent of display frame rate", () => {
  const run = (fps: number) => {
    const p = new MiniPhysics(slopeRail(0.2));
    advance(p, 4, fps);
    p.impulse();
    advance(p, 6, fps);
    return p;
  };
  const a = run(30),
    b = run(144);
  assert.ok(Math.abs(a.distance - b.distance) < 1e-9);
  assert.equal(a.stops, b.stops);
});
test("generated miniature sections are continuous, bounded in height, and include true inversions", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const track = new MiniTrack(seed);
    assert.deepEqual(
      new MiniTrack(seed).sections.map((s) => s.length),
      track.sections.map((s) => s.length),
    );
    assert.ok(track.sections.some((s) => s.kind === "hill"));
    assert.ok(track.sections.some((s) => s.kind === "dip"));
    const tall = track.sections.find((s) => s.kind === "skyhill")!;
    assert.ok(tall.frames.some((f) => f.position.y > 20));
    for (let i = 0; i < track.sections.length; i++) {
      const s = track.sections[i];
      assert.ok(
        Math.abs(s.frames.at(-1)!.position.y - 4) < 1e-8,
        "No cumulative downhill drift",
      );
      if (i) {
        const last = track.sections[i - 1].frames.at(-1)!;
        assert.ok(s.frames[0].position.distanceTo(last.position) < 1e-8);
        assert.ok(s.frames[0].tangent.dot(last.tangent) > 0.9999);
        assert.ok(Math.abs(s.frames[0].rotation.dot(last.rotation)) > 0.9999);
      }
      // Compare with gravity projected into the rail's normal plane: a pitched
      // corkscrew is inverted even while the cart is also pointing downhill.
      if (s.kind === "loop" || s.kind === "corkscrew")
        assert.ok(
          s.frames.some(
            (f) => f.up.y < -0.98 * Math.sqrt(1 - f.tangent.y ** 2),
          ),
          s.kind,
        );
      for (let j = 0; j < s.frames.length; j++) {
        const f = s.frames[j];
        assert.ok(f.position.y > 1 && f.position.y < 28);
        assert.ok(Number.isFinite(f.position.length() + f.curvature.length()));
        assert.ok(Math.abs(f.up.dot(f.tangent)) < 1e-8);
        if (j)
          assert.ok(Math.abs(f.rotation.dot(s.frames[j - 1].rotation)) > 0.97);
      }
    }
  }
  assert.notEqual(new MiniTrack(1).end, new MiniTrack(2).end);
});
test("gravity conserves mechanical energy without resistance on the actual generated hills and loops", () => {
  const track = new MiniTrack(42),
    p = new MiniPhysics(track, { initialSpeed: 25, drag: 0, rolling: 0 });
  const energy = p.energy;
  for (let i = 0; i < 1200; i++) {
    track.ensure(p.distance);
    p.update(1 / 60);
    assert.ok(Math.abs(p.energy - energy) / energy < 0.002);
  }
  assert.equal(p.stops, 0);
});
test("incorrect answers do not move a held train, a correct product resumes it, and idle play has no ending", () => {
  const { host, finishes } = harness();
  const game = new HeadlessMini(host, 123);
  advance(game, 25);
  assert.equal(game.physics.held, true);
  const at = game.physics.distance;
  game.key("0");
  game.key("Enter");
  advance(game, 1);
  assert.equal(game.physics.distance, at);
  assert.equal(game.mistakes, 1);
  answer(game);
  assert.equal(game.physics.velocity, Math.sqrt(2 * MINI_BOOST_ENERGY));
  advance(game, 0.2);
  assert.ok(game.physics.distance > at);
  assert.equal(game.correct, 1);
  advance(game, 200);
  assert.equal(game.ended, false);
  assert.equal(finishes.length, 0);
});
test("fast answers keep the train rolling for kilometres while track memory stays bounded", () => {
  const { host, finishes } = harness();
  const game = new HeadlessMini(host, 75);
  let maximumSections = 0;
  for (let i = 0; i < 600; i++) {
    answer(game);
    advance(game, 1);
    maximumSections = Math.max(maximumSections, game.track.sections.length);
    assert.ok(game.track.end > game.physics.distance + 200);
    assert.ok(game.physics.velocity >= 0);
  }
  assert.ok(game.travelled > 10000, `Travelled ${game.travelled}`);
  assert.ok(game.physics.bestRun > 1000, `Best run ${game.physics.bestRun}`);
  assert.ok(maximumSections < 24, `Retained ${maximumSections} sections`);
  assert.ok(game.track.generated > 250);
  assert.ok(game.track.sections[0].start > 8000);
  assert.equal(game.ended, false);
  assert.equal(finishes.length, 0);
});

test("one answer clears a loop from a stall without repeated little pushes", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const track = new MiniTrack(seed);
    for (const loop of track.sections.filter((s) => s.kind === "loop")) {
      for (const fraction of [0, 0.15, 0.3, 0.45]) {
        const p = new MiniPhysics(track, {
          initialSpeed: 0,
          initialDistance: loop.start + loop.length * fraction,
        });
        p.impulse();
        for (let i = 0; i < 20 * 60 && p.distance < loop.end; i++)
          p.update(1 / 60);
        assert.ok(
          p.distance >= loop.end,
          `seed ${seed}, stalled at ${fraction}`,
        );
        assert.equal(p.stops, 0, `seed ${seed}, stalled at ${fraction}`);
      }
    }
  }
});

test("every three correct answers adds exactly one cart; mistakes and locked input add none", () => {
  const game = new HeadlessMini(harness().host, 16);
  assert.equal(game.cartCount, 3);
  for (let n = 1; n <= 18; n++) {
    if (n % 3 === 0) {
      game.key("0");
      game.key("Enter");
      advance(game, 0.25);
      assert.equal(game.cartCount + game.carriages.lost, 3 + Math.floor((n - 1) / 3));
    }
    answer(game);
    assert.equal(game.cartCount + game.carriages.lost, 3 + Math.floor(n / 3));
    const correct = game.correct;
    answer(game);
    assert.equal(game.correct, correct);
    advance(game, 0.25);
  }
  assert.equal(game.cartCount + game.carriages.lost, 9);
  assert.equal(miniCartCount(3000), 1003, "Reward count has no artificial cap");
  assert.equal(
    new HeadlessMini(harness().host, 17).cartCount,
    3,
    "Restart begins a new train",
  );
});

test("the visible train tail stays on retained rail even on a long endless ride", () => {
  const track = new MiniTrack(77);
  for (let distance = 8; distance < 10000; distance += 37) {
    track.ensure(distance);
    const tail = distance - (MINI_VISIBLE_CARTS - 1) * MINI_CART_SPACING;
    assert.ok(tail >= track.sections[0].start);
    assert.ok(Number.isFinite(track.sample(tail).position.y));
  }
});

test("boost energy is consistent and speed gains ease off once the train is already fast", () => {
  const slow = new MiniPhysics(slopeRail(0), { initialSpeed: 0 });
  const fast = new MiniPhysics(slopeRail(0), { initialSpeed: 30 });
  const slowBefore = slow.energy,
    fastBefore = fast.energy;
  const slowGain = slow.impulse(),
    fastGain = fast.impulse();
  assert.ok(slowGain > fastGain);
  assert.ok(
    Math.abs(slow.energy - slowBefore - MINI_BOOST_ENERGY * slow.options.mass) <
      1e-8,
  );
  assert.ok(
    Math.abs(fast.energy - fastBefore - MINI_BOOST_ENERGY * fast.options.mass) <
      1e-8,
  );
});

test("every opening ride includes a full corkscrew and an upright, rising 360-degree helix", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const track = new MiniTrack(seed);
    const corkscrew = track.sections.find(s => s.kind === "corkscrew")!;
    const helix = track.sections.find(s => s.kind === "helix")!;
    assert.ok(corkscrew.frames.some(f => f.up.y < -0.98 * Math.hypot(f.tangent.x, f.tangent.z)), "Corkscrew fully inverts relative to its pitched rail");
    assert.ok(helix.frames.some(f => f.tangent.x < -0.7), "Helix turns back around its circle");
    assert.ok(helix.frames.some(f => f.position.y > 9), "Helix climbs above its entry rail");
    assert.ok(helix.frames.every(f => f.up.y > 0.3), "Helix banks without inverting");
    assert.ok(Math.abs(helix.frames.at(-1)!.position.y - helix.origin.y) < 1e-8);
    assert.ok(Math.max(...helix.frames.map(f => f.position.z)) - Math.min(...helix.frames.map(f => f.position.z)) > 7);
  }
});

test("only excessive speed at the rear carriage sheds a cart, once per hump", () => {
  const track = new MiniTrack(42);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  const crest = hill.start + hill.length / 2;
  const frame = hill.sample(crest);
  const threshold = Math.sqrt(9.81 * frame.up.y / -frame.curvature.dot(frame.up));
  const carriages = new MiniCarriages(track);
  const front = crest + 2 * MINI_CART_SPACING;
  assert.equal(carriages.update(0, front, threshold * 0.8, 3), false);
  assert.equal(carriages.lost, 0);
  assert.equal(carriages.update(0, front, threshold * 1.5, 3), true);
  assert.equal(carriages.lost, 1);
  const flight = carriages.flights[0];
  assert.equal(flight.colorIndex, 2, "The rear carriage leaves");
  assert.ok(flight.position.distanceTo(frame.position) < 1e-8);
  assert.ok(flight.velocity.distanceTo(frame.tangent.clone().multiplyScalar(threshold * 1.5)) < 1e-8);
  assert.equal(carriages.update(0, crest + MINI_CART_SPACING, threshold * 2, 2), false);
  assert.equal(carriages.lost, 1, "The next carriage stays on this hump");
  assert.equal(new MiniCarriages(track).update(0, crest, 500, 1), false, "The front carriage is retained");
  for (const kind of ["loop", "corkscrew", "helix"]) {
    const section = track.sections.find(s => s.kind === kind)!;
    assert.equal(carriages.update(0, section.start + section.length / 2 + MINI_CART_SPACING, 500, 2), false);
  }
});

test("a detached carriage follows the analytical gravity parabola, lands, and is cleaned up", () => {
  const track = new MiniTrack(42);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  const carriages = new MiniCarriages(track);
  const front = hill.start + hill.length / 2 + 2 * MINI_CART_SPACING;
  assert.equal(carriages.update(0, front, 35, 3), true);
  const cart = carriages.flights[0];
  const start = cart.position.clone(), velocity = cart.velocity.clone();
  const time = 0.75;
  for (let i = 0; i < 90; i++) carriages.update(1 / 120, front, 0, 2);
  const expected = start.addScaledVector(velocity, time);
  expected.y -= 0.5 * 9.81 * time ** 2;
  assert.ok(cart.position.distanceTo(expected) < 1e-8);
  assert.ok(Math.abs(cart.velocity.y - (velocity.y - 9.81 * time)) < 1e-8);
  assert.ok(Math.abs(cart.rotation.length() - 1) < 1e-8);
  for (let i = 0; i < 1200; i++) carriages.update(1 / 120, front, 0, 2);
  assert.ok(cart.groundedFor > 0, "Carriage lands on the ground");
  assert.equal(carriages.flights.length, 0, "Landed carts do not accumulate");
});

test("detachment and airborne motion agree at 30 and 144 frames per second", () => {
  const run = (fps: number) => {
    const game = new HeadlessMini(harness().host, 42);
    const hill = game.track.sections.find(s => s.kind === "skyhill")!;
    game.physics.distance = hill.start + hill.length / 2 - 5;
    game.physics.velocity = 35;
    advance(game, 1.5, fps);
    return game;
  };
  const a = run(30), b = run(144);
  assert.equal(a.carriages.lost, 1);
  assert.equal(a.carriages.lost, b.carriages.lost);
  assert.equal(a.cartCount, b.cartCount);
  assert.equal(a.carriages.flights.length, 1);
  assert.ok(a.carriages.flights[0].position.distanceTo(b.carriages.flights[0].position) < 1e-8);
  assert.ok(a.carriages.flights[0].velocity.distanceTo(b.carriages.flights[0].velocity) < 1e-8);
});

test("lost carriages can be earned back and a restart clears the losses", () => {
  const game = new HeadlessMini(harness().host, 42);
  for (const kind of ["hill", "skyhill"]) {
    const hill = game.track.sections.find(s => s.kind === kind)!;
    game.carriages.update(0, hill.start + hill.length / 2 + (game.cartCount - 1) * MINI_CART_SPACING, 100, game.cartCount);
  }
  assert.equal(game.cartCount, 1);
  game.physics.velocity = 0;
  for (let i = 0; i < 3; i++) {
    answer(game);
    game.physics.velocity = 0;
    advance(game, 0.25);
  }
  assert.equal(game.cartCount, 2);
  const fresh = new HeadlessMini(harness().host, 42);
  assert.equal(fresh.cartCount, 3);
  assert.equal(fresh.carriages.lost, 0);
  assert.equal(fresh.carriages.flights.length, 0);
});
