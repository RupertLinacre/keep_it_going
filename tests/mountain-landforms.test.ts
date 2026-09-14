import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Scene, Vector3 } from 'three';
import { mountainTunnel, MOUNTAIN_TUNNEL_LENGTH, tunnelRevealAt } from '../src/games/mountain-landforms';
import { AdventureScene } from '../src/games/adventure-scene';
import { createMiniSection, MiniTrack } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';

test('the mountain has an unobstructed bore with a real ceiling, walls and two open portals', () => {
  const material = new MeshStandardMaterial(), glow = new MeshBasicMaterial();
  const tunnel = mountainTunnel(material, glow); tunnel.updateMatrixWorld(true);
  const ray = (origin: number[], direction: number[]) => new Raycaster(new Vector3(...origin), new Vector3(...direction), 0, 40).intersectObject(tunnel, true);
  // Both directions, including the room occupied by loaded coaches.
  for (const sign of [-1, 1]) for (const x of [-1, 0, 1]) for (const y of [.2, 1.2, 2.2]) {
    assert.equal(ray([x, y, sign * (MOUNTAIN_TUNNEL_LENGTH / 2 + 2)], [0, 0, -sign]).length, 0);
  }
  for (const direction of [[0, 1, 0], [1, 0, 0], [-1, 0, 0]]) {
    const hits = ray([0, .6, 0], direction);
    assert.ok(hits.length && hits[0].distance < 3.2, 'The passage must be enclosed above and on both sides');
  }
  const owned = new Set<Material>([material, glow]);
  tunnel.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); owned.add(o.material as Material); } });
  owned.forEach(m => m.dispose());
});

test('the mountain reveal opens before entry and stays open for the trailing coaches', () => {
  const s = createMiniSection('tunnel', 1000, new Vector3(0, 4, 0), 20, seededRandom(42), true);
  const middle = s.start + s.length / 2;
  assert.equal(tunnelRevealAt(s, s.start - 30), 0);
  assert.equal(tunnelRevealAt(s, middle - 14), 1);
  assert.equal(tunnelRevealAt(s, middle + 14 + 20), 1);
  assert.ok(tunnelRevealAt(s, middle + 14 + 26) > 0);
  assert.equal(tunnelRevealAt(s, middle + 14 + 30), 0);
});

test('each player opens only their own tunnel wall and every private material is released once', () => {
  const track = new MiniTrack(42, { generative: true }); track.ensure(1000, 200);
  const s = track.sections.find(s => s.kind === 'tunnel')!; assert.ok(s);
  const middle = s.start + s.length / 2, scene = new Scene(), view = new AdventureScene(scene);
  view.render(track, middle, 0, 35, 0, s.start - 50);
  const tile = view.tiles.get(s.id)!; assert.ok(tile.tunnel && tile.mirrorTunnel);
  const materials = (root: typeof tile.tunnel) => {
    const m = new Map<number, Material>();
    root!.traverse(o => { if (o instanceof Mesh && o.userData.mountainCover) m.set(o.userData.mountainCover, o.material as Material); });
    return m;
  };
  const own = materials(tile.tunnel), opponent = materials(tile.mirrorTunnel);
  assert.ok(own.get(1)!.opacity < .2); assert.equal(own.get(-1)!.opacity, 1);
  assert.equal(opponent.get(-1)!.opacity, 1); assert.notEqual(own.get(1), opponent.get(1));
  view.render(track, middle + 50, 0, 35, 1, middle);
  assert.equal(own.get(1)!.opacity, 1); assert.ok(opponent.get(-1)!.opacity < .2);
  const disposed = new Map<Material, number>();
  view.group.traverse(o => {
    if (o instanceof Mesh && o.userData.mountainCover && !disposed.has(o.material as Material)) {
      const m = o.material as Material; disposed.set(m, 0);
      m.addEventListener('dispose', () => disposed.set(m, disposed.get(m)! + 1));
    }
  });
  view.destroy(); assert.ok(disposed.size >= 4); assert.ok([...disposed.values()].every(n => n === 1));
});

test('the gorge wall remains behind both race lanes and each ledge has a solid reverse face', () => {
  const track = new MiniTrack(42, { generative: true }); track.ensure(900, 150);
  const s = track.sections.find(s => s.kind === 'mountainpass')!;
  const view = new AdventureScene(new Scene()), lane = 35;
  view.render(track, s.start + s.length / 2, 0, lane, 1);
  const tile = view.tiles.get(s.id)!; view.group.updateMatrixWorld(true);
  const wall = new Box3().setFromObject(tile.gorgeWall!);
  const furthestRail = Math.min(...s.frames.map(f => -f.position.z - lane));
  assert.ok(wall.max.z < furthestRail, 'The high wall must not hide the far lane');
  for (const sign of [-1, 1]) {
    const p = s.frames[Math.round(s.resolution * .5)].position;
    const x = p.x - s.origin.x, z = p.z - s.origin.z;
    // Test either side of the ledge in its original model coordinates.
    const ray = new Raycaster(new Vector3(x, p.y * .75, z + sign * 20), new Vector3(0, 0, -sign), 0, 40);
    const formation = tile.formation!; const position = formation.position.clone();
    formation.position.set(0, 0, 0); formation.updateMatrixWorld(true);
    assert.ok(ray.intersectObject(formation, true).length, 'The rock shelf has faces visible from either race lane');
    formation.position.copy(position);
  }
  view.destroy();
});
