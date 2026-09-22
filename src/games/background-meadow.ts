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
  return geometry.computeVertexNormals(), geometry;
})();
const flowerHeart = new T.OctahedronGeometry(1);
const millTower = new T.CylinderGeometry(1.25, 2, 5.8, 7);
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
export type MeadowActor = { kind: 'sheep' | 'mill'; x: number; y: number; z: number; phase: number; size: number; onTrack?: boolean };

/** A field edge, a little orchard and grazing pockets, all merged into the tile. */
export function meadowScenery(m: WorldModel, place: (actor: MeadowActor) => void, x: number, back: number, front: number, r: () => number) {
  // Lower foreground shoulders and a lighter distant ridge give the hills depth.
  // Their bases overlap behind the field, without burying the trees or buildings.
  m.add(G.round, '#b5d28b', [x + 8, -3.2, back - 39], [29, 13 + r() * 7, 20]);
  m.add(G.round, r() > .5 ? '#86b569' : '#95be72', [x - 3, -2.8, back - 22], [24, 7 + r() * 5, 15]);
  m.add(G.round, '#a1c77d', [x + 13, -1.8, back - 13], [12, 4.8, 8]);

  // Group sheep as a flock on one soft field patch rather than three dotted islands.
  const flockX = x - 6 + r() * 10, flockZ = front + 2.8 + r() * 1.4;
  m.add(patch, '#a1c971', [flockX, .09, flockZ], [6.8, 1, 3.2], [0, .2, 0]);
  for (let i = 0; i < 3; i++) place({ kind: 'sheep', x: flockX + (i - 1) * 2.8 + r() * 1.1,
    y: .15, z: flockZ + (r() - .5) * 2, phase: r() * Math.PI * 2, size: .8 + r() * .35, onTrack: true });

  // A gently meandering fence has an opening with a braced little gate.
  const fence = Array.from({ length: 5 }, (_, i) => V(x - 14 + i * 7, 0, back - 1 + Math.sin(i * 1.15) * .7));
  for (let i = 0; i < fence.length; i++) {
    const p = fence[i];
    m.add(G.pole, '#a7865a', [p.x, .72, p.z], [.12, 1.44, .12]);
    if (!i) continue;
    const previous = fence[i - 1];
    for (const y of [.53, 1.1]) m.beam('#e5d3a4', V(previous.x, y, previous.z), V(p.x, y, p.z), .075);
    if (i === 2) m.beam('#b89b70', V(previous.x, .53, previous.z), V(p.x, 1.1, p.z), .075);
  }

  // Two small wildflower beds, with readable five-petal heads instead of spheres.
  for (let bed = 0; bed < 2; bed++) {
    const bx = x - 8 + bed * 15, bz = front + 8 + r() * 2;
    m.add(patch, bed ? '#a5c77a' : '#9ac377', [bx, .09, bz], [4, 1, 1.65], [0, bed ? -.25 : .18, 0]);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, radius = .8 + r() * 2.1, fx = bx + Math.cos(a) * radius, fz = bz + Math.sin(a) * radius * .45;
      const h = .35 + r() * .28, size = .23 + r() * .09;
      m.add(G.box, '#5c9258', [fx, h / 2, fz], [.035, h, .035]);
      m.add(flower, i % 3 ? '#fff0bf' : '#eaa6b4', [fx, h, fz], [size, size, size], [0, a, 0]);
      m.add(flowerHeart, '#ebbe50', [fx, h + size * .18, fz], [.07, .045, .07]);
    }
  }

  // An uneven orchard edge leaves a clear space for the windmill on the left.
  const treeX = x + 7, treeZ = back + 2.3;
  m.add(patch, '#91b978', [treeX, .09, treeZ], [3.6, 1, 2.6]);
  m.add(G.pole, '#937958', [treeX, 1.55, treeZ], [.28, 3.1, .28], [0, 0, .05]);
  m.beam('#937958', V(treeX, 2, treeZ), V(treeX + 1.1, 3.8, treeZ + .3), .18);
  const crown = r() > .5 ? '#66975e' : '#76a664';
  m.add(G.round, crown, [treeX - .65, 3.8, treeZ], [1.8, 1.65, 1.65]);
  m.add(G.round, '#83ae6b', [treeX + .7, 4.5, treeZ + .15], [1.6, 2, 1.5]);
  // A low hedge gives the orchard an edge without blocking the distant rider.
  for (let i = 0; i < 3; i++) m.add(G.rock, i % 2 ? '#84ae6a' : '#76a362',
    [x + 11 + i * 1.7, .55, back - .1], [1.3, .75, 1.05], [0, i, 0]);

  if (r() < .38) {
    const mx = x - 8, mz = back - 4;
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
}
