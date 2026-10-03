import * as T from 'three';
import type { MiniSection } from '../../games/mini-track';
import type { PieceAnimation } from '../../games/piece-animation';
import type { FairgroundLights } from '../../games/world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { VariantBuilder, point, at, arrival } from './variant-kit';

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
function arc(m: WorldModel, color: string, cx: number, cy: number, z: number, radius: number, width: number, start = 0, end = Math.PI) {
  const positions: number[] = [];
  for (let i = 0; i < 32; i++) {
    const a = start + (end - start) * i / 32, b = start + (end - start) * (i + 1) / 32;
    const p = (t: number, r: number) => [cx + Math.cos(t) * r, cy + Math.sin(t) * r, z];
    positions.push(...p(a, radius), ...p(b, radius), ...p(a, radius - width), ...p(b, radius), ...p(b, radius - width), ...p(a, radius - width));
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
  m.add(g, color, [0, 0, 0]); m.add(g, color, [2 * cx, 0, z * 2], [-1, 1, -1]); g.dispose();
}
function pine(m: WorldModel, x: number, y: number, z: number, scale = 1) {
  m.add(G.pole, '#816d53', [x, y + scale, z], [.2 * scale, 2 * scale, .2 * scale]);
  m.add(G.cone, '#5c9388', [x, y + 2.7 * scale, z], [1.35 * scale, 4 * scale, 1.35 * scale]);
  m.add(G.cone, '#eef4e3', [x, y + 4 * scale, z], [.66 * scale, 1.9 * scale, .66 * scale]);
}
function cloud(m: WorldModel, x: number, y: number, z: number, scale = 1, face = false) {
  for (let i = 0; i < 5; i++) m.add(G.round, i % 2 ? '#f6f0dc' : '#e3eef0', [x + (i - 2) * 1.25 * scale, y + Math.sin(i * 1.5) * .55 * scale, z], [1.65 * scale, (1.05 + i % 2 * .35) * scale, 1.3 * scale]);
  if (face) {
    for (const side of [-1, 1]) m.add(G.round, '#547183', [x + side * .75 * scale, y + .08 * scale, z + 1.24 * scale], [.13 * scale, .19 * scale, .07 * scale]);
    m.add(G.round, '#e3a79a', [x, y - .37 * scale, z + 1.29 * scale], [.3 * scale, .11 * scale, .055 * scale]);
  }
}
function noteModel() {
  const m = new WorldModel();
  m.add(G.round, '#f2cb71', [0, 0, 0], [.48, .32, .14]);
  m.add(G.box, '#f2cb71', [.35, .68, 0], [.16, 1.4, .14]);
  m.add(G.box, '#f2cb71', [.68, 1.26, 0], [.7, .24, .14], [0, 0, -.25]);
  return m;
}
/** Rounded turnarounds make the slide and its visible return belt one circuit. */
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
function alpineBase(s: MiniSection, m: WorldModel, ice: boolean) {
  const ridge: P[][] = [], ledge: P[][] = [], water: P[][] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, p = point(s, t), e = Math.sin(Math.PI * t), y = p.y - .55;
    ridge.push([[p.x, 0, p.z - 17], [p.x, y + e * (10 + 5 * Math.sin(t * Math.PI * 5) ** 2), p.z - 9], [p.x, y + e * 6, p.z - 4], [p.x, y, p.z - 2.9]]);
    ledge.push([[p.x, 0, p.z - 2.9], [p.x, y, p.z - 2.9], [p.x, y, p.z + 2.6], [p.x, 0, p.z + 5.5]]);
    water.push([[p.x, .14, p.z + 5.5], [p.x, .18, p.z + 14.5], [p.x, 0, p.z + 17]]);
  }
  surface(m, ridge, ice ? ['#accdd8', '#f0f4e6', '#b9dfe6'] : ['#a69e93', '#e2d4b3', '#a4b9ae']);
  surface(m, ledge, ice ? ['#89b9c9', '#e5efea', '#76a4b7'] : ['#8d9e96', '#cbd3b2', '#859a91']);
  surface(m, water, ice ? ['#a9e1e9', '#d9efe9'] : ['#81c8cf', '#b8d5b7']);
  let previous: T.Vector3 | undefined;
  for (let i = 1; i < 19; i++) {
    const p = point(s, i / 19); p.z += 2.35;
    m.beam(ice ? '#77a8b8' : '#a58462', p.clone().add(new T.Vector3(0, -.6, 0)), p.clone().add(new T.Vector3(0, 1, 0)), .11);
    if (previous) m.beam('#dfd9b5', previous, p.clone().add(new T.Vector3(0, .78, 0)), .085);
    previous = p.clone().add(new T.Vector3(0, .78, 0));
    if (i % 4 === 1) pine(m, p.x, p.y + 5, p.z - 11, .8);
  }
}
function hornModel() {
  const m = new WorldModel();
  // Wide brass bell faces the viewer; a long curved wooden alphorn feeds it.
  m.beam('#b78355', new T.Vector3(-4, .2, 0), new T.Vector3(-1.1, .6, 0), .2);
  m.beam('#b78355', new T.Vector3(-1.1, .6, 0), new T.Vector3(0, 1.8, 0), .24);
  const bell = new T.CylinderGeometry(1.5, .27, 2, 12, 1, true);
  m.add(bell, '#e7b96b', [.45, 2.6, .4], [1, 1, 1], [.65, 0, -.3]);
  // A trumpet is visible from inside its bell too. Reverse the inner wall's
  // triangles rather than changing the shared material to double-sided.
  const inner = bell.toNonIndexed(), vertices = inner.getAttribute('position');
  for (let i = 0; i < vertices.count; i += 3) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    vertices.setXYZ(i, vertices.getX(i + 2), vertices.getY(i + 2), vertices.getZ(i + 2)); vertices.setXYZ(i + 2, x, y, z);
  }
  inner.computeVertexNormals(); m.add(inner, '#c99353', [.45, 2.6, .4], [.985, .995, .985], [.65, 0, -.3]);
  inner.dispose(); bell.dispose();
  m.add(G.ring, '#ffe2a1', [.71, 3.36, 1.01], [1.5, 1.5, 1.5], [Math.PI / 2 + .65, 0, -.3]);
  m.add(G.round, '#725d50', [.06, 1.9, -.15], [.25, .16, .25]);
  for (let i = 0; i < 5; i++) m.add(G.box, '#efd397', [-3.4 + i * .48, .39 + i * .07, 0], [.09, .35, .4]);
  return m;
}
function yodel(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); alpineBase(s, m, false);
  const stops = [.22, .4, .58, .76].map(t => ({ p: point(s, t), at: at(s, t) }));
  for (const [i, { p }] of stops.entries()) {
    m.add(G.rock, '#aeaa97', [p.x, p.y - 2, p.z + 7.5], [4.8, 3.2, 4]);
    m.add(G.round, '#e7e4c6', [p.x, p.y - .1, p.z + 7.5], [4, .3, 3]);
    // Giant organ pipes form a skyline, each with a coloured cap and collar.
    for (let j = 0; j < 3; j++) {
      const h = 6.2 + j * 1.65, x = p.x - 3.4 + j * .95;
      m.add(G.pole, '#bd9367', [x, p.y + h / 2, p.z + 6.5], [.42, h, .42]);
      m.add(G.ring, palette[i], [x, p.y + h, p.z + 6.5], [.66, .66, .66], [Math.PI / 2, 0, 0]);
      m.add(G.box, palette[i], [p.x - 2.45, p.y + 1, p.z + 6.85], [3.5, 1.5, .65]);
    }
    m.add(G.box, '#85694e', [p.x - 3, p.y + 1.2, p.z + 7.5], [1, 2.1, 1.9]);
  }
  b.batch(m);
  const horns = b.pool(hornModel(), stops.length), notes = b.pool(noteModel(), stops.length * 4);
  const bellowsModel = new WorldModel();
  for (let i = 0; i < 9; i++) bellowsModel.add(G.box, i % 2 ? '#8ebfb5' : '#e4cfa0', [(i - 4) * .2, 0, 0], [.13, 1.5 + i % 2 * .2, 1.5]);
  const bellows = b.pool(bellowsModel, stops.length);
  b.animate((time, distance, reduced) => {
    for (const [i, { p, at: stop }] of stops.entries()) {
      const hello = arrival(distance, stop, 15), pump = reduced ? 0 : hello * Math.sin(time * 5 + i);
      b.place(horns, i, p.x + .6, p.y + .1, p.z + 7.5, 1.5, 0, i % 2 ? .18 : -.12, pump * .05);
      b.place(bellows, i, p.x - 2.1 + pump * .4, p.y + 1.2, p.z + 7.5, 1, 0, 0, pump * .035);
      for (let j = 0; j < 4; j++) {
        const phase = reduced ? j / 4 : (time * .45 + j / 4) % 1;
        b.place(notes, i * 4 + j, p.x + 1.7 + Math.sin(phase * 4 + i) * 1.1, p.y + 4.5 + phase * 6, p.z + 8.7, .22 + (reduced ? 0 : hello * (1 - phase) * .65), 0, -.25, Math.sin(phase * 5) * .2);
      }
    }
  });
}
function snowball(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); alpineBase(s, m, true);
  const center = point(s, .5), path = (u: number) => new T.Vector3(center.x - 21 + u * 42, center.y * .82 * (1 - u) + 1.5, center.z + 11 + Math.sin(u * Math.PI * 3) * 2.6);
  const rows: P[][] = [];
  for (let i = 0; i <= 42; i++) {
    const p = path(i / 42);
    rows.push([[p.x, p.y + 1.1, p.z - 2.4], [p.x, p.y, p.z - 1.5], [p.x, p.y, p.z + 1.5], [p.x, p.y + 1.1, p.z + 2.4]]);
    if (i % 7 === 0) {
      m.beam('#8db7c8', new T.Vector3(p.x, 0, p.z), p.clone().add(new T.Vector3(0, -.4, 0)), .3);
      m.add(G.pole, '#80a6b9', [p.x, p.y + 1.8, p.z - 2.45], [.1, 2, .1]);
      m.add(G.box, palette[(i / 7) % 5], [p.x + .6, p.y + 2.4, p.z - 2.45], [1.2, .7, .07]);
    }
  }
  surface(m, rows, ['#b5e4eb', '#ecf6ed', '#8fcbdc']);
  const start = path(0), end = path(1), backZ = center.z + 19;
  returnBelt(m, path, backZ);
  for (const side of [-1, 1]) {
    const x = center.x + side * 25, z = center.z + 9;
    m.add(G.round, '#ecf3e5', [x, 2.1, z], [2.5, 2.4, 2.4]); m.add(G.round, '#f5f3df', [x, 5.1, z], [1.8, 1.8, 1.7]);
    m.add(G.cone, '#e8a46a', [x, 5, z + 1.85], [.24, 1.1, .24], [Math.PI / 2, 0, 0]);
    for (const eye of [-1, 1]) m.add(G.round, '#526a7a', [x + eye * .6, 5.55, z + 1.48], [.16, .19, .11]);
    m.add(G.box, '#da8e94', [x, 3.8, z], [3.4, .45, 3.2]);
    for (const arm of [-1, 1]) m.beam('#947a65', new T.Vector3(x + arm * 1.9, 2.8, z), new T.Vector3(x + arm * 4, 4.4, z), .12);
  }
  const lift = path(0); m.add(G.pole, '#7eacbd', [lift.x - 2.5, lift.y / 2, lift.z], [.45, lift.y, .45]);
  b.batch(m);
  const snow = new WorldModel(); snow.add(G.round, '#eff5e8', [0, 0, 0], [1, 1, 1]);
  for (let i = 0; i < 5; i++) snow.add(G.rock, '#b6d8de', [Math.sin(i * 2.4) * .87, Math.cos(i * 2.4) * .87, .38], [.16, .16, .12]);
  const balls = b.pool(snow, 8), spinner = new WorldModel();
  spinner.add(G.round, '#d8f1ec', [0, 0, 0], [.6, .6, .3]);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    spinner.beam('#96d2db', new T.Vector3(0, 0, 0), new T.Vector3(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0), .2);
    for (const hand of [-1, 1]) spinner.beam('#dff1e8', new T.Vector3(Math.cos(a) * 2, Math.sin(a) * 2, 0), new T.Vector3(Math.cos(a) * 2.8 + Math.sin(a) * hand * .7, Math.sin(a) * 2.8 - Math.cos(a) * hand * .7, 0), .14);
  }
  const wheel = b.pool(spinner, 1);
  b.animate((time, distance, reduced) => {
    const clock = reduced ? 0 : time, push = reduced ? 0 : T.MathUtils.clamp(distance - at(s, .25), 0, s.length * .5) * .009;
    b.place(wheel, 0, lift.x - 2.5, lift.y + 1, lift.z, 1, 0, 0, -clock * .7 - push * 4);
    for (let i = 0; i < 8; i++) {
      const u = (clock * .08 + push + i / 8) % 1, { p } = circuit(u, path, start, end, backZ);
      b.place(balls, i, p.x, p.y + 1, p.z, .75 + i % 3 * .1, 0, 0, -u * 42);
    }
  });
}

