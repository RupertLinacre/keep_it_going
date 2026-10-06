import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createChristmasSleigh, createChristmasGift, CHRISTMAS_GIFT_COLORS, christmasTrainAt } from "../src/games/christmas-sleigh";
import { MiniView } from "../src/games/mini-view";
import type { MiniTrack } from "../src/games/mini-track";
import { WORLD_LAP } from "../src/games/adventure-worlds";
import { mirrorRotation } from "../src/multiplayer/ghost";

function dispose(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  materials.forEach(material => material.dispose());
}

test("all sleigh roles share rail-sized runners and a bounded single draw batch", () => {
  for (const [engine, cargo] of [[true, false], [false, false], [false, true]]) {
    const group = createChristmasSleigh(engine, undefined, cargo);
    try {
      assert.equal(group.children.length, 1);
      const mesh = group.children[0] as THREE.Mesh;
      const geometry = mesh.geometry, position = geometry.getAttribute("position");
      assert.ok(position.count < 40000, `bounded model size: ${position.count}`);
      for (const attribute of ["position", "normal", "color", "sleighGlow"]) {
        assert.equal(geometry.getAttribute(attribute).count, position.count);
        assert.ok(Array.from(geometry.getAttribute(attribute).array).every(Number.isFinite));
      }
      const bounds = new THREE.Box3().setFromObject(group);
      assert.ok(bounds.max.x - bounds.min.x < 1.6, "matches the ordinary train width");
      assert.ok(bounds.max.z - bounds.min.z < 2.4, "fits ordinary cart spacing");
      assert.ok(bounds.min.y > 0, "runners sit above the rail frame");
      assert.ok(bounds.max.y < 2.55, "enlarged Santa fits the Christmas arch and tunnel clearance");
      assert.ok(group.userData.detailNames.includes("curled-gold-runner"));
      assert.equal(group.userData.detailNames.includes("santa-face"), engine);
      assert.equal(group.userData.detailNames.includes("santa-beard"), engine);
      assert.equal(group.userData.detailNames.includes("santa-hat"), engine);
      assert.equal(group.userData.detailNames.includes("velvet-toy-sack"), cargo);
      assert.ok((mesh.material as THREE.MeshStandardMaterial).vertexColors);
    } finally { dispose(group); }
  }
});

test("gift bounds preserve ordinary parcel collisions and a visible looped bow", () => {
  const group = createChristmasGift();
  try {
    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.max.x - bounds.min.x <= .7);
    assert.ok(bounds.max.z - bounds.min.z <= .7);
    assert.ok(bounds.min.y >= -.35 && bounds.max.y <= .4);
    assert.ok(group.getObjectByName("wrapping-paper"));
    assert.equal(group.children.filter(child => child.name === "looped-bow").length, 2);
    assert.equal(CHRISTMAS_GIFT_COLORS.length, 6);
  } finally { dispose(group); }
});

test("Christmas applies to the whole current section and repeats on later laps", () => {
  const makeTrack = (start: number, generative = true, towerDemo = false) => ({
    options: { generative, towerDemo }, sectionAt: () => ({ start }),
  }) as unknown as Pick<MiniTrack, "options" | "sectionAt">;
  assert.equal(christmasTrainAt(makeTrack(4199), 4235), false, "a boundary-crossing previous section keeps its world");
  assert.equal(christmasTrainAt(makeTrack(4200), 4235), true, "Twilight Lapland");
  assert.equal(christmasTrainAt(makeTrack(5400), 5435), true, "Frosty Lake Fair");
  for (const start of [0, 900, 1900, 3000]) assert.equal(christmasTrainAt(makeTrack(start), start + 35), false);
  assert.equal(christmasTrainAt(makeTrack(WORLD_LAP - 1), WORLD_LAP + 10), true);
  assert.equal(christmasTrainAt(makeTrack(WORLD_LAP), WORLD_LAP + 10), false, "next meadow restores the normal train");
  assert.equal(christmasTrainAt(makeTrack(WORLD_LAP + 4200), WORLD_LAP + 4250), true);
  assert.equal(christmasTrainAt(makeTrack(4300, false), 4350), false);
  assert.equal(christmasTrainAt(makeTrack(4300, true, true), 4350), false);
  // Racers on either side of a boundary resolve independently.
  assert.equal(christmasTrainAt(makeTrack(4100), 4150), false);
  assert.equal(christmasTrainAt(makeTrack(4300), 4350), true);
});

test("sleigh instances preserve local, mirrored-rival and detached flight transforms; exit clears them", () => {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color }));
    return materials.get(color)!;
  };
  const view = { scene: new THREE.Scene(), material };
  const prototype = MiniView.prototype as any;
  const factory = (geometry: THREE.BufferGeometry, color: string) => new THREE.Mesh(geometry, material(color));
  const parts = prototype.instanceModel.call(view, createChristmasSleigh(false, factory), 3);
  const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.7, 1.2, 2.1));
  const transforms = [
    new THREE.Matrix4().compose(new THREE.Vector3(15, 4, 7), localRotation, new THREE.Vector3(1, 1, 1)),
    new THREE.Matrix4().compose(new THREE.Vector3(15, 4, -7), mirrorRotation(localRotation), new THREE.Vector3(1, 1, 1)),
    new THREE.Matrix4().compose(new THREE.Vector3(30, 13, 4), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.3, 2.1, -.6)), new THREE.Vector3(1, 1, 1)),
  ];
  prototype.drawModel.call(view, parts, transforms, []);
  const matrix = new THREE.Matrix4();
  for (const part of parts) {
    assert.equal(part.mesh.count, 3);
    for (let i = 0; i < transforms.length; i++) {
      part.mesh.getMatrixAt(i, matrix);
      const expected = transforms[i].clone().multiply(part.transform);
      for (let j = 0; j < 16; j++) assert.ok(Math.abs(matrix.elements[j] - expected.elements[j]) < 1e-6);
    }
  }
  const geometry = parts[0].mesh.geometry;
  prototype.drawModel.call(view, parts, [], []);
  assert.equal(parts[0].mesh.count, 0);
  assert.equal(parts[0].mesh.visible, false);
  assert.equal(parts[0].mesh.geometry, geometry, "cached geometry remains reusable on next entry");
  dispose(view.scene);
});

test("gift paper varies per instance while gold ribbons retain their colour", () => {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color }));
    return materials.get(color)!;
  };
  const view = { scene: new THREE.Scene(), material }, prototype = MiniView.prototype as any;
  const factory = (geometry: THREE.BufferGeometry, color: string) => new THREE.Mesh(geometry, material(color));
  const parts = prototype.instanceModel.call(view, createChristmasGift(factory), 6);
  const transforms = Array.from({ length: 6 }, (_, index) => new THREE.Matrix4().makeTranslation(index, 0, 0));
  prototype.drawModel.call(view, parts, transforms, [0, 1, 2, 3, 4, 5], CHRISTMAS_GIFT_COLORS);
  assert.equal(parts.length, 2, "paper and ribbons need only two batches");
  const color = new THREE.Color();
  for (const part of parts) {
    if (part.body) for (let i = 0; i < 6; i++) {
      part.mesh.getColorAt(i, color);
      assert.ok(Math.abs(color.r - CHRISTMAS_GIFT_COLORS[i].r) < 1e-6);
    } else assert.equal(part.mesh.instanceColor, null);
  }
  dispose(view.scene);
});

