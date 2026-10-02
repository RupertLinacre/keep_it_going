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
  m.add(G.rock, '#84979f', [fx, h * .4, fz - 5.5], [7, h * .68, 5]);
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
