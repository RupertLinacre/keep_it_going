import * as T from 'three';
import { alpineBackground } from './background-mountains';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function mountainScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number,variant?:number) {
  alpineBackground(m,x,back,front,r,variant);
}

export { mountainGorge as mountainRidge, mountainTunnel as tunnelModel } from "./mountain-landforms";

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
    }
    previous = ends;
  }
  const fx = center.x + 3, fz = center.z - 10, h = center.y * .8;
  m.add(G.rock, '#84979f', [fx, h * .4, fz - 5.5], [7, h * .68, 5]);
  m.add(G.box, '#81cfd5', [fx, h / 2, fz], [3.3, h, .28], [], true);
  for (const dx of [-1.05, 0, .95]) m.add(G.box, '#ceefed', [fx + dx, h / 2, fz + .2], [.16, h, .1], [], true);
  m.add(G.round, '#a3dce0', [fx, .14, fz + 1.2], [4.5, .13, 3]);
  for (let i = 0; i < 10; i++) m.add(G.round, '#d9efed', [fx + Math.sin(i * 2.4) * 2, .25, fz + 1 + Math.cos(i * 2.4)], [.65, .15, .5], [], true);
}
