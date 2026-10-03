import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { MiniSection, type MiniKind } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMountainVariant } from '../src/review/variants/mountain-variants';

const kinds = ['mountainpass', 'tunnel', 'ravinebridge'] as const;
function section(kind: MiniKind) { return new MiniSection(4, kind, 600, new Vector3(73, 4, -20), kind === 'tunnel' ? 52 : 90, kind === 'tunnel' ? 1.1 : 22, 0, 1); }
function allMeshes(root: ReturnType<typeof createMountainVariant>) { const result: Mesh[] = []; root!.group.traverse(o => { if (o instanceof Mesh) result.push(o); }); return result; }
function poses(root: ReturnType<typeof createMountainVariant>) { return allMeshes(root).filter((m): m is InstancedMesh => m instanceof InstancedMesh).map(m => Array.from(m.instanceMatrix.array)); }

test('all six complete mountain alternatives respect scene budgets and dispose their fixed pools', () => {
  for (const kind of kinds) for (const option of ['b', 'c'] as const) {
    const material = new MeshStandardMaterial({ vertexColors: true }), lights = new FairgroundLights(), s = section(kind);
    const design = createMountainVariant(s, option, material, lights)!;
    const meshes = allMeshes(design), triangles = meshes.reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3 * (m instanceof InstancedMesh ? m.count : 1), 0);
    assert.ok(meshes.length <= 7, `${kind}-${option} has ${meshes.length} draw batches`);
    assert.ok(triangles < 40000, `${kind}-${option} has ${triangles} triangles`);
    const buffers = meshes.map(m => m instanceof InstancedMesh ? m.instanceMatrix.array : m.geometry.getAttribute('position').array);
    for (let i = 0; i < 360; i++) design.update(i / 60, s.start - 20 + i, false);
    meshes.forEach((m, i) => {
      assert.equal(m instanceof InstancedMesh ? m.instanceMatrix.array : m.geometry.getAttribute('position').array, buffers[i]);
      assert.ok(Array.from(buffers[i]).every(Number.isFinite));
      assert.ok(m.geometry.getAttribute('color')); assert.equal(m.castShadow, false);
      if (m.material === lights) assert.ok(m.geometry.getAttribute('lightPhase'));
    });
    let geometries = 0, instances = 0, materials = 0;
    meshes.forEach(m => { m.geometry.addEventListener('dispose', () => geometries++); if (m instanceof InstancedMesh) m.addEventListener('dispose', () => instances++); });
    material.addEventListener('dispose', () => materials++); lights.addEventListener('dispose', () => materials++);
    design.dispose(); assert.equal(geometries, meshes.length); assert.equal(instances, meshes.filter(m => m instanceof InstancedMesh).length); assert.equal(materials, 0);
    material.dispose(); lights.dispose();
  }
});

test('mountain alternatives replay deterministically, respond to trains, and hold still for reduced motion', () => {
  for (const kind of kinds) for (const option of ['b', 'c'] as const) {
    const material = new MeshStandardMaterial(), lights = new FairgroundLights(), s = section(kind), design = createMountainVariant(s, option, material, lights)!;
    const distance = s.start + s.length * .5;
    design.update(2, distance, false); const near = poses(design);
    design.update(12, s.end + 100, false); design.update(2, distance, false); assert.deepEqual(poses(design), near);
    design.update(2, s.start - 80, false); assert.notDeepEqual(poses(design), near, `${kind}-${option} reacts to the passing train`);
    design.update(0, s.start, true); const still = poses(design); design.update(10, s.end, true); assert.deepEqual(poses(design), still);
    design.update(2, distance, false); s.frames.forEach(f => f.position.y += 40); design.update(2, distance, false); assert.deepEqual(poses(design), near, 'Later track lift must only be applied by the owner');
    design.dispose(); material.dispose(); lights.dispose();
  }
});

test('dragon and mining alternatives have real, clear, enclosed bores and independent cutaways', () => {
  for (const option of ['b', 'c'] as const) {
    const s = section('tunnel'), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, option, material, lights)!;
    design.group.updateMatrixWorld(true);
    const local = design.group.children[0], ray = (p: number[], d: number[]) => {
      const origin = new Vector3(...p).applyMatrix4(local.matrixWorld), direction = new Vector3(...d).transformDirection(local.matrixWorld);
      return new Raycaster(origin, direction, 0, 40).intersectObject(design.group, true);
    };
    for (const sign of [-1, 1]) for (const x of [-1, 0, 1]) for (const y of [.2, 1.2, 2.2]) assert.equal(ray([x, y, sign * 17], [0, 0, -sign]).length, 0, `${option}: coach envelope stays clear`);
    for (const d of [[0, 1, 0], [-1, 0, 0], [1, 0, 0]]) { const hits = ray([0, .6, 0], d); assert.ok(hits.length && hits[0].distance < 3.3, `${option} direction ${d}: ${hits.map(h=>h.distance)}`); }
    design.group.userData.cutaway = true; design.update(1, s.start + 30, false);
    assert.ok(local.children.some(c => !c.visible));
    design.group.userData.cutaway = false; design.update(1, s.start + 30, false); assert.ok(local.children.every(c => c.visible));
    design.dispose(); material.dispose(); lights.dispose();
  }
});
