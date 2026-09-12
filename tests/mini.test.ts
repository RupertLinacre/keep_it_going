import test from "node:test";
import assert from "node:assert/strict";
import { MiniTrack, type MiniRail } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { Mini } from "../src/games/mini.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import {
  MINI_BOOST_ENERGY,
  MINI_VISIBLE_CARTS,
  MINI_CART_SPACING,
  MINI_START_SPEED,
} from "../src/games/mini-config.ts";
import type { Host, Result } from "../src/types.ts";

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
  const finishes: Result[] = [];
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
  for (let i = 0; i < 1200 && p.distance < track.sections.find(s => s.kind === "jump")!.start - 2; i++) {
    track.ensure(p.distance);
    p.update(1 / 60);
    assert.ok(Math.abs(p.energy - energy) / energy < 0.002);
  }
  assert.equal(p.stops, 0);
});

test("the ride starts gently at a big hilltop and gains speed down the first drop without a boost", () => {
  for (const seed of [1, 12, 42, 93]) {
    const game = new HeadlessMini(harness().host, seed);
    const hill = game.track.sectionAt(game.physics.distance);
    const peak = Math.max(...hill.frames.map(frame => frame.position.y));
    const startHeight = game.physics.sample(game.physics.distance).position.y;
    assert.equal(hill.kind, "firsthill");
    assert.ok(peak - hill.origin.y >= 20, "A substantial first drop");
    assert.ok(peak - startHeight < 0.3, "The lead coach begins just over the crest");
    assert.ok(game.physics.velocity > 0 && game.physics.velocity <= 2);
    assert.equal(game.travelled, 0);
    const poses = game.carriages.poses(game.physics.distance);
    assert.equal(poses.length, 6, "All six coaches start on real rail near the hilltop");
    assert.ok(poses.every(pose => pose.frame.position.y > 20));
    for (let i = 0; i < 1200 && game.physics.distance < hill.end; i++) game.update(1 / 120);
    assert.ok(game.physics.distance >= hill.end);
    assert.ok(game.physics.velocity > 17 && game.physics.velocity < 21, "Gravity supplies the opening momentum");
    assert.equal(game.correct, 0);
    assert.equal(game.ended, false);
    assert.equal(game.carriages.lost, 0);
    assert.equal(game.carriages.spilled, 0);
    assert.equal(game.cartCount, 6);
  }
});
test("stopping ends the ride once and no input can restart a finished train", () => {
  const { host, finishes } = harness();
  const game = new HeadlessMini(host, 123);
  assert.equal(game.cartCount, 6);
  assert.equal(game.physics.velocity, MINI_START_SPEED, "A gentle roll starts the descent");
  game.key("0"); game.key("Enter");
  assert.equal(game.mistakes, 1);
  advance(game, 60);
  assert.ok(game.ended);
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].ride?.distance, game.travelled);
  assert.ok(finishes[0].ride!.longestTrain >= 6);
  const at = game.physics.distance, score = game.score;
  answer(game); advance(game, 10);
  assert.equal(game.physics.distance, at);
  assert.equal(game.score, score);
  assert.equal(finishes.length, 1);
  assert.equal(new HeadlessMini(harness().host, 123).cartCount, 6);
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

test("answers boost speed without instantly adding coaches, and locked submissions add nothing", () => {
  const game = new HeadlessMini(harness().host, 16);
  for (let n = 1; n <= 3; n++) {
    answer(game);
    assert.equal(game.correct, n);
    const speed = game.physics.velocity;
    answer(game);
    assert.equal(game.physics.velocity, speed);
    assert.equal(game.cartCount, 6);
    advance(game, 0.2);
    while (game.answer) game.key("Backspace");
  }
});

