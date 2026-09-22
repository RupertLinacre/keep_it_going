import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { PumpkinPlacement } from './world-halloween';

// Shared low-poly shapes are baked into the existing landscape batches.
const branch = new T.CylinderGeometry(.48, 1, 1, 4);
const leaf = new T.OctahedronGeometry(1);
const moor = (() => {
  const vertices: number[] = [], indices: number[] = [];
  const rim = [1, .94, 1, .91, .98, .95, 1, .93, 1, .96];
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5, radius = rim[i] * (ring ? .52 : 1);
    vertices.push(Math.sin(a) * radius + (ring ? -.08 : 0), ring ? .48 + Math.sin(a * 2) * .12 : 0,
      Math.cos(a) * radius + (ring ? -.09 : 0));
  }
  vertices.push(.08, 1, -.12);
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10;
    indices.push(i, j, i + 10, j, j + 10, i + 10, i + 10, j + 10, 20);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
})();

function stem(m: WorldModel, color: string, from: number[], to: number[], radius: number, geometry: T.BufferGeometry = branch) {
  const a = new T.Vector3(...from), b = new T.Vector3(...to), delta = b.clone().sub(a);
  const rotation = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize()));
  m.add(geometry, color, a.add(b).multiplyScalar(.5).toArray(), [radius, delta.length(), radius], [rotation.x, rotation.y, rotation.z]);
}

function bareTree(m: WorldModel, x: number, z: number, size: number, lean: number, style: number) {
  const mirror = style % 2 ? -1 : 1;
  const point = (p: number[]) => [x + (p[0] + lean * p[1] * .15) * size * mirror, .075 + p[1] * size, z + (p[2] ?? 0) * size];
  const poses = [
    [[0, 0], [-.35, 2.5], [.35, 4.1], [-.65, 6.2], [-1.8, 3.7], [-2.7, 4.6], [1.45, 4.65], [2.05, 5.8]],
    [[0, 0], [.5, 2.7], [1.6, 4.6], [3.1, 5.2], [-.8, 3.9], [-.35, 5], [1.3, 5.7], [1.8, 6.1]],
    [[0, 0], [-.55, 2.6], [-.3, 4.7], [1, 5.8], [-2.2, 3.7], [-2, 4.8], [2, 5.4], [1.1, 4.7]],
  ][style % 3];
  const edges = style % 3 === 2
    ? [[0, 1, .39], [1, 2, .27], [2, 3, .17], [3, 6, .095], [1, 4, .19], [4, 5, .11], [2, 7, .13]]
    : [[0, 1, .39], [1, 2, .27], [2, 3, .16], [1, 4, .19], [4, 5, .11], [2, 6, .14], [6, 7, .085]];
  for (const [a, b, radius] of edges) stem(m, radius < .15 ? '#ac91a9' : '#91748c', point(poses[a]), point(poses[b]), radius * size);
  m.add(leaf, '#e5bfef', point(poses[3]), [.15, .23, .15], [], true);
}

// A filled gable and two joined roof slopes replace the old floating cone.
const gable = (() => {
  const shape = new T.Shape();
  shape.moveTo(-2.4, 4.35); shape.lineTo(2.4, 4.35); shape.lineTo(-.45, 6.35); shape.closePath();
  return new T.ExtrudeGeometry(shape, {depth: 3.6, bevelEnabled: false, steps: 1});
})();

function cottage(m: WorldModel, x: number, z: number) {
  const lean = .065, turn = -.1;
  const q = new T.Quaternion().setFromEuler(new T.Euler(0, turn, lean));
  const at = (p: number[]) => new T.Vector3(...p).applyQuaternion(q).add(new T.Vector3(x, 0, z)).toArray();
  const add = (shape: T.BufferGeometry, color: string, p: number[], scale: number[], rotation = [0, 0, 0], glow = false) => {
    const rq = q.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation)));
    const e = new T.Euler().setFromQuaternion(rq);
    m.add(shape, color, at(p), scale, [e.x, e.y, e.z], glow);
  };
  add(G.box, '#a890a8', [0, 2.15, 0], [4.8, 4.5, 3.6]);
  add(gable, '#b399ad', [0, 0, -1.8], [1, 1, 1]);
  // Both slopes share the same ridge and overhang the complete wall width.
  for (const edge of [[-2.75, 4.05], [2.75, 4.05]]) {
    const dx = edge[0] + .45, dy = edge[1] - 6.35;
    add(G.box, '#685978', [(-.45 + edge[0]) * .5, (6.35 + edge[1]) * .5, 0],
      [Math.hypot(dx, dy) + .15, .22, 4.35], [0, 0, Math.atan2(dy, dx)]);
  }
  add(G.box, '#826b83', [1.2, 5.25, -.6], [.52, 2.6, .6]);
  add(G.box, '#b199af', [1.2, 6.55, -.6], [.74, .2, .82]);
  add(G.box, '#705c79', [0, 1.4, 1.84], [1.5, 2.8, .13]);
  add(G.box, '#ffdc99', [0, 1.37, 1.92], [1.13, 2.6, .05], [], true);
  add(G.box, '#ccb297', [0, .15, 2.13], [1.9, .25, .85]);
  for (const dx of [-1.5, 1.5]) {
    add(G.box, '#77617f', [dx, 3.13, 1.84], [1.02, 1.33, .13]);
    add(G.box, '#f9d4a1', [dx, 3.13, 1.92], [.77, 1.08, .055], [], true);
    add(G.box, '#8b7189', [dx, 3.13, 1.97], [.085, 1.08, .06]);
    add(G.box, '#8b7189', [dx, 3.13, 1.97], [.77, .085, .06]);
  }
  add(leaf, '#efc5ef', [-.45, 5.18, 1.85], [.26, .37, .055], [], true);
}

