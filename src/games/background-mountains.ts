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

/** A connected ridge with several summits, saddles and welded snow gullies.
 * Every colour shares the same grid vertices; the silhouette is not a row of cones. */
function ridge(m: WorldModel, x: number, z: number, width: number, depth: number, height: number, phase: number, far = false) {
  const mesh = new Facets();
  const profiles = [
    [0, .36, .82, .58, 1, .69, .43, .31, 0],
    [0, .3, .58, 1, .67, .46, .79, .33, 0],
    [0, .49, .72, .46, .74, 1, .68, .38, 0],
  ];
  const silhouette = profiles[Math.floor(phase * 1.7) % profiles.length];
  const xs = [-1, -.77, -.51, -.26, 0, .27, .52, .78, 1];
  const rows = [-1, -.56, -.19, 0, .2, .57, 1];
  const points: Point[][] = xs.map((u, i) => rows.map((v, j) => {
    const h = height * silhouette[i] * (.91 + .09 * Math.sin(i * 1.6 + phase));
    const shoulder = .25 + .08 * Math.sin(i * 1.9 + phase);
    const snowline = .62 + .15 * Math.sin(i * 2.2 + phase);
    const levels = [0, .35, .79, 1, snowline, shoulder, 0];
    // Offset each crest and shoulder a little, while keeping the outer footprint fixed.
    return [u * width + Math.sin(i + phase) * width * .027 * (1 - Math.abs(v)) * (1 - Math.abs(u)),
      -.12 + h * levels[j], v * depth + Math.sin(i * 1.4 + phase) * depth * .09 * (1 - Math.abs(v))];
  }));
  const stone = far ? ["#99afbd", "#a1b5c0", "#91a8b8"] : ["#8a9ea5", "#96a8ab", "#7e959f"];
  for (let i = 0; i < xs.length - 1; i++) for (let row = 0; row < rows.length - 1; row++) {
    const a = points[i][row], b = points[i + 1][row], c = points[i + 1][row + 1], d = points[i][row + 1];
    const snowy = (row === 2 || row === 3) && Math.min(silhouette[i], silhouette[i + 1]) > (far ? .35 : .55);
    const color = snowy ? row === 2 ? "#dbe7e7" : "#f0f1df" : stone[(row + (i % 3 === 0 ? 1 : 0)) % 3];
    // A narrow tongue of snow continues into selected lee gullies, within the
    // actual slope surface rather than hovering above a differently shaped peak.
    const gully = row === 4 && (i + Math.floor(phase)) % 4 === 1 && silhouette[i] > .55;
    mesh.triangle(color, a, b, c, [0, 1, 0]);
    mesh.triangle(gully ? "#e2ebe2" : color, a, c, d, [0, 1, 0]);
  }
  mesh.addTo(m, [x, 0, z]);
}

/** Broad fractured shelves, with top facets joined to the exposed rock face. */
function crag(m: WorldModel, x: number, z: number, width: number, depth: number, height: number, phase: number, snowy = false) {
  const mesh = new Facets(), sides = 7, lower: Point[] = [], ledge: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = i * Math.PI * 2 / sides + .16;
    const r = .88 + .12 * Math.sin(a * 3 + phase) ** 2;
    lower.push([Math.cos(a) * width * r, -.12, Math.sin(a) * depth * r]);
    ledge.push([Math.cos(a) * width * r * .77 - width * .08,
      height * (.74 + .2 * Math.sin(a * 2 + phase) ** 2), Math.sin(a) * depth * r * .77]);
  }
  const top: Point = [-width * .08, height, 0];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides, outward: Point = [lower[i][0] + lower[j][0], 0, lower[i][2] + lower[j][2]];
    const rock = i % 3 === 0 ? "#8e9fa2" : "#a2b0ae";
    mesh.triangle(rock, lower[i], lower[j], ledge[j], outward);
    mesh.triangle(rock, lower[i], ledge[j], ledge[i], outward);
    mesh.triangle(snowy && i % 3 !== 0 ? "#e9ecdc" : "#b2bfb3", ledge[i], ledge[j], top, [0, 1, 0]);
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

function grove(m: WorldModel, x: number, z: number, trees: number, phase: number, r: () => number) {
  // A single snow clearing contains an uneven cluster, not one island per tree.
  patch(m, x, z, 5.7, 3, "#dde5d3", phase);
  for (let i = 0; i < trees; i++) {
    const a = i * 2.4 + phase, radius = 1.2 + r() * 2.8;
    fir(m, x + Math.cos(a) * radius, z + Math.sin(a) * radius * .48,
      2.5 + r() * 2.7, phase + i);
  }
}

