import * as T from 'three';
import { FairgroundLights } from './world-lighting';

type Shape = { positions: Float32Array; normals: Float32Array };
type Part = { shape: Shape; matrix: T.Matrix4; normal: T.Matrix3; color: T.Color; mirrored: boolean; phase: number; center: number[] };
const templates = new WeakMap<T.BufferGeometry, Shape>();

/** Snapshot only the attributes these solid-colour models use. Shared primitives
 * are immutable; expanding their indices once avoids thousands of geometry/UV
 * clones when several new scenery sections enter the window together. */
function shapeData(geometry: T.BufferGeometry): Shape {
  const cached = templates.get(geometry);
  if (cached) return cached;
  const source = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), index = geometry.index;
  const count = index?.count ?? source.count;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const at = index ? index.getX(i) : i;
    positions[i * 3] = source.getX(at); positions[i * 3 + 1] = source.getY(at); positions[i * 3 + 2] = source.getZ(at);
    normals[i * 3] = normal.getX(at); normals[i * 3 + 1] = normal.getY(at); normals[i * 3 + 2] = normal.getZ(at);
  }
  const result = { positions, normals };
  // Custom geometry may be edited between add() calls. Only our known immutable
  // primitives are cached; everything else keeps add()'s snapshot semantics.
  if (sharedShapes.has(geometry)) templates.set(geometry, result);
  return result;
}

/** One vertex-coloured batch per scenery tile. Bake directly into final buffers:
 * the geometry, materials and draw calls match the old clone/merge path. */
export class WorldModel {
  private solid: Part[] = [];
  private glow: Part[] = [];
  private frontSolid: Part[] = [];
  private frontGlow: Part[] = [];
  private halos: Part[] = [];
  private frontHalos: Part[] = [];
  constructor(private splitLandscape = false) {}
  add(geometry: T.BufferGeometry, color: string, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0], glow = false, phase = -1) {
    const matrix = new T.Matrix4().compose(new T.Vector3(...position),
      new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(...scale));
    const part: Part = { shape: shapeData(geometry), matrix, normal: new T.Matrix3().getNormalMatrix(matrix),
      color: new T.Color(color), mirrored: matrix.determinant() < 0, phase, center: [...position] };
    const front = this.splitLandscape && position[2] > 0;
    (front ? glow ? this.frontGlow : this.frontSolid : glow ? this.glow : this.solid).push(part);
    if (glow && phase >= 0 && geometry === WORLD_SHAPES.round) (front ? this.frontHalos : this.halos).push(part);
  }
  beam(color: string, from: T.Vector3, to: T.Vector3, radius = .1, glow = false, phase = -1) {
    const delta = to.clone().sub(from), length = delta.length();
    if (length < .0001) return;
    const rotation = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.divideScalar(length)));
    this.add(WORLD_SHAPES.pole, color, from.clone().add(to).multiplyScalar(.5).toArray(), [radius, length, radius], [rotation.x, rotation.y, rotation.z], glow, phase);
  }
  private bake(parts: Part[], luminous: boolean, halo = false) {
    const count = parts.reduce((n, p) => n + p.shape.positions.length / 3, 0);
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const phases = luminous ? new Float32Array(count) : undefined;
    const centers = halo ? new Float32Array(count * 3) : undefined;
    let vertex = 0;
    for (const part of parts) {
      const m = part.matrix.elements, n = part.normal.elements, p = part.shape.positions, normal = part.shape.normals;
      const { r, g, b } = part.color;
      for (let i = 0; i < p.length / 3; i++, vertex++) {
        // Reflect winding as well as normals, preserving bat wings and mirrored
        // shapes without making the material double-sided.
        const source = (part.mirrored ? i - i % 3 + 2 - i % 3 : i) * 3, out = vertex * 3;
        const x = p[source], y = p[source + 1], z = p[source + 2];
        positions[out] = m[0] * x + m[4] * y + m[8] * z + m[12];
        positions[out + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        positions[out + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        const nx = normal[source], ny = normal[source + 1], nz = normal[source + 2];
        const a = n[0] * nx + n[3] * ny + n[6] * nz, c = n[1] * nx + n[4] * ny + n[7] * nz, d = n[2] * nx + n[5] * ny + n[8] * nz;
        const inverse = 1 / (Math.sqrt(a * a + c * c + d * d) || 1);
        normals[out] = a * inverse; normals[out + 1] = c * inverse; normals[out + 2] = d * inverse;
        colors[out] = r; colors[out + 1] = g; colors[out + 2] = b;
        if (phases) phases[vertex] = part.phase;
        if (centers) centers.set(part.center, out);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    if (phases) geometry.setAttribute('lightPhase', new T.BufferAttribute(phases, 1));
    if (centers) geometry.setAttribute('lightCenter', new T.BufferAttribute(centers, 3));
    return geometry;
  }
  finish(material: T.Material, luminous: T.Material, halos = true) {
    const group = new T.Group();
    for (const [parts, mat, front, glow] of [[this.solid, material, false, false], [this.glow, luminous, false, true],
      [this.frontSolid, material, true, false], [this.frontGlow, luminous, true, true]] as const) {
      if (!parts.length) continue;
      const mesh = new T.Mesh(this.bake(parts, glow), mat);
      mesh.castShadow = mat === material; mesh.receiveShadow = mat === material;
      mesh.userData.front = front; group.add(mesh);
    }
    if (halos && luminous instanceof FairgroundLights) for (const [parts, front] of [[this.halos, false], [this.frontHalos, true]] as const) {
      if (!parts.length) continue;
      const mesh = new T.Mesh(this.bake(parts, true, true), luminous.halos);
      mesh.userData.front = front; group.add(mesh);
    }
    this.halos = []; this.frontHalos = [];
    this.solid = []; this.glow = []; this.frontSolid = []; this.frontGlow = [];
    return group;
  }
}
export const WORLD_SHAPES = {
  rock: new T.IcosahedronGeometry(1, 0), round: new T.IcosahedronGeometry(1, 1),
  box: new T.BoxGeometry(1, 1, 1), cone: new T.ConeGeometry(1, 1, 7),
  pole: new T.CylinderGeometry(1, 1, 1, 6),
  ring: new T.TorusGeometry(1, .065, 5, 28),
};
const sharedShapes = new Set<T.BufferGeometry>(Object.values(WORLD_SHAPES));
