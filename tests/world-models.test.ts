import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../src/games/world-models';
import { FairgroundLights } from '../src/games/world-lighting';

function close(actual: T.BufferAttribute | T.InterleavedBufferAttribute, expected: T.BufferAttribute | T.InterleavedBufferAttribute) {
  assert.equal(actual.count, expected.count);
  for (let i = 0; i < actual.array.length; i++) assert.ok(Math.abs(actual.array[i] - expected.array[i]) < 1e-6, `attribute ${i}`);
}

test('direct scenery baking matches Three transforms, including nonuniform and reflected shapes', () => {
  const material = new T.MeshBasicMaterial(), glow = new FairgroundLights();
  try {
    for (const shape of Object.values(G)) for (const scale of [[2, .7, 3], [-2, .7, 3], [.8, -1.3, -2]]) {
      const model = new WorldModel(), position = [15, 7, -8], rotation = [.4, 1.2, -.7];
      model.add(shape, '#d432c8', position, scale, rotation);
      const group = model.finish(material, glow), mesh = group.children[0] as T.Mesh;
      const expected = shape.index ? shape.toNonIndexed() : shape.clone();
      const matrix = new T.Matrix4().compose(new T.Vector3(...position), new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(...scale));
      expected.applyMatrix4(matrix);
      if (matrix.determinant() < 0) for (const name of ['position', 'normal']) {
        const data = expected.getAttribute(name).array;
        for (let i = 0; i < data.length; i += 9) for (let j = 0; j < 3; j++) [data[i + j], data[i + 6 + j]] = [data[i + 6 + j], data[i + j]];
      }
      close(mesh.geometry.getAttribute('position'), expected.getAttribute('position'));
      close(mesh.geometry.getAttribute('normal'), expected.getAttribute('normal'));
      const colors = mesh.geometry.getAttribute('color'), color = new T.Color('#d432c8');
      for (let i = 0; i < colors.count; i++) assert.ok(new T.Color().fromBufferAttribute(colors, i).equals(new T.Color(Math.fround(color.r), Math.fround(color.g), Math.fround(color.b))));
      assert.equal(mesh.castShadow, true);
      assert.equal(mesh.receiveShadow, true);
      mesh.geometry.dispose(); expected.dispose();
    }
  } finally { material.dispose(); glow.dispose(); }
});

test('baking preserves lamp phases, halo centres, front batches and model reuse', () => {
  const model = new WorldModel(true), solid = new T.MeshBasicMaterial(), glow = new FairgroundLights();
  try {
    for (const z of [-8, 8]) {
      model.add(G.box, '#abcdef', [2, 1, z]);
      model.add(G.round, '#ffaabb', [4, 3, z], [.4, .8, .3], [0, 0, .5], true, 2.5);
    }
    const group = model.finish(solid, glow);
    assert.equal(group.children.length, 6);
    for (const child of group.children) {
      const mesh = child as T.Mesh, geo = mesh.geometry;
      if (mesh.material === glow || mesh.material === glow.halos) assert.ok(Array.from(geo.getAttribute('lightPhase').array).every(x => x === 2.5));
      if (mesh.material === glow.halos) {
        const c = geo.getAttribute('lightCenter');
        for (let i = 0; i < c.count; i++) assert.deepEqual([c.getX(i), c.getY(i), c.getZ(i)], [4, 3, mesh.userData.front ? 8 : -8]);
        assert.equal(mesh.castShadow, false);
      }
      geo.dispose();
    }
    assert.equal(model.finish(solid, glow).children.length, 0);
    model.add(G.round, '#ffffff', [0, 0, 0], [1, 1, 1], [0, 0, 0], true, 1);
    const noHalos = model.finish(solid, glow, false);
    assert.equal(noHalos.children.length, 1);
    (noHalos.children[0] as T.Mesh).geometry.dispose();
  } finally { solid.dispose(); glow.dispose(); }
});

test('custom geometry and caller transforms are snapshotted before later mutation or disposal', () => {
  const shape = new T.BoxGeometry(), model = new WorldModel(), material = new T.MeshBasicMaterial();
  const position = [0, 0, 0];
  model.add(shape, '#ffffff', position);
  position[0] = 99; shape.translate(10, 0, 0);
  model.add(shape, '#ffffff', [0, 0, 0]); shape.dispose();
  const group = model.finish(material, material), geo = (group.children[0] as T.Mesh).geometry, p = geo.getAttribute('position');
  for (let i = 0; i < p.count / 2; i++) assert.ok(Math.abs(p.getX(i)) <= .5);
  for (let i = p.count / 2; i < p.count; i++) assert.ok(p.getX(i) >= 9.5 && p.getX(i) <= 10.5);
  geo.dispose(); material.dispose();
});
