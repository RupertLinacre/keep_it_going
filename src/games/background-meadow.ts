import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';

// Background-only shapes. The attraction/creature prefabs retain their detail.
const patch = new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const flower = (() => {
  const vertices: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, b = (i + 1) * Math.PI / 5;
    const r = i % 2 ? .45 : 1, s = i % 2 ? 1 : .45;
    vertices.push(0, .18, 0, Math.cos(b) * s, 0, Math.sin(b) * s, Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
})();
const flowerHeart = new T.OctahedronGeometry(1);
const millTower = new T.CylinderGeometry(1.25, 2, 5.8, 7);
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
export type MeadowActor = { kind: 'sheep' | 'mill'; x: number; y: number; z: number; phase: number; size: number; onTrack?: boolean };

function windmill(m: WorldModel, place: (actor: MeadowActor) => void, mx: number, mz: number, r: () => number) {
    m.add(patch, '#bed093', [mx, .09, mz + .5], [3.7, 1, 3]);
    // Turn a flat tower facet towards the path, then follow its taper with the
    // door and frame. An upright door would disappear into the wider base.
    m.add(millTower, '#efe0b6', [mx, 2.9, mz], [1, 1, 1], [0, -Math.PI / 7, 0]);
    m.add(G.cone, '#d88b70', [mx, 6.55, mz], [2, 1.7, 2], [0, -Math.PI / 7, 0]);
    const facade = Math.cos(Math.PI / 7), slope = .75 / 5.8 * facade;
    const doorZ = mz + 2 * facade - 1.15 * slope;
    m.add(G.box, '#c4a47a', [mx, 1.15, doorZ + .04], [.93, 2.34, .1], [-Math.atan(slope), 0, 0]);
    m.add(G.box, '#819d91', [mx, 1.15, doorZ + .1], [.7, 2.2, .055], [-Math.atan(slope), 0, 0]);
    m.add(G.box, '#e9ce94', [mx, .15, mz + 2.08], [1.3, .25, .65]);
    // Hub and sails sit fully in front of the taper and roof, never through them.
    m.add(G.pole, '#9b7c57', [mx, 5.3, mz + 1.65], [.17, 1.2, .17], [Math.PI / 2, 0, 0]);
    place({ kind: 'mill', x: mx, y: 5.3, z: mz + 2.32, phase: r() * Math.PI * 2, size: 1 });
}

/** Rounded shoulders, a flattened summit and restrained bands of field colour. */
function hill(m: WorldModel, x: number, z: number, width: number, height: number, depth: number, phase: number, distant: boolean) {
  const faces: number[][] = [[], [], []], sides = 14;
  const rings = [1, .76, .4];
  const point = (ring: number, i: number) => {
    const a = i * Math.PI * 2 / sides;
    const radius = rings[ring] * (1 + Math.sin(a * 3 + phase) * .05);
    return [Math.cos(a) * radius * width + ring * .7,
      [-.1, height * .34, height * .76][ring] + (ring ? Math.sin(a + phase) * height * .045 : 0),
      Math.sin(a) * radius * depth - ring * .5];
  };
  for (let i = 0; i < sides; i++) {
    for (let ring = 0; ring < 2; ring++) {
      const a = point(ring, i), b = point(ring, i + 1), c = point(ring + 1, i), d = point(ring + 1, i + 1);
      faces[ring].push(...a, ...d, ...b, ...a, ...c, ...d);
    }
    faces[2].push(...point(2, i), 1.7, height, -.9, ...point(2, i + 1));
  }
  const palette = distant ? ['#b0ca89', '#bed497', '#c9dda4'] : ['#8cb369', '#9bbf77', '#abc982'];
  faces.forEach((vertices, i) => {
    const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));g.computeVertexNormals();
    m.add(g, palette[i], [x, 0, z]);g.dispose();
  });
}

function orchardTree(m: WorldModel, x: number, z: number, size: number, apples: boolean) {
  m.add(patch, '#98bc79', [x, .09, z], [3.2 * size, 1, 2.3 * size]);
  m.add(G.pole, '#927556', [x, 1.4 * size, z], [.25 * size, 2.8 * size, .25 * size]);
  m.beam('#927556', V(x, 1.9 * size, z), V(x + size, 3.1 * size, z + .2), .16 * size);
  m.add(G.round, '#769e61', [x - .6 * size, 3.25 * size, z], [1.75 * size, 1.6 * size, 1.6 * size]);
  m.add(G.round, '#92b26b', [x + .75 * size, 3.95 * size, z + .15], [1.5 * size, 1.85 * size, 1.5 * size]);
  if (apples) for (const [dx, dy, dz] of [[-1, 3.15, 1.25], [.7, 3.4, 1.5], [.3, 4.6, 1.25], [1.6, 3.85, .85]]) {
    m.add(flowerHeart, '#d88162', [x + dx * size, dy * size, z + dz * size], [.23, .23, .23]);
    m.add(G.box, '#827955', [x + dx * size, dy * size + .23, z + dz * size], [.045, .15, .045]);
  }
}

function flowers(m: WorldModel, x: number, z: number, r: () => number, sunflowers = false) {
  m.add(patch, sunflowers ? '#b8c681' : '#a1c179', [x, .09, z], [3.8, 1, 1.8], [0, .2, 0]);
  for (let i = 0; i < (sunflowers ? 4 : 7); i++) {
    const a = i * 2.4, radius = .8 + r() * 2, fx = x + Math.cos(a) * radius, fz = z + Math.sin(a) * radius * .45;
    const h = sunflowers ? 1.25 + r() * .6 : .35 + r() * .25, size = sunflowers ? .43 : .25 + r() * .08;
    m.add(G.box, '#73965b', [fx, h / 2, fz], [.04, h, .04]);
    m.add(flower, sunflowers ? '#ecc261' : i % 3 ? '#fff0bf' : '#e5a5b3', [fx, h, fz], [size, size, size], [sunflowers ? .45 : 0, a, 0]);
    m.add(flowerHeart, sunflowers ? '#937550' : '#ebbe50', [fx, h + size * .18, fz], [sunflowers ? .14 : .075, .07, sunflowers ? .14 : .075]);
    if (sunflowers) m.add(flowerHeart, '#83a363', [fx + .19, h * .53, fz], [.28, .07, .12], [0, 0, .5]);
  }
}

