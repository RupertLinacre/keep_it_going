import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { WorldModel } from '../src/games/world-models';
import { meadowScenery } from '../src/games/background-meadow';
import { mountainScenery } from '../src/games/world-mountains';
import { nightScenery } from '../src/games/world-night';
import { halloweenScenery } from '../src/games/world-halloween';
import { seededRandom } from '../src/games/mini-rail';
import { AdventureScene } from '../src/games/adventure-scene';
import { MiniTrack } from '../src/games/mini-track';

test('background bays keep explicit geometry budgets, finite normals and separate race sightlines', () => {
  // These caps protect the geometry savings, including all optional buildings.
  const builders = [
    { name: 'meadow', limit: 1800, build: (m: WorldModel, r: () => number) => meadowScenery(m, () => {}, 16, -22, 9, r) },
    { name: 'mountain', limit: 1800, build: (m: WorldModel, r: () => number) => mountainScenery(m, 16, -22, 9, r) },
    { name: 'night', limit: 2600, build: (m: WorldModel, r: () => number) => nightScenery(m, 16, -22, 9, r) },
    { name: 'halloween', limit: 1600, build: (m: WorldModel, r: () => number) => halloweenScenery(m, 16, -22, 9, r, () => {}) },
  ];
  const solid = new MeshBasicMaterial(), glow = new MeshBasicMaterial();
  try {
    for (const { name, limit, build } of builders) for (let seed = 1; seed <= 32; seed++) {
      const model = new WorldModel(true); build(model, seededRandom(seed));
      const group = model.finish(solid, glow); let triangles = 0;
      assert.ok(group.children.length <= 4, `${name}: static material batches`);
      for (const child of group.children) {
        const mesh = child as Mesh, p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal');
        triangles += p.count / 3;
        for (let i = 0; i < p.count; i++) {
          assert.ok([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite), `${name}: finite vertices`);
          assert.ok(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > .99, `${name}: valid surface normals`);
          // No background primitive may straddle the centre aisle or leave the board.
          assert.ok(mesh.userData.front ? p.getZ(i) > 4 : p.getZ(i) < -4, `${name}: clear rail corridor`);
          assert.ok(p.getZ(i) >= -84.01 && p.getZ(i) <= 49, `${name}: terrain envelope`);
        }
        for (let i = 0; i < p.count; i += 3) {
          const y = p.getY(i);
          if (n.getY(i) > .99 && y > 0 && y < .075 &&
            Math.abs(p.getY(i + 1) - y) < 1e-6 && Math.abs(p.getY(i + 2) - y) < 1e-6) {
            assert.fail(`${name}: upward ground detail is buried beneath the .075m turf surface`);
          }
        }
        mesh.geometry.dispose();
      }
      assert.ok(triangles > 100 && triangles <= limit, `${name}: ${triangles} > ${limit}`);
    }
  } finally { solid.dispose(); glow.dispose(); }
});

test('backgrounds stay anchored and shared behind both race lanes', () => {
  const scene = new AdventureScene(new Scene()), track = new MiniTrack(42, { generative: true, multiplayer: true });
  try {
    for (const distance of [180, 1120, 2120, 3220]) {
      track.ensure(distance);
      scene.render(track, distance, 0, 35, 12, distance - 35);
      const staticPositions = [...scene.tiles.values()].flatMap(tile => tile.root.children.map(mesh => ({
        mesh, p: mesh.getWorldPosition(new Vector3()), tile,
      })));
      const actors = scene.group.children.filter((o): o is InstancedMesh => o instanceof InstancedMesh);
      const original = actors.map(mesh => Array.from({ length: mesh.count }, (_, i) => {
        const matrix = new Matrix4(); mesh.getMatrixAt(i, matrix); return matrix;
      }));
      scene.render(track, distance, 25, 35, 12, distance - 35);
      for (const { mesh, p, tile } of staticPositions) {
        const now = mesh.getWorldPosition(new Vector3());
        assert.ok(now.distanceTo(p.add(new Vector3(-25, 0, 0))) < 1e-6, 'Origin rebasing does not slide decoration');
        assert.equal(mesh.position.z, mesh.userData.front ? 35 : -35 - 2 * tile.section.origin.z);
      }
      for (const [j, mesh] of actors.entries()) for (let i = 0; i < mesh.count; i++) {
        const matrix = new Matrix4(); mesh.getMatrixAt(i, matrix);
        assert.ok(Math.abs(matrix.elements[12] - original[j][i].elements[12] + 25) < .001);
        assert.equal(matrix.elements[13], original[j][i].elements[13]);
        assert.equal(matrix.elements[14], original[j][i].elements[14]);
      }
      for (const mesh of actors) {
        if (mesh.count) assert.deepEqual(mesh.instanceMatrix.updateRanges, [{ start: 0, count: mesh.count * 16 }]);
        else assert.equal(mesh.visible, false);
      }
    }
  } finally { scene.destroy(); }
});
