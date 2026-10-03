import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { MiniSection, type MiniKind } from '../src/games/mini-track';
import { createMountainPieceAnimation, mountainGreeting, goatGreetingHop } from '../src/games/mountain-piece-animation';
import { FairgroundLights } from '../src/games/world-lighting';
import { mountainGondolaPosition } from '../src/games/mountain-gondolas';

function section(kind: MiniKind) {
  return new MiniSection(7, kind, 400, new Vector3(100, 7, 30), kind === 'tunnel' ? 52 : 90, kind === 'tunnel' ? 1.1 : 22, 0, 1);
}
const meshes = (animation: NonNullable<ReturnType<typeof createMountainPieceAnimation>>) => animation.group.children as InstancedMesh[];
const matrices = (animation: NonNullable<ReturnType<typeof createMountainPieceAnimation>>) => meshes(animation).map(m => Array.from(m.instanceMatrix.array));

test('mountain animation batches are bounded, replayable and release only owned geometry', () => {
  for (const kind of ['mountainpass', 'tunnel', 'ravinebridge'] as const) {
    const s = section(kind), material = new MeshStandardMaterial(), lights = new FairgroundLights();
    let materialDisposals = 0; material.addEventListener('dispose', () => materialDisposals++); lights.addEventListener('dispose', () => materialDisposals++);
    const animation = createMountainPieceAnimation(s, material, lights)!;
    assert.ok(meshes(animation).length <= 4);
    meshes(animation).forEach(m => {
      assert.ok(m.geometry.getAttribute('color'), 'Shared vertex-colour materials need explicit colours on every geometry');
      if (m.material === lights) assert.ok(m.geometry.getAttribute('lightPhase'));
    });
    const buffers = meshes(animation).map(m => m.instanceMatrix.array), counts = meshes(animation).map(m => m.count);
    animation.update(3, s.start + s.length * .5, false); const expected = matrices(animation);
    animation.update(100, s.end + 100, false);
    animation.update(3, s.start + s.length * .5, false); assert.deepEqual(matrices(animation), expected, 'Scrubbing reproduces the original pose');
    for (let i = 0; i < 600; i++) animation.update(i / 60, s.start + i / 5, false);
    meshes(animation).forEach((m, i) => { assert.equal(m.instanceMatrix.array, buffers[i]); assert.equal(m.count, counts[i]); assert.ok(Array.from(m.instanceMatrix.array).every(Number.isFinite)); });
    let disposals = 0, instanceDisposals = 0; meshes(animation).forEach(m => {
      m.geometry.addEventListener('dispose', () => disposals++);
      m.addEventListener('dispose', () => instanceDisposals++);
    });
    animation.dispose(); assert.equal(disposals, buffers.length); assert.equal(instanceDisposals, buffers.length); assert.equal(materialDisposals, 0);
    material.dispose(); lights.dispose();
  }
});

test('reduced motion holds all mountain ornaments still and cached heights avoid double lifting', () => {
  for (const kind of ['mountainpass', 'tunnel', 'ravinebridge'] as const) {
    const s = section(kind), material = new MeshStandardMaterial(), lights = new FairgroundLights();
    const animation = createMountainPieceAnimation(s, material, lights)!;
    animation.update(0, s.start, true); const still = matrices(animation);
    animation.update(80, s.end, true); assert.deepEqual(matrices(animation), still);
    animation.update(3, s.start + 20, false); const beforeLift = matrices(animation);
    s.frames.forEach(f => f.position.y += 40);
    animation.update(3, s.start + 20, false); assert.deepEqual(matrices(animation), beforeLift);
    animation.dispose(); material.dispose(); lights.dispose();
  }
});

test('goat greetings respond to each train while their platforms remain outside the railway', () => {
  const s = section('mountainpass'), material = new MeshStandardMaterial(), lights = new FairgroundLights();
  const animation = createMountainPieceAnimation(s, material, lights)!;
  const goats = meshes(animation)[0], matrix = new Matrix4(), position = new Vector3(), scale = new Vector3(), rotation = new Quaternion();
  animation.update(.32, s.start + s.length * .5, false);
  const heads = meshes(animation)[1], relativeHead = new Matrix4(), bodyInverse = new Matrix4();
  goats.getMatrixAt(2, bodyInverse); bodyInverse.invert(); heads.getMatrixAt(2, relativeHead); relativeHead.premultiply(bodyInverse);
  const greetingHead = relativeHead.clone();
  animation.update(.32, s.start - 90, false);
  goats.getMatrixAt(2, bodyInverse); bodyInverse.invert(); heads.getMatrixAt(2, relativeHead); relativeHead.premultiply(bodyInverse);
  assert.ok(relativeHead.elements.some((v, i) => Math.abs(v - greetingHead.elements[i]) > .05), 'Heads turn independently of the jumping bodies');
  animation.update(.32, s.start + s.length * .5, false);
  for (let i = 0; i < goats.count; i++) {
    goats.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
    const worldX = s.origin.x + position.x;
    const frame = s.frames.reduce((best, f) => Math.abs(f.position.x - worldX) < Math.abs(best.position.x - worldX) ? f : best);
    assert.ok(position.z + s.origin.z - frame.position.z > 3.9, 'Goats never jump onto the rails');
  }
  assert.equal(mountainGreeting(s.start + 30, s.start + 30), 1);
  assert.ok(mountainGreeting(s.start - 100, s.start + 30) < .001);
  animation.dispose(); material.dispose(); lights.dispose();
});

test('gondolas keep moving between trains while retaining exact train coupling', () => {
  const s = section('tunnel'), at = s.start - 20;
  const a = mountainGondolaPosition(s, at, .25, 10), b = mountainGondolaPosition(s, at, .25, 10.01);
  assert.ok(Math.abs(a.distanceTo(b) - .0085) < 1e-6);
  const center = s.start + s.length / 2;
  const c = mountainGondolaPosition(s, center, .25, 10), d = mountainGondolaPosition(s, center + .01, .25, 10);
  assert.ok(Math.abs(c.distanceTo(d) - .01) < 1e-6);
});


test('goat greeting is a continuous crouch, high hop and smaller landing skip', () => {
  const stop = 40;
  assert.deepEqual(goatGreetingHop(stop - 8, stop), { height: 0, squash: 0, tilt: 0 });
  assert.deepEqual(goatGreetingHop(stop + 14, stop), { height: 0, squash: 0, tilt: 0 });
  let previous = goatGreetingHop(stop - 8, stop), tallest = 0;
  for (let i = 1; i <= 220; i++) {
    const next = goatGreetingHop(stop - 8 + i / 10, stop);
    assert.ok(Math.abs(next.height - previous.height) < .08);
    assert.ok(next.height >= -1e-10 && next.squash >= 0 && next.squash <= .16);
    tallest = Math.max(tallest, next.height); previous = next;
  }
  assert.ok(tallest > 1.1);
  assert.ok(goatGreetingHop(stop + 11, stop).height < .37);
});
