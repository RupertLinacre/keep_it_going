import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

/** Low banks follow the crests, with room for the coaches above the grass. */
export function sheepBanks(m: WorldModel, section: MiniSection) {
  const rows: number[][] = [], vertices: number[] = [];
  for (let i = 0; i <= 40; i++) {
    const p = section.frames[Math.round(section.resolution * i / 40)].position;
    const y = Math.max(.15, p.y - 1.55);
    rows.push([-8, -3, 0, 3, 8].flatMap((z, j) =>
      [p.x - section.origin.x, [0, y * .85, y, y * .85, 0][j], p.z - section.origin.z + z]));
  }
  for (let i = 0; i < 40; i++) for (let j = 0; j < 4; j++) {
    const a = rows[i].slice(j * 3, j * 3 + 3), b = rows[i + 1].slice(j * 3, j * 3 + 3);
    const c = rows[i].slice((j + 1) * 3, (j + 2) * 3), d = rows[i + 1].slice((j + 1) * 3, (j + 2) * 3);
    vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
  m.add(g, '#91bf67', [0, 0, 0]); g.dispose();
  for (let i = 0; i < 9; i++) {
    const p = section.sample(section.start + section.length * (.08 + i * .105)).position;
    const x = p.x - section.origin.x, z = p.z - section.origin.z - 4.3;
    m.add(G.box, '#e7bf6a', [x, .85, z], [2.4, 1.7, 1.8]);
    for (const dx of [-.7, .7]) m.add(G.box, '#b99650', [x + dx, .85, z], [.09, 1.76, 1.86]);
    // Daisies along the edge of the grass banks.
    for (const side of [-1, 1]) {
      const fy = Math.max(.2, (p.y - 1.5) * .6);
      m.add(G.round, '#fff4d1', [x, fy + .3, z + 4.3 + side * 5], [.36, .13, .36]);
      m.add(G.round, '#e7b749', [x, fy + .43, z + 4.3 + side * 5], [.11, .06, .11]);
    }
  }
}

export function lilyBridge(m: WorldModel, section: MiniSection) {
  const x = section.span * .5, z = section.hand * 4;
  m.add(G.round, '#85b799', [x, -.2, z], [section.span * .39, .5, 14]);
  m.add(G.round, '#74bfc1', [x, .13, z], [section.span * .36, .13, 12.5]);
  for (let i = 0; i < 16; i++) {
    const px = x + Math.sin(i * 2.4) * section.span * .28, pz = z + Math.cos(i * 2.4) * (7 + i % 3);
    m.add(G.round, '#689e72', [px, .29, pz], [.85, .055, .65]);
    if (i % 3 === 0) {
      for (let j = 0; j < 5; j++) m.add(G.round, '#f2b6cf', [px + Math.sin(j * 1.256) * .22, .44, pz + Math.cos(j * 1.256) * .22], [.18, .14, .18]);
      m.add(G.round, '#ffe2a0', [px, .6, pz], [.13, .09, .13]);
    }
  }
  // The timber deck and low handrails follow the actual curved railway.
  let previous: T.Vector3[] | undefined;
  for (let d = 0; d <= section.length; d += 2) {
    const f = section.sample(section.start + d), p = f.position.clone(); p.x -= section.origin.x; p.z -= section.origin.z;
    m.add(G.box, '#c69a64', [p.x, p.y - .45, p.z], [3.5, .23, 1.9], new T.Euler().setFromQuaternion(f.rotation).toArray().slice(0, 3) as number[]);
    if (Math.floor(d) % 6) continue;
    const rails = [-1, 1].map(side => p.clone().addScaledVector(f.right, side * 1.85));
    for (let i = 0; i < 2; i++) {
      const q = rails[i];
      m.add(G.pole, '#a27f55', [q.x, (q.y + .9) / 2, q.z], [.13, q.y + .9, .13]);
      q.y += .65;
      if (previous) m.beam('#e4bd7f', previous[i], q, .075);
    }
    previous = rails;
  }
}

export function meadowWindmill(m: WorldModel, section: MiniSection) {
  // Its sails sit inside the loop silhouette, safely behind the entire rail.
  const x = section.width * .5, y = section.origin.y + section.amplitude, z = -3.7;
  m.add(G.cone, '#f2dfb0', [x, y * .45, z], [3.1, y * .9, 3.1]);
  m.add(G.cone, '#da8e6e', [x, y - 1.4, z], [3.4, 4, 3.4]);
  m.add(G.box, '#739693', [x, 1.7, z + 2.3], [1.3, 3.4, .12]);
  for (const wy of [5, 8]) m.add(G.box, '#9fbbc0', [x, wy, z + 1.8], [.8, 1.1, .1]);
  m.add(G.round, '#9c7652', [x, y, z + .5], [.65, .65, .7]);
}

export function duckModel() {
  const m = new WorldModel();
  m.add(G.round, '#ffdd7c', [0, .35, 0], [.55, .35, .36]);
  m.add(G.round, '#ffe8a3', [.38, .72, 0], [.27, .29, .26]);
  m.add(G.box, '#e9964f', [.65, .68, 0], [.3, .09, .24]);
  for (const z of [-.23, .23]) m.add(G.round, '#455251', [.48, .8, z], [.035, .045, .025]);
  m.add(G.round, '#efc866', [-.1, .46, .28], [.3, .18, .1]);
  return m;
}
