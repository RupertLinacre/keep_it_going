import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';

const LANTERNS = ['#ffd4a1', '#a2e9d8', '#e6abda', '#bcaaf4'];
// Small distant lights need a readable silhouette, not a high-detail sphere.
const GEM = new T.OctahedronGeometry(1, 0);
const SPARK = (() => {
  const positions: number[] = [];
  const perimeter = Array.from({ length: 8 }, (_, i) => {
    const a = i * Math.PI / 4, r = i % 2 ? .24 : 1;
    return [Math.sin(a) * r * .7, Math.cos(a) * r, 0];
  });
  for (let i = 0; i < 8; i++) {
    const p = perimeter[i], q = perimeter[(i + 1) % 8];
    // Clockwise perimeter viewed from +Z: reverse the front face.
    positions.push(0, 0, .11, ...q, ...p, 0, 0, -.11, ...p, ...q);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
})();

function geometry(positions: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

function rim(m: WorldModel, x: number, y: number, z: number, radius: number, width: number) {
  const p: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10, b = (i + 1) * Math.PI / 10;
    const point = (angle: number, r: number) => [Math.sin(angle) * r, 0, Math.cos(angle) * r];
    const ai = point(a, radius - width), ao = point(a, radius), bi = point(b, radius - width), bo = point(b, radius);
    p.push(...ai, ...ao, ...bo, ...ai, ...bo, ...bi);
  }
  const g = geometry(p); m.add(g, '#98a7b7', [x, y, z]); g.dispose();
}

function pavilion(m: WorldModel, x: number, z: number, colour: string) {
  m.add(G.pole, '#606784', [x, .18, z], [4.5, .36, 4.5]);
  m.add(G.pole, '#9b879c', [x, .37, z], [4.1, .14, 4.1]);
  // A continuous, closed canopy with two sloping tiers and alternating panels.
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, b = (i + 1) * Math.PI / 6;
    const p = (angle: number, radius: number, y: number) => [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
    const na = p(a, 1.35, 5.65), nb = p(b, 1.35, 5.65), ea = p(a, 4.5, 3.45), eb = p(b, 4.5, 3.45);
    const g = geometry([0, 6.6, 0, ...na, ...nb, ...na, ...ea, ...eb, ...na, ...eb, ...nb, 0, 3.35, 0, ...eb, ...ea]);
    m.add(g, i % 2 ? '#edc6a3' : colour, [x, 0, z]); g.dispose();
    m.add(GEM, LANTERNS[i % 4], [x + Math.sin(a) * 4.25, 3.35, z + Math.cos(a) * 4.25], [.16, .23, .16], [], true, i * .42);
    if (i % 2 === 0) {
      const px = x + Math.sin(a) * 3.8, pz = z + Math.cos(a) * 3.8;
      m.add(G.pole, '#deb997', [px, 1.87, pz], [.1, 2.95, .1]);
      m.add(G.box, colour, [px, .74, pz], [.38, .6, .38]);
    }
  }
  m.add(G.pole, '#d7b77e', [x, 3.3, z], [.15, 6.2, .15]);
  m.add(SPARK, '#ffe2a9', [x, 7.15, z], [.57, .57, .57], [], true);
  // A little round refreshment table belongs inside the pavilion, not in its roof.
  m.add(G.pole, '#bc929b', [x, .95, z], [.32, 1.1, .32]);
  m.add(G.pole, '#e0c1a5', [x, 1.55, z], [1.5, .16, 1.5]);
  for (const dx of [-.75, .65]) {
    m.add(G.pole, '#dae7ce', [x + dx, 1.8, z], [.18, .4, .18]);
    m.add(G.box, '#d898b9', [x + dx, 2.02, z], [.07, .35, .07], [0, 0, .2]);
  }
}


function fountain(m: WorldModel, x: number, z: number) {
  m.add(G.pole, '#716781', [x, .24, z], [3.05, .48, 3.05]);
  m.add(G.pole, '#477082', [x, .5, z], [2.8, .05, 2.8]);
  rim(m, x, .54, z, 3.06, .3);
  m.add(G.pole, '#b0bdc8', [x, .75, z], [.3, .5, .3]);
  // Four continuous square-section water arches: 208 triangles, versus the
  // old fountain's 60 separate cylindrical segments (1,440 triangles).
  for (let j = 0; j < 4; j++) {
    const angle = j * Math.PI / 2 + .4, points: T.Vector3[][] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, center = new T.Vector3(Math.sin(angle) * 2.4 * t, .9 + Math.sin(t * Math.PI) * 2.2 - t * .34, Math.cos(angle) * 2.4 * t);
      const tangent = new T.Vector3(Math.sin(angle) * 2.4, Math.PI * Math.cos(t * Math.PI) * 2.2 - .34, Math.cos(angle) * 2.4).normalize();
      const right = new T.Vector3(Math.cos(angle), 0, -Math.sin(angle)), up = new T.Vector3().crossVectors(tangent, right).normalize();
      points.push([[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([u, v]) => center.clone().addScaledVector(right, u * .055).addScaledVector(up, v * .055)));
    }
    const vertices: number[] = [];
    for (let i = 0; i < 6; i++) for (let side = 0; side < 4; side++) {
      const a = points[i][side], b = points[i][(side + 1) % 4], c = points[i + 1][side], d = points[i + 1][(side + 1) % 4];
      vertices.push(...a.toArray(), ...d.toArray(), ...b.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
    }
    for (const [row, reverse] of [[0, true], [6, false]] as const) {
      const p = points[row];
      for (const indexes of reverse ? [[0, 1, 2], [0, 2, 3]] : [[0, 2, 1], [0, 3, 2]]) vertices.push(...p[indexes[0]].toArray(), ...p[indexes[1]].toArray(), ...p[indexes[2]].toArray());
    }
    const g = geometry(vertices); m.add(g, LANTERNS[j], [x, 0, z], [1, 1, 1], [], true, j * .8); g.dispose();
  }
}


const HOOP = new T.TorusGeometry(1, .07, 3, 10);

function festoon(m: WorldModel, x: number, z: number, phase: number) {
  const height = 5.25;
  for (const dx of [-11, 11]) {
    m.add(G.pole, '#b79fa3', [x + dx, height / 2, z], [.095, height, .095]);
    m.add(G.pole, '#706c8b', [x + dx, .2, z], [.4, .4, .4]);
    m.add(GEM, '#ffe0ad', [x + dx, height + .12, z], [.25, .3, .25], [], true);
  }
  let previous: T.Vector3 | undefined;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, p = new T.Vector3(x - 11 + t * 22, height - Math.sin(Math.PI * t) * 1.1, z);
    if (previous) {
      const delta = p.clone().sub(previous), centre = p.clone().add(previous).multiplyScalar(.5);
      m.add(G.box, '#958a9f', centre.toArray(), [delta.length(), .055, .055], [0, 0, Math.atan2(delta.y, delta.x)]);
    }
    m.add(G.box, '#958a9f', [p.x, p.y - .12, z], [.05, .24, .05]);
    m.add(GEM, i % 3 ? '#ffdaa2' : '#aae8d6', [p.x, p.y - .34, z], [.19, .24, .19], [], true, phase + i * .55);
    previous = p;
  }
}

function bench(m: WorldModel, x: number, z: number) {
  for (const dx of [-1.35, 1.35]) m.add(G.box, '#52657b', [x + dx, .4, z], [.16, .8, 1.2]);
  for (let i = 0; i < 3; i++) {
    m.add(G.box, '#c4a8aa', [x, .79, z - .4 + i * .4], [3.2, .13, .29]);
    m.add(G.box, '#c4a8aa', [x, 1.14 + i * .21, z - .53], [3.2, .15, .13]);
  }
}

function teddy(m: WorldModel, x: number, y: number, z: number, colour: string, size = 1) {
  const add = (g: T.BufferGeometry, c: string, p: number[], scale: number[]) =>
    m.add(g, c, [x + p[0] * size, y + p[1] * size, z + p[2] * size], scale.map(n => n * size));
  add(G.rock, colour, [0, .42, 0], [.44, .5, .32]);
  add(G.rock, colour, [0, 1.02, .03], [.44, .42, .36]);
  for (const dx of [-.31, .31]) {
    add(GEM, colour, [dx, 1.35, .01], [.2, .23, .17]);
    add(GEM, colour, [dx, .15, .22], [.23, .2, .28]);
  }
  for (const dx of [-.14, .14]) add(GEM, '#303346', [dx, 1.09, .35], [.06, .07, .04]);
  add(GEM, '#f1d7be', [0, .88, .35], [.21, .17, .1]);
}

function candyCart(m: WorldModel, x: number, z: number) {
  m.add(G.box, '#deb1c6', [x, 1.72, z], [4.5, 1.35, 2.9]);
  m.add(G.box, '#e7d0ad', [x, 2.43, z], [4.85, .18, 3.3]);
  for (const dx of [-1.55, 1.55]) {
    m.add(G.pole, '#695b74', [x + dx, .7, z], [.1, 3.55, .1], [Math.PI / 2, 0, 0]);
    for (const dz of [-1.6, 1.6]) {
      m.add(G.pole, '#746380', [x + dx, .7, z + dz], [.66, .22, .66], [Math.PI / 2, 0, 0]);
      m.add(G.pole, '#e2bdab', [x + dx, .7, z + dz * 1.08], [.29, .045, .29], [Math.PI / 2, 0, 0]);
    }
  }
  for (let i = 0; i < 6; i++) m.add(G.box, i % 2 ? '#f0d7bb' : '#bd82a7', [x - 1.9 + i * .76, 1.72, z + 1.47], [.73, 1.27, .045]);
  for (const dx of [-2, 2]) for (const dz of [-1.2, 1.2]) m.add(G.pole, '#d5b997', [x + dx, 3.32, z + dz], [.065, 1.6, .065]);
  // Both roof slopes meet along a real ridge. The valances connect to eaves.
  for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
    const cx = x - 2.15 + i * .86;
    m.add(G.box, i % 2 ? '#efcbaa' : '#aa77a1', [cx, 4.24, z + side * .9], [.855, .1, 2.05], [side * .37, 0, 0]);
    m.add(G.box, i % 2 ? '#efcbaa' : '#aa77a1', [cx, 3.66, z + side * 1.86], [.855, .36, .08]);
  }
  // A spun-sugar bowl and three candy-floss sticks are readable from the rail.
  m.add(G.pole, '#859eab', [x, 2.67, z + .15], [.72, .3, .72]);
  for (const dx of [-1.25, 0, 1.25]) {
    m.add(G.pole, '#e5d6b8', [x + dx, 2.89, z + .35], [.045, .75, .045]);
    m.add(G.rock, dx ? '#ebbcce' : '#bce3d2', [x + dx, 3.3, z + .35], [.45, .63, .44]);
  }
  // A cart handle is attached to the chassis, rather than a floating sign.
  for (const dz of [-.8, .8]) m.beam('#d0b89e', new T.Vector3(x + 2.2, 1.55, z + dz), new T.Vector3(x + 3.3, 1.8, z + dz), .07);
  m.beam('#d0b89e', new T.Vector3(x + 3.3, 1.8, z - .8), new T.Vector3(x + 3.3, 1.8, z + .8), .07);
}

