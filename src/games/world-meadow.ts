import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export const SHEEP_STOPS=[.16,.19,.32,.45,.48,.61,.74,.77,.86];
/** Route distance guarantees that even a fast train finds the rails clear.
 * Sheep keep their place on the bank until the train has completely passed. */
export function trackSheepPose(section:MiniSection,at:number,distance:number,phase:number,time:number,reduced=false) {
  const ahead=at-distance,notice=28+Math.sin(phase)*3;
  const p=T.MathUtils.clamp((notice-ahead)/(notice-8),0,1),escape=p*p*(3-2*p);
  const f=section.sample(at),side=Math.sin(phase*2.7)>=0?1:-1;
  const position=f.position.clone().addScaledVector(f.right,side*(.2+escape*5.2));
  position.y=T.MathUtils.lerp(f.position.y+.12,Math.max(.2,(f.position.y-1.55)*.5),escape);
  if(!reduced)position.y+=Math.sin(Math.PI*escape)*(1.5+Math.abs(Math.sin(time*18+phase))*.35);
  const away=Math.atan2(-f.right.z*side,f.right.x*side);
  const yaw=phase+Math.atan2(Math.sin(away-phase),Math.cos(away-phase))*Math.min(1,escape*3);
  return {position,yaw,escape};
}

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

const windmillTower = new T.CylinderGeometry(1.7, 3.1, 1, 7);
export function meadowWindmill(m: WorldModel, section: MiniSection) {
  const x = section.width * .5, y = section.origin.y + section.amplitude;
  const rotorZ = Math.min(0, section.shift) - 2.8, size = section.amplitude * .22, roofRadius = 3.4;
  // Keep the sail plane behind every rail, including loops that bend backwards.
  // Put the whole building behind its swept volume, including the wider roof
  // and blade thickness. Share this hub position with the animated instance.
  const z = rotorZ - roofRadius - .65 - size * .045, height = y + .5;
  const facet = Math.cos(Math.PI / 7), slope = 1.4 / height * facet;
  const facade = (at: number) => z + 3.1 * facet - at * slope;
  m.add(windmillTower, '#f2dfb0', [x, height / 2, z], [1, height, 1], [0, -Math.PI / 7, 0]);
  m.add(G.cone, '#da8e6e', [x, height + 1.7, z], [roofRadius, 3.4, roofRadius], [0, -Math.PI / 7, 0]);
  // Door and window frames follow the tapered wall rather than floating in it.
  const lean = [-Math.atan(slope), 0, 0];
  m.add(G.box, '#cba774', [x, 1.65, facade(1.65) + .06], [1.6, 3.3, .13], lean);
  m.add(G.box, '#739693', [x, 1.65, facade(1.65) + .15], [1.3, 3.05, .08], lean);
  for (const wy of [height * .4, height * .66]) {
    m.add(G.box, '#fff0cc', [x, wy, facade(wy) + .06], [1.15, 1.45, .14], lean);
    m.add(G.box, '#9fbbc0', [x, wy, facade(wy) + .15], [.85, 1.15, .08], lean);
  }
  const axleBack = facade(y) - .25;
  m.add(G.pole, '#9c7652', [x, y, (axleBack + rotorZ) / 2], [.23, rotorZ - axleBack, .23], [Math.PI / 2, 0, 0]);
  m.add(G.round, '#9c7652', [x, y, rotorZ + .1], [.65, .65, .4]);
  return { x, y, z: rotorZ, size };
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