/** Full barrel tunnel with two independent skins. Both open portals and the
 * interior arch are real geometry; the optional cutaway hides only the near half. */
function tunnelShell(s: MiniSection, b: VariantBuilder, mine: boolean) {
  const local = new T.Group(), frame = s.sample(s.start + s.length / 2), p = point(s, .5);
  local.position.copy(p); local.quaternion.copy(frame.rotation); b.group.add(local);
  const near = new WorldModel(), far = new WorldModel(), details = new WorldModel();
  const steps = 20, radius = 3.2, spring = .6;
  const shellY = (a: number, r: number) => spring + Math.pow(Math.sin(a), mine && r > 4 ? 1.7 : 1) * r * (mine && r > 4 ? 1.35 : 1);
  for (const side of [0, 1]) {
    const model = side === 0 ? near : far;
    const positions: number[] = [];
    for (let z = 0; z < 12; z++) for (let j = side * steps / 2; j < (side + 1) * steps / 2; j++) {
      const a = Math.PI * j / steps, c = Math.PI * (j + 1) / steps;
      const lo = -14 + z * 28 / 12, hi = -14 + (z + 1) * 28 / 12;
      const r0 = 8.4 + Math.sin((lo + 14) / 28 * Math.PI) * 4.6, r1 = 8.4 + Math.sin((hi + 14) / 28 * Math.PI) * 4.6;
      const v = (angle: number, r: number, zz: number): P => [Math.cos(angle) * r, shellY(angle, r), zz];
      const A = v(a, r0, lo), B = v(a, r1, hi), C = v(c, r0, lo), D = v(c, r1, hi);
      positions.push(...A, ...C, ...B, ...B, ...C, ...D);
      // During cutaway the opposite rock mass must still have an inside face;
      // otherwise its ore seams appear to float against the sky.
      if (side === 1) positions.push(...A, ...B, ...C, ...B, ...D, ...C);
      const E = v(a, radius, lo), F = v(a, radius, hi), H = v(c, radius, lo), I = v(c, radius, hi);
      positions.push(...E, ...F, ...H, ...F, ...I, ...H);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
    model.add(g, mine ? side ? '#8d8175' : '#b3a28a' : side ? '#8885af' : '#b2afce', [0, 0, 0]); g.dispose();
    model.add(G.box, mine ? '#9a907b' : '#9c9bbb', [side ? -3.38 : 3.38, -.05, 0], [.36, 1.3, 28]);
    if (mine) for (let j = 1; j < 5; j++) {
      const z = -12 + j * 5, r = 8.4 + Math.sin((z + 14) / 28 * Math.PI) * 4.6, sign = side ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        const a = .35 + k * .23, c = a + .18;
        model.beam('#debf82', new T.Vector3(sign * (Math.cos(a) * r + .08), shellY(a, r), z - .8), new T.Vector3(sign * (Math.cos(c) * r + .08), shellY(c, r), z + .8), .09);
      }
      model.add(G.cone, j % 2 ? '#afd9ce' : '#c0cede', [sign * Math.cos(.9) * r, shellY(.9, r) + 1, z], [.75, 3, .75], [0, j, sign * -.25]);
    }
  }
  for (const z of [-14, 14]) {
    for (let i = 0; i < 20; i++) {
      const a = i * Math.PI / 20, c = (i + 1) * Math.PI / 20;
      const p = (angle: number, r: number): P => [Math.cos(angle) * r, shellY(angle, r), z];
      const vertices = z > 0
        ? [...p(a, 3.2), ...p(a, 8.4), ...p(c, 3.2), ...p(c, 3.2), ...p(a, 8.4), ...p(c, 8.4)]
        : [...p(a, 3.2), ...p(c, 3.2), ...p(a, 8.4), ...p(c, 3.2), ...p(c, 8.4), ...p(a, 8.4)];
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
      details.add(g, mine ? '#c5b18c' : '#bdb9d9', [0, 0, 0]); g.dispose();
      // Faceted voussoirs around the generous, unobstructed bore.
      const mid = (a + c) / 2;
      details.add(G.box, mine ? '#bd8959' : palette[i % 5], [Math.cos(mid) * 3.55, spring + Math.sin(mid) * 3.55, z], [.58, .6, .8], [0, 0, mid - Math.PI / 2]);
    }
    for (const x of [-3.55, 3.55]) details.add(G.box, mine ? '#b3865c' : '#c4bddc', [x, -.05, z], [.65, 1.3, .8]);
  }
  for (let i = 0; i < 9; i++) {
    const z = -12 + i * 3;
    details.add(G.round, mine ? '#f2d58d' : '#bde5e4', [-2.98, 1.4, z], [.15, .23, .23], [], true);
    for (const side of [-1, 1]) details.add(G.cone, mine ? '#aacccc' : palette[i % 5], [side * 5.4, -.65 + (3 + i % 2) / 2, z], [1.1, 3 + i % 2, .9], [0, i, side * -.3]);
  }
  details.add(G.box, mine ? '#b1a591' : '#afa9c4', [0, -1.1, 0], [17, .7, 30]);
  if (mine) for (const z of [-11, -4, 3, 10]) {
    for (const x of [-2.99, 2.99]) details.add(G.box, '#bd936c', [x, .9, z], [.22, 3.4, .25]);
    details.add(G.box, '#ceb080', [0, 3.65, z], [4.3, .2, .3]);
  }
  const cover = b.batch(near, local); b.batch(far, local); b.batch(details, local);
  return { local, cover };
}
function dragon(s: MiniSection, b: VariantBuilder) {
  const { local, cover } = tunnelShell(s, b, false), m = new WorldModel();
  // The mouth IS the railway portal. Cheeks, whiskers and ears stay outside it.
  for (const side of [-1, 1]) {
    m.add(G.round, '#b9b8dc', [side * 4.45, 2.7, 14.2], [1.6, 2.8, 2]);
    m.add(G.cone, '#dfd4a6', [side * 4.8, 6.8, 14], [.6, 3.6, .6], [0, 0, side * -.2]);
    m.add(G.round, '#d2b1cb', [side * 5.35, 3.5, 15.4], [.62, .48, .27]);
    m.beam('#eee1b8', new T.Vector3(side * 5.2, 2.3, 15.5), new T.Vector3(side * 7, 3.2, 15.5), .14);
  }
  // A long sleeping dragon coils over the roof, ending in a curled tail.
  for (let i = 0; i < 11; i++) {
    const z = 10 - i * 2.2, y = 11.4 + Math.sin(i / 10 * Math.PI) * 3;
    m.add(G.round, i % 2 ? '#a9abd2' : '#b8b7dc', [Math.sin(i * .6) * .7, y, z], [2, 1.45, 1.8]);
    m.add(G.cone, '#d9d8af', [Math.sin(i * .6) * .7, y + 1.8, z], [.65, 1.7, .7]);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) m.add(G.round, '#b2b3d7', [side * (4.8 + i * .65), .2, 9], [.8, .5, 1.3]);
  // Broad folded wings make the entire mountain read as a friendly dragon.
  // Their membranes lie outside the shell and never enter the rail bore.
  for (const side of [-1, 1]) {
    const anchor: P = [side * 12.8, 5.8, -5];
    const tips: P[] = [[side * 10.4, 17, -3], [side * 13.8, 12.5, 3], [side * 13.5, 7.2, 8]];
    const vertices: number[] = [];
    for (let i = 0; i < 2; i++) vertices.push(...anchor, ...tips[i], ...tips[i + 1], ...anchor, ...tips[i + 1], ...tips[i]);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    m.add(g, '#a4ccc2', [0, 0, 0]); g.dispose();
    for (const tip of tips) m.beam('#d4d2a7', new T.Vector3(...anchor), new T.Vector3(...tip), .15);
    for (let i = 0; i < 2; i++) m.beam('#d4d2a7', new T.Vector3(...tips[i]), new T.Vector3(...tips[i + 1]), .13);
  }
  b.batch(m, local);
  const head = new WorldModel();
  head.add(G.round, '#b9b9db', [0, 0, 0], [3.5, 1.8, 2.2]);
  head.add(G.round, '#d7d7df', [0, -.7, 1.7], [2.4, .75, 1.25]);
  for (const side of [-1, 1]) {
    head.add(G.round, '#f6efcb', [side * 1.85, .18, 1.75], [.82, .82, .35]);
    head.add(G.round, '#536c80', [side * 1.85, .12, 2.05], [.22, .35, .12]);
    head.add(G.round, '#718e9b', [side * .85, -.37, 2.72], [.25, .16, .1]);
    head.add(G.cone, '#e2d7ad', [side * 2.65, 2, -.2], [.45, 2.5, .5], [0, 0, side * -.28]);
  }
  const face = b.pool(head, 1, local), breath = new WorldModel(); breath.add(G.rock, '#c8ede0', [0, 0, 0], [.6, .85, .6], [], true);
  const gems = b.pool(breath, 10, local), stop = at(s, .5) - 12;
  b.animate((time, distance, reduced) => {
    cover.visible = !b.group.userData.cutaway;
    const hello = arrival(distance, stop, 18), t = reduced ? 0 : time;
    b.place(face, 0, 0, 7.2 + (reduced ? 0 : Math.sin(t * 1.2) * .12 + hello * .25), 14.6, 1.3, reduced ? 0 : -hello * .09, 0, 0);
    for (let i = 0; i < 10; i++) {
      const u = (t * .24 + i / 10) % 1;
      b.place(gems, i, (i % 2 ? -1 : 1) * (1.1 + u * 2.7), 6.7 + u * 4, 18 + u * 7, reduced ? .15 : (.12 + hello * .38) * (1 - u), u * 2, u * 3, 0);
    }
  });
}
function mine(s: MiniSection, b: VariantBuilder) {
  const { local, cover } = tunnelShell(s, b, true), m = new WorldModel();
  const machinery = new T.Group(); machinery.position.x = 5; local.add(machinery);
  // A copper-and-teal bucket elevator runs beside the mountain, not through it.
  for (const z of [-4.6, 4.6]) {
    m.add(G.box, '#ccab73', [11, 8, z], [.5, 16, .5]);
    m.beam('#8fa99b', new T.Vector3(11, 1, z), new T.Vector3(11, 15, -z), .12);
  }
  m.add(G.box, '#d9c293', [11, 16.3, 0], [3, .6, 11]);
  m.add(G.box, '#7cb2ad', [11, .4, 0], [5, .8, 12]);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU, c = (i + 1) / 40 * TAU;
    m.beam('#717e80', new T.Vector3(11, 8 + Math.sin(a) * 7, Math.cos(a) * 4), new T.Vector3(11, 8 + Math.sin(c) * 7, Math.cos(c) * 4), .12);
  }
  m.add(G.box, '#c7a872', [8, 2.1, -10], [4.3, 3.5, 4]);
  m.add(G.box, '#8ab6b1', [8, 4.2, -10], [5.2, .5, 5]);
  for (const z of [-10.8, -9.2]) {
    m.add(G.round, '#f6e5b2', [10.23, 2.65, z], [.12, .55, .55]);
    m.add(G.round, '#52687b', [10.35, 2.65, z], [.08, .22, .22]);
  }
  b.batch(m, machinery);
  const bucket = new WorldModel();
  bucket.add(G.box, '#77a7a5', [0, -.1, 0], [1.6, 1.1, 1.8]);
  bucket.add(G.box, '#e1c48d', [0, .55, 0], [1.9, .15, 2]);
  for (let i = 0; i < 3; i++) bucket.add(G.rock, palette[i + 1], [0, .75 + i % 2 * .2, (i - 1) * .48], [.48, .6, .43]);
  const buckets = b.pool(bucket, 8, machinery), rotor = new WorldModel();
  rotor.add(G.pole, '#8fa2a0', [0, 0, 0], [1.4, .6, 1.4], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    rotor.add(G.box, '#e1b86e', [0, Math.sin(a) * 1.55, Math.cos(a) * 1.55], [1, .55, .55], [a, 0, 0]);
  }
  rotor.add(G.cone, '#b2c9be', [.8, 0, 0], [1.1, 2.8, 1.1], [0, 0, -Math.PI / 2]);
  const drill = b.pool(rotor, 1, machinery);
  b.animate((time, distance, reduced) => {
    cover.visible = !b.group.userData.cutaway;
    const clock = reduced ? 0 : time, push = reduced ? 0 : T.MathUtils.clamp(distance - (at(s, .5) - 14), 0, 28) * .06;
    for (let i = 0; i < 8; i++) {
      const a = clock * .28 + push + i / 8 * TAU;
      b.place(buckets, i, 11, 8 + Math.sin(a) * 7, Math.cos(a) * 4, 1, 0, 0, 0);
    }
    b.place(drill, 0, 10.6, 1.45, -10, 1, clock * 1.2 + push * 2, 0, 0);
  });
}
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
function weather(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); viaduct(s, m, false);
  const p = point(s, .5), x = p.x, z = p.z + 12;
  m.add(G.round, '#a8d5d4', [x, 0, z], [17, .35, 10]);
  for (let i = 0; i < 5; i++) arc(m, palette[i], x, 1.5, p.z - 8, 15 - i * .75, .58);
  m.add(G.box, '#92bcb4', [x, 2.2, z], [9, 4, 5]);
  m.add(G.box, '#e6d4aa', [x, 4.4, z], [10, .6, 6]);
  for (let i = 0; i < 3; i++) m.add(G.box, palette[i], [x + (i - 1) * 2.5, 2.4, z + 2.55], [1.7, 2.1, .15]);
  for (const side of [-1, 1]) {
    m.add(G.pole, '#b9c6b5', [x + side * 5.5, 5.5, z], [.3, 11, .3]);
    cloud(m, x + side * 11, 6 + side, z - 1, 1.15, true);
  }
  m.add(G.box, '#c6d6c5', [x, 10.8, z], [12, .4, .5]);
  m.add(G.round, '#e9db98', [x, 11, z + .2], [.6, .6, .5]);
  b.batch(m);
  const sun = new WorldModel();
  sun.add(G.round, '#efd48a', [0, 0, 0], [2.5, 2.5, .48]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    sun.add(G.cone, palette[i % 5], [Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0], [.65, 2, .27], [0, 0, a - Math.PI / 2]);
  }
  for (const side of [-1, 1]) sun.add(G.round, '#637b86', [side * .7, .3, .48], [.18, .25, .08]);
  sun.add(G.round, '#d3a77d', [0, -.7, .48], [.6, .18, .09]);
  const turbine = b.pool(sun, 1), puff = new WorldModel(); cloud(puff, 0, 0, 0, 1.2, true);
  const clouds = b.pool(puff, 2), droplet = new WorldModel(); droplet.add(G.rock, '#bee9e6', [0, 0, 0], [.2, .48, .2], [], true);
  const rain = b.pool(droplet, 24), spark = new WorldModel(); spark.add(G.rock, '#f2e6a5', [0, 0, 0], [.2, .2, .2], [], true);
  const glints = b.pool(spark, 14);
  b.animate((time, distance, reduced) => {
    const clock = reduced ? 0 : time, hello = arrival(distance, at(s, .5), 24);
    const push = reduced ? 0 : T.MathUtils.clamp(distance - s.start, 0, s.length) * .025;
    b.place(turbine, 0, x, 11, z + .5, 1, 0, 0, clock * .28 + push);
    for (let i = 0; i < 2; i++) b.place(clouds, i, x + (i ? 7 : -7), 15 + (reduced ? 0 : Math.sin(clock * .7 + i * 2) * .5 + hello), z, 1, 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const u = (clock * .32 + i / 24) % 1;
      b.place(rain, i, x + (i % 2 ? 7 : -7) + Math.sin(i * 2.4) * 2.5, 14 - u * 12, z + Math.cos(i) * 1.1, reduced ? .65 : .65 + hello * .45);
    }
    for (let i = 0; i < 14; i++) {
      const a = .1 + i / 13 * (Math.PI - .2);
      b.place(glints, i, x + Math.cos(a) * 13.7, 1.5 + Math.sin(a) * 13.7, p.z - 7.8, reduced ? .6 : .7 + hello * (.8 + Math.sin(clock * 4 + i) * .4));
    }
  });
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
    m.add(G.round, '#526e83', [side * .72, 1, 0], [.19, .62, .23], [0, 0, side * -.5]);
  }
  m.add(G.box, '#dca0a0', [0, 1.3, 0], [1.05, .19, .9]);
  return m;
}
function penguins(s: MiniSection, b: VariantBuilder) {
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
  returnBelt(m, slide, c.z + 18);
  b.batch(m);
  const riders = b.pool(penguinModel(), 7), floe = new WorldModel();
  floe.add(G.rock, '#e8f3e8', [0, 0, 0], [2, .4, 1.6]);
  const floes = b.pool(floe, 4);
  b.animate((time, distance, reduced) => {
    const clock = reduced ? 0 : time, push = reduced ? 0 : T.MathUtils.clamp(distance - at(s, .25), 0, s.length * .5) * .008;
    for (let i = 0; i < 7; i++) {
      const u = (clock * .075 + push + i / 7) % 1;
      const { p, yaw, down } = circuit(u, slide, start, end, c.z + 18);
      b.place(riders, i, p.x, p.y + .3, p.z, 1.15, down ? -.3 : 0, yaw, 0);
    }
    for (let i = 0; i < 4; i++) b.place(floes, i, c.x + 15 + Math.sin(i * 2.4) * 5.5, .4 + Math.sin(clock * .8 + i) * (reduced ? 0 : .14), c.z + 12 + Math.cos(i * 2.4) * 4, 1, 0, i, 0);
  });
}

export function createMountainVariant(section: MiniSection, option: 'b' | 'c', material: T.Material, lights: FairgroundLights): PieceAnimation | undefined {
  if (!['mountainpass', 'tunnel', 'ravinebridge'].includes(section.kind)) return undefined;
  const builder = new VariantBuilder(material, lights); builder.group.name = `${section.kind}-${option}`;
  if (section.kind === 'mountainpass') (option === 'b' ? yodel : snowball)(section, builder);
  if (section.kind === 'tunnel') (option === 'b' ? dragon : mine)(section, builder);
  if (section.kind === 'ravinebridge') (option === 'b' ? weather : penguins)(section, builder);
  builder.update(0, section.start - 60, false); return builder;
}