function balloons(m: WorldModel, x: number, z: number) {
  m.add(G.box, '#8d7a91', [x, .4, z], [1.35, .8, 1.2]);
  for (let i = 0; i < 4; i++) {
    const bx = x + (i - 1.5) * .94, by = 5.5 + (i % 2) * 1.15, bz = z + (i % 2) * .6;
    m.beam('#c3b5b7', new T.Vector3(x, .8, z), new T.Vector3(bx, by - .85, bz), .025);
    m.add(GEM, LANTERNS[i], [bx, by - .77, bz], [.11, .19, .11]);
    if (i === 1) m.add(SPARK, '#ffe0a1', [bx, by, bz], [.9, .95, 1.4], [], true);
    else m.add(G.rock, LANTERNS[i], [bx, by, bz], [.65, .92, .62]);
  }
}

function prizeBooth(m: WorldModel, x: number, z: number, colour: string) {
  m.add(G.box, '#676681', [x, .18, z], [7.6, .36, 4.4]);
  m.add(G.box, '#514765', [x, 2.2, z - 1.55], [7.2, 3.7, .24]);
  for (const dx of [-3.35, 3.35]) m.add(G.pole, '#deb997', [x + dx, 2.12, z + 1.45], [.12, 3.98, .12]);
  m.add(G.box, colour, [x, .83, z + 1.5], [7.1, 1.05, .2]);
  m.add(G.box, '#e7cfa9', [x, 1.42, z + 1.6], [7.45, .2, 1.15]);
  m.add(G.box, '#ddbc9e', [x, 2.05, z - 1.2], [6.7, .18, 1.1]);
  for (let i = 0; i < 3; i++) teddy(m, x - 2.1 + i * 2.1, 2.14, z - 1.15, LANTERNS[(i + 1) % 4], .76);
  for (let i = 0; i < 5; i++) {
    const dx = x - 2.5 + i * 1.25;
    m.add(G.pole, '#a5d7c3', [dx, 1.84, z + 1.52], [.19, .63, .19]);
    m.add(G.pole, '#d6dba6', [dx, 2.23, z + 1.52], [.085, .19, .085]);
  }
  for (const [dx, y, angle] of [[-2.5, 1.67, -.18], [0, 1.65, .12], [2.5, 1.67, .28]]) m.add(HOOP, '#f2c783', [x + dx, y, z + 1.5], [.53, .53, .53], [Math.PI / 2 + angle, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const cx = x - 3.32 + i * .95;
    m.add(G.box, i % 2 ? '#e7c4a3' : colour, [cx, 4.28, z], [.945, .16, 4.6], [.06, 0, 0]);
    m.add(G.box, i % 2 ? '#e7c4a3' : colour, [cx, 3.9, z + 2.29], [.945, .48, .1]);
    m.add(GEM, LANTERNS[i % 4], [cx, 3.77, z + 2.37], [.14, .18, .14], [], true, i * .5);
  }
  // Three large targets crown the roof, making this a game stall from afar.
  for (const dx of [-1.8, 0, 1.8]) {
    m.add(G.pole, '#cba991', [x + dx, 4.72, z], [.055, .8, .055]);
    m.add(HOOP, '#ffe0ab', [x + dx, 5.14, z], [.55, .55, .55], [], true);
  }
}

function lantern(m: WorldModel, x: number, z: number, colour: string, phase: number) {
  m.add(G.pole, '#a5a0a7', [x, 1.35, z], [.065, 2.7, .065]);
  m.add(G.pole, '#626b80', [x, .16, z], [.36, .32, .36]);
  m.add(GEM, colour, [x, 2.72, z], [.38, .5, .38], [], true, phase);
  m.add(G.cone, '#ac8ea9', [x, 3.11, z], [.49, .3, .49]);
}

/** A low horizon for narrow sections, without stars, furniture or attractions. */
export function nightTerrain(m: WorldModel, x: number, back: number, r: () => number) {
  // Low, overlapping banks have a shallow silhouette. Tall cliffs previously
  // filled the entire backdrop and made the carnival look like a quarry.
  m.add(G.round, '#2d4058', [x - 3, -3, back - 25], [24, 4.5 + r() * 1.5, 12]);
  m.add(G.round, '#27354d', [x + 9, -3.2, back - 36], [27, 6 + r() * 2, 14]);
}

/** Seeded fairground neighbourhoods, built once into the existing scenery batch. */
export function nightBackground(m: WorldModel, x: number, back: number, front: number, r: () => number, variant?: number) {
  const scene = variant === undefined ? Math.floor(r() * 3) : ((variant % 3) + 3) % 3;
  nightTerrain(m, x, back, r);
  for (let i = 0; i < 5; i++) {
    const sx = x - 14 + r() * 28, sy = 14 + r() * 15, sz = back - 8 - r() * 22;
    const size = i % 3 === 0 ? .32 + r() * .15 : .16 + r() * .08;
    m.add(SPARK, i % 3 ? '#a6bfdf' : '#ffe8bb', [sx, sy, sz], [size, size, size], [0, 0, (r() - .5) * .2], true);
  }
  const colour = r() < .5 ? '#a774a8' : '#668aab';
  if (scene === 0) {
    pavilion(m, x - 2, back - 6.5, colour);
    // One sheltered refreshment court, with a fountain in front of the train.
    m.add(G.box, '#5c677b', [x - 2, .09, back + 1.65], [2.6, .05, 8.7]);
    for (const dx of [-9, 7]) {
      bench(m, x + dx, back + 1.6);
      lantern(m, x + dx, back - .5, '#ffdaa2', dx * .12);
    }
    m.add(G.pole, '#596b7a', [x - 5, .06, front + 8.2], [5, .12, 4.6]);
    fountain(m, x - 5, front + 8.6);
    bench(m, x + 6, front + 7.3);
    lantern(m, x + 9, front + 6.3, '#a2e9d8', 2);
  } else if (scene === 1) {
    candyCart(m, x - 5.5, back + .2);
    balloons(m, x + 7, back + 2);
    festoon(m, x, back + 5.2, .7);
    m.add(G.box, '#5c677b', [x, .09, back + 4.75], [22, .05, 1.6]);
    // A picnic patch is visibly different from the refreshment fountain.
    m.add(G.pole, '#596b7a', [x + 1, .06, front + 7.7], [5.4, .12, 3.6]);
    m.add(G.pole, '#ad92a1', [x + 1, .76, front + 7.7], [.38, 1.4, .38]);
    m.add(G.pole, '#d5b69f', [x + 1, 1.51, front + 7.7], [2.35, .17, 1.8]);
    for (const dx of [-3.3, 3.3]) {
      m.add(G.box, '#72718a', [x + 1 + dx, .36, front + 7.7], [.35, .72, 1.5]);
      m.add(G.box, '#c4a8aa', [x + 1 + dx, .78, front + 7.7], [.95, .16, 2.5]);
    }
    lantern(m, x - 7, front + 5.2, '#edb2d3', .8);
    lantern(m, x + 9, front + 7.6, '#ffe2a9', 2.6);
  } else {
    prizeBooth(m, x - 2, back + .2, colour);
    festoon(m, x, back + 5.8, 1.6);
    m.add(G.box, '#5c677b', [x - 2, .09, back + 4.8], [13, .05, 3.8]);
    m.add(G.pole, '#596b7a', [x + 3, .06, front + 7.5], [5.4, .12, 3.2]);
    bench(m, x + 3, front + 7.4);
    teddy(m, x + 2.15, .87, front + 7.4, '#a8dccc', .53);
    lantern(m, x - 4, front + 6.2, '#ffe2a9', .9);
    // Painted stepping stars lead towards the game, wholly above the turf.
    for (let i = 0; i < 3; i++) {
      m.add(G.box, '#748394', [x + 7 - i * 3.5, .095, front + 3.4], [2.2, .09, 1.8]);
      m.add(SPARK, i % 2 ? '#e9c5a1' : '#a9d7cf', [x + 7 - i * 3.5, .15, front + 3.4], [.57, .57, .025], [-Math.PI / 2, 0, 0]);
    }
  }
  // Trees frame a court instead of marching through every canopy and counter.
  const tx = x + (scene === 1 ? -12 : 11), tz = back - 10, h = 4.3 + r() * .9;
  m.add(G.pole, '#667887', [tx, h * .38, tz], [.19, h * .76, .19]);
  m.add(G.rock, '#477078', [tx, h, tz], [1.8, h * .46, 1.8]);
  m.add(G.rock, '#719c91', [tx - .4, h + .4, tz + .6], [1.2, h * .28, 1.2]);
}
