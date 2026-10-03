import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';
import { mountainRopeway } from './mountain-gondolas';

type Point = [number, number, number];

export const GORGE_GOAT_STOPS = [.19, .35, .5, .66, .81] as const;
/** Small rock balconies beyond the fence. Kept in formation coordinates so
 * their occupants share the same lift and mirrored-lane transform. */
export function gorgeLookout(section: MiniSection, fraction: number) {
  const p = section.sample(section.start + section.length * fraction).position;
  return new T.Vector3(p.x - section.origin.x, p.y - .4, p.z - section.origin.z + 4.1);
}

/** Join cross-sections into a closed-looking faceted landscape, not overlapping
 * rocks across a railway. The profiles explicitly leave clearance for the train. */
function ribbon(m: WorldModel, rows: Point[][], colors: string[]) {
  for (let band = 0; band < rows[0].length - 1; band++) {
    const vertices: number[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i][band], b = rows[i + 1][band], c = rows[i][band + 1], d = rows[i + 1][band + 1];
      vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    m.add(g, colors[band % colors.length], [0, 0, 0]); g.dispose();
  }
}

export function mountainGorge(m: WorldModel, section: MiniSection, backdrop = m) {
  const cliffs: Point[][] = [], ledge: Point[][] = [], river: Point[][] = [], near: Point[][] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, p = section.frames[Math.round(section.resolution * t)].position;
    const x = p.x - section.origin.x, z = p.z - section.origin.z;
    const edge = Math.sin(Math.PI * t) ** .75, floor = .25 + Math.max(0, p.y - 4) * .12;
    const shelf = p.y - .45;
    const tooth = Math.sin(i * 1.73) * .8 * edge;
    const peak = shelf + edge * (17 + 4 * Math.sin(t * Math.PI * 9) ** 2) + tooth;
    const wall = shelf + edge * (10 + 3 * Math.sin(t * Math.PI * 7 + .3) ** 2);
    cliffs.push([
      [x, 0, z - 19], [x, peak * .53, z - 14.5], [x, peak * .76, z - 11], [x, peak, z - 7.2],
      [x, wall, z - 3.8], [x, shelf + (wall - shelf) * .7, z - 3.4],
      [x, shelf + (wall - shelf) * .37, z - 3.65], [x, shelf, z - 3.1],
      [x, 0, z - 3.1],
    ]);
    ledge.push([[x, floor, z - 3.1], [x, shelf, z - 3.1], [x, shelf, z + 1.9],
      [x, floor + (shelf - floor) * .57, z + 2.25], [x, floor, z + 3.5]]);
    river.push([[x, floor, z + 3.5], [x, floor + .08, z + 4.1], [x, floor + .08, z + 8], [x, floor, z + 8.7]]);
    const lip = floor + edge * (3 + 2 * Math.sin(t * Math.PI * 6) ** 2);
    near.push([[x, floor, z + 8.7], [x, lip, z + 9.4], [x, lip + edge * 1.2, z + 12], [x, 0, z + 16]]);
  }
  ribbon(backdrop, cliffs, ['#718b94', '#a4b5b5', '#c2ceca', '#d6dfdb', '#7a8993', '#a6b1b3', '#798b95']);
  ribbon(m, ledge, ['#718892', '#b5b6a2', '#718892', '#96a3a5']);
  ribbon(m, river, ['#b8c6b4', '#64bac9', '#a1c7c2']);
  ribbon(m, near, ['#758f9a', '#b0bdba', '#8f9fa1']);
  // A pale ribbon of snow makes the craggy ridge legible at game-camera scale.
  ribbon(backdrop, cliffs.map(row => [
    [row[3][0], row[3][1] - .35, row[3][2] - 1.1],
    [row[3][0], row[3][1] + .12, row[3][2]],
    [row[3][0], row[3][1] - .55, row[3][2] + 1.25],
  ]), ['#edf3ed', '#f8f4df']);
  for (const [i, fraction] of GORGE_GOAT_STOPS.entries()) {
    const p = gorgeLookout(section, fraction);
    // These are real rock spurs rising out of the river, rather than balconies
    // that hover halfway up the gorge. Snow shelves make their tops readable.
    const base = .25 + Math.max(0, p.y - 3.6) * .12, height = p.y - base;
    m.add(G.rock, i % 2 ? '#799299' : '#92a6a6', [p.x, base + height * .42, p.z + .5], [2.25, height * .58, 1.85], [0, i * .55, 0]);
    m.add(G.rock, '#b6c3b8', [p.x - .45, base + height * .55, p.z + .95], [1.8, .45, 1.55]);
    m.add(G.rock, '#9aa8a6', [p.x, p.y - 1.1, p.z], [2.05, 1.5, 1.75]);
    m.add(G.rock, '#edf0df', [p.x, p.y - .13, p.z], [1.65, .3, 1.35]);
    // Crystals sit outside the rail envelope and light up as coaches pass.
    for (let j = 0; j < 3; j++) {
      const h = 1.15 + (j % 2) * .6, x = p.x + 1.35 + j * .3;
      m.add(G.cone, ['#91d8de', '#bdd1ed', '#c0ece4'][j], [x, p.y + h * .35, p.z + .45], [.32, h, .3], [0, i + j, -.2 + j * .2], true, i * .9 + j * .4);
    }
    m.add(G.round, '#718e78', [p.x - 1.3, p.y, p.z + .35], [.4, .22, .35]);
    for (let j = 0; j < 3; j++) m.add(G.round, '#edc67d', [p.x - 1.3 + j * .18, p.y + .18, p.z + .45], [.13, .12, .13]);
  }
  for (let i = 1; i < 16; i++) {
    const t = i / 16, f = section.frames[Math.round(section.resolution * t)], p = f.position;
    const x = p.x - section.origin.x, z = p.z - section.origin.z, floor = .25 + Math.max(0, p.y - 4) * .12;
    // Flow marks follow the river far below the ledge.
    m.add(G.box, '#d1eae6', [x, floor + .18, z + 5.5 + Math.sin(i) * 1.2], [2.2, .025, .11]);
    m.add(G.rock, '#bbc5bf', [x + 1, floor + .18, z + 8.1], [.6, .35, .55]);
    // Safety posts give the cliff-edge railway a clear, continuous silhouette.
    const q = new T.Vector3(x, p.y, z + 2.2);
    m.beam('#b5a182', q.clone().add(new T.Vector3(0, -.6, 0)), q.clone().add(new T.Vector3(0, .9, 0)), .085);
    if (i > 1) {
      const a = section.frames[Math.round(section.resolution * (i - 1) / 16)].position;
      m.beam('#d1c19c', new T.Vector3(a.x - section.origin.x, a.y + .65, a.z - section.origin.z + 2.2), q.clone().add(new T.Vector3(0, .65, 0)), .065);
    }
    if (i % 3 === 1) {
      const y = p.y - .45 + Math.sin(Math.PI * t) ** .75 * (17 + 4 * Math.sin(t * Math.PI * 9) ** 2);
      backdrop.add(G.rock, '#eff2e7', [x, y + .1, z - 7.2], [2.4, .35, 1.9]);
      backdrop.add(G.pole, '#77766b', [x, y + 1, z - 7.8], [.14, 2, .14]);
      backdrop.add(G.cone, '#426f68', [x, y + 2.6, z - 7.8], [1, 3, 1]);
      backdrop.add(G.cone, '#e7eee7', [x, y + 3.7, z - 7.8], [.4, 1.2, .4]);
    }
    if (i % 3 === 0) {
      // Long glacial seams remain on the rock face, safely above the railway.
      const y = p.y + 7 + Math.sin(Math.PI * t) * 5;
      backdrop.add(G.cone, '#c4e7e8', [x, y, z - 3.95], [.32, 2.8, .24], [0, 0, Math.PI]);
      backdrop.add(G.cone, '#e1f1eb', [x + .6, y + .4, z - 4.1], [.2, 1.9, .2], [0, 0, Math.PI]);
    }
    if (i % 4 === 0) {
      const lip = floor + Math.sin(Math.PI * t) ** .75 * (4.2 + 2 * Math.sin(t * Math.PI * 6) ** 2);
      // Larger ice outcrops read from the normal play camera; their long tips
      // stay on the far river bank, many metres from the coaches.
      for (let j = 0; j < 3; j++) {
        const h = 2.4 + (j % 2) * 1.4;
        m.add(G.cone, ['#a6e4e3', '#d3e9f0', '#c1e7dc'][j], [x + (j - 1) * .9, lip + h * .38, z + 11.5], [.7, h, .6], [0, j, (j - 1) * .18], true, i * .6 + j);
      }
    }
  }
}

