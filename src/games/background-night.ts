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

function kiosk(m: WorldModel, x: number, z: number, colour: string) {
  m.add(G.box, '#655373', [x, .18, z], [5.4, .36, 3.7]);
  m.add(G.box, colour, [x, 1.65, z], [4.8, 2.9, 3.1]);
  m.add(G.box, '#40394e', [x, 2.1, z + 1.58], [3.8, 1.45, .13]);
  m.add(G.box, '#ffddaa', [x, 2.48, z + 1.66], [3.45, .42, .035], [], true);
  // A serving counter, two menu panels and an alternating striped awning.
  m.add(G.box, '#e5be97', [x, 1.22, z + 1.88], [5.05, .22, 1.02]);
  for (const dx of [-1.1, 1.1]) {
    m.add(G.box, '#d1ddc2', [x + dx, 1.99, z + 1.67], [.7, .61, .07]);
    for (let j = 0; j < 3; j++) m.add(G.box, '#65808c', [x + dx, 2.15 - j * .15, z + 1.72], [.45, .055, .025]);
  }
  for (let i = 0; i < 8; i++) {
    const ax = x - 2.28 + i * .65;
    m.add(G.box, i % 2 ? '#f2d9a7' : colour, [ax, 3.3, z + 1.48], [.645, .15, 1.85], [.19, 0, 0]);
    m.add(G.box, i % 2 ? '#f2d9a7' : colour, [ax, 3.01, z + 2.38], [.645, .4, .12]);
  }
  m.add(G.box, '#8c7696', [x, 3.25, z - .35], [5.25, .28, 2.8]);
  m.add(G.box, '#e7c79e', [x, 3.82, z + .16], [2.35, .85, .2]);
  m.add(SPARK, '#ffdb9c', [x, 3.84, z + .3], [.33, .33, .33], [], true);
  for (const dx of [-.75, .75]) m.add(GEM, '#a1eddf', [x + dx, 3.84, z + .32], [.13, .16, .08], [], true);
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

/** A small fairground neighbourhood, built once into the existing scenery batch. */
export function nightBackground(m: WorldModel, x: number, back: number, front: number, r: () => number) {
  // The distant slopes leave room for an actual night sky, rather than a wall
  // of near-black mountains as tall as the coaster.
  m.add(G.round, '#293c57', [x, -2.5, back - 25], [24, 6 + r() * 3, 12]);
  m.add(G.round, '#23304a', [x + 10, -3, back - 36], [28, 9 + r() * 3, 14]);
  for (let i = 0; i < 7; i++) {
    const sx = x - 15 + r() * 30, sy = 15 + r() * 15, sz = back - 8 - r() * 22;
    const size = i % 3 === 0 ? .3 + r() * .17 : .15 + r() * .1;
    m.add(SPARK, i % 3 ? '#a6bfdf' : '#ffe8bb', [sx, sy, sz], [size, size, size], [0, 0, (r() - .5) * .2], true);
  }

  const colour = r() < .5 ? '#a774a8' : '#668aab';
  kiosk(m, x - 8, back + 2.1, colour);
  pavilion(m, x + 7.5, back - 8, colour);
  // The turf surface is y=.075. Paving tops sit at .115, and the two
  // strips meet edge-to-edge instead of producing coplanar overlap.
  m.add(G.box, '#5c677b', [x - 2, .09, back + 5.8], [23, .05, 2.1]);
  m.add(G.box, '#5c677b', [x + 7.5, .09, back - .95], [2.2, .05, 11.4]);
  for (const [tx, tz, h] of [[x - 14, back - 8, 4.2], [x + 15, back - 14, 5.1]]) {
    m.add(G.pole, '#667887', [tx, h * .38, tz], [.19, h * .76, .19]);
    m.add(G.rock, '#477078', [tx, h, tz], [1.85, h * .46, 1.85]);
    m.add(G.rock, '#719c91', [tx - .45, h + .45, tz + .6], [1.3, h * .29, 1.3]);
  }

  // Small paved courts do not need to join the next bay's different rail
  // footprint. Their low furniture stays below the foreground sightline.
  m.add(G.pole, '#596b7a', [x - 6, .06, front + 8.3], [5.45, .12, 4.6]);
  m.add(G.pole, '#596b7a', [x + 7, .06, front + 7.5], [4.4, .12, 3.25]);
  for (let i = 0; i < 4; i++) m.add(G.box, '#83929c', [x - 6 + i * 4.1, .08, front + 3.7], [2.8, .12, 1.25]);
  for (const dx of [-11.5, 0, 11.5]) {
    const lx = x + dx, lz = front + 4.5;
    m.add(G.pole, '#a5a0a7', [lx, 1.35, lz], [.065, 2.7, .065]);
    m.add(G.pole, '#626b80', [lx, .16, lz], [.36, .32, .36]);
    m.add(GEM, LANTERNS[Math.round((dx + 11.5) / 11.5) % 4], [lx, 2.72, lz], [.38, .5, .38], [], true, dx * .1);
    m.add(G.cone, '#ac8ea9', [lx, 3.11, lz], [.49, .3, .49]);
  }
  const poolX = x - 6, poolZ = front + 8.8;
  if (r() < .42) fountain(m, poolX, poolZ);
  else {
    m.add(G.pole, '#6f7e90', [poolX, .12, poolZ], [3.35, .24, 3.35]);
    m.add(G.pole, '#3b667c', [poolX, .26, poolZ], [3.02, .035, 3.02]);
    rim(m, poolX, .28, poolZ, 3.38, .3);
    for (let i = 0; i < 7; i++) m.add(G.box, LANTERNS[i % 4], [poolX - 1.8 + i * .6, .29, poolZ + Math.sin(i * 2) * 1.6], [.4 + r() * .6, .01, .045], [], true);
  }
  const bx = x + 7, bz = front + 7.5;
  for (const dx of [-1.35, 1.35]) m.add(G.box, '#52657b', [bx + dx, .4, bz], [.16, .8, 1.2]);
  for (let i = 0; i < 3; i++) {
    m.add(G.box, '#c4a8aa', [bx, .79, bz - .4 + i * .4], [3.2, .13, .29]);
    m.add(G.box, '#c4a8aa', [bx, 1.14 + i * .21, bz - .53], [3.2, .15, .13]);
  }
  for (const dx of [-2.5, 2.5]) {
    m.add(G.pole, '#867797', [bx + dx, .28, bz], [.5, .56, .5]);
    m.add(G.rock, '#83aa90', [bx + dx, .8, bz], [.62, .68, .62]);
    m.add(GEM, '#d9b3e3', [bx + dx, 1.37, bz], [.23, .23, .23], [], true);
  }
}
