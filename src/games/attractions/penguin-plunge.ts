import * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { PieceAnimation } from '../piece-animation';
import type { FairgroundLights } from '../world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { PieceBuilder, point, at } from './piece-builder';

type P = [number, number, number];

const TAU = Math.PI * 2;

const palette = ['#edb566', '#e89794', '#8bcac1', '#a5bcdf', '#c6a5d1'];

function surface(m: WorldModel, rows: P[][], colors: string[]) {
  for (let band = 0; band < rows[0].length - 1; band++) {
    const positions: number[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i][band], b = rows[i + 1][band], c = rows[i][band + 1], d = rows[i + 1][band + 1];
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    m.add(geometry, colors[band % colors.length], [0, 0, 0]); geometry.dispose();
  }
}
/** Large irregular facets, grouped by colour before baking, give the rock real
 * planes without spending a draw call on every ledge or triangular face. */

function rockSurface(m: WorldModel, rows: P[][], colors: string[]) {
  const groups = colors.map(() => [] as number[]);
  for (let band = 0; band < rows[0].length - 1; band++) for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i][band], c = rows[i][band + 1], b = rows[i + 1][band], d = rows[i + 1][band + 1];
    const color = (band * 2 + (i % 7 === 2 ? 1 : 0)) % colors.length;
    groups[color].push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  groups.forEach((positions, i) => {
    if (!positions.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
    m.add(g, colors[i], [0, 0, 0]); g.dispose();
  });
}
/** An ice shelf fills the space beneath a slide and its return conveyor. */

function glacierShelf(m: WorldModel, slide: (t: number) => T.Vector3, backZ: number) {
  const rows: P[][] = [];
  for (let i = 0; i <= 24; i++) {
    const p = slide(i / 24), ripple = Math.sin(i * 1.7) * .65;
    rows.push([[p.x, 0, p.z - 4.6], [p.x, p.y * .36, p.z - 3.8 + ripple],
      [p.x, p.y - .58, p.z - 2.45], [p.x, p.y - .42, p.z + 2.35],
      [p.x, p.y - .42, backZ + 1.7], [p.x, p.y * .42, backZ + 3.1 - ripple], [p.x, 0, backZ + 5]]);
  }
  rockSurface(m, rows, ['#86b7cb', '#b8dee5', '#dfeee8', '#add5e1', '#e8f3e9']);
  for (const t of [0, 1]) {
    const p = slide(t), radius = Math.abs(backZ - p.z) / 2;
    m.add(G.rock, '#b9dce4', [p.x, Math.max(.2, p.y * .42), (backZ + p.z) / 2], [radius + 2.8, Math.max(.5, p.y * .52), radius + 2.6]);
    m.add(G.round, '#e5f1e9', [p.x, p.y - .55, (backZ + p.z) / 2], [radius + 2.3, .35, radius + 2]);
  }
}

function cloud(m: WorldModel, x: number, y: number, z: number, scale = 1, face = false) {
  for (let i = 0; i < 5; i++) m.add(G.round, i % 2 ? '#f6f0dc' : '#e3eef0', [x + (i - 2) * 1.25 * scale, y + Math.sin(i * 1.5) * .55 * scale, z], [1.65 * scale, (1.05 + i % 2 * .35) * scale, 1.3 * scale]);
  if (face) {
    for (const side of [-1, 1]) m.add(G.round, '#547183', [x + side * .75 * scale, y + .08 * scale, z + 1.24 * scale], [.13 * scale, .19 * scale, .07 * scale]);
    m.add(G.round, '#e3a79a', [x, y - .37 * scale, z + 1.29 * scale], [.3 * scale, .11 * scale, .055 * scale]);
  }
}