const mushroomCap = (() => {
  const positions: number[] = [], indices: number[] = [];
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7, radius = ring ? .78 : 1;
    positions.push(Math.sin(a) * radius, ring ? .45 : 0, Math.cos(a) * radius);
  }
  positions.push(0, .72, 0, 0, -.07, 0);
  for (let i = 0; i < 7; i++) {
    const j = (i + 1) % 7;
    indices.push(i, j, i + 7, j, j + 7, i + 7, i + 7, j + 7, 14, j, i, 15);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
})();
const hollowRim = new T.TorusGeometry(1, .13, 3, 8);

function mushroomGrove(m: WorldModel, x: number, z: number) {
  m.add(moor, '#817181', [x, .09, z], [5.5, .11, 3.2]);
  const mushrooms = [[-2.7, .35, 1.55, 2.15], [.4, -.45, 2.15, 3.35], [3.05, 1.25, 1.25, 1.55]];
  for (const [i, [dx, dz, radius, height]] of mushrooms.entries()) {
    const top = [x + dx + .17, height, z + dz];
    stem(m, '#d1b7b4', [x + dx, .075, z + dz], top, .3 + radius * .045, G.pole);
    m.add(mushroomCap, i % 2 ? '#b78bbc' : '#d5a381', top, [radius, radius, radius]);
    // Large cream spots sit on the sloping cap, readable from the ride camera.
    for (const side of [-1, 1]) m.add(leaf, '#ffe1ac', [top[0] + side * radius * .3, height + radius * .57, top[2] + radius * .25],
      [radius * .17, radius * .075, radius * .19], [0, side * .3, 0], true);
  }
  for (const side of [-1, 1]) m.add(G.rock, '#8a778e', [x + side * 4.1, .35, z + 1.35], [.9, .5, .7]);
}

function owlTree(m: WorldModel, x: number, z: number) {
  m.add(G.pole, '#8f718a', [x, 1.57, z], [.95, 3.3, .95], [0, Math.PI / 6, 0]);
  stem(m, '#9b7c91', [x - .4, 2.9, z], [x + .45, 4.25, z], .52);
  stem(m, '#9b7c91', [x - .25, 2.95, z], [x + 1.9, 3.95, z], .35);
  for (const side of [-1, 1]) stem(m, '#8f718a', [x, .45, z], [x + side * 1.3, .08, z + .45], .3);
  m.add(G.rock, '#45394f', [x, 1.45, z + .832], [.43, .75, .035]);
  m.add(hollowRim, '#b297a9', [x, 1.45, z + .858], [.5, .85, .18]);
  // One static, oversized owl shares the solid/glow landscape batches.
  const ox = x + 1.1, oz = z + .1;
  m.add(G.rock, '#b397b6', [ox, 4.48, oz], [.8, .96, .59]);
  m.add(G.rock, '#c7b1c7', [ox, 5.63, oz + .06], [.85, .72, .61]);
  for (const side of [-1, 1]) {
    m.add(leaf, '#886a97', [ox + side * .69, 4.46, oz + .09], [.27, .65, .45], [0, 0, side * .14]);
    m.add(G.cone, '#b397b6', [ox + side * .56, 6.22, oz + .06], [.23, .7, .27], [0, 0, side * -.18]);
    m.add(G.rock, '#ffe3b3', [ox + side * .3, 5.72, oz + .62], [.3, .34, .085], [], true);
    m.add(leaf, '#4e405e', [ox + side * .3, 5.72, oz + .711], [.12, .19, .04]);
  }
  m.add(leaf, '#e1a267', [ox, 5.32, oz + .72], [.15, .21, .15]);
}

