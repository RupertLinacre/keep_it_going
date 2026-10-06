import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SleighMagic } from '../src/games/sleigh-magic';

const rotation = new THREE.Quaternion(), position = new THREE.Vector3();

test('magic uses one bounded sparkle buffer and fades away after leaving Christmas', () => {
  const magic = new SleighMagic(), attributes = Object.values(magic.geometry.attributes).map(a => a.array);
  try {
    for (let i = 0; i < 600; i++) magic.update(1 / 60, position, rotation, 70);
    assert.ok(magic.activeCount > 100 && magic.activeCount <= 384);
    assert.equal(magic.group.children.length, 1);
    assert.equal(magic.material.blending, THREE.AdditiveBlending);
    assert.equal(magic.material.depthWrite, false);
    assert.equal(magic.material.depthTest, true);
    Object.values(magic.geometry.attributes).forEach((a, i) => assert.equal(a.array, attributes[i]));
    magic.update(3, null, rotation, 0);
    assert.equal(magic.activeCount, 0);
    assert.equal(magic.points.visible, false);
  } finally { magic.dispose(); magic.dispose(); }
});

test('runner trails stay where they were emitted through teleports, rebasing and pauses', () => {
  const magic = new SleighMagic();
  try {
    magic.update(.1, position, rotation, 30);
    const attribute = magic.geometry.getAttribute('position');
    const before = Array.from(attribute.array), births = Array.from(magic.geometry.getAttribute('born').array);
    assert.equal(before[0], Math.fround(-.86)); assert.equal(before[3], Math.fround(.86));
    assert.equal(before[2], Math.fround(1.05), 'emits behind the sleigh, away from its -Z forward');
    magic.update(0, new THREE.Vector3(500, 0, 0), rotation, 30);
    assert.deepEqual(Array.from(attribute.array), before);
    magic.update(.02, new THREE.Vector3(500, 0, 0), rotation, 30);
    let retained = 0;
    for (let i = 0; i < births.length; i++) {
      const born = magic.geometry.getAttribute('born').getX(i);
      if (births[i] >= 0 && born === births[i]) {
        retained++;
        assert.deepEqual(Array.from(attribute.array).slice(i * 3, i * 3 + 3), before.slice(i * 3, i * 3 + 3));
      } else if (born >= 0) assert.ok(attribute.getX(i) > 499, 'no glitter bridge across a teleport');
    }
    assert.ok(retained > 0);
    const after = Array.from(attribute.array);
    magic.group.position.x = -500;
    assert.deepEqual(Array.from(attribute.array), after, 'origin shifts the parent, not old particle positions');
  } finally { magic.dispose(); }
});

test('reduced motion lowers emission and resets clear stale glitter for a new ride', () => {
  const magic = new SleighMagic(), reduced = new SleighMagic();
  reduced.reducedMotion = true;
  try {
    for (let i = 0; i < 60; i++) {
      magic.update(1 / 60, position, rotation, 40);
      reduced.update(1 / 60, position, rotation, 40);
    }
    assert.ok(reduced.activeCount > 0 && reduced.activeCount < magic.activeCount);
    assert.equal(reduced.material.uniforms.motion.value, 0);
    magic.reset();
    assert.equal(magic.activeCount, 0); assert.equal(magic.points.visible, false);
    magic.update(20, position, rotation, 70);
    assert.ok(magic.activeCount < 30, 'a resumed tab cannot build an emission backlog');
  } finally { magic.dispose(); reduced.dispose(); }
});
