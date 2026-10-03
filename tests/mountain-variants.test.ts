import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
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

test('dragon wing deformation reuses its vertex buffer, replays exactly and honours reduced motion', () => {
  const s = section('tunnel'), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, 'b', material, lights)!;
  const meshes = allMeshes(design).filter(m => !(m instanceof InstancedMesh));
  const before = meshes.map(m => Array.from(m.geometry.getAttribute('position').array));
  design.update(2, s.start + s.length * .5 - 12, false);
  const moving = meshes.filter((m, i) => !Array.from(m.geometry.getAttribute('position').array).every((v, j) => v === before[i][j]));
  assert.equal(moving.length, 1, 'Only the batched wing geometry flexes');
  const attribute = moving[0].geometry.getAttribute('position'), buffer = attribute.array, pose = Array.from(buffer);
  design.update(20, s.end + 60, false); design.update(2, s.start + s.length * .5 - 12, false);
  assert.equal(attribute.array, buffer); assert.deepEqual(Array.from(buffer), pose);
  design.update(0, s.start, true); const still = Array.from(buffer); design.update(40, s.end, true); assert.deepEqual(Array.from(buffer), still);
  design.dispose(); material.dispose(); lights.dispose();
});

test('mountain and ice landscapes leave the full raised train envelope open', () => {
  for (const kind of ['mountainpass', 'ravinebridge'] as const) for (const option of ['b', 'c'] as const) {
    const s = section(kind), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, option, material, lights)!;
    design.group.updateMatrixWorld(true);
    for (let i = 2; i < 39; i++) for (const side of [-.85, 0, .85]) {
      const frame = s.frames[Math.round(s.resolution * i / 40)], p = frame.position.clone().addScaledVector(frame.right, side);
      p.x -= s.origin.x; p.z -= s.origin.z; p.y += .15;
      const hits = new Raycaster(p, new Vector3(0, 1, 0), 0, 2.8).intersectObject(design.group, true);
      assert.equal(hits.length, 0, `${kind}-${option} rail sample ${i} side ${side} stays open`);
    }
    design.dispose(); material.dispose(); lights.dispose();
  }
});


test('mining ore actually leaves its open bucket and reloads at the bottom without a position jump', () => {
  const s = section('tunnel'), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, 'c', material, lights)!;
  const payload = design.group.getObjectByName('mine-ore-payloads') as InstancedMesh;
  const buckets = design.group.getObjectByName('mine-empty-buckets') as InstancedMesh;
  const matrix = new Matrix4();
  const sample = (phase: number, mesh = payload) => {
    design.update(phase / .28, s.start - 100, false); mesh.getMatrixAt(0, matrix);
    return { p: new Vector3().setFromMatrixPosition(matrix), scale: new Vector3().setFromMatrixScale(matrix).length() };
  };
  const before = sample(Math.PI / 2 - 1e-5), after = sample(Math.PI / 2 + 1e-5);
  assert.ok(before.p.distanceTo(after.p) < .001, 'Ore does not teleport at the tipping point');
  const pouring = sample(Math.PI / 2 + .6), bucket = sample(Math.PI / 2 + .6, buckets);
  assert.ok(pouring.p.distanceTo(bucket.p) > 3, 'Gems travel down the separate sorting chute');
  assert.equal(sample(Math.PI + .2).scale, 0, 'Empty return side has no cargo floating above it');
  assert.ok(sample(Math.PI * 1.5 + .01).scale < .1, 'Load begins in the ground-level hopper');
  assert.ok(sample(Math.PI * 1.5 + .3).scale > 1, 'New load is full before climbing away');
  design.dispose(); material.dispose(); lights.dispose();
});

test('dragon eyelids wake for the train, blink without reallocating and replay exactly', () => {
  const s = section('tunnel'), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, 'b', material, lights)!;
  const face = design.group.getObjectByName('dragon-blinking-face') as InstancedMesh;
  const position = face.geometry.getAttribute('position'), colors = face.geometry.getAttribute('color'), tint = new Color('#f6efcb');
  const indices = Array.from({ length: position.count }, (_, i) => i).filter(i => Math.abs(colors.getX(i) - tint.r) < .001 && Math.abs(colors.getY(i) - tint.g) < .001 && Math.abs(colors.getZ(i) - tint.b) < .001);
  const range = () => Math.max(...indices.map(i => position.getY(i))) - Math.min(...indices.map(i => position.getY(i)));
  const distance = s.start + s.length * .5 - 12, buffer = position.array;
  design.update(1, s.start - 100, false); const sleepy = range();
  design.update(1, distance, false); const awake = range(); assert.ok(awake > sleepy * 3);
  const awakePose = Array.from(buffer); design.update(2, distance, false); assert.ok(range() < awake * .1, 'Brief eyelid close');
  design.update(1, distance, false); assert.equal(position.array, buffer); assert.deepEqual(Array.from(buffer), awakePose);
  design.update(0, s.start, true); const still = Array.from(buffer); design.update(8, s.end, true); assert.deepEqual(Array.from(buffer), still);
  design.dispose(); material.dispose(); lights.dispose();
});

test('penguin flippers remain attached to their shoulders during belly slides and turns', () => {
  const s = section('ravinebridge'), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, 'c', material, lights)!;
  const bodies = design.group.getObjectByName('penguin-riders') as InstancedMesh, wings = design.group.getObjectByName('penguin-flippers') as InstancedMesh;
  const body = new Matrix4(), wing = new Matrix4();
  for (const time of [0, 2, 4, 8]) {
    design.update(time, s.start + s.length * .5, false);
    for (let i = 0; i < 7; i++) for (let side = 0; side < 2; side++) {
      bodies.getMatrixAt(i, body); wings.getMatrixAt(i * 2 + side, wing);
      const shoulder = new Vector3().setFromMatrixPosition(wing.premultiply(body.invert()));
      assert.ok(shoulder.distanceTo(new Vector3(side ? .65 : -.65, 1.22, 0)) < 1e-4);
    }
  }
  design.dispose(); material.dispose(); lights.dispose();
});

test('marmot paws press down onto the keyboard instead of waving above it', () => {
  const s = section('mountainpass'), material = new MeshStandardMaterial(), lights = new FairgroundLights(), design = createMountainVariant(s, 'b', material, lights)!;
  const paws = design.group.getObjectByName('yodel-playing-paws') as InstancedMesh, matrix = new Matrix4();
  const i = Math.round(s.resolution * .22), platform = s.frames[i].position.clone(); platform.x -= s.origin.x; platform.z -= s.origin.z;
  const position = (time: number) => { design.update(time, s.start + s.distances[i], false); paws.getMatrixAt(0, matrix); return new Vector3(0, -.7, .35).applyMatrix4(matrix); };
  const pressed = position(Math.PI / 16), raised = position(Math.PI * 3 / 16);
  assert.ok(pressed.y < raised.y - .07);
  assert.ok(Math.abs(pressed.y - .18 - (platform.y + 1.095)) < .03, 'Paw underside touches the white key top');
  assert.ok(pressed.z > platform.z + 8.475 && pressed.z < platform.z + 9.325);
  design.dispose(); material.dispose(); lights.dispose();
});