function hayCart(m: WorldModel, x: number, z: number) {
  m.add(patch, '#b3c58a', [x, .09, z], [4.2, 1, 2.6]);
  for (const dx of [-1.15, 1.15]) {
    m.add(G.box, '#78664f', [x + dx, .62, z], [.14, .14, 2.9]);
    for (const side of [-1, 1]) {
      m.add(G.pole, '#866746', [x + dx, .62, z + side * 1.24], [.53, .18, .53], [Math.PI / 2, 0, 0]);
      m.add(G.pole, '#c6aa71', [x + dx, .62, z + side * 1.35], [.14, .04, .14], [Math.PI / 2, 0, 0]);
    }
  }
  m.add(G.box, '#bc9566', [x, 1.08, z], [3.4, .25, 2.05]);
  m.add(G.box, '#e4c982', [x - .15, 1.62, z], [2.85, .85, 1.7]);
  m.add(G.box, '#eeda9b', [x - .65, 2.17, z], [1.6, .3, 1.45]);
  for (const dx of [-.85, .55]) m.add(G.box, '#b29460', [x + dx, 1.63, z], [.07, .91, 1.75]);
  for (const side of [-1, 1]) m.add(G.box, '#98744e', [x, 1.3, z + side * 1.04], [3.7, .16, .12]);
  m.beam('#98744e', V(x + 1.7, .98, z), V(x + 3.6, .37, z), .1);
}

function hives(m: WorldModel, x: number, z: number) {
  m.add(patch, '#b4c985', [x, .09, z], [3.2, 1, 2]);
  for (const dx of [-1.25, 1.25]) {
    for (let i = 0; i < 3; i++) m.add(G.pole, i % 2 ? '#d6b86f' : '#e4c880',
      [x + dx, .28 + i * .3, z], [.68 - i * .12, .34, .68 - i * .12]);
    m.add(G.cone, '#ead6a1', [x + dx, 1.05, z], [.48, .46, .48]);
    m.add(G.box, '#89734e', [x + dx, .24, z + .67], [.22, .17, .03]);
  }
}

/** Cheap distant land for narrow sections; returns the shared composition phase. */
export function meadowTerrain(m: WorldModel, x: number, back: number, r: () => number) {
  const phase = r() * Math.PI * 2;
  hill(m, x + 8, back - 39, 29, 7.5 + r() * 4, 20, phase, true);
  hill(m, x - 3, back - 23, 24, 3.8 + r() * 2.2, 13, phase + 1, false);
  return phase;
}

/** Three small countryside scenes, with the same bounded flock/actor budget. */
export function meadowScenery(m: WorldModel, place: (actor: MeadowActor) => void, x: number, back: number, front: number, r: () => number, variant?: number) {
  const scene = variant === undefined ? Math.floor(r() * 3) : ((variant % 3) + 3) % 3;
  const phase = meadowTerrain(m, x, back, r);

  // A short field boundary belongs to this clearing instead of joining every
  // section into a ruler-straight fence. The gate has a visibly braced panel.
  const fence = Array.from({ length: 4 }, (_, i) => V(x - 10 + i * 6.3, 0, back - .8 + Math.sin(i * 1.1 + phase) * .65));
  for (let i = 0; i < fence.length; i++) {
    const p = fence[i];m.add(G.pole, '#a88b61', [p.x, .72, p.z], [.1, 1.44, .1]);
    if (i) {
      const a = fence[i - 1];
      for (const y of [.55, 1.1]) m.beam('#ddcaa3', V(a.x, y, a.z), V(p.x, y, p.z), .065);
      if (i === 2) m.beam('#b49771', V(a.x, .55, a.z), V(p.x, 1.1, p.z), .065);
    }
  }

  const flockX = x - 3 + r() * 5, flockZ = front + 2.4 + r();
  m.add(patch, '#a3c27a', [flockX, .09, flockZ], [5.8, 1, 3], [0, phase * .1, 0]);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.25 + phase;
    place({ kind: 'sheep', x: flockX + Math.cos(a) * (1.6 + i * .5), y: .15,
      z: flockZ + Math.sin(a) * 1.2, phase: r() * Math.PI * 2, size: .82 + r() * .3, onTrack: true });
  }

  if (scene === 0) {
    windmill(m, place, x - 5, back - 4, r);
    orchardTree(m, x + 7.5, back + 2, 1, false);
    flowers(m, x - 7, front + 8, r);
    flowers(m, x + 7, front + 8.5, r, true);
  } else if (scene === 1) {
    orchardTree(m, x - 5.5, back + 1, 1, true);
    orchardTree(m, x + 5.8, back - 2.1, 1.12, true);
    hives(m, x + 7, front + 7.8);
    flowers(m, x - 7, front + 8.2, r, true);
  } else {
    orchardTree(m, x + 7.5, back - .2, 1.05, false);
    hayCart(m, x - 5, back + 4);
    flowers(m, x + 7, front + 8.6, r);
    // A little sunflower row reads at phone scale beside the grazing field.
    flowers(m, x - 6.5, front + 7.8, r, true);
  }
}