test("typing the next answer during a boost cooldown preserves every digit without applying a second impulse", () => {
  const game = new HeadlessMini(harness().host, 42);
  answer(game);
  const speed = game.physics.velocity, nextAnswer = String(game.a * game.b);
  for (const digit of nextAnswer) game.key(digit);
  assert.equal(game.answer, nextAnswer);
  game.key("Enter");
  assert.equal(game.physics.velocity, speed);
  assert.equal(game.correct, 1);
  advance(game, 0.2);
  game.key("Enter");
  assert.equal(game.correct, 2);
  assert.equal(game.combo, 2);
  assert.equal(game.bestStreak, 2);
  advance(game, 0.2);
  game.key("0"); game.key("Enter");
  assert.equal(game.combo, 0);
  assert.equal(game.bestStreak, 2, "A mistake resets the live streak but keeps the ride's best");
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

test("sticky coaches survive ordinary humps; the rear whips off first and faster runs lose more", () => {
  const run = (speed: number) => {
    const track = new MiniTrack(42), c = new MiniCarriages(track);
    const hill = track.sections.find(s => s.kind === "skyhill")!;
    let maximumLift = 0;
    for (let t = 0; t < (hill.length + 16) / speed; t += 1 / 120) {
      c.update(1 / 120, hill.start + t * speed, speed);
      maximumLift = Math.max(maximumLift, ...c.coaches.map(c => c.lift));
      assert.equal(c.coaches[0].id, 0);
      assert.equal(c.coaches[0].lift, 0, "The lead coach remains pinned");
    }
    return { c, maximumLift };
  };
  assert.equal(run(20).c.spilled, 0);
  const normal = run(32), fast = run(35), faster = run(38), extreme = run(80);
  assert.equal(normal.c.lost, 0);
  assert.ok(normal.c.spilled > 0, "Parcels release before coaches");
  assert.ok(normal.maximumLift > 0.1, "Coaches can lift and settle without detaching");
  assert.equal(fast.c.lost, 1, "A reachable boost speed can release the tail coach");
  assert.deepEqual(fast.c.coaches.map(c => c.id), [0, 1, 2, 3, 4], "The rear coach goes first");
  assert.equal(faster.c.lost, 4, "More speed releases a larger connected section");
  assert.equal(extreme.c.lost, 5);
});

test("ordinary answer boosts can send rear coaches airborne during an actual ride", () => {
  for (const seed of [1, 12, 42, 93]) {
    const game = new HeadlessMini(harness().host, seed);
    const hill = game.track.sections.find(s => s.kind === "skyhill")!;
    let nextAnswer = 0;
    for (let i = 0; i < 2400 && !game.ended && !game.carriages.lost; i++) {
      if (game.elapsed >= nextAnswer) { answer(game); nextAnswer += 1; }
      game.update(1 / 120);
      const lead = game.carriages.poses(game.physics.distance)[0];
      assert.equal(lead.coach.id, 0);
      assert.ok(lead.frame.position.distanceTo(game.physics.sample(game.physics.distance).position) < 1e-8);
      if (game.physics.distance > hill.end + 16) break;
    }
    assert.ok(game.carriages.lost > 0 && game.carriages.lost < 6, `Seed ${seed}: answer boosts should reach detachment speeds`);
    assert.ok(game.carriages.flights.length > 0);
    assert.ok(game.correct <= 4, "No artificially assigned velocity or rapid-fire boost spam");
    assert.ok(game.physics.velocity < 40, "Detachment is reachable below 144 km/h");
    assert.ok(game.carriages.flights.every(cart => cart.colorIndex > 0 && cart.position.y > 4));
    assert.ok(game.carriages.spilled > 0, "Loose parcels still release before or alongside a broken section");
  }
});

test("a detached carriage follows the analytical gravity parabola, lands, and is cleaned up", () => {
  const track = new MiniTrack(42);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  const carriages = new MiniCarriages(track);
  const front = hill.start + hill.length / 2 + 2 * MINI_CART_SPACING;
  carriages.coaches.splice(1, 4);
  carriages.coaches[1].offset = 2 * MINI_CART_SPACING;
  for (let i = 0; i < 20 && !carriages.lost; i++) carriages.update(1 / 120, front, 80);
  assert.equal(carriages.lost, 1);
  const cart = carriages.flights[0];
  const start = cart.position.clone(), velocity = cart.velocity.clone();
  const time = 0.75;
  for (let i = 0; i < 90; i++) carriages.update(1 / 120, front, 0, false);
  const expected = start.addScaledVector(velocity, time);
  expected.y -= 0.5 * 9.81 * time ** 2;
  assert.ok(cart.position.distanceTo(expected) < 1e-8);
  assert.ok(Math.abs(cart.velocity.y - (velocity.y - 9.81 * time)) < 1e-8);
  assert.ok(Math.abs(cart.rotation.length() - 1) < 1e-8);
  for (let i = 0; i < 1200; i++) carriages.update(1 / 120, front, 0, false);
  assert.ok(cart.groundedFor > 0, "Carriage lands on the ground");
  assert.equal(carriages.flights.length, 0, "Landed carts do not accumulate");
});

test("detachment and airborne motion agree at 30 and 144 frames per second", () => {
  const run = (fps: number) => {
    const game = new HeadlessMini(harness().host, 42);
    const hill = game.track.sections.find(s => s.kind === "skyhill")!;
    game.physics.distance = hill.start + hill.length / 2 - 5;
    game.physics.velocity = 80;
    advance(game, 1.5, fps);
    return game;
  };
  const a = run(30), b = run(144);
  assert.ok(a.carriages.lost > 0);
  assert.equal(a.carriages.lost, b.carriages.lost);
  assert.equal(a.cartCount, b.cartCount);
  assert.equal(a.carriages.flights.length, b.carriages.flights.length);
  for (const key of ["flights", "parcels"] as const) {
    assert.equal(a.carriages[key].length, b.carriages[key].length);
    for (let i = 0; i < a.carriages[key].length; i++) {
      assert.ok(a.carriages[key][i].position.distanceTo(b.carriages[key][i].position) < 1e-8);
      assert.ok(a.carriages[key][i].velocity.distanceTo(b.carriages[key][i].velocity) < 1e-8);
    }
  }
});

test("replacement coaches visibly close the gap from behind, sooner at higher speed", () => {
  const run = (speed: number) => {
    const track = new MiniTrack(42), c = new MiniCarriages(track);
    c.coaches.splice(4); c.lost = 2;
    let firstSeen = -1, arrival = -1, previousOffset = Infinity, finalClosingSpeed = Infinity;
    for (let t = 0; t < 30; t += 1 / 120) {
      c.update(1 / 120, 8, speed);
      if (c.incoming) {
        if (firstSeen < 0) firstSeen = t;
        assert.ok(c.incoming.offset < previousOffset);
        assert.ok(c.incoming.offset > c.coaches.at(-1)!.offset);
        finalClosingSpeed = (previousOffset - c.incoming.offset) * 120;
        previousOffset = c.incoming.offset;
        assert.equal(c.coaches.length, 4, "Not counted until it couples");
      }
      if (c.arrived) { arrival = t; break; }
    }
    assert.ok(firstSeen >= 0 && arrival > firstSeen + 0.5);
    assert.ok(finalClosingSpeed < 0.2, "An arriving coach matches the train's speed before coupling");
    assert.equal(c.coaches.length, 5);
    assert.equal(c.coaches.at(-1)!.offset, 4 * MINI_CART_SPACING);
    return arrival;
  };
  assert.ok(run(40) < run(20));
});

test("water jumps use gravity, award distance once on landing, and kill an under-speed train", () => {
  const run = (speed: number, fps = 60) => {
    const { host, finishes } = harness();
    const game = new HeadlessMini(host, 42);
    const jump = game.track.sections.find(s => s.kind === "jump")!;
    game.physics.distance = jump.takeoff - 0.01;
    game.physics.velocity = speed;
    for (let i = 0; i < 5 * fps && !game.ended && !game.physics.jumps; i++) game.update(1 / fps);
    return { game, finishes };
  };
  const slow = run(12), fast = run(25), faster = run(30);
  assert.ok(slow.game.ended && slow.game.physics.crashed);
  assert.equal(slow.finishes.length, 1);
  assert.equal(slow.game.physics.jumps, 0);
  assert.ok(slow.game.carriages.explosions[0].water);
  assert.equal(fast.finishes.length, 0);
  assert.equal(fast.game.physics.jumps, 1);
  assert.ok(fast.game.physics.lastJumpDistance > 40);
  assert.ok(faster.game.physics.lastJumpDistance > fast.game.physics.lastJumpDistance);
  assert.equal(fast.game.score, Math.round(fast.game.physics.lastJumpDistance * 10));
  const score = fast.game.score;
  advance(fast.game, 0.2);
  assert.equal(fast.game.score, score, "Bonus is awarded only once");
  const a = run(25, 30).game, b = run(25, 144).game;
  assert.equal(a.physics.lastJumpDistance, b.physics.lastJumpDistance);
  assert.equal(a.score, b.score);
});

test("the lead and following coaches share the gravity arc across a real rail gap", () => {
  const game = new HeadlessMini(harness().host, 42);
  const jump = game.track.sections.find(s => s.kind === "jump")!;
  game.physics.distance = jump.takeoff - 0.01; game.physics.velocity = 25;
  game.update(1 / 120);
  const flight = game.physics.flight!;
  const position = flight.position.clone(), velocity = flight.velocity.clone();
  const energy = game.physics.energy;
  advance(game, 0.5, 120);
  const expected = position.addScaledVector(velocity, 0.5);
  expected.y -= 0.5 * 9.81 * 0.25;
  assert.ok(game.physics.flight!.position.distanceTo(expected) < 1e-8);
  assert.ok(Math.abs(game.physics.energy - energy) / energy < 1e-10);
  const poses = game.carriages.poses(game.physics.distance);
  assert.ok(poses[0].frame.airborne && poses[1].frame.airborne);
  assert.ok(!jump.hasRail(game.physics.distance));
  assert.ok(poses[0].frame.position.y > jump.height(game.physics.distance) + 3);
  assert.equal(game.carriages.lost, 0, "The intentional jump doesn't shed coaches");
});

test("a jump that reaches the far bank below rail height is a miss, never an underside landing", () => {
  for (const speed of [1, 5, 10, 17, 18]) {
    const track = new MiniTrack(42), jump = track.sections.find(s => s.kind === "jump")!;
    const p = new MiniPhysics(track, { initialDistance: jump.takeoff - 0.001, initialSpeed: speed });
    for (let i = 0; i < 1200 && !p.crashed && !p.held; i++) {
      track.ensure(p.distance);
      p.update(1 / 120);
      const pose = p.sample(p.distance);
      assert.ok(Number.isFinite(pose.position.length() + pose.rotation.length()));
    }
    assert.equal(p.jumps, 0, `Speed ${speed} should miss the landing lip`);
    assert.ok(p.crashed || p.held);
  }
});

test("restarting keeps a completed jump and the current distance as personal records", () => {
  const host = { ...harness().host, difficulty: "hard" as const };
  const game = new HeadlessMini(host, 42);
  const jump = game.track.sections.find(s => s.kind === "jump")!;
  game.physics.distance = jump.takeoff - 0.01; game.physics.velocity = 25;
  advance(game, 2.1);
  assert.equal(game.physics.jumps, 1);
  game.destroy();
  const next = new HeadlessMini(host, 42);
  assert.ok(next.personalBest.distance >= game.travelled);
  assert.ok(next.personalBest.jump >= game.physics.bestJump);
  assert.ok(next.personalBest.score >= game.score);
  assert.equal(next.physics.bestJump, 0, "The new ride still has its own separate statistics");
});
