import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** One vertex-coloured batch per scenery tile. No texture downloads or per-flower draw calls. */
export class WorldModel {
  private solid: T.BufferGeometry[] = [];
  private glow: T.BufferGeometry[] = [];
  private frontSolid: T.BufferGeometry[] = [];
  private frontGlow: T.BufferGeometry[] = [];
  constructor(private splitLandscape=false) {}
  add(geometry: T.BufferGeometry, color: string, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0], glow = false, phase = -1) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); g.deleteAttribute("uv");
    const matrix = new T.Matrix4().compose(new T.Vector3(...position),
      new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(...scale));
    g.applyMatrix4(matrix);
    // Baked reflections need their triangle winding reversed (e.g. bat wings).
    if (matrix.determinant() < 0) for (const attribute of Object.values(g.attributes)) {
      const a=attribute as T.BufferAttribute, data=a.array;
      for(let i=0;i<a.count;i+=3)for(let j=0;j<a.itemSize;j++){
        const left=i*a.itemSize+j,right=(i+2)*a.itemSize+j;
        [data[left],data[right]]=[data[right],data[left]];
      }
    }
    const c = new T.Color(color), colors = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    if (glow) g.setAttribute("lightPhase", new T.BufferAttribute(new Float32Array(colors.length / 3).fill(phase), 1));
    (this.splitLandscape && position[2]>0 ? glow ? this.frontGlow : this.frontSolid : glow ? this.glow : this.solid).push(g);
  }
  beam(color: string, from: T.Vector3, to: T.Vector3, radius = .1, glow = false, phase = -1) {
    const delta = to.clone().sub(from), length = delta.length();
    if (length < .0001) return;
    const rotation = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.divideScalar(length)));
    this.add(WORLD_SHAPES.pole, color, from.clone().add(to).multiplyScalar(.5).toArray(), [radius, length, radius], [rotation.x, rotation.y, rotation.z], glow, phase);
  }
  finish(material: T.Material, luminous: T.Material) {
    const group = new T.Group();
    for (const [geometries, mat, front] of [[this.solid, material, false], [this.glow, luminous, false], [this.frontSolid, material, true], [this.frontGlow, luminous, true]] as const) {
      if (!geometries.length) continue;
      const mesh = new T.Mesh(mergeGeometries([...geometries])!, mat);
      mesh.castShadow = mat === material; mesh.receiveShadow = mat === material;
      mesh.userData.front=front;
      group.add(mesh); geometries.forEach(g => g.dispose());
    }
    this.solid = []; this.glow = [];this.frontSolid=[];this.frontGlow=[];
    return group;
  }
}
export const WORLD_SHAPES = {
  rock: new T.IcosahedronGeometry(1, 0), round: new T.IcosahedronGeometry(1, 1),
  box: new T.BoxGeometry(1, 1, 1), cone: new T.ConeGeometry(1, 1, 7),
  pole: new T.CylinderGeometry(1, 1, 1, 6),
  ring: new T.TorusGeometry(1, .065, 5, 28),
};
