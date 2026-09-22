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

function bareTree(m: WorldModel, x: number, z: number, size: number, lean: number, index: number) {
  const point = (x0: number, y: number, z0 = 0) => [x + x0 * size, y * size, z + z0 * size];
  const root = point(0, 0), fork = point(lean, 2.9), crown = point(lean - .38, 6.1, .1);
  const upperFork = point(lean - .38 * .45, 2.9 + 3.2 * .45, .045);
  const left = point(lean - 1.35, 4.05, .08), right = point(lean + 1.2, 4.9, -.1);
  const bark = index % 2 ? '#8e798f' : '#9a8299';
  stem(m, bark, root, fork, .28 * size);
  stem(m, bark, fork, crown, .19 * size);
  stem(m, bark, fork, left, .16 * size);
  stem(m, bark, left, point(lean - 2.65, 4.48, .15), .09 * size);
  stem(m, '#ab93ab', left, point(lean - 1.5, 5.13, .07), .075 * size);
  stem(m, bark, upperFork, right, .13 * size);
  stem(m, '#ab93ab', right, point(lean + 1.85, 5.94, -.13), .08 * size);
  if (index % 2 === 0) m.add(leaf, '#e5bfef', crown, [.14, .2, .14], [], true);
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

export function halloweenLandscape(m: WorldModel, x: number, back: number, front: number, r: () => number, place: PumpkinPlacement) {
  m.add(moor, '#685970', [x, -.1, back - 19], [25, 8 + r() * 4, 16]);
  m.add(moor, '#584962', [x + 12, -.1, back - 39], [27, 15 + r() * 6, 20]);
  // Two small beds give the pumpkins a garden, with space between the clusters.
  for (let bed = 0; bed < 2; bed++) {
    const bx = x + (bed ? 7.4 : -7.5), bz = front + (bed ? 5.9 : 3.8);
    m.add(moor, '#726071', [bx, .09, bz], [5.5, .1, 2.35]);
    for (let i = 0; i < 3; i++) {
      const px = bx + (i - 1) * 2.9 + (r() - .5) * .65, pz = bz + (r() - .5) * 2;
      place(px, .1, pz, .65 + r() * .75, (i + bed) % 2 ? '#e7a44f' : '#d98852');
    }
    const a = [bx - 4.2, .18, bz + .45], b = [bx, .22, bz + 1.1], c = [bx + 4.2, .18, bz + .1];
    stem(m, '#9b9979', a, b, .075, G.box); stem(m, '#9b9979', b, c, .075, G.box);
    for (const side of [-1, 1]) m.add(leaf, '#9d9975', [bx + side * 1.5, .255, bz + .95], [.53, .085, .24], [0, side * .6, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const tx = x + [-13, -6, 5.6, 13.6][i], tz = back + [1, -2.5, -.7, -3][i];
    bareTree(m, tx, tz, [1.05, .79, 1.18, .94][i], (r() - .5) * .9, i);
  }
  if (r() < .42) {
    cottage(m, x - .7, back + 3);
    place(x + 2.1, .1, back + 5.1, 1);
  }
  // A gently wandering rail joins the five warm lantern posts.
  let previous: number[] | undefined;
  for (let i = 0; i < 5; i++) {
    const px = x + [-13, -7.1, -.4, 6.5, 13][i], pz = front + 9.6 + Math.sin(i * 1.7) * .35;
    const height = [1.45, 1.72, 1.52, 1.8, 1.6][i];
    m.add(G.box, '#b6a0b8', [px, height * .5, pz], [.13, height, .13]);
    m.add(G.rock, i % 2 ? '#d3b4ef' : '#ffbf76', [px, height + .17, pz], [.26, .33, .26], [], true);
    m.add(G.cone, '#95809d', [px, height + .5, pz], [.34, .2, .34]);
    const rail = [px, .85, pz];
    if (previous) stem(m, '#a88fab', previous, rail, .095, G.box);
    previous = rail;
  }
}
