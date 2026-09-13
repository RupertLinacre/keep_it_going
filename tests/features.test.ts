import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MiniTrack } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import { MiniCameraRig, MINI_CAMERA_DIRECTION } from "../src/games/mini-camera.ts";
import { MINI_CART_SPACING, MINI_EXPLOSION_PARTICLES } from "../src/games/mini-config.ts";

test("the helter skelter descends through three separated, banked turns", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const track = new MiniTrack(seed);
    const tower = track.sections.find(s => s.kind === "triplehelix")!;
    const coil = tower.frames.slice(378, 1135);
    let turns = 0;
    for (let i = 1; i < coil.length; i++) {
      if (coil[i - 1].tangent.x >= 0 && coil[i].tangent.x < 0) turns++;
      assert.ok(coil[i].position.y <= coil[i - 1].position.y + 1e-8);
      assert.ok(coil[i].up.y > 0.3, "Banked, not inverted");
      if (i >= 252) assert.ok(coil[i - 252].position.y - coil[i].position.y > 3.5, "Clearance between turns");
    }
    assert.equal(turns, 3);
    assert.ok(coil[0].position.y - coil.at(-1)!.position.y > 20);
    assert.ok(Math.abs(tower.frames[0].position.y - 4) < 1e-8 && Math.abs(tower.frames.at(-1)!.position.y - 4) < 1e-8);
  }
});

test("triple helices recur occasionally among the other features", () => {
  const track = new MiniTrack(42);
  const seen = new Map<number, string>();
  for (let at = 0; at < 20000; at += 150) {
    track.ensure(at);
    for (const section of track.sections) seen.set(section.id, section.kind);
  }
  const kinds = [...seen.values()];
  const ratio = kinds.filter(k => k === "triplehelix").length / kinds.length;
  assert.ok(ratio > 0.02 && ratio < 0.08, `Tower frequency ${ratio}`);
  assert.ok(kinds.includes("invertedhill") && kinds.includes("verticalhill"));
});

test("vertical hills contain straight vertical climbs and drops with stable frames", () => {
  const track = new MiniTrack(12);
  const hill = track.sections.find(s => s.kind === "verticalhill")!;
  assert.ok(hill.frames.filter(f => f.tangent.y > 0.999999).length > 20);
  assert.ok(hill.frames.filter(f => f.tangent.y < -0.999999).length > 20);
  for (const frame of hill.frames) {
    assert.ok(Math.abs(frame.up.dot(frame.tangent)) < 1e-8);
    assert.ok(Math.abs(frame.rotation.length() - 1) < 1e-8);
  }
  const physics = new MiniPhysics(track, { initialDistance: hill.start, initialSpeed: 30, drag: 0, rolling: 0 });
  const energy = physics.energy;
  for (let i = 0; i < 1200 && physics.distance < hill.end; i++) {
    physics.update(1 / 120);
    assert.ok(Math.abs(physics.energy - energy) / energy < 0.002);
  }
  assert.ok(physics.distance >= hill.end);
  assert.equal(physics.stops, 0);
});

test("inverting before the crest retains the carriage and parcels at high speed", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const track = new MiniTrack(seed);
    const protectedHill = track.sections.find(s => s.kind === "invertedhill")!;
    const carriages = new MiniCarriages(track);
    carriages.coaches.splice(2);
    for (let i = 0; i <= 200; i++) {
      const at = protectedHill.start + protectedHill.length * i / 200;
      carriages.update(1 / 120, at + MINI_CART_SPACING, 120);
    }
    const crest = protectedHill.sample(protectedHill.start + protectedHill.length / 2);
    assert.ok(crest.up.y < -0.99);
    assert.ok(crest.curvature.dot(crest.up) > 0);
    assert.equal(carriages.lost, 0);
    assert.equal(carriages.spilled, 0);
    const upright = track.sections.find(s => s.kind === "skyhill")!;
    const exposed = new MiniCarriages(track);
    for (let i = 0; i < 400 && !exposed.lost; i++) exposed.update(1 / 120, upright.start + i * 60 / 120, 60);
    assert.equal(exposed.lost, 1);
    assert.ok(exposed.spilled >= 2);
  }
});

test("spilled parcels follow gravity and refill with one extra parcel up to four per wagon", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track);
  c.coaches.splice(2);
  const coach = c.coaches[1];
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  const at = hill.start + hill.length / 2 + MINI_CART_SPACING;
  for (const expectedCount of [2, 3, 4, 4, 4, 4]) {
    assert.equal(coach.cargo, expectedCount);
    for (let i = 0; i < 120 && coach.cargo; i++) c.update(1 / 120, at, 20);
    assert.equal(coach.cargo, 0);
    assert.equal(c.lost, 0);
    const parcel = c.parcels.at(-1)!;
    assert.ok(c.cameraSubjects().includes(parcel.position), "The camera follows airborne cargo");
    const before = parcel.position.clone();
    const launchSpeed = parcel.velocity.length();
    for (let i = 0; i < 60; i++) c.update(1 / 120, 8, 0);
    assert.ok(parcel.position.distanceTo(before) < launchSpeed * 0.5);
    assert.ok(parcel.velocity.length() < launchSpeed, "Drag slows a loose parcel");
    for (let i = 0; i < 245; i++) c.update(1 / 120, 8, 0);
    assert.equal(coach.cargo, Math.min(4, expectedCount + 1));
    assert.ok(coach.nextCargo <= 4, "The refill counter also stops growing at capacity");
    if (parcel.bounces) assert.ok(!c.cameraSubjects().includes(parcel.position), "Landed cargo no longer pulls the camera back");
  }
  assert.equal(c.refills, 6);
  for (let i = 0; i < 1500; i++) c.update(1 / 120, 8, 0);
  assert.equal(c.parcels.length, 0);
});

