import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import { Mini } from "../src/games/mini.ts";
import type { StrengthTower } from "../src/games/strength-tower.ts";
import { OpponentGhost, snapshotRide } from "../src/multiplayer/ghost.ts";
import { validRideState } from "../src/multiplayer/protocol.ts";
import type { Host } from "../src/types.ts";

class Headless extends Mini { setup() {} }
const host: Host = { difficulty: "normal", stage: {} as HTMLElement,
  panel() {}, stats() {}, feedback() {}, sound() {}, finish() {} };

function towerRide() {
  const game = new Headless(host, 42, { remixMode: true, multiplayer: true });
  game.physics.velocity = 27;
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), new Vector3(0, 1, 0));
  const poses = game.carriages.poses(game.physics.renderDistance).map(({ coach, frame }, i) => ({
    coach, frame: { ...frame, position: new Vector3(160, 100 - i * 2.4, 0),
      rotation: rotation.clone(), tangent: new Vector3(0, 1, 0) },
  }));
  game.tower = {} as StrengthTower;
  game.ridePoses = () => poses;
  return { game, poses };
}

test("tower race snapshots use guided carriage poses and couplers, without stale rail or debris prediction", () => {
  const { game, poses } = towerRide();
  const original = game.track.sample(game.physics.distance);
  game.carriages.parcels.push({ position: original.position.clone(), rotation: new Quaternion(),
    velocity: new Vector3(12, 3, 0), angularVelocity: new Vector3(), age: 0, groundedFor: 0, bounces: 0 });
  game.carriages.explosions.push({ position: original.position.clone(), age: 0, colorIndex: 0, water: false, particles: [] });
  const packet = snapshotRide(game, 1);
  assert.ok(validRideState(packet));
  assert.equal(packet.speed, 0);
  assert.equal(packet.ended, false, "the tower pause never ends the race");
  assert.equal(packet.heights?.advancing, false);
  assert.equal(packet.bodies.length, poses.length);
  packet.bodies.forEach((body, i) => {
    assert.deepEqual(body.position, poses[i].frame.position.toArray());
    assert.deepEqual(body.rotation, poses[i].frame.rotation.toArray());
    assert.equal(body.rail, undefined);
    assert.equal(body.velocity, undefined);
  });
  assert.deepEqual(packet.parcels, []);
  assert.deepEqual(packet.impacts, []);
  assert.equal(packet.links.length, poses.length - 1);
  assert.deepEqual(packet.links, game.carriages.links(game.physics.renderDistance, poses)
    .map(link => ({ start: link.start.toArray(), end: link.end.toArray(), stress: link.stress })));
  assert.ok(packet.links.every(link => link.start[1] > 80 && link.end[1] > 80));
  const transported = JSON.parse(JSON.stringify(packet, (_key, value) => value === undefined ? null : value));
  assert.ok(validRideState(transported), "optional motion hints are omitted, not transported as null");
});

test("a delayed tower snapshot holds the train aloft instead of extrapolating it along the rail or under gravity", () => {
  const { game } = towerRide();
  const packet = snapshotRide(game, 1);
  const peer = new OpponentGhost(game.track);
  peer.push(packet, 0);
  peer.sample(0);
  const later = peer.sample(2000)!;
  assert.equal(later.distance, packet.distance);
  assert.deepEqual(later.bodies.map(body => body.position), packet.bodies.map(body => body.position));
  assert.deepEqual(later.links, packet.links);
});

test("ordinary race snapshots resume rail prediction after leaving the tower", () => {
  const { game } = towerRide();
  game.tower = undefined;
  game.ridePoses = (distance = game.physics.renderDistance, alpha = game.physics.renderAlpha) => game.carriages.poses(distance, alpha);
  const packet = snapshotRide(game, 2);
  assert.ok(validRideState(packet));
  assert.equal(packet.speed, game.physics.velocity);
  assert.ok(packet.bodies.every(body => body.rail && body.velocity));
  assert.equal(packet.heights?.advancing, true);
});