function fallenTimber(m: WorldModel, x: number, z: number, angle: number) {
  const start = new T.Vector3(x - Math.cos(angle) * 2.4, .33, z - Math.sin(angle) * 2.4);
  const end = new T.Vector3(x + Math.cos(angle) * 2.4, .54, z + Math.sin(angle) * 2.4);
  m.beam("#927458", start, end, .31);
  const branch = start.clone().lerp(end, .42);
  m.beam("#927458", branch, branch.clone().add(new T.Vector3(-.3, .78, .5)), .13);
  // One visibly cut end, oriented with the trunk, keeps the little timber readable.
  const tangent = end.clone().sub(start).normalize();
  m.beam("#d5bd87", end.clone().addScaledVector(tangent, -.025), end.clone().addScaledVector(tangent, .035), .26);
}

/** Ridge-only backdrop for narrow track sections, without a repeated village. */
export function mountainTerrain(m: WorldModel, x: number, back: number, r: () => number) {
  const phase = r() * Math.PI * 2;
  // Both surfaces end on the ground. The distant extent remains back - 62;
  // the near toe stops behind the existing cable-pylon line at back - 8.
  ridge(m, x + 3, back - 40, 28, 22, 22 + r() * 7, phase + .7, true);
  ridge(m, x - 3, back - 26, 24, 15, 12 + r() * 8, phase + 2.1);
  crag(m, x + 3, back - 13.8, 9.5, 2.6, 2.6, phase);
  return phase;
}

/** Background-only alpine vignettes. Adjacent bays can request different layouts
 * without changing the course seed or adding runtime scene objects. */
export function alpineBackground(m: WorldModel, x: number, back: number, front: number, r: () => number, variant?: number) {
  const layout = ((Math.floor(variant ?? r() * 3) % 3) + 3) % 3;
  const phase = mountainTerrain(m, x, back, r);

  if (layout === 0) {
    // Chalet clearing: orchard-like groups frame a readable building and path.
    chalet(m, x - 4.5, back + 3.7);
    grove(m, x + 8, back + 1.4, 3, phase, r);
    grove(m, x - 8, front + 6.4, 3, phase + 2, r);
    patch(m, x + 4.5, front + 8.2, 4.5, 2.2, "#b9c6b0", phase + 1);
    crag(m, x + 6.3, front + 8.3, 2.8, 1.4, 1.1, phase + 1, true);
    // A pair of substantial stepping slabs leads towards the railway clearing.
    for (let i = 0; i < 2; i++) m.add(G.rock, "#b9c3b5", [x - 4.5 + i * .15, .16, back + 7.5 + i * .8], [.65, .15, .39], [0, i * .16, 0]);
  } else if (layout === 1) {
    // A rocky glacial tarn, with the broken shelf behind the water rather than
    // in the camera-facing foreground. Only this vignette contains a pool.
    grove(m, x - 8, back + 2, 3, phase + 1, r);
    crag(m, x + 7, back + 2.4, 4.4, 2.2, 2.2, phase + 2, true);
    patch(m, x, front + 8.4, 9.5, 3.7, "#bdcbbc", phase, .1);
    patch(m, x, front + 8.4, 8.7, 3.1, "#66b5c0", phase, .12);
    patch(m, x + 2.2, front + 8.7, 4.8, 2, "#83ccc9", phase + .3, .137);
    crag(m, x - 3, front + 4.4, 5.4, 1.7, 1.9, phase + 3, true);
    for (let i = 0; i < 3; i++) m.add(G.box, "#c3e9dc", [x - 3.2 + i * 2.1, .16, front + 8.4 + (i % 2) * .6], [1.8, .02, .055]);
    grove(m, x + 9, front + 5.5, 2, phase + 3, r);
  } else {
    // A sheltered woodland bay: tall firs behind, saplings and fallen timber
    // in the foreground, with a broad snowbank instead of another identical pond.
    grove(m, x - 7, back + 1.5, 4, phase, r);
    grove(m, x + 8, back + 2.6, 3, phase + 1, r);
    patch(m, x - 1, front + 7, 9.4, 3, "#e5e9d7", phase + 2);
    grove(m, x + 7, front + 7.4, 2, phase + 2, r);
    fallenTimber(m, x - 4.5, front + 7.2, -.28);
    crag(m, x - 9, front + 9.1, 2.5, 1.6, 1.2, phase + 1);
  }
}
