import { WORLD_LAP } from "../src/games/adventure-worlds.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import { MINI_CART_SPACING } from "../src/games/mini-config.ts";
import { MiniSection, MiniTrack } from "../src/games/mini-track.ts";
import { HeightTrack } from "../src/games/height-track.ts";
import { StrengthTower } from "../src/games/strength-tower.ts";
import { StrengthTowerMotion } from "../src/games/strength-tower-motion.ts";
import { towerCurveFrame, towerEntrance, towerExit, towerExitFrame, towerFrame } from "../src/games/strength-tower-rail.ts";
import type { RailFrame } from "../src/games/mini-rail.ts";

function frameIsValid(frame: RailFrame) {
  for (const axis of [frame.tangent, frame.right, frame.up]) {
    assert.ok(axis.toArray().every(Number.isFinite));
    assert.ok(Math.abs(axis.length() - 1) < 1e-8, "no collapsed rail axes at vertical transitions");
  }
  assert.ok(Math.abs(frame.right.dot(frame.up)) < 1e-8);
  assert.ok(Math.abs(frame.up.dot(frame.tangent)) < 1e-8);
  assert.ok(Math.abs(frame.right.dot(frame.tangent)) < 1e-8);
  assert.ok(Math.abs(frame.rotation.length() - 1) < 1e-8);
  assert.ok(new Vector3(0, 0, -1).applyQuaternion(frame.rotation).distanceTo(frame.tangent) < 1e-8,
    "existing carriage models face local -Z");
  assert.ok(new Vector3(0, 1, 0).applyQuaternion(frame.rotation).distanceTo(frame.up) < 1e-8);
}

test("tower junction curves join the real course and vertical mast with continuous carriage frames", () => {
  const start = towerCurveFrame(towerEntrance, 0);
  const mastUp = towerCurveFrame(towerEntrance, towerEntrance.getLength());
  const mastDown = towerCurveFrame(towerExit, 0);
  const finish = towerCurveFrame(towerExit, towerExit.getLength());
  assert.deepEqual(start.position.toArray(), [0, 0, 0]);
  assert.deepEqual(finish.position.toArray(), [100, 0, 0]);
  assert.ok(start.tangent.distanceTo(new Vector3(1, 0, 0)) < .001);
  assert.ok(finish.tangent.distanceTo(new Vector3(1, 0, 0)) < .001);
  assert.ok(mastUp.position.distanceTo(new Vector3(50, 8, -14)) < 1e-8);
  assert.ok(mastDown.position.distanceTo(mastUp.position) < 1e-8);
  assert.ok(mastUp.tangent.distanceTo(new Vector3(0, 1, 0)) < .001);
  assert.ok(mastDown.tangent.distanceTo(new Vector3(0, -1, 0)) < .001);
  for (const frame of [mastUp, mastDown]) assert.ok(frame.up.distanceTo(new Vector3(0, 0, 1)) < .001,
    "both climbing and descending roofs face the player");

  for (const curve of [towerEntrance, towerExit]) {
    let previous: RailFrame | undefined;
    for (let i = 0; i <= 2000; i++) {
      const frame = towerCurveFrame(curve, curve.getLength() * i / 2000);
      frameIsValid(frame);
      if (previous) {
        assert.ok(Math.abs(frame.rotation.dot(previous.rotation)) > .999,
          `no frame flip along the junction at sample ${i}`);
        assert.ok(frame.position.distanceTo(previous.position) < .06);
      }
      previous = frame;
    }
  }
});

test("the vertical mast uses valid front-facing train frames in both directions", () => {
  for (const direction of [1, -1]) {
    const frame = towerFrame(new Vector3(50, 120, -14), new Vector3(0, direction, 0));
    frameIsValid(frame);
    assert.deepEqual(frame.up.toArray(), [0, 0, 1]);
  }
});

/** Exercise the real pose method without constructing HUD elements or WebGL. */
function poseHarness(coaches = 6) {
  const track = new MiniTrack(42);
  const origin = new Vector3(170, 19, 6);
  const section = new MiniSection(800, "strengthtower", 500, origin, 100, 0, 0, 1);
  track.sections.splice(0, track.sections.length,
    new MiniSection(799, "station", 400, origin.clone().add(new Vector3(-100, 0, 0)), 100, 0, 0, 1),
    section,
    new MiniSection(801, "station", section.end, origin.clone().add(new Vector3(100, 0, 0)), 100, 0, 0, 1));
  const tower = Object.create(StrengthTower.prototype) as StrengthTower;
  const motion = new StrengthTowerMotion(26, towerEntrance.getLength(), towerExit.getLength());
  Object.assign(tower, { track, section, origin, motion, trainLength: (coaches - 1) * MINI_CART_SPACING });
  return { tower, motion, track, section, coaches };
}