/** Moorland-only filler; returned samples preserve the main builder's RNG order. */
export function halloweenTerrain(m: WorldModel, x: number, back: number, r: () => number): [number, number] {
  const samples: [number, number] = [r(), r()];
  m.add(moor, '#756277', [x - 3, -.1, back - 23], [29, 3.1 + samples[0] * 1.7, 17]);
  m.add(moor, '#65596f', [x + 11, -.1, back - 44], [32, 6 + samples[1] * 2, 15]);
  return samples;
}

export function halloweenLandscape(m: WorldModel, x: number, back: number, front: number, r: () => number, place: PumpkinPlacement, variant?: number) {
  // Keep one small set of seeded samples per bay; a supplied sequence guarantees
  // neighbouring bays show different little stories.
  const samples = [...halloweenTerrain(m, x, back, r), ...Array.from({length: 23}, r)];
  const scene = variant === undefined ? (samples[24] < .42 ? 0 : samples[24] < .72 ? 1 : 2) : ((variant % 3) + 3) % 3;
  // Crescent-shaped clusters, with a curling vine around each planted bed.
  for (let bed = 0; bed < 2; bed++) {
    const bx = x + (bed ? 7.7 : -7.8) + (scene - 1) * (bed ? -.6 : .6), bz = front + (bed ? 6.1 : 3.5);
    const turn = (bed ? -.3 : .4) + scene * .13, cos = Math.cos(turn), sin = Math.sin(turn);
    const point = (dx: number, y: number, dz: number) => [bx + dx * cos - dz * sin, y, bz + dx * sin + dz * cos];
    m.add(moor, '#7e6878', [bx, .09, bz], [4.6, .1, 2.6], [0, -turn, 0]);
    for (let i = 0; i < 3; i++) {
      const offset = 2 + bed * 9 + i * 3, dx = [-2.05, -.15, 2.1][i], dz = [-.25, 1.05, -.55][i];
      const p = point(dx + (samples[offset] - .5) * .6, .1, dz + (samples[offset + 1] - .5) * .6);
      place(p[0], p[1], p[2], .68 + samples[offset + 2] * .69, (i + bed) % 2 ? '#e7a44f' : '#d98852');
    }
    const vine = [[-3.7, -.7], [-2.8, 1], [-.5, 1.8], [2.1, 1.5], [3.5, .1], [2.85, -.9]];
    for (let i = 1; i < vine.length; i++) stem(m, '#b0a985', point(vine[i - 1][0], .2, vine[i - 1][1]), point(vine[i][0], .2, vine[i][1]), .12, G.box);
    for (const side of [-1, 1]) m.add(leaf, '#b1a580', point(side * 1.5, .255, 1.6), [.63, .085, .3], [0, side * .6 - turn, 0]);
  }
  for (let i = 0; i < 2; i++) {
    const tx = x + (i ? 10 : -10), tz = back - 2 - samples[22 + i] * 2;
    bareTree(m, tx, tz, .92 + samples[20 + i] * .18, samples[20 + i] - .5, (scene + i) % 3);
  }
  if (scene === 0) {
    cottage(m, x - .7, back + 3);
    place(x + 2.1, .1, back + 5.1, 1);
    for (let i = 0; i < 2; i++) m.add(G.rock, '#b399a4', [x - .7 + i * .45, .11, back + 6.3 + i * 1.05], [.75, .09, .42]);
  } else if (scene === 1) mushroomGrove(m, x, back + 2.6);
  else owlTree(m, x - .5, back + 2.4);
  // Two short garden fences leave an inviting entrance between the beds.
  let previous: number[] | undefined;
  for (let i = 0; i < 5; i++) {
    const px = x + [-12, -7.4, -3.1, 5.1, 12][i], pz = front + [7.1, 7.8, 7.3, 9.4, 8.8][i];
    const height = [1.45, 1.72, 1.52, 1.8, 1.6][i];
    m.add(G.box, '#b6a0b8', [px, height * .5, pz], [.13, height, .13]);
    m.add(G.rock, i % 2 ? '#d3b4ef' : '#ffbf76', [px, height + .17, pz], [.26, .33, .26], [], true);
    m.add(leaf, '#a78aa8', [px, height + .49, pz], [.35, .14, .35]);
    const rail = [px, .85, pz];
    if (previous && i !== 3) stem(m, '#a88fab', previous, rail, .095, G.box);
    previous = rail;
  }
}
