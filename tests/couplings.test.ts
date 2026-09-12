import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, Quaternion } from "three";
import { MiniTrack } from "../src/games/mini-track.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import { MINI_PARCEL_DRAG, MINI_COUPLING_SLACK } from "../src/games/mini-config.ts";

test("parcel drag matches the analytical horizontal solution at different frame rates", () => {
  const run = (fps: number) => {
    const c = new MiniCarriages(new MiniTrack(42), 0);
    const parcel = { position: new Vector3(0, 100, 0), velocity: new Vector3(30, 0, 0),
      rotation: new Quaternion(), angularVelocity: new Vector3(2, 1, 0), age: 0, groundedFor: 0, bounces: 0 };
    c.parcels.push(parcel);
    for (let i = 0; i < fps; i++) c.update(1 / fps, 8, 0, false);
    assert.ok(Math.abs(parcel.position.x - Math.log1p(MINI_PARCEL_DRAG * 30) / MINI_PARCEL_DRAG) < 1e-8);
    assert.ok(Math.abs(parcel.velocity.x - 30 / (1 + MINI_PARCEL_DRAG * 30)) < 1e-8);
    assert.ok(parcel.position.x < 21, "Drag prevents the previous long forward flight");
    assert.ok(parcel.angularVelocity.length() < 1, "Tumbling loses energy too");
    return parcel;
  };
  assert.ok(run(30).position.distanceTo(run(144).position) < 1e-8);
});

test("tall cargo stacks do not turn into long rigid levers or acquire a large launch boost", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  const wagon = c.coaches[1];
  wagon.cargo = 30;
  c.coaches.splice(2);
  const distance = hill.start + hill.length / 2 + wagon.offset;
  for (let i = 0; i < 120 && !c.spilled; i++) c.update(1 / 120, distance, 35);
  assert.equal(c.parcels.length, 30);
  const pose = c.frame(wagon, distance);
  const carrierVelocity = pose.tangent.clone().multiplyScalar(35).add(wagon.relativeVelocity);
  for (const parcel of c.parcels) {
    assert.ok(parcel.velocity.length() <= carrierVelocity.length() * 1.040001);
    assert.ok(parcel.velocity.distanceTo(carrierVelocity) < 1.51);
  }
  assert.ok(c.parcels[0].velocity.distanceTo(c.parcels[28].velocity) < 1e-8,
    "A box fifteen layers up inherits the same motion as the first layer");
});

test("suspension loads propagate between neighbours while the lead coach stays pinned", () => {
  const c = new MiniCarriages(new MiniTrack(42));
  c.coaches[5].displacement.y = 0.4;
  c.update(1 / 120, 8, 20);
  assert.ok(c.coaches[4].displacement.y > 0, "The adjacent coupling reacts to a lifted tail");
  assert.equal(c.coaches[0].displacement.length(), 0);
  assert.equal(c.coaches[0].relativeVelocity.length(), 0);
  for (let i = 0; i < 240; i++) c.update(1 / 120, 8, 20);
  assert.ok(c.coaches.every(coach => coach.displacement.length() < 0.01), "The connected train settles onto the rail");
  assert.equal(c.lost, 0);
});

test("attached coaches cannot stretch their couplings while lifting over a crest", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  let lifted = false;
  for (let t = 0; t < (hill.length + 16) / 45; t += 1 / 120) {
    const distance = hill.start + t * 45;
    c.update(1 / 120, distance, 45);
    const poses = c.poses(distance);
    assert.ok(poses[0].frame.position.distanceTo(track.sample(distance).position) < 1e-8);
    for (let i = 1; i < c.coaches.length; i++) {
      const rest = track.sample(distance - c.coaches[i].offset).position.distanceTo(track.sample(distance - c.coaches[i - 1].offset).position);
      assert.ok(poses[i].frame.position.distanceTo(poses[i - 1].frame.position) <= rest + MINI_COUPLING_SLACK + 0.006);
      lifted ||= c.coaches[i].lift > 0.2;
    }
  }
  assert.ok(lifted);
  assert.equal(c.lost, 0, "Lifting alone does not break a coupling");
});

test("a broken joint releases a connected rear section that conserves its centre-of-mass flight", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  let distance = hill.start;
  for (let i = 0; i < 1000 && !c.lost; i++) {
    distance = hill.start + i / 120 * 60;
    c.update(1 / 120, distance, 60);
  }
  assert.equal(c.lost, 3);
  assert.deepEqual(c.coaches.map(coach => coach.id), [0, 1, 2]);
  assert.deepEqual(c.flights.map(coach => coach.colorIndex), [3, 4, 5]);
  assert.equal(c.flights[0].coupledTo, undefined);
  assert.equal(c.flights[1].coupledTo, 3);
  assert.equal(c.flights[2].coupledTo, 4);
  const mean = (field: "position" | "velocity") => c.flights.reduce((sum, cart) => sum.add(cart[field]), new Vector3()).divideScalar(3);
  const initial = mean("position"), velocity = mean("velocity");
  for (let i = 0; i < 60; i++) c.update(1 / 120, distance, 0, false);
  const expected = initial.addScaledVector(velocity, 0.5); expected.y -= 0.5 * 9.81 * 0.25;
  assert.ok(mean("position").distanceTo(expected) < 1e-8, "Internal coupling forces cannot propel the group");
  for (let i = 1; i < c.flights.length; i++)
    assert.ok(Math.abs(c.flights[i].position.distanceTo(c.flights[i - 1].position) - c.flights[i].linkLength!) < 0.001);
  assert.equal(c.links(distance).length, 4, "Only the failed drawbar disappears");
});