export const MOUNTAIN_TUNNEL_LENGTH = 28;
const HALF = MOUNTAIN_TUNNEL_LENGTH / 2;
const BORE_RADIUS = 2.75;
const SPRING = .9;

/** A mountain with a continuous arched void through it. Coordinates are local
 * to the centre rail frame: X across the bore, -Z forward along the railway. */
export function mountainTunnel(material: T.Material, luminous: T.Material) {
  const solid = new WorldModel(), back = new WorldModel(), cover = new WorldModel();
  const lengthSteps = 14, archSteps = 20;
  const rows: Point[][] = [];
  // The outside peak follows a jagged ridge, with steep rock shoulders.
  for (let i = 0; i <= lengthSteps; i++) {
    const z = -HALF + MOUNTAIN_TUNNEL_LENGTH * i / lengthSteps;
    const swell = Math.sin(i / lengthSteps * Math.PI);
    const peak = 9 + swell * (9 + 3 * Math.sin(i * .92) ** 2);
    const shoulder = 6.4 + swell * (1.5 + Math.sin(i * 1.3) * .5);
    const crown = swell * (-1 + Math.sin(i * .7) * 1.2);
    rows.push([[-9 - swell * 3, -.8, z], [-shoulder, 5.9, z], [-3.4 + crown, peak * .88, z],
      [crown, peak, z], [3.4 + crown, peak * .88, z], [shoulder, 5.9, z], [9 + swell * 3, -.8, z]]);
  }
  // A pair of mountain halves permits a temporary camera-facing reveal while
  // the train is inside; the closed mountain is the default gallery view.
  for (let band = 0; band < 6; band++) {
    const vertices: number[] = [];
    for (let i = 0; i < lengthSteps; i++) {
      const a = rows[i][band], b = rows[i + 1][band], c = rows[i][band + 1], d = rows[i + 1][band + 1];
      vertices.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    // Keep the summit and upper shoulders solid during the reveal. Only the
    // low wall beside the carriages opens; the mountain retains its mass.
    (band === 0 ? back : band === 5 ? cover : solid).add(g,
      ['#81939c', '#a8b6b9', '#e1e8e2', '#dce5e1', '#9cabb1', '#7f929c'][band], [0, 0, 0]); g.dispose();
  }
  // Interior arch, with normals facing into the tunnel. There is no solid box
  // behind the entrance: the void really continues all the way to the exit.
  for (let half = 0; half < 2; half++) {
    const vertices: number[] = [];
    for (let j = half * archSteps / 2; j < (half + 1) * archSteps / 2; j++) {
      const a = Math.PI * j / archSteps, b = Math.PI * (j + 1) / archSteps;
      const p: Point = [Math.cos(a) * BORE_RADIUS, SPRING + Math.sin(a) * BORE_RADIUS, -HALF];
      const q: Point = [Math.cos(b) * BORE_RADIUS, SPRING + Math.sin(b) * BORE_RADIUS, -HALF];
      vertices.push(...p, p[0], p[1], HALF, ...q, ...q, p[0], p[1], HALF, q[0], q[1], HALF);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    (half === 0 ? cover : back).add(g, '#526c79', [0, 0, 0]); g.dispose();
  }
  back.add(G.box, '#617984', [-BORE_RADIUS - .15, .05, 0], [.3, 1.7, MOUNTAIN_TUNNEL_LENGTH]);
  cover.add(G.box, '#617984', [BORE_RADIUS + .15, .05, 0], [.3, 1.7, MOUNTAIN_TUNNEL_LENGTH]);
  // Rock portal faces fill everything outside the arched hole, on both ends.
  for (const z of [-HALF, HALF]) {
    const outline = new T.Shape(); outline.moveTo(-9, -.8); outline.lineTo(9, -.8);
    outline.lineTo(6.4, 5.9); outline.lineTo(3.4, 7.92); outline.lineTo(0, 9); outline.lineTo(-3.4, 7.92); outline.lineTo(-6.4, 5.9); outline.closePath();
    const hole = new T.Path(); hole.moveTo(-BORE_RADIUS, -.76); hole.lineTo(-BORE_RADIUS, SPRING);
    hole.absarc(0, SPRING, BORE_RADIUS, Math.PI, 0, true); hole.lineTo(BORE_RADIUS, -.76); hole.closePath(); outline.holes.push(hole);
    const face = new T.ShapeGeometry(outline, 20);
    solid.add(face, '#94a5ad', [0, 0, z], [1, 1, 1], [0, z < 0 ? Math.PI : 0, 0]); face.dispose();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * i / 12, r = BORE_RADIUS + .35;
      solid.add(G.box, i % 2 ? '#c5c4b1' : '#dcd6bd', [Math.cos(a) * r, SPRING + Math.sin(a) * r, z], [.6, .76, .55], [0, 0, a - Math.PI / 2]);
    }
    for (const x of [-BORE_RADIUS - .35, BORE_RADIUS + .35]) solid.add(G.box, '#b5b5a5', [x, .05, z], [.6, 1.7, .6]);
    // Portal bell towers announce the arriving train with visible, swinging
    // brass bells. Their posts are well outside the arched opening.
    for (const x of [3.85, 5.55]) solid.add(G.box, '#a88c64', [x, 3.6, z + Math.sign(z) * .6], [.23, 7, .28]);
    solid.add(G.box, '#d5bd8d', [4.7, 7.35, z + Math.sign(z) * .6], [2.3, .3, .5]);
    for (const side of [-1, 1]) solid.add(G.box, '#66988e', [4.7 + side * .57, 7.7, z + Math.sign(z) * .6], [1.5, .19, 1.8], [0, 0, -side * .45]);
    solid.add(G.box, '#576c78', [0, 5.25, z + Math.sign(z) * .06], [3, .72, .12]);
    for (const x of [-1.1, 0, 1.1]) solid.add(G.rock, '#a0e6df', [x, 5.25, z + Math.sign(z) * .16], [.18, .23, .1], [], true);
  }
  // Broken rock shoulders interrupt the long tunnel ridge.
  // Their bases sit outside the bore, so neither lane gains hidden obstacles.
  for (let i = 0; i < 7; i++) {
    const z = -10 + i * 3.3, swell = Math.sin((z + HALF) / MOUNTAIN_TUNNEL_LENGTH * Math.PI);
    for (const side of [-1, 1]) {
      const model = side < 0 ? back : cover;
      model.add(G.rock, i % 2 ? '#8698a2' : '#aab8bc', [side * (8 + swell * 2), 1.2, z],
        [2.5, 3 + (i % 3) * .7, 2.7], [0, i * .43, side * .16]);
      model.add(G.rock, '#cbd7ce', [side * (8 + swell * 2), 3.2 + i % 3 * .5, z], [2.3, .48, 2.2], [0, i * .43, 0]);
      if (i % 2 === 0) {
        model.add(G.rock, '#668e9c', [side * (7.3 + swell * 2), 3.7, z + .45], [1.7, 1.75, 1.45]);
        for (let j = 0; j < 3; j++) model.add(G.cone, ['#a8dfdb', '#bed8ec', '#d3e6dc'][j], [side * (8.4 + swell * 2), 3.4 + j * .6, z + (j - 1) * .67], [.55, 2.2, .48], [0, j, side * -.65]);
      }
    }
  }
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const model = side < 0 ? back : cover, x = side * (9.6 + i * .7), z = -8 + i * 5;
    model.add(G.pole, '#837768', [x, .5, z], [.17, 1.8, .17]);
    model.add(G.cone, '#598c80', [x, 2.1, z], [1.3, 3.3, 1.3]);
    model.add(G.cone, '#eaf0e2', [x, 3.13, z], [.62, 1.45, .62]);
  }
  for (let i = 0; i < 9; i++) {
    const z = -HALF + 2 + i * 3;
    solid.add(G.box, '#829ca1', [-2.3, 2.5, z], [.2, .25, .35]);
    solid.add(G.round, '#ffdfa0', [-2.05, 2.4, z], [.16, .25, .16], [], true);
    if (i % 2 === 0) {
      solid.add(G.cone, '#8dd5d8', [-2.25, .3, z + .7], [.25, .85, .25], [0, 0, -.15], true);
      solid.add(G.cone, '#bab9de', [-2, .1, z + 1.1], [.16, .5, .16], [], true);
    }
    // Recessed glowing mineral seams trace the real arch; they do not narrow
    // the usable bore or attach to the wall that fades for the train reveal.
    for (let j = 0; j < 3; j++) {
      const a = .55 + j * .7;
      solid.add(G.rock, ['#a7e1db', '#b5c5e8', '#eed8a0'][j],
        [Math.cos(a) * 2.72, SPRING + Math.sin(a) * 2.72, z], [.18, .12, .27], [0, 0, a], true, i * .65 + j * .3);
    }
  }
  mountainRopeway(solid);
  const result = solid.finish(material, luminous);
  // Each rock half has its own material, so the camera-facing half can fade
  // independently on each mirrored lane. Portals and interior lamps stay solid.
  for (const [model, side] of [[back, -1], [cover, 1]] as const) {
    const skin = material.clone(); skin.userData.mountainCover = side;
    const skinGroup = model.finish(skin, luminous);
    for (const mesh of [...skinGroup.children]) { mesh.userData.mountainCover = side; result.add(mesh); }
  }
  return result;
}

export function tunnelRevealAt(section: MiniSection, distance: number) {
  const middle = section.start + section.length / 2;
  // Reveal before the engine enters, and wait for the whole ten-coach train
  // to leave before closing. The rock fades back in across eight route metres.
  const entering = T.MathUtils.clamp((distance - (middle - HALF - 5)) / 5, 0, 1);
  const leaving = T.MathUtils.clamp((middle + HALF + 30 - distance) / 8, 0, 1);
  return Math.min(entering, leaving);
}
