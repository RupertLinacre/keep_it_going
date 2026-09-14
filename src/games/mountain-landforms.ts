import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

type Point = [number, number, number];

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
    const peak = shelf + edge * (17 + 4 * Math.sin(t * Math.PI * 9) ** 2);
    const wall = shelf + edge * (10 + 3 * Math.sin(t * Math.PI * 7 + .3) ** 2);
    cliffs.push([
      [x, 0, z - 17], [x, peak * .76, z - 11], [x, peak, z - 7.2],
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
  ribbon(backdrop, cliffs, ['#88969e', '#a8b5b8', '#d6dfdb', '#7a8993', '#a6b1b3', '#798b95']);
  ribbon(m, ledge, ['#718892', '#b5b6a2', '#718892', '#96a3a5']);
  ribbon(m, river, ['#b8c6b4', '#64bac9', '#a1c7c2']);
  ribbon(m, near, ['#758f9a', '#b0bdba', '#8f9fa1']);
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
    }
  }
  for (let i = 0; i < 9; i++) {
    const z = -HALF + 2 + i * 3;
    solid.add(G.box, '#829ca1', [-2.3, 2.5, z], [.2, .25, .35]);
    solid.add(G.round, '#ffdfa0', [-2.05, 2.4, z], [.16, .25, .16], [], true);
    if (i % 2 === 0) {
      solid.add(G.cone, '#8dd5d8', [-2.25, .3, z + .7], [.25, .85, .25], [0, 0, -.15], true);
      solid.add(G.cone, '#bab9de', [-2, .1, z + 1.1], [.16, .5, .16], [], true);
    }
  }
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
