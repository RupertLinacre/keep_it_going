import * as T from 'three';
import { alpineBackground } from './background-mountains';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function mountainScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number,variant?:number) {
  alpineBackground(m,x,back,front,r,variant);
}

export { mountainGorge as mountainRidge, mountainTunnel as tunnelModel } from "./mountain-landforms";

export function ravineWaterfall(section: MiniSection) {
  const p = section.frames[Math.round(section.resolution * .5)].position;
  return { x: p.x - section.origin.x + 3, z: p.z - section.origin.z + 10, height: p.y * .8 };
}

/** A high timber trestle, with a river and waterfall far below the coaches. */
export function ravineBridge(m: WorldModel, section: MiniSection) {
  const center = section.frames[Math.round(section.resolution * .5)].position.clone();
  center.x -= section.origin.x; center.z -= section.origin.z;
  m.add(G.round, '#649fa6', [center.x, -.1, center.z], [19, .3, 20]);
  m.add(G.round, '#64c2cf', [center.x, .12, center.z], [16, .1, 18]);
  for (const side of [-1, 1]) {
    const at = .5 + side * .32, p = section.frames[Math.round(section.resolution * at)].position;
    const x = p.x - section.origin.x, z = p.z - section.origin.z, h = p.y - 1;
    m.add(G.rock, '#8f9d9f', [x, h * .4, z - 2], [11, h * .58, 11]);
    m.add(G.round, '#b0bcb0', [x, h * .82, z - 3], [8, h * .12, 6]);
  }
  let previous: T.Vector3[] | undefined;
  for (let i = 0; i <= 24; i++) {
    const f = section.sample(section.start + section.length * i / 24), p = f.position.clone();
    p.x -= section.origin.x; p.z -= section.origin.z;
    const ends = [-1, 1].map(side => p.clone().addScaledVector(f.right, side * 2.1).add(new T.Vector3(0, -.6, 0)));
    m.beam('#d8b380', ends[0], ends[1], .23);
    for (let j = 0; j < 2; j++) {
      const q = ends[j];
      if (i % 2 === 0) m.beam('#9e8062', new T.Vector3(q.x, .3, q.z), q, .22);
      if (previous) {
        m.beam('#ba9770', previous[j], q, .2);
        m.beam('#b39473', previous[j].clone().add(new T.Vector3(0, -3.5, 0)), q, .16);
        m.beam('#b39473', previous[j], q.clone().add(new T.Vector3(0, -3.5, 0)), .16);
        m.beam('#e2c99d', previous[j].clone().add(new T.Vector3(0, 1.6, 0)), q.clone().add(new T.Vector3(0, 1.6, 0)), .07);
      }
      m.beam('#d8bd91', q, q.clone().add(new T.Vector3(0, 1.8, 0)), .075);
      if (i % 3 === 0) {
        m.add(G.rock, '#94d8d5', [q.x, q.y + 1.83, q.z], [.14, .17, .14], [], true, i * .5 + j);
        m.add(G.box, '#557f84', [q.x, q.y - .18, q.z], [.45, .38, .3]);
      }
    }
    previous = ends;
  }
  const { x: fx, z: fz, height: h } = ravineWaterfall(section);
  // Three irregular terraces carry the falls. Broad ledges and contrasting
  // vertical buttresses give the gorge a readable layered silhouette.
  for (let level = 0; level < 3; level++) {
    const top = h * (1 - level * .24), width = 6.5 + level * 1.3, z = fz - 3.6 + level * .65;
    m.add(G.rock, ['#849aa0', '#718f98', '#9cafab'][level], [fx - level * .25, top * .43, z], [width, top * .57, 4.1 + level * .2], [0, level * .18, 0]);
    m.add(G.rock, '#b2c5ad', [fx - level * .25, top - .35, z], [width * .82, .62, 3.3]);
    for (const side of [-1, 1]) m.add(G.rock, level % 2 ? '#8ba2a3' : '#a2b3ae', [fx + side * (3.2 + level), top * .5, fz - 1.2 + level * .3], [1.5, top * .47, 1.4], [0, side * .3, side * .1]);
  }
  m.add(G.round, '#9adbd8', [fx, h + .02, fz - 1.2], [3.5, .13, 2.2], [], true);
  // Two waterfalls land on mossy shelves before spilling into the river.
  for (const [x, y, z, height, width] of [
    [fx, h * .77, fz, h * .46, 3.2],
    [fx + .6, h * .27, fz + 1.1, h * .54, 4.4],
  ]) {
    m.add(G.box, '#66b8c6', [x, y, z], [width, height, .36], [], true);
    for (let i = 0; i < 5; i++) m.add(G.box, i % 2 ? '#b9e8e3' : '#e2f4e9',
      [x - width * .4 + i * width * .2, y, z + .23], [.08 + i % 2 * .09, height, .055], [], true);
  }
  m.add(G.rock, '#7c9998', [fx + .4, h * .52, fz + .25], [3.6, .6, 2]);
  m.add(G.round, '#b5e3dd', [fx + .4, h * .55, fz + .4], [3.15, .1, 1.4], [], true);
  m.add(G.round, '#a3dce0', [fx + .6, .14, fz + 1.8], [5.1, .13, 3.6]);
  for (let i = 0; i < 10; i++) m.add(G.round, '#d9efed', [fx + Math.sin(i * 2.4) * 2, .25, fz + 1 + Math.cos(i * 2.4)], [.65, .15, .5], [], true);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    m.add(G.rock, i % 2 ? '#76958c' : '#aec4b0', [fx + Math.sin(a) * 5.1, .5, fz + 1.8 + Math.cos(a) * 3.4], [.7, .65, .85]);
  }
  // A little river mill gives the moving wheel a believable axle and channel.
  m.add(G.rock, '#a7b6a6', [fx + 6.1, .25, fz + .2], [3.6, .55, 3]);
  m.add(G.box, '#d6bc8b', [fx + 6.1, 2.2, fz - .6], [3.5, 3.8, 2.5]);
  for (const side of [-1, 1]) {
    m.add(G.box, '#628b85', [fx + 6.1 + side * .95, 4.25, fz - .6], [2.45, .2, 3.2], [0, 0, -side * .44]);
    m.add(G.box, '#86664f', [fx + 6.1 + side * 1.52, 2.2, fz + .69], [.18, 3.8, .14]);
  }
  m.add(G.box, '#77745e', [fx + 6.1, 1.3, fz + .7], [.9, 1.9, .12]);
  m.add(G.box, '#ffe5a3', [fx + 6.1, 3.3, fz + .75], [.9, .75, .12], [], true);
  m.add(G.pole, '#9d7650', [fx + 6.1, 2.7, fz + 1.6], [.2, 2, .2], [Math.PI / 2, 0, 0]);
  m.add(G.box, '#8dbaa8', [fx + 6.1, .3, fz + 2.5], [3.5, .12, 2.4]);
  // The overshot wheel is fed from the waterfall's middle pool by a sloping
  // timber flume, so the moving buckets have an obvious source of water.
  const channelStart = new T.Vector3(fx + 2.2, h * .55, fz + 1.65), channelEnd = new T.Vector3(fx + 6.1, 5.02, fz + 1.65);
  for (const side of [-1, 1]) {
    m.beam('#a3825b', channelStart.clone().add(new T.Vector3(0, -.08, side * .52)), channelEnd.clone().add(new T.Vector3(0, -.08, side * .52)), .19);
    m.beam('#d1b07a', channelStart.clone().add(new T.Vector3(0, .3, side * .52)), channelEnd.clone().add(new T.Vector3(0, .3, side * .52)), .12);
  }
  for (let j = 0; j < 5; j++) m.beam(j % 2 ? '#c4e9dd' : '#85d0cf', channelStart.clone().add(new T.Vector3(0, 0, (j - 2) * .18)), channelEnd.clone().add(new T.Vector3(0, 0, (j - 2) * .18)), .12);
  for (let j = 0; j < 3; j++) {
    const t = j / 2, p = channelStart.clone().lerp(channelEnd, t);
    m.beam('#927958', new T.Vector3(p.x, .2, p.z), p.clone().add(new T.Vector3(0, -.25, 0)), .16);
    m.add(G.box, '#d4bc8d', [p.x, p.y - .22, p.z], [.22, .18, 1.4]);
  }
  // A mossy island and a tiny arched duck house give the circling mill-pond
  // ducks a home. These stay below the bridge and outside the wheel/flume.
  m.add(G.rock, '#9bb3a0', [fx + .6, .3, fz + 1.8], [1.25, .45, .9]);
  m.add(G.box, '#d7b782', [fx + .6, .93, fz + 1.8], [1.25, 1.1, 1.1]);
  m.add(G.round, '#607d7c', [fx + .6, .74, fz + 2.36], [.36, .43, .035]);
  for (const side of [-1, 1]) m.add(G.box, '#709c8f', [fx + .6 + side * .36, 1.6, fz + 1.8], [.94, .14, 1.5], [0, 0, -side * .48]);
  // A softly coloured low arch hangs in the spray, behind the high railway.
  for (const [band, color] of ['#e8a39b', '#ecd49f', '#b4d4aa', '#a2d8d8', '#bac7e0'].entries()) {
    const vertices: number[] = [], radius = 6.6 - band * .32;
    for (let j = 0; j < 24; j++) {
      const a = Math.PI * j / 24, b = Math.PI * (j + 1) / 24;
      const p = (angle: number, r: number) => [fx + Math.cos(angle) * r, 1.7 + Math.sin(angle) * r, fz + 2.8];
      vertices.push(...p(a, radius), ...p(b, radius), ...p(a, radius - .23), ...p(b, radius), ...p(b, radius - .23), ...p(a, radius - .23));
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    m.add(geometry, color, [0, 0, 0]); geometry.dispose();
  }
}
