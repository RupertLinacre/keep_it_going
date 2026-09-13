import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** One vertex-coloured batch per scenery tile. No texture downloads or per-flower draw calls. */
export class WorldModel {
  private solid: T.BufferGeometry[] = [];
  private glow: T.BufferGeometry[] = [];
  add(geometry: T.BufferGeometry, color: string, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0], glow = false) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); g.deleteAttribute("uv");
    const matrix = new T.Matrix4().compose(new T.Vector3(...position),
      new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(...scale));
    g.applyMatrix4(matrix);
    const c = new T.Color(color), colors = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    (glow ? this.glow : this.solid).push(g);
  }
  finish(material: T.Material, luminous: T.Material) {
    const group = new T.Group();
    for (const [geometries, mat] of [[this.solid, material], [this.glow, luminous]] as const) {
      if (!geometries.length) continue;
      const mesh = new T.Mesh(mergeGeometries([...geometries])!, mat);
      mesh.castShadow = mat === material; mesh.receiveShadow = mat === material;
      group.add(mesh); geometries.forEach(g => g.dispose());
    }
    this.solid = []; this.glow = [];
    return group;
  }
}
export const WORLD_SHAPES = {
  rock: new T.IcosahedronGeometry(1, 0), round: new T.IcosahedronGeometry(1, 1),
  box: new T.BoxGeometry(1, 1, 1), cone: new T.ConeGeometry(1, 1, 7),
  pole: new T.CylinderGeometry(1, 1, 1, 6),
  ring: new T.TorusGeometry(1, .065, 5, 28),
};
