import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SMOKE_DESIGNS, TrainSmoke, type SmokeVariant } from '../src/games/train-smoke';

const up = new THREE.Vector3(0, 1, 0);
const zero = new THREE.Vector3();
function batches(smoke: TrainSmoke) { return smoke.group.children as THREE.InstancedMesh[]; }
function positions(smoke: TrainSmoke) {
  const matrix = new THREE.Matrix4(), result: THREE.Vector3[] = [];
  for (const mesh of batches(smoke)) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    result.push(new THREE.Vector3().setFromMatrixPosition(matrix));
  }
  return result;
}
function run(smoke: TrainSmoke, variant: SmokeVariant, seconds: number, step = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / step); i++) smoke.update(step, zero, up, 12, variant, zero);
}

test('all six smoke designs have bounded opaque batches and exhaust after emission stops', () => {
  assert.deepEqual(SMOKE_DESIGNS.map(design => design.id), ['normal', 'a', 'b', 'c', 'd', 'e']);
  const smoke = new TrainSmoke();
  for (const { id } of SMOKE_DESIGNS) {
    smoke.reset();
    run(smoke, id, 10);
    assert.ok(smoke.activeCount > 0 && smoke.activeCount <= 120, `${id}: bounded populated pool`);
    assert.equal(batches(smoke).length, 3);
    for (const mesh of batches(smoke)) {
      assert.equal((mesh.material as THREE.Material).transparent, false);
      assert.equal(mesh.castShadow, false); assert.equal(mesh.receiveShadow, false);
    }
    smoke.update(3, null, up, 12, id);
    assert.equal(smoke.activeCount, 0);
    assert.ok(batches(smoke).every(mesh => !mesh.visible));
  }
  smoke.dispose(); smoke.dispose();
});

test('moving or switching the emitter does not pull an existing smoke trail along', () => {
  const smoke = new TrainSmoke();
  run(smoke, 'normal', .5);
  const before = positions(smoke);
  assert.ok(before.length >= 3);
  smoke.update(1 / 60, new THREE.Vector3(500, 0, 0), up, 12, 'c');
  const after = positions(smoke);
  assert.equal(after.length, before.length, 'a teleport must not spawn a connecting line');
  after.forEach((position, i) => assert.ok(position.distanceTo(before[i]) < .1, 'existing clouds retain their world position'));
  run(smoke, 'c', .3);
  assert.ok(batches(smoke)[0].count > 0, 'old white puffs survive the style change');
  assert.ok(batches(smoke)[1].count > 0, 'new style emits rings');
  smoke.dispose();
});

test('reset is repeatable and zero dt does not reset or emit particles', () => {
  const smoke = new TrainSmoke();
  run(smoke, 'e', 1);
  const before = positions(smoke).map(position => position.toArray());
  smoke.update(0, null, up, 0, 'normal');
  assert.deepEqual(positions(smoke).map(position => position.toArray()), before);
  smoke.reset();
  assert.equal(smoke.activeCount, 0);
  run(smoke, 'e', 1);
  assert.deepEqual(positions(smoke).map(position => position.toArray()), before);
  smoke.dispose();
});

test('analytic motion and timed emission give matching trails at 30 and 60 fps', () => {
  const slow = new TrainSmoke(), fast = new TrainSmoke();
  const velocity = new THREE.Vector3(8, 0, 0), emitter = new THREE.Vector3();
  for (const [smoke, fps] of [[slow, 30], [fast, 60]] as const) {
    for (let frame = 1; frame <= fps * 2; frame++) {
      emitter.copy(velocity).multiplyScalar(frame / fps);
      smoke.update(1 / fps, emitter, up, 8, 'a', velocity);
    }
  }
  const a = positions(slow), b = positions(fast);
  assert.equal(a.length, b.length);
  a.forEach((position, i) => assert.ok(position.distanceTo(b[i]) < 1e-5));
  slow.dispose(); fast.dispose();
});

test('a resumed frame stays bounded, reduced motion emits fewer puffs, and funnel up controls thrust', () => {
  const normal = new TrainSmoke(), reduced = new TrainSmoke();
  reduced.reducedMotion = true;
  run(normal, 'normal', 1); run(reduced, 'normal', 1);
  assert.ok(reduced.activeCount > 0 && reduced.activeCount < normal.activeCount);
  normal.update(20, zero, up, 60, 'e');
  assert.ok(normal.activeCount <= 10, 'long background frame has no emission backlog');
  normal.reset();
  const outward = new THREE.Vector3(1, 0, 0);
  for (let frame = 0; frame < 30; frame++) normal.update(1 / 60, zero, outward, 10, 'd', zero);
  assert.ok(positions(normal).some(position => position.x > 1.5), 'jet follows the tilted funnel');
  assert.ok(positions(normal).every(position => Math.abs(position.y) < 1), 'jet is not hard-coded to world up');
  normal.dispose(); reduced.dispose();
});