function circuit(u: number, slide: (t: number) => T.Vector3, start: T.Vector3, end: T.Vector3, backZ: number) {
  if (u < .6) return { p: slide(u / .6), yaw: Math.PI / 2, down: true };
  if (u < .7) {
    const a = (u - .6) / .1 * Math.PI, r = (backZ - end.z) / 2;
    return { p: new T.Vector3(end.x + Math.sin(a) * r, end.y, end.z + r - Math.cos(a) * r), yaw: Math.PI / 2 - a, down: false };
  }
  if (u < .9) {
    const t = (u - .7) / .2;
    return { p: new T.Vector3(end.x + (start.x - end.x) * t, end.y + (start.y - end.y) * t, backZ), yaw: -Math.PI / 2, down: false };
  }
  const a = (u - .9) / .1 * Math.PI, r = (backZ - start.z) / 2;
  return { p: new T.Vector3(start.x - Math.sin(a) * r, start.y, start.z + r + Math.cos(a) * r), yaw: -Math.PI / 2 - a, down: false };
}

function returnBelt(m: WorldModel, slide: (t: number) => T.Vector3, backZ: number) {
  const start = slide(0), end = slide(1); let previous: T.Vector3 | undefined;
  for (let i = 0; i <= 44; i++) {
    const { p } = circuit(.6 + i / 44 * .4, slide, start, end, backZ);
    if (previous) for (const side of [-1, 1]) m.beam('#8cb2bf', previous.clone().add(new T.Vector3(0, 0, side * 1.2)), p.clone().add(new T.Vector3(0, 0, side * 1.2)), .13);
    m.add(G.box, '#cde2df', p.toArray(), [1.2, .15, 2.4]);
    if (i % 9 === 0) m.beam('#8aaebc', new T.Vector3(p.x, 0, p.z), p.clone(), .2);
    previous = p;
  }
}
/** A continuous rock ledge, with a radically different open mountain profile
 * from design A. The near-side scenery starts beyond the fence. */

function viaduct(s: MiniSection, m: WorldModel, icy: boolean) {
  let previous: T.Vector3[] | undefined;
  for (let i = 0; i <= 36; i++) {
    const p = point(s, i / 36), f = s.frames[Math.round(s.resolution * i / 36)];
    const ends = [-1, 1].map(side => p.clone().addScaledVector(f.right, side * 2.2).add(new T.Vector3(0, -.55, 0)));
    m.beam(icy ? '#a8d6df' : '#dcd9bf', ends[0], ends[1], .22);
    for (let j = 0; j < 2; j++) {
      const q = ends[j];
      if (i % 4 === 0) {
        if (icy) {
          m.add(G.pole, '#9ccbd9', [q.x, q.y / 2, q.z], [.85, Math.max(.3, q.y), .85]);
          m.add(G.rock, '#e2f0e7', [q.x, q.y - .2, q.z], [1.3, .7, 1.3]);
        } else cloud(m, q.x, q.y - .6, q.z, .85);
      }
      if (previous) {
        m.beam(icy ? '#86bacd' : '#dbcaa1', previous[j], q, .23);
        m.beam(icy ? '#c6e4e5' : '#eae4ca', previous[j].clone().add(new T.Vector3(0, 1.7, 0)), q.clone().add(new T.Vector3(0, 1.7, 0)), .09);
      }
      if (i % 2 === 0) m.beam(icy ? '#9ac9d4' : '#b3beb1', q, q.clone().add(new T.Vector3(0, 1.8, 0)), .09);
    }
    previous = ends;
  }
}