test("a carriage explodes once on impact and the debris follows gravity then expires", () => {
  const track = new MiniTrack(42);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  let front = hill.start;
  const carriages = new MiniCarriages(track);
  for (let i = 0; i < 400 && !carriages.lost; i++) {
    front = hill.start + i * 38 / 120;
    carriages.update(1 / 120, front, 38);
  }
  assert.equal(carriages.lost, 1);
  assert.equal(carriages.explosions.length, 0, "No mid-air explosion");
  for (let i = 0; i < 1200 && carriages.flights.length; i++) carriages.update(1 / 120, front, 0, false);
  assert.equal(carriages.flights.length, 0);
  assert.equal(carriages.impacts, 1);
  assert.equal(carriages.explosions.length, 1);
  const explosion = carriages.explosions[0];
  assert.ok(carriages.cameraSubjects().includes(explosion.position), "Frame the impact when it happens");
  assert.equal(explosion.particles.length, MINI_EXPLOSION_PARTICLES);
  const particle = explosion.particles[0];
  const expected = particle.position.clone().addScaledVector(particle.velocity, 0.1);
  expected.y -= 0.5 * 9.81 * 0.1 ** 2;
  carriages.update(0.1, front, 0, false);
  assert.ok(particle.position.distanceTo(expected) < 1e-8);
  for (let i = 0; i < 72; i++) carriages.update(1 / 120, front, 0, false);
  const debris = new Set([explosion.position, ...explosion.particles.map(p => p.position)]);
  assert.ok(carriages.cameraSubjects().every(position => !debris.has(position)), "Fading debris no longer holds the camera away from the train");
  for (let i = 0; i < 360; i++) carriages.update(1 / 120, front, 0, false);
  assert.equal(carriages.impacts, 1);
  assert.equal(carriages.explosions.length, 0);
});

test("the camera keeps nearby airborne objects in frame, then returns smoothly", () => {
  for (const aspect of [0.7, 1.4, 2, 3.5]) {
    const rig = new MiniCameraRig();
    const base = new THREE.Vector3(0, 10, 0);
    const camera = new THREE.OrthographicCamera();
    camera.far = 10000;
    rig.update(base, 32, aspect, [], 1 / 60);
    for (let i = 0; i <= 240; i++) {
      const t = i / 60;
      const subjects = [new THREE.Vector3(6 * t, 25 + 20 * t - 4.905 * t * t, 0), new THREE.Vector3(-3 * t, 35, 15)];
      rig.update(base, 32, aspect, subjects, 1 / 60);
      camera.left = -rig.height * aspect / 2; camera.right = -camera.left;
      camera.top = rig.height / 2; camera.bottom = -camera.top;
      camera.position.copy(rig.focus).addScaledVector(MINI_CAMERA_DIRECTION, 2000);
      camera.lookAt(rig.focus); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
      for (const p of [base, ...subjects]) {
        const screen = p.clone().project(camera);
        assert.ok(Math.abs(screen.x) < 0.85 && Math.abs(screen.y) < 0.73, `Clipped at aspect ${aspect}`);
      }
    }
    assert.ok(rig.height > 32);
    const wideHeight = rig.height;
    rig.update(base, 32, aspect, [], 1 / 60);
    assert.ok(rig.height > wideHeight * 0.9, "No abrupt snap back");
    for (let i = 0; i < 360; i++) rig.update(base, 32, aspect, [], 1 / 60);
    assert.ok(Math.abs(rig.height - 32) < 0.01);
    assert.ok(rig.focus.distanceTo(base) < 0.01);
  }
});

test("runaway objects cannot zoom beyond three times normal or pan the train offscreen", () => {
  const rig = new MiniCameraRig();
  for (const [aspect, normal] of [[2, 100], [0.7, 32], [3.5, 26], [1, 48]]) {
    const base = new THREE.Vector3(20, 18, 5);
    const runaway = new THREE.Vector3(10000, 8000, -3000);
    for (let i = 0; i < 240; i++) {
      base.x += 0.5;
      rig.update(base, normal, aspect, [runaway], 1 / 60);
      assert.ok(rig.height <= normal * 3, "Hard cap also applies during resize/close-view transitions");
      const camera = new THREE.OrthographicCamera(-rig.height * aspect / 2, rig.height * aspect / 2, rig.height / 2, -rig.height / 2, 0.1, 20000);
      camera.position.copy(rig.focus).addScaledVector(MINI_CAMERA_DIRECTION, 10000);
      camera.lookAt(rig.focus); camera.updateMatrixWorld(true);
      const engine = base.clone().project(camera);
      assert.ok(Math.abs(engine.x) < 0.84 && Math.abs(engine.y) < 0.72, "Keep the train visible at the cap");
      const escaped = runaway.clone().project(camera);
      assert.ok(Math.abs(escaped.x) > 1 || Math.abs(escaped.y) > 1, "Distant debris may leave the view");
    }
    assert.equal(rig.height, normal * 3);
    rig.update(base, normal, aspect, [], 1 / 60);
    assert.ok(rig.height > normal * 2.7, "Return from the cap without snapping in");
    for (let i = 0; i < 360; i++) rig.update(base, normal, aspect, [], 1 / 60);
    assert.ok(Math.abs(rig.height - normal) < 0.01);
  }
});
