import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MiniSection } from "./mini-track";

/** Bake fixed model parts into one mesh per material. Wheels, trees and blocks
 * retain their geometry but no longer need a draw call for every small part. */
export function mergeStaticMeshes(group: THREE.Group) {
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
    const batch = batches.get(object.material) ?? [];
    batch.push(object); batches.set(object.material, batch);
  });
  const retired = new Set<THREE.BufferGeometry>();
  const retained = new Set<THREE.BufferGeometry>();
  for (const [material, sources] of batches) {
    if (sources.length === 1) { retained.add(sources[0].geometry); continue; }
    const geometries = sources.map(source => {
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
      // Solid-colour models need no UVs. Rails and primitives can share a
      // material, so give them the same position/normal attribute layout.
      geometry.deleteAttribute("uv");
      source.removeFromParent(); retired.add(source.geometry);
      return geometry;
    });
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach(part => part.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  retired.forEach(geometry => { if (!retained.has(geometry)) geometry.dispose(); });
}

/** Reuse the physics rail frames instead of asking TubeGeometry to sample and
 * calculate a second set of Frenet frames for each rail. Typed buffers avoid
 * large temporary JS arrays when a new piece enters the view. */
export function railGeometries(section: MiniSection, from: number, to: number) {
  const segments = Math.max(24, Math.min(4800, Math.ceil((to - from) * 3)));
  const sides = 6, stride = sides + 1, vertices = (segments + 1) * stride;
  const positions = [new Float32Array(vertices * 3), new Float32Array(vertices * 3)];
  const normals = new Float32Array(vertices * 3);
  const indices = new (vertices < 65536 ? Uint16Array : Uint32Array)(segments * sides * 6);
  const offsets = [-0.57, 0.57];
  for (let i = 0; i <= segments; i++) {
    const frame = section.sample(from + (to - from) * i / segments);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      const nx = frame.right.x * c + frame.up.x * s;
      const ny = frame.right.y * c + frame.up.y * s;
      const nz = frame.right.z * c + frame.up.z * s;
      const at = (i * stride + j) * 3;
      normals[at] = nx; normals[at + 1] = ny; normals[at + 2] = nz;
      for (let rail = 0; rail < 2; rail++) {
        const p = positions[rail], offset = offsets[rail];
        p[at] = frame.position.x - section.origin.x + frame.right.x * offset + nx * 0.095;
        p[at + 1] = frame.position.y - section.origin.y + frame.right.y * offset + ny * 0.095;
        p[at + 2] = frame.position.z - section.origin.z + frame.right.z * offset + nz * 0.095;
      }
      if (i < segments && j < sides) {
        const a = i * stride + j, b = a + stride, at = (i * sides + j) * 6;
        indices.set([a, b, a + 1, b, b + 1, a + 1], at);
      }
    }
  }
  return positions.map(p => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    return geometry;
  });
}
