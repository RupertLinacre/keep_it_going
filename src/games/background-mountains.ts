import * as T from "three";
import { WorldModel, WORLD_SHAPES as G } from "./world-models";

type Point = [number, number, number];

/** Small vertex-colour batches feed the existing landscape batching system. */
class Facets {
  private faces = new Map<string, number[]>();

  triangle(color: string, a: Point, b: Point, c: Point, outward: Point) {
    // Generated terrain is built as the train advances. Keep this per-face
    // orientation check allocation-free to avoid a burst of temporary vectors.
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if ((uy * vz - uz * vy) * outward[0] + (uz * vx - ux * vz) * outward[1] +
      (ux * vy - uy * vx) * outward[2] < 0) [b, c] = [c, b];
    let faces = this.faces.get(color);
    if (!faces) this.faces.set(color, faces = []);
    faces.push(...a, ...b, ...c);
  }

  addTo(model: WorldModel, position: Point) {
    for (const [color, vertices] of this.faces) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      model.add(geometry, color, position);
      geometry.dispose();
    }
  }
}

/** Snow and rock share the same seam vertices: no separate floating snow cone. */
function peak(m: WorldModel, x: number, z: number, width: number, depth: number, height: number, phase: number, far = false) {
  const mesh = new Facets(), sides = 9;
  const top: Point = [width * .17 * Math.sin(phase), height, -depth * .12];
  const base: Point[] = [], snow: Point[] = [];
  const stone = far ? ["#9eafbf", "#acbdca", "#94a7b8"] : ["#788c99", "#8e9da6", "#a0acae"];
  const ice = far ? ["#edf3ed", "#d6e6e9", "#e4edf0"] : ["#f2f2df", "#d5e5e8", "#e6eded"];
  for (let i = 0; i < sides; i++) {
    const a = i * Math.PI * 2 / sides + .13;
    const radius = .88 + .12 * Math.sin(a * 2 + phase) ** 2;
    const b: Point = [Math.cos(a) * width * radius, -.16, Math.sin(a) * depth * radius];
    const line = .23 + .15 * (.5 + .5 * Math.sin(a * 3 + phase));
    base.push(b);
    snow.push(top.map((v, j) => v + (b[j] - v) * line) as Point);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const out: Point = [base[i][0] + base[j][0], 0, base[i][2] + base[j][2]];
    mesh.triangle(stone[i % 3], base[i], base[j], snow[j], out);
    mesh.triangle(stone[i % 3], base[i], snow[j], snow[i], out);
    mesh.triangle(ice[i % 3], snow[i], snow[j], top, out);
  }
  mesh.addTo(m, [x, 0, z]);
}

function patch(m: WorldModel, x: number, z: number, width: number, depth: number, color: string, phase: number, y = .09) {
  const mesh = new Facets(), count = 10;
  for (let i = 0; i < count; i++) {
    const point = (j: number): Point => {
      const a = j * Math.PI * 2 / count;
      const radius = .87 + .13 * Math.cos(a * 3 + phase);
      return [Math.cos(a) * width * radius, 0, Math.sin(a) * depth * radius];
    };
    mesh.triangle(color, [0, 0, 0], point(i), point(i + 1), [0, 1, 0]);
  }
  mesh.addTo(m, [x, y, z]);
}

function foothill(m: WorldModel, x: number, z: number, phase: number) {
  const mesh = new Facets(), count = 10;
  const top: Point = [-2, 3.4, -1];
  for (let i = 0; i < count; i++) {
    const point = (j: number): Point => {
      const a = j * Math.PI * 2 / count;
      return [Math.cos(a) * 16, -.12, Math.sin(a) * 7];
    };
    mesh.triangle(["#9eafa9", "#acb9b0", "#91a6a1"][(i + Math.floor(phase)) % 3], top, point(i), point(i + 1), [0, 1, 0]);
  }
  mesh.addTo(m, [x, 0, z]);
}

function fir(m: WorldModel, x: number, z: number, height: number, phase: number) {
  m.add(G.box, "#746c5d", [x, height * .22, z], [.18, height * .44, .18]);
  m.add(G.cone, "#3e7168", [x, height * .48, z], [height * .37, height * .62, height * .37]);
  // The snowy upper tier uses the same joined construction as the mountains.
  const crown = new Facets(), count = 6, radius = height * .29;
  const top: Point = [0, height, 0], ring: Point[] = [], snow: Point[] = [];
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count + phase;
    const p: Point = [Math.cos(a) * radius, height * .43, Math.sin(a) * radius];
    ring.push(p);
    const fraction = .4 + .12 * Math.sin(a * 3 + phase) ** 2;
    snow.push(top.map((v, j) => v + (p[j] - v) * fraction) as Point);
  }
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count, out: Point = [ring[i][0] + ring[j][0], 0, ring[i][2] + ring[j][2]];
    crown.triangle("#527f72", ring[i], ring[j], snow[j], out);
    crown.triangle("#527f72", ring[i], snow[j], snow[i], out);
    crown.triangle(i % 2 ? "#e8eee1" : "#cee0da", snow[i], snow[j], top, out);
  }
  crown.addTo(m, [x, 0, z]);
}

