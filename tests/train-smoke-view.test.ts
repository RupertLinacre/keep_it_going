import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MiniView } from "../src/games/mini-view.ts";
import { createMiniCar, createMiniFunnel, MINI_FUNNEL_OUTLET } from "../src/games/train-model.ts";
import { mergeStaticMeshes } from "../src/games/mini-mesh.ts";
import { lanePosition, mirrorRotation } from "../src/multiplayer/ghost.ts";

// Exercise the view's source/time boundary with real smoke buffers, without a
// WebGL context. The full renderer is covered by browser visual/performance QA.
function harness() {
  const view = { scene: new THREE.Scene(), reducedMotion: { matches: false } };
  const prototype = MiniView.prototype as any;
  const state = prototype.createSmoke.call(view);
  const source = {};
  const tick = (time: number, position = new THREE.Vector3(), rotation = new THREE.Quaternion(),
    speed = 0, anchor = 0, options: { source?: object; sourceTime?: number; velocity?: THREE.Vector3 } = {}) =>
    prototype.updateSmoke.call(view, state, time, options.sourceTime ?? time, options.source ?? source,
      position, rotation, speed, anchor, options.velocity);
  return { view, state, tick };
}
const near = (a: THREE.Vector3, b: THREE.Vector3) => assert.ok(a.distanceTo(b) < 1e-7, `${a.toArray()} != ${b.toArray()}`);

test("only the separate engine funnel adds two bounded material batches", () => {
  const coach = createMiniCar("#ffffff"), funnel = createMiniFunnel();
  assert.equal(coach.getObjectByName("engine-funnel"), undefined);
  assert.ok(MINI_FUNNEL_OUTLET.z < 0, "funnel sits near the engine's front");
  const bounds = new THREE.Box3().setFromObject(funnel);
  assert.ok(bounds.min.y >= 1.59 && bounds.max.y < MINI_FUNNEL_OUTLET.y);
  assert.ok(bounds.max.x - bounds.min.x < .54);
  mergeStaticMeshes(funnel);
  assert.equal(funnel.children.length, 2);
});

test("smoke pauses with elapsed time and anchor changes only translate the parent", () => {
  const { state, tick } = harness();
  tick(0, new THREE.Vector3(24, 0, 0));
  tick(.1, new THREE.Vector3(24.2, 0, 0));
  tick(.2, new THREE.Vector3(24.4, 0, 0));
  const batch = state.effect.group.children[0] as THREE.InstancedMesh;
  assert.ok(batch.count > 0);
  const count = batch.count, before = batch.instanceMatrix.array.slice(), clock = state.effect.clock;
  tick(.2, new THREE.Vector3(24.4, 0, 0), new THREE.Quaternion(), 2, 25);
  assert.equal(batch.count, count);
  assert.deepEqual(batch.instanceMatrix.array, before);
  assert.equal(state.effect.clock, clock);
  assert.equal(state.effect.group.position.x, -25);
  tick(.3, new THREE.Vector3(24.6, 0, 0), new THREE.Quaternion(), 2, 25);
  assert.equal(state.effect.clock, .3);
  near(state.emitter, MINI_FUNNEL_OUTLET.clone().add(new THREE.Vector3(24.6, 0, 0)));
  state.effect.dispose();
});

test("funnel outlet and up follow inversion and mirrored multiplayer lanes", () => {
  const { state, tick } = harness();
  const position = new THREE.Vector3(44, 6, 3);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.4, .8, Math.PI));
  const mirrored = mirrorRotation(rotation), offset = 9;
  const lane = lanePosition(position, offset, true);
  tick(0, lane, mirrored);
  tick(.1, lane, mirrored, 12, 25, { velocity: new THREE.Vector3(8, 2, -4) });
  near(state.emitter, lanePosition(MINI_FUNNEL_OUTLET.clone().applyQuaternion(rotation).add(position), offset, true));
  const expectedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation); expectedUp.z *= -1;
  near(state.direction, expectedUp);
  near(state.velocity, new THREE.Vector3(8, 2, -4));
  assert.equal(state.effect.group.position.x, -25);
  state.effect.dispose();
});

test("tower motion supplies travel velocity even when rail speed is zero", () => {
  const { state, tick } = harness();
  tick(0, new THREE.Vector3(10, 8, 0));
  tick(.1, new THREE.Vector3(10, 8.5, 0));
  near(state.velocity, new THREE.Vector3(0, 5, 0));
  state.effect.dispose();
});

test("rewinding, replacing a run, remote rewind, and teleport reset the old trail", () => {
  for (const reset of ["time", "run", "remote", "teleport"] as const) {
    const { state, tick } = harness();
    tick(0); tick(.1); tick(.2);
    assert.ok(state.effect.group.children[0].count > 0);
    let resets = 0;
    const original = state.effect.reset.bind(state.effect);
    state.effect.reset = () => { resets++; original(); };
    if (reset === "time") tick(.1);
    if (reset === "run") tick(.2, new THREE.Vector3(), new THREE.Quaternion(), 0, 0, { source: {} });
    if (reset === "remote") tick(.2, new THREE.Vector3(), new THREE.Quaternion(), 0, 0, { sourceTime: 0 });
    if (reset === "teleport") tick(.2, new THREE.Vector3(100, 0, 0));
    assert.equal(resets, 1, reset);
    assert.equal(state.effect.group.children[0].count, 0, reset);
    state.effect.dispose();
  }
});