function penguinModel() {
  const m = new WorldModel();
  m.add(G.round, '#526e83', [0, .85, 0], [.64, .9, .52]);
  m.add(G.round, '#f0ecd7', [.08, .82, .4], [.46, .7, .18]);
  m.add(G.round, '#526e83', [0, 1.7, 0], [.53, .56, .46]);
  m.add(G.cone, '#e1b469', [0, 1.55, .58], [.2, .65, .22], [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    m.add(G.round, '#f5efd7', [side * .22, 1.82, .4], [.14, .18, .08]);
    m.add(G.round, '#405464', [side * .22, 1.82, .47], [.065, .085, .035]);
    m.add(G.round, '#e2b96e', [side * .3, .08, .2], [.27, .11, .42]);

  }
  m.add(G.box, '#dca0a0', [0, 1.3, 0], [1.05, .19, .9]);
  return m;
}

function penguins(s: MiniSection, b: PieceBuilder) {
  const m = new WorldModel(); viaduct(s, m, true);
  const c = point(s, .5);
  const slide = (u: number) => new T.Vector3(c.x - 16 + u * 34, 1.4 + c.y * .75 * (1 - u), c.z + 12 + Math.sin(u * Math.PI * 2) * 3);
  const rows: P[][] = [];
  for (let i = 0; i <= 48; i++) {
    const p = slide(i / 48);
    rows.push([[p.x, p.y + 1.1, p.z - 2.6], [p.x, p.y, p.z - 1.65], [p.x, p.y, p.z + 1.65], [p.x, p.y + 1.1, p.z + 2.6]]);
    if (i % 8 === 0) {
      m.add(G.rock, '#b2dbe3', [p.x, p.y * .44, p.z], [2.6, p.y * .54, 2.8]);
      m.add(G.pole, '#7ea9ba', [p.x, p.y + 1.5, p.z + 2.7], [.1, 2.1, .1]);
      m.add(G.box, palette[(i / 8) % 5], [p.x + .55, p.y + 2.2, p.z + 2.7], [1.1, .6, .08]);
    }
  }
  surface(m, rows, ['#b9e5eb', '#e8f4ec', '#8dc9db']);
  m.add(G.round, '#83c5d7', [c.x + 17, .04, c.z + 12], [9, .2, 7]);
  for (let i = 0; i < 9; i++) m.add(G.rock, '#e5f0e5', [c.x + 17 + Math.sin(i * 2.4) * 8.5, .28, c.z + 12 + Math.cos(i * 2.4) * 6.5], [1.7, .45, 1.6]);
  const start = slide(0), end = slide(1);
  glacierShelf(m, slide, c.z + 18);
  returnBelt(m, slide, c.z + 18);
  // Blue crevasses, snow cornices and hanging ice make the whole circuit part
  // of one glacier, with the return conveyor carved into its upper terrace.
  for (let i = 0; i < 9; i++) {
    const p = slide(.06 + i * .105);
    m.add(G.rock, i % 2 ? '#74b3cb' : '#98c8d7', [p.x, Math.max(.5, p.y * .32), p.z - 3.9], [2, Math.max(1.1, p.y * .43), 1.9], [0, i * .3, -.1]);
    m.add(G.rock, '#e6f2e8', [p.x, p.y - .65, p.z - 2.9], [2.2, .55, 1.6]);
    for (const side of [-1, 1]) m.add(G.cone, '#b3e3e6', [p.x + side * .5, p.y - 2, p.z - 3.65], [.33, 2.5, .32], [0, 0, Math.PI]);
  }
  // A snow arch frames the top of the run; its opening is wide enough for the
  // penguins and both rails of their conveyor, far outside the train route.
  for (const side of [-1, 1]) m.add(G.rock, '#a8d4df', [start.x - 1.2, start.y + 1.3, start.z + side * 3], [2.7, 3, 1.4]);
  m.add(G.rock, '#e4f0e6', [start.x - 1.2, start.y + 4.15, start.z], [2.8, 1.15, 4.1]);
  // Two huge fish-shaped ice hoops mark the slide's start and splash finish.
  for (const u of [.14, .78]) {
    const p = slide(u);
    for (const side of [-1, 1]) {
      m.add(G.rock, '#81bacc', [p.x, p.y + 1.65, p.z + side * 3], [.9, 2.5, .8]);
      m.add(G.cone, '#b7dee2', [p.x, p.y + 3.5, p.z + side * 3], [.6, 2, 1.5], [0, 0, side * .25]);
    }
    m.add(G.round, '#d4ece6', [p.x, p.y + 4.5, p.z], [.65, .65, 3.6]);
    m.add(G.round, '#7db6c7', [p.x + .55, p.y + 4.5, p.z - .6], [.11, .23, .23]);
  }
  b.batch(m);
  const riders = b.pool(penguinModel(), 7), floe = new WorldModel(); riders[0].name = 'penguin-riders';
  const wing = new WorldModel(); wing.add(G.round, '#526e83', [0, -.36, 0], [.17, .52, .25]);
  const wings = b.pool(wing, 14); wings[0].name = 'penguin-flippers';
  const spray = new WorldModel();
  spray.add(G.rock, '#cdeae5', [0, 0, 0], [.22, .32, .22], [], true);
  const splashes = b.pool(spray, 14);
  const wingPose = new T.Object3D(), wingMatrix = new T.Matrix4();

  const riderPose = new T.Object3D(); riderPose.rotation.order = 'YXZ';
  floe.add(G.rock, '#e8f3e8', [0, 0, 0], [2, .4, 1.6]);
  const floes = b.pool(floe, 4);
  b.animate((time, distance, reduced) => {
    const clock = reduced ? 0 : time, push = reduced ? 0 : T.MathUtils.clamp(distance - at(s, .25), 0, s.length * .5) * .008;
    for (let i = 0; i < 7; i++) {
      const u = (clock * .075 + push + i / 7) % 1;
      const { p, yaw, down } = circuit(u, slide, start, end, c.z + 18);
      const belly = down ? T.MathUtils.smoothstep(u, 0, .07) * (1 - T.MathUtils.smoothstep(u, .52, .6)) : 0;
      const tangent = Math.atan2(34, 6 * Math.PI * Math.cos(u / .6 * TAU));
      const heading = down ? Math.PI / 2 + (tangent - Math.PI / 2) * belly : yaw;
      // Belly-down sliding is a distinct pose from the upright ride uphill.
      riderPose.position.set(p.x, p.y + .3 + belly * .55, p.z); riderPose.scale.setScalar(1.3);
      riderPose.rotation.set((Math.PI / 2 - .17) * belly, heading, belly * .08 * Math.sin(clock * 5 + i));
      riderPose.updateMatrix(); for (const mesh of riders) mesh.setMatrixAt(i, riderPose.matrix);
      for (let side = 0; side < 2; side++) {
        wingPose.position.set(side ? .65 : -.65, 1.22, 0);
        wingPose.rotation.set(0, 0, (side ? 1 : -1) * (.45 + (reduced ? 0 : (.5 + .5 * (Math.sin(clock * 3 + i) * (1 - belly) + Math.sin(clock * 8 + i) * belly)) * (.35 + belly * .45))));
        wingPose.updateMatrix(); wingMatrix.multiplyMatrices(riderPose.matrix, wingPose.matrix);
        for (const mesh of wings) mesh.setMatrixAt(i * 2 + side, wingMatrix);
        const sliding = down ? Math.sin(Math.min(1, u / .6) * Math.PI) : 0;
        b.place(splashes, i * 2 + side, p.x - .8 - side * .4, p.y + .25 + side * .2, p.z + (side ? -1 : 1) * 1.1, reduced ? 0 : sliding * (.65 + .3 * Math.sin(clock * 9 + i)), 0, clock + i, 0);
      }
    }
    for (let i = 0; i < 4; i++) b.place(floes, i, c.x + 15 + Math.sin(i * 2.4) * 5.5, .4 + Math.sin(clock * .8 + i) * (reduced ? 0 : .14), c.z + 12 + Math.cos(i * 2.4) * 4, 1, 0, i, 0);
  });
}

export function createPenguinPlunge(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation {
 const piece=new PieceBuilder(material,lights);penguins(section,piece);
 piece.update(0,section.start-12,false);return piece;
}