function chalet(m: WorldModel, x: number, z: number) {
  // Sit on a flat clearing in front of the foothills, not inside their slopes.
  patch(m, x, z + 1, 5.2, 3.1, "#bdc4b3", 2);
  m.add(G.box, "#8e7966", [x, .23, z], [5.1, .32, 3.7]);
  m.add(G.box, "#c69069", [x, 1.6, z], [4.7, 2.5, 3.25]);
  const roof = new Facets();
  const left: Point = [-2.85, 2.8, 0], right: Point = [2.85, 2.8, 0], ridge: Point = [0, 4.8, 0];
  for (const side of [-1, 1]) {
    const faceZ = side * 1.7;
    const shoulder = 4.8 - 2 * 2.35 / 2.85;
    const a: Point = [-2.35, 2.85, faceZ], b: Point = [2.35, 2.85, faceZ];
    const c: Point = [2.35, shoulder, faceZ], d: Point = [0, 4.8, faceZ], e: Point = [-2.35, shoulder, faceZ];
    roof.triangle("#bd875f", a, b, c, [0, 0, side]);
    roof.triangle("#bd875f", a, c, d, [0, 0, side]);
    roof.triangle("#bd875f", a, d, e, [0, 0, side]);
  }
  for (const edge of [left, right]) {
    const a: Point = [edge[0], edge[1], -2.05], b: Point = [edge[0], edge[1], 2.05];
    const c: Point = [ridge[0], ridge[1], 2.05], d: Point = [ridge[0], ridge[1], -2.05];
    roof.triangle(edge === left ? "#dce7df" : "#f1eee0", a, b, c, [0, 1, 0]);
    roof.triangle(edge === left ? "#dce7df" : "#f1eee0", a, c, d, [0, 1, 0]);
    m.beam("#725d4e", new T.Vector3(...b).add(new T.Vector3(x, -.1, z)), new T.Vector3(...c).add(new T.Vector3(x, -.1, z)), .11);
  }
  roof.addTo(m, [x, 0, z]);
  m.add(G.box, "#947f77", [x + 1.4, 4.3, z - .6], [.6, 2.3, .65]);
  m.add(G.box, "#e4e9dc", [x + 1.4, 5.48, z - .6], [.82, .2, .85]);
  m.add(G.box, "#735746", [x, 1.1, z + 1.665], [.85, 1.65, .09]);
  m.add(G.box, "#b9ab88", [x, .25, z + 2], [1.45, .25, .7]);
  m.add(G.box, "#d7d2b6", [x, .14, z + 2.8], [1.2, .08, 1.2]);
  for (const dx of [-1.5, 1.5]) {
    m.add(G.box, "#725846", [x + dx, 1.7, z + 1.68], [1.12, 1.1, .12]);
    m.add(G.box, "#ffe4a0", [x + dx, 1.7, z + 1.76], [.85, .86, .055], [], true);
    for (const side of [-1, 1]) m.add(G.box, "#7c9b82", [x + dx + side * .7, 1.7, z + 1.7], [.31, 1.1, .1]);
    m.add(G.box, "#735b4a", [x + dx, 1.7, z + 1.8], [.075, .88, .05]);
  }
}

/** Background-only alpine bay: all details merge into the existing tile batches. */
export function alpineBackground(m: WorldModel, x: number, back: number, front: number, r: () => number) {
  const phase = r() * Math.PI * 2;
  // The far peak retains the previous outer limit of back - 62 metres.
  peak(m, x + 16, back - 38, 25, 24, 24 + r() * 10, phase + 1.4, true);
  peak(m, x - 3, back - 23, 21, 18, 17 + r() * 10, phase);
  peak(m, x + 14, back - 18, 11, 11, 9 + r() * 5, phase + 2.4);
  foothill(m, x, back - 7, phase);

  for (let i = 0; i < 8; i++) {
    const px = x - 13 + r() * 26, pz = i < 5 ? back + 1.5 + r() * 3 : front + 3 + r() * 5;
    const h = 2.6 + r() * 2.8;
    patch(m, px, pz, 1.9 + h * .2, 1.3 + h * .1, i % 3 ? "#c5cdbb" : "#ebeee1", phase + i);
    fir(m, px, pz, h, phase + i);
    if (i < 4) m.add(G.rock, i % 2 ? "#abb6b2" : "#8fa5a7", [px + 1.8, .42, pz + .7], [1.2, .65, .8], [0, phase + i, 0]);
  }

  // A shaped shore and shoal give the water a place in the valley.
  patch(m, x + 1, front + 9, 8.2, 4, "#b8c7bc", phase, .1);
  patch(m, x + 1, front + 9, 7.5, 3.35, "#67bbc3", phase, .12);
  patch(m, x + 2.8, front + 9.2, 4.6, 2.2, "#78c8c9", phase + .3, .135);
  for (let i = 0; i < 4; i++) m.add(G.box, "#c4ede1", [x - 3 + i * 2, .15, front + 8.2 + (i % 2) * .9], [1.4, .02, .055]);
  patch(m, x - 9, front + 5, 3.1, 1.7, "#eff0df", phase + 2);
  if (r() < .48) chalet(m, x - 6, back + 4);
}
