import * as THREE from "three";

export const CART_COLORS = ["#e5ef93", "#e9a8a7", "#9fbddd", "#c6b0e5", "#eec987", "#a8dac7"].map(c => new THREE.Color(c));
export type MiniModelMeshFactory = (geometry: THREE.BufferGeometry, color: string) => THREE.Mesh;

function defaultMeshFactory(): MiniModelMeshFactory {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  return (geometry, color) => {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .06 });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
}

/** The same carriage geometry for the continuous ride and special attractions.
 * Callers own the returned geometries and default materials; an optional factory
 * lets an existing renderer keep its material cache and instancing pipeline. */
export function createMiniCar(color: string, open = false, meshFactory: MiniModelMeshFactory = defaultMeshFactory()) {
  const group = new THREE.Group();
  const board = meshFactory(new THREE.BoxGeometry(1.45, 0.25, 2.1), "#6f8e89");
  board.position.y = 0.26;
  group.add(board);
  if (open) {
    for (const x of [-0.62, 0.62]) {
      const wall = meshFactory(new THREE.BoxGeometry(0.16, 0.58, 2.02), color);
      wall.position.set(x, 0.66, 0); group.add(wall);
      const rim = meshFactory(new THREE.BoxGeometry(0.2, 0.08, 2.06), "#fff0ca");
      rim.position.set(x, 0.98, 0); group.add(rim);
    }
    for (const z of [-0.95, 0.95]) {
      const wall = meshFactory(new THREE.BoxGeometry(1.1, 0.58, 0.16), color);
      wall.position.set(0, 0.66, z); group.add(wall);
    }
  } else {
    const cube = new THREE.BoxGeometry(0.7, 0.52, 0.52);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const block = meshFactory(cube, color);
        block.position.set(0, 0.64 + row * 0.56, (col - 1) * 0.57);
        group.add(block);
      }
  }
  for (const x of [-0.6, 0.6])
    for (const z of [-0.68, 0.68]) {
      const wheel = meshFactory(
        new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12),
        "#536b73",
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.12, z);
      group.add(wheel);
    }
  if (!open) for (const z of [-0.22, 0.22]) {
    const eye = meshFactory(new THREE.SphereGeometry(0.2, 10, 8), "#fffef7");
    eye.scale.set(0.4, 1.2, 0.8);
    eye.position.set(0.4, 1.1, z);
    group.add(eye);
    const pupil = meshFactory(new THREE.SphereGeometry(0.067, 8, 6), "#3b465a");
    pupil.position.set(0.49, 1.09, z - 0.025);
    group.add(pupil);
  }
  if (!open) {
    const roof = meshFactory(new THREE.BoxGeometry(0.84, 0.12, 1.9), "#fff0ca");
    roof.position.y = 1.57;
    group.add(roof);
  }
  return group;
}

export function createMiniParcel(meshFactory: MiniModelMeshFactory = defaultMeshFactory()) {
  const group = new THREE.Group();
  group.add(meshFactory(new THREE.BoxGeometry(0.68, 0.68, 0.68), "#c89560"));
  group.add(meshFactory(new THREE.BoxGeometry(0.12, 0.69, 0.69), "#f9e8b9"));
  group.add(meshFactory(new THREE.BoxGeometry(0.69, 0.69, 0.12), "#f9e8b9"));
  return group;
}