function framesMeet(a: RailFrame[], b: RailFrame[]) {
  for (let i = 0; i < a.length; i++) {
    assert.ok(a[i].position.distanceTo(b[i].position) < .001, `coach ${i} must not teleport at a phase transition`);
    assert.ok(Math.abs(a[i].rotation.dot(b[i].rotation)) > .9999, `coach ${i} must retain its heading`);
    frameIsValid(a[i]); frameIsValid(b[i]);
  }
}

test("actual tower coach poses stay continuous through climb, turnaround, descent and switched exit", () => {
  for (const coaches of [5, 10]) {
    const { tower, motion, track, section } = poseHarness(coaches);
    const poses = () => Array.from({ length: coaches }, (_, i) => tower.pose(i));
    motion.phase = "approach"; motion.progress = 1;
    let before = poses();
    motion.phase = "climb"; motion.height = 0;
    framesMeet(before, poses());

    motion.height = 80; before = poses();
    motion.phase = "celebrate"; motion.time = 0;
    framesMeet(before, poses());
    let previous = poses();
    for (let time = .01; time <= 2.8; time += .01) {
      motion.time = time;
      const current = poses();
      current.forEach((frame, i) => {
        frameIsValid(frame);
        assert.ok(Math.abs(frame.rotation.dot(previous[i].rotation)) > .9998);
        if (i) assert.ok(Math.abs(frame.position.distanceTo(current[i - 1].position) - MINI_CART_SPACING) < 1e-8);
      });
      previous = current;
    }
    motion.time = 2.8; before = poses();
    motion.phase = "descend";
    framesMeet(before, poses());
    assert.ok(tower.pose(0).position.y < tower.pose(coaches - 1).position.y,
      "the original locomotive becomes the lowest carriage and leads down");

    motion.height = 0; before = poses();
    motion.phase = "exit"; motion.progress = 0;
    framesMeet(before, poses());
    motion.progress = 1;
    for (let i = 0; i < coaches; i++) {
      const actual = tower.pose(i);
      const expected = track.sample(section.end + tower.trainLength - i * MINI_CART_SPACING);
      framesMeet([actual], [expected]);
    }
  }
});

test("the exit junction rejoins ordinary track without jumping when the engine crosses its end", () => {
  const { tower, motion } = poseHarness(10);
  motion.phase = "exit";
  const crossing = (towerExit.getLength() - tower.trainLength) / towerExit.getLength();
  motion.progress = crossing - .00001;
  const before = tower.pose(0);
  motion.progress = crossing + .00001;
  const after = tower.pose(0);
  assert.ok(before.position.distanceTo(after.position) < .002);
  assert.ok(Math.abs(before.rotation.dot(after.rotation)) > .9999);
  assert.ok(after.rotation.angleTo(new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), new Vector3(1, 0, 0))) < .001);
});

test("a raised tower entrance descends smoothly to the actual exit without a Sky Lift teleport", () => {
  const track = new HeightTrack(42, { generative: true });
  track.ensure(0, WORLD_LAP + 600);
  const section = track.sections.find(s => s.kind === "strengthtower")!;
  track.raise(section.start - 1);
  track.advance(1);
  const origin = section.sample(section.start).position.clone();
  const rise = section.sample(section.end).position.y - origin.y;
  assert.ok(Math.abs(rise + 30) < 1e-8, "the preceding lift raises the entrance but not the exit");
  const tower = Object.create(StrengthTower.prototype) as StrengthTower;
  const motion = new StrengthTowerMotion(26, towerEntrance.getLength(), towerExit.getLength());
  Object.assign(tower, { track, section, origin, motion, trainLength: 5 * MINI_CART_SPACING });
  motion.phase = "exit";
  const crossing = (towerExit.getLength() - tower.trainLength) / towerExit.getLength();
  motion.progress = crossing - .00001;
  const before = tower.pose(0);
  motion.progress = crossing + .00001;
  const after = tower.pose(0);
  assert.ok(before.position.distanceTo(after.position) < .002, "no 30 m drop at the exit seam");
  assert.ok(Math.abs(before.rotation.dot(after.rotation)) > .9999);
  assert.ok(towerExitFrame(0, rise).tangent.distanceTo(new Vector3(0, -1, 0)) < .001);
  assert.ok(towerExitFrame(towerExit.getLength(), rise).tangent.distanceTo(new Vector3(1, 0, 0)) < .001);
  for (const offset of [-90, -30, 30, 90]) {
    let previous: RailFrame | undefined;
    for (let i = 0; i <= 1500; i++) {
      const distance = towerExit.getLength() * i / 1500;
      const frame = towerExitFrame(distance, offset);
      frameIsValid(frame);
      if (previous) assert.ok(Math.abs(frame.rotation.dot(previous.rotation)) > .998,
        `raised exit ${offset} m should have no coach-frame flips`);
      previous = frame;
    }
  }
});
