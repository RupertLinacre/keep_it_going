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
import { MiniSection, MiniTrack } from '../src/games/mini-track';
import { WORLDS } from '../src/games/adventure-worlds';

test('background bays keep explicit geometry budgets, finite normals and separate race sightlines', () => {
  // These caps protect the geometry savings, including all optional buildings.
  const builders = [
    { name: 'meadow', limit: 1800, build: (m: WorldModel, r: () => number, v: number) => meadowScenery(m, () => {}, 16, -22, 9, r, v) },
    { name: 'mountain', limit: 1800, build: (m: WorldModel, r: () => number, v: number) => mountainScenery(m, 16, -22, 9, r, v) },
    { name: 'night', limit: 2600, build: (m: WorldModel, r: () => number, v: number) => nightScenery(m, 16, -22, 9, r, v) },
    { name: 'halloween', limit: 1600, build: (m: WorldModel, r: () => number, v: number) => halloweenScenery(m, 16, -22, 9, r, () => {}, v) },
  ];
  const solid = new MeshBasicMaterial(), glow = new MeshBasicMaterial();
  try {
    for (const { name, limit, build } of builders) for (let variant = 0; variant < 3; variant++) for (let seed = 1; seed <= 32; seed++) {
      const model = new WorldModel(true); build(model, seededRandom(seed), variant);
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

test('consecutive short sections retain a cheap continuous backdrop without crowded props', () => {
  const track = new MiniTrack(42, { generative: true });
  track.sections.splice(0, track.sections.length, ...Array.from({ length: 5 }, (_, i) =>
    new MiniSection(i, 'station', i * 20, new Vector3(i * 20, 4, 0), 20, 0, 0, 1)));
  for (const world of WORLDS) {
    const scene = new AdventureScene(new Scene(), { world });
    try {
      scene.render(track, 40, 0, 0, 0);
      assert.equal(scene.tiles.size, 5);
      let previousRight = -Infinity;
      for (const tile of [...scene.tiles.values()].sort((a, b) => a.section.id - b.section.id)) {
        assert.equal(tile.actors.length, 0, `${world.id}: no dense animated props on connectors`);
        assert.equal(tile.root.children.length, 1, `${world.id}: a single static backdrop batch`);
        const mesh = tile.root.children[0] as Mesh;
        assert.equal(mesh.userData.front, false);
        assert.ok(mesh.geometry.getAttribute('position').count / 3 <= 400, `${world.id}: cheap terrain`);
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox!;
        const left = bounds.min.x + tile.section.origin.x, right = bounds.max.x + tile.section.origin.x;
        if (Number.isFinite(previousRight)) assert.ok(left < previousRight, `${world.id}: hills overlap between connectors`);
        previousRight = right;
      }
    } finally { scene.destroy(); }
    const gallery = new AdventureScene(new Scene(), { world, attractionsOnly: true });
    try {
      gallery.render(track, 40, 0, 0, 0);
      assert.ok([...gallery.tiles.values()].every(tile => tile.root.children.length === 0), 'Gallery keeps its clear backdrop');
    } finally { gallery.destroy(); }
  }
});
