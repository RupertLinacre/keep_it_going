import * as T from 'three';
import type { MiniSection } from '../../games/mini-track';
import type { PieceAnimation } from '../../games/piece-animation';
import type { FairgroundLights } from '../../games/world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { VariantBuilder, point, at, arrival, type InstancePool } from './variant-kit';

const TAU = Math.PI * 2;
const cream = '#f6edd1', dark = '#536d77', wood = '#bc9266';
const colours = ['#dca29b', '#82bcb0', '#e5bd72', '#a8b4d7'];
type P = [number, number, number];
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
function named(b: VariantBuilder, model: WorldModel, count: number, name: string, parent = b.group) {
  const pool = b.pool(model, count, parent); pool[0].name = name; return pool;
}
function pose(pool: InstancePool, index: number, object: T.Object3D) { object.updateMatrix(); for (const mesh of pool) mesh.setMatrixAt(index, object.matrix); }
function geometry(m: WorldModel, vertices: number[], color: string) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals(); m.add(g, color, [0, 0, 0]); g.dispose();
}
function pine(m: WorldModel, x: number, y: number, z: number, scale = 1) {
  m.add(G.pole, wood, [x, y + scale, z], [.2 * scale, 2 * scale, .2 * scale]);
  m.add(G.cone, '#71988a', [x, y + 3 * scale, z], [1.6 * scale, 5 * scale, 1.6 * scale]);
  m.add(G.cone, cream, [x, y + 4.6 * scale, z], [.73 * scale, 2.1 * scale, .73 * scale]);
}
function cloud(m: WorldModel, scale = 1) {
  for (let j = 0; j < 5; j++) m.add(G.round, j % 2 ? cream : '#dae9e8', [(j - 2) * .85 * scale, Math.sin(j * 1.8) * .24 * scale, 0], [1.12 * scale, (.75 + j % 2 * .3) * scale, .8 * scale]);
  for (const sign of [-1, 1]) m.add(G.round, dark, [sign * .53 * scale, .05, .77 * scale], [.11 * scale, .15 * scale, .065 * scale]);
  m.add(G.round, '#d69b94', [0, -.34 * scale, .79 * scale], [.25 * scale, .08 * scale, .06 * scale]);
}
/** Continuous banks stay under the railway; big rear facets give the mountain
 * options their own silhouettes without relying on little scattered props. */
function trackBed(m: WorldModel, a: T.Vector3, c: T.Vector3, width: number) {
  const y = Math.min(a.y, c.y) - .55;
  const A: P = [a.x,y,a.z-width], B: P = [a.x,y,a.z+width], C: P = [c.x,y,c.z-width], D: P = [c.x,y,c.z+width];
  geometry(m,[...A,...B,...C,...B,...D,...C], '#bdc4ad');
  for(const side of [-1,1]) {
    const E: P=[a.x,y,a.z+side*width],F: P=[c.x,y,c.z+side*width],H: P=[a.x,0,a.z+side*(width+1)],I: P=[c.x,0,c.z+side*(width+1)];
    geometry(m,side<0?[...E,...F,...H,...F,...I,...H]:[...E,...H,...F,...F,...H,...I],'#a6b4a2');
  }
}
function ridge(s: MiniSection, m: WorldModel, breakfast = false) {
  for (let j = 0; j < 26; j++) {
    const a = point(s, j / 26), c = point(s, (j + 1) / 26);
    trackBed(m,a,c,2.45);
    if (j % 2) {
      const rise = 6 + Math.sin(j * 1.57) ** 2 * 8;
      m.add(G.rock, breakfast ? '#b6a590' : '#99b5b2', [a.x, (a.y + rise) * .5, a.z - 8], [4.7, (a.y + rise) * .5, 4.4], [0, j * .53, .12]);
      m.add(G.rock, cream, [a.x - .3, (a.y + rise) * .9, a.z - 8], [3.2, 1.2, 3.1]);
    }
    if (j % 5 === 2) pine(m, a.x, Math.max(.2, a.y - 3), a.z - 15, 1.1);
  }
  for (let j = 0; j < 19; j++) {
    const p = point(s, .04 + j * .05);
    m.add(G.box, wood, [p.x, p.y + .45, p.z + 2.65], [.17, 1.9, .17]);
    if (j) {
      const q = point(s, .04 + (j - 1) * .05);
      m.beam('#d9c8a0', v(q.x, q.y + 1.2, q.z + 2.65), v(p.x, p.y + 1.2, p.z + 2.65), .085);
    }
  }
}
function terrace(m: WorldModel, p: T.Vector3, radius: number, color = '#99b4aa') {
  m.add(G.rock, color, [p.x, Math.max(.2, p.y / 2 - 1), p.z], [radius + .8, Math.max(1.3, p.y / 2 + .3), radius]);
  m.add(G.pole, '#dbe0c6', [p.x, p.y - .35, p.z], [radius, .65, radius]);
}
function laundry(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); ridge(s, m);
  const stops = [.23, .5, .77].map(t => ({ p: point(s, t).add(v(0, 1, 9)), stop: at(s, t) }));
  for (const [i, { p }] of stops.entries()) {
    terrace(m, p, 5.4);
    // Substantial open wringer: rollers sit within the frame, clear of the rail.
    for (const sign of [-1, 1]) {
      m.add(G.box, '#6c9d9a', [p.x + sign * 3.4, p.y + 3.8, p.z], [.72, 7.6, 2]);
      m.add(G.round, '#b3d0c2', [p.x + sign * 3.4, p.y + 7.7, p.z], [1, .8, 1.15]);
    }
    m.add(G.box, '#85b9b0', [p.x, p.y + 6.6, p.z], [7.5, .65, 2.2]);
    m.add(G.pole, '#88b5b9', [p.x, p.y + .6, p.z + .4], [3.5, 1.2, 2.5]);
    m.add(G.pole, '#b6dedd', [p.x, p.y + 1.23, p.z + .4], [3, .12, 2]);
    for (const sign of [-1, 1]) {
      const x = p.x + sign * 5.1;
      m.add(G.box, wood, [x, p.y + 6.5, p.z - 3.8], [.42, 13, .42]);
      m.add(G.cone, colours[i], [x, p.y + 13.55, p.z - 3.8], [.86, 1.2, .86]);
    }
    m.beam('#ddc291', v(p.x - 5.1, p.y + 12, p.z - 3.8), v(p.x + 5.1, p.y + 12, p.z - 3.8), .1);
    m.add(G.box, '#d4b37c', [p.x, p.y + 7, p.z + 1.17], [4, 1, .14]);
    for (let j = 0; j < 3; j++) m.add(G.round, cream, [p.x - .95 + j * .95, p.y + 7, p.z + 1.31], [.25, .3, .12]);
  }
  b.batch(m);
  const roller = new WorldModel(); roller.add(G.pole, '#e8cc94', [0, 0, 0], [.85, 6, .85], [0, 0, Math.PI / 2]);
  for (let j = 0; j < 8; j++) roller.add(G.box, '#cba674', [0, Math.cos(j * TAU / 8) * .82, Math.sin(j * TAU / 8) * .82], [5.5, .1, .14], [j * TAU / 8, 0, 0]);
  const rollers = named(b, roller, 6, 'laundry-wringer-rollers');
  const pillow = new WorldModel(); cloud(pillow, 1); const pillows = named(b, pillow, 3, 'laundry-cloud-pillows');
  const mitten = new WorldModel(); mitten.add(G.round, '#dba098', [0, -1.5, 0], [.85, 1.1, .4]); mitten.add(G.round, '#dba098', [.75, -1, 0], [.45, .7, .37], [0, 0, -.45]); mitten.add(G.box, '#edd4a4', [0, -.52, 0], [1.35, .56, .85]); mitten.add(G.box, wood, [0, .08, 0], [.28, .7, .35]);
  const mittens = named(b, mitten, 9, 'laundry-pegged-mittens');
  const wheel = new WorldModel(); wheel.add(G.ring, '#d6ad71', [0, 0, 0], [1.6, 1.6, 1.6]);
  for (let j = 0; j < 6; j++) wheel.beam('#e7c68c', v(0, 0, 0), v(Math.cos(j * TAU / 6) * 1.6, Math.sin(j * TAU / 6) * 1.6, 0), .15);
  wheel.add(G.pole, '#bc8d67', [1.25, 0, .6], [.2, 1.3, .2], [Math.PI / 2, 0, 0]); const wheels = named(b, wheel, 3, 'laundry-hand-cranks');
  const bubbles = new WorldModel(); bubbles.add(G.round, '#d7efeb', [0, 0, 0], [.28, .28, .28]); const foam = named(b, bubbles, 15, 'laundry-foam');
  const dummy = new T.Object3D();
  b.animate((time, distance, reduced) => {
    for (let i = 0; i < stops.length; i++) {
      const { p, stop } = stops[i], greet = reduced ? 0 : arrival(distance, stop, 17), cycle = reduced ? 0 : time * .8 + greet * 1.4;
      for (let side = 0; side < 2; side++) b.place(rollers, i * 2 + side, p.x, p.y + 4 + side * 1.8, p.z, 1, cycle * (side ? -1 : 1), 0, 0);
      dummy.position.set(p.x, p.y + 4.88, p.z + Math.sin(cycle) * 1.25); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, .4 + Math.abs(Math.sin(cycle)) * .15, 1); pose(pillows, i, dummy);
      b.place(wheels, i, p.x + 3.85, p.y + 4, p.z + .7, 1, 0, Math.PI / 2, cycle);
      for (let j = 0; j < 3; j++) b.place(mittens, i * 3 + j, p.x - 3 + j * 3, p.y + 12, p.z - 3.8, 1, reduced ? 0 : Math.sin(time * 2.5 + j) * greet * .65, 0, (j - 1) * .15);
      for (let j = 0; j < 5; j++) { const f = reduced ? j / 5 : (time * .25 + j / 5) % 1; b.place(foam, i * 5 + j, p.x - 2 + j, p.y + 1.5 + f * 2, p.z + 1.4, reduced ? .5 : .5 + greet * (1 - f)); }
    }
  });
}
function yeti(m: WorldModel, x: number, y: number, z: number) {
  m.add(G.round, '#e9edda', [x, y + 2.1, z], [2, 2.5, 1.5]);
  m.add(G.round, '#f4f0d9', [x, y + 4.3, z], [1.9, 1.8, 1.4]);
  m.add(G.round, '#a1c8c5', [x, y + 4.25, z + 1.2], [1.3, 1.1, .45]);
  for (const sign of [-1, 1]) {
    m.add(G.cone, '#d7bd94', [x + sign * 1.55, y + 5.5, z], [.38, 1.7, .38], [0, 0, -sign * .5]);
    m.add(G.round, dark, [x + sign * .44, y + 4.6, z + 1.62], [.15, .19, .1]);
    m.add(G.round, '#dce6d7', [x + sign * 1.35, y + .3, z + .6], [.85, .4, 1.1]);
  }
  m.add(G.round, '#607f86', [x, y + 4.1, z + 1.7], [.3, .23, .13]);
  m.add(G.box, '#e0aa95', [x, y + 3.15, z], [3.3, .45, 2.65]);
  m.add(G.box, '#e0aa95', [x + 1.3, y + 2.5, z + 1.4], [.65, 1.8, .24]);
}
function snowCones(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); ridge(s, m);
  const stops = [.26, .53, .79].map(t => ({ p: point(s, t).add(v(0, .2, 10)), stop: at(s, t) }));
  for (const [i, { p }] of stops.entries()) {
    terrace(m, p, 6.4, '#a6bdba');
    // Wide colourful cup, visible rim and the open gap beneath the crusher.
    m.add(G.cone, colours[i], [p.x + 1, p.y + 1.7, p.z + 1.5], [2.2, 3.4, 2.2], [0, 0, Math.PI]);
    m.add(G.ring, cream, [p.x + 1, p.y + 3.4, p.z + 1.5], [2.2, 2.2, 2.2], [Math.PI / 2, 0, 0]);
    for (const sign of [-1, 1]) m.add(G.box, '#7ea6ac', [p.x + 1 + sign * 3.1, p.y + 5.3, p.z - .4], [.62, 10.6, 1.6]);
    m.add(G.box, '#91bfc0', [p.x + 1, p.y + 8.1, p.z - .4], [7.4, 3.2, 4.5]);
    m.add(G.cone, '#dae8dc', [p.x + 1, p.y + 10.9, p.z - .4], [3.7, 2.6, 3.2], [0, 0, Math.PI]);
    m.add(G.pole, '#adced0', [p.x + 1, p.y + 12.25, p.z - .4], [3.9, .32, 3.3]);
    for (let j = 0; j < 5; j++) m.add(G.rock, cream, [p.x - .8 + j * .9, p.y + 12.8 + j % 2 * .45, p.z - .4], [1.25, 1.1, 1.3]);
    m.add(G.box, '#557d86', [p.x + 1, p.y + 6.1, p.z + 1.3], [2.1, 1, 1.3]);
    for (let j = 0; j < 3; j++) m.add(G.round, colours[j], [p.x -.3 + j * 1.3, p.y + 8.3, p.z + 1.94], [.32, .36, .13]);
    yeti(m, p.x - 4.4, p.y + .2, p.z + .6);
    m.add(G.box, wood, [p.x + 4.3, p.y + 6.8, p.z + .2], [.3, 5.3, .3]);
    m.add(G.cone, colours[i], [p.x + 4.3, p.y + 10.1, p.z + .2], [1.4, 2.2, 1.4], [0, 0, Math.PI]);
    m.add(G.round, cream, [p.x + 4.3, p.y + 11.6, p.z + .2], [1.6, 1.25, 1.5]);
  }
  b.batch(m);
  const wheel = new WorldModel(); wheel.add(G.ring, '#d6ae7d', [0, 0, 0], [1.7, 1.7, 1.7]);
  for (let j = 0; j < 6; j++) wheel.beam('#ead2a1', v(0,0,0), v(Math.cos(j*TAU/6)*1.7, Math.sin(j*TAU/6)*1.7, 0), .16);
  wheel.add(G.pole, wood, [1.4,0,.55], [.18,1.1,.18], [Math.PI/2,0,0]);
  const cranks = named(b,wheel,3,'yeti-ice-crusher-cranks');
  const hand = new WorldModel(); hand.add(G.round, '#e8eddb', [0,0,0], [.52,.48,.45]);
  const hands = named(b,hand,3,'yeti-cranking-paws');
  const arm = new WorldModel(); arm.add(G.pole, '#e8eddb', [0,-.5,0], [.4,1,.4]);
  const arms = named(b,arm,3,'yeti-connected-arms');
  const snow = new WorldModel(); snow.add(G.rock, '#f6efd9', [0,0,0], [1.9,1.5,1.9]); snow.add(G.round,'#e2aaa0',[.35,.65,.15],[1.1,.75,1.1]);
  const scoops = named(b,snow,3,'yeti-growing-snow-cones');
  const chip = new WorldModel(); chip.add(G.rock,'#d8e9e3',[0,0,0],[.26,.36,.26]);
  const chips = named(b,chip,18,'yeti-falling-ice');
  const dummy = new T.Object3D(), shoulder = new T.Vector3(), paw = new T.Vector3(), delta = new T.Vector3(), down = v(0,-1,0);
  b.animate((time,distance,reduced)=>{
    for(let i=0;i<stops.length;i++) {
      const {p,stop}=stops[i], greet=reduced?0:arrival(distance,stop,17), angle=reduced?0:time*.7+greet*2;
      const cx=p.x-2.2,cy=p.y+5.4,cz=p.z+2.1;
      b.place(cranks,i,cx,cy,cz,1,0,0,angle);
      paw.set(cx+Math.cos(angle)*1.4,cy+Math.sin(angle)*1.4,cz+.55); b.place(hands,i,paw.x,paw.y,paw.z);
      shoulder.set(p.x-3.1,p.y+3.1,p.z+1.2); delta.copy(paw).sub(shoulder);
      const length=delta.length(); dummy.position.copy(shoulder); dummy.quaternion.setFromUnitVectors(down,delta.normalize()); dummy.scale.set(1,length,1); pose(arms,i,dummy);
      b.place(scoops,i,p.x+1,p.y+3.5,p.z+1.5,.5+greet*.5);
      for(let j=0;j<6;j++){const f=reduced?j/6:(time*.75+j/6)%1; b.place(chips,i*6+j,p.x+1+Math.sin(j*2.4)*.55,p.y+5.7-f*1.6,p.z+1.5,reduced?.25:.25+greet*.7);}
    }
  });
}
/** A true vaulted passage, split at its crown for the gallery cutaway. Every
 * exterior feature belongs to the removable near shell or the solid far half. */
function tunnel(s: MiniSection, b: VariantBuilder, snail: boolean) {
  const local = new T.Group(), frame = s.sample(s.start + s.length / 2); local.position.copy(point(s, .5)); local.quaternion.copy(frame.rotation); b.group.add(local);
  const near = new WorldModel(), far = new WorldModel();
  for (let side = 0; side < 2; side++) {
    const m = side ? far : near, vertices: number[] = [];
    for (let j = side * 16; j < (side + 1) * 16; j++) for (let slice = 0; slice < (snail ? 12 : 1); slice++) {
      const lo = -13 + slice * 26 / (snail ? 12 : 1), hi = -13 + (slice + 1) * 26 / (snail ? 12 : 1);
      const a = j * Math.PI / 32, c = (j + 1) * Math.PI / 32;
      const inner = (a: number, z: number): P => [3.2 * Math.cos(a), .6 + 3.2 * Math.sin(a), z];
      const outer = (a: number, z: number): P => { const taper = snail ? Math.sqrt(1 - (z / 17) ** 2) : 1; return [Math.cos(a) * (snail ? 10.5 : 7.4) * taper, .6 + Math.sin(a) * (snail ? 17 : 13) * taper, z]; };
      const A = inner(a, lo), B = inner(a, hi), C = inner(c, lo), D = inner(c, hi);
      const E = outer(a, lo), F = outer(a, hi), H = outer(c, lo), I = outer(c, hi);
      vertices.push(...A, ...B, ...C, ...B, ...D, ...C, ...E, ...H, ...F, ...F, ...H, ...I);
      if (slice === 0) vertices.push(...A, ...C, ...E, ...C, ...H, ...E);
      if (slice === (snail ? 11 : 0)) vertices.push(...B, ...F, ...D, ...D, ...F, ...I);
      if (side) vertices.push(...E, ...F, ...H, ...F, ...I, ...H);
    }
    geometry(m, vertices, snail ? side ? '#b492ac' : '#d9a6ac' : side ? '#9f9d8e' : '#c4bba1');
    m.add(G.box, snail ? '#c2a7b7' : '#c8bc9d', [side ? -3.4 : 3.4, -.1, 0], [.4, 1.4, 26]);
    const sign = side ? -1 : 1;
    if (snail) {
      // Big concentric coils run across the shell's side, where they cannot
      // obstruct either entrance. A broad cream foot anchors the animal.
      for (let j = 0; j < 66; j++) {
        const a = j / 65 * TAU * 2.1, next = (j + 1) / 65 * TAU * 2.1, r = .8 + j / 65 * 5.8, rr = .8 + (j + 1) / 65 * 5.8;
        const shellPoint = (angle: number, radius: number) => { const y = 8 + Math.cos(angle) * radius, z = Math.sin(angle) * radius; return v(sign * (10.5 * Math.sqrt(Math.max(.02, 1 - ((y-.6)/17)**2 - (z/17)**2)) + .4), y, z); };
        m.beam('#efd5b3', shellPoint(a,r), shellPoint(next,rr), .4);
      }
      for (const z of [-11.7, 11.7]) for (let j = side * 20; j < (side + 1) * 20; j++) {
        const taper = Math.sqrt(1 - (z/17)**2), a=j*Math.PI/40, c=(j+1)*Math.PI/40;
        m.beam('#e5bfb3',v(Math.cos(a)*10.5*taper,.6+Math.sin(a)*17*taper,z),v(Math.cos(c)*10.5*taper,.6+Math.sin(c)*17*taper,z),.24);
      }
      m.add(G.round, '#a8c5a7', [sign * 6.8, .3, 0], [3.3, 1.1, 15.5]);
      for (let j = 0; j < 7; j++) m.add(G.round, '#e2ddb4', [sign * 7.4, .95, -11 + j * 3.7], [1.35, .23, 1.5]);
    } else {
      // Chalet walls, stepped roof and heavy eaves dominate the silhouette.
      m.add(G.box, '#b67e60', [sign * 5.55, 5.4, 0], [3.2, 10.8, 26.8]);
      m.add(G.box, '#d9bc8c', [sign * 5.55, 10.2, 0], [3.45, .5, 27.6]);
      m.add(G.box, '#72a69e', [sign * 4.5, 13.1, 0], [10.6, .65, 29], [0, 0, -sign * .65]);
      for (const z of [-10, -3.5, 3.5, 10]) { m.add(G.box, '#e3cca3', [sign * 7.22, 5.1, z], [.16, 3, 3]); m.add(G.box, '#688d91', [sign * 7.33, 5.1, z], [.11, 2.3, 2.3]); m.add(G.box, cream, [sign * 7.4, 5.1, z], [.08, .12, 2.4]); }
    }
    for (const z of [-13.25, 13.25]) for (let j = 0; j < 10; j++) { const angle = (j + .5) * Math.PI / 20 + side * Math.PI / 2; m.add(G.box, snail ? '#c6d4b1' : '#ebcf9b', [Math.cos(angle) * 3.5, .6 + Math.sin(angle) * 3.5, z], [.54, .55, .6], [0, 0, angle - Math.PI / 2]); }
  }
  const cover = b.batch(near, local); cover.name = 'extra-tunnel-cutaway'; b.batch(far, local);
  return { local, cover };
}
function snail(s: MiniSection, b: VariantBuilder) {
  const { local, cover } = tunnel(s, b, true), m = new WorldModel();
  m.add(G.round, '#accba9', [7.5, 1.9, -15.8], [3.3, 2.4, 5]);
  m.add(G.round, '#b9d5b2', [7.5, 4.1, -18.1], [2.7, 2.7, 2.5]);
  m.add(G.round, '#dcb09e', [7.5, 3.3, -20.45], [1.4, .45, .25]);
  for (const sign of [-1, 1]) m.add(G.round, '#e8c59f', [7.5 + sign * 1.9, 3.95, -19.6], [.56, .4, .2]);
  for (let j = 0; j < 7; j++) m.add(G.rock, '#96b4a0', [-5.7, .2, -10 + j * 3.5], [2, 1, 1.8]);
  b.batch(m, local);
  const stalk = new WorldModel(); stalk.add(G.pole, '#a8c6a1', [0, 1.5, 0], [.35, 3, .35]); stalk.add(G.round, cream, [0, 3.4, 0], [.95, .9, .85]); stalk.add(G.round, dark, [0, 3.42, -.77], [.32, .41, .18]); stalk.add(G.round, '#ffffff', [-.08, 3.58, -.93], [.09, .12, .04]);
  const eyes = named(b, stalk, 2, 'snail-rising-feelers', local);
  const lid = new WorldModel(); lid.add(G.round, '#8cae92', [0, 3.69, -.4], [.99, .48, .63]); const lids = named(b, lid, 2, 'snail-sleepy-eyelids', local);
  const flag = new WorldModel(); flag.add(G.box, wood, [0, 1.5, 0], [.18, 3, .18]); flag.add(G.box, '#e7bf82', [.9, 2.4, 0], [1.8, 1, .14]); flag.add(G.round, '#b97c6e', [.9, 2.4, -.11], [.28, .3, .08]); const flags = named(b, flag, 1, 'snail-welcome-flag', local);
  const dummy = new T.Object3D(), stop = at(s, .44);
  b.animate((time, distance, reduced) => {
    cover.visible = !b.group.userData.cutaway;
    const greet = reduced ? 0 : arrival(distance, stop, 22);
    for (let j = 0; j < 2; j++) {
      dummy.position.set(7.5 + (j ? 1.45 : -1.45), 5.2, -18.3); dummy.rotation.set(reduced ? 0 : Math.sin(time * 2 + j) * greet * .16, 0, (j ? -1 : 1) * (.14 + greet * .15)); dummy.scale.set(1, .52 + greet * .6, 1); pose(eyes, j, dummy);
      // Lids use the exact stalk transform, then lift relative to the eye.
      dummy.position.y += greet * .7; pose(lids, j, dummy);
    }
    b.place(flags, 0, 8, 2, -12.5, 1, 0, 0, reduced ? 0 : Math.sin(time * 4) * greet * .3);
  });
}
function accordion(s: MiniSection, b: VariantBuilder) {
  const { local, cover } = tunnel(s, b, false), m = new WorldModel();
  for (const sign of [-1,1]) {
    // Broad keyboard and bass-button cabinets sit beside the clear rail arch.
    m.add(G.box,'#779e9a',[sign*6.4,6.1,-14],[4.1,10.5,2.5]);
    for(let j=0;j<10;j++) {
      m.add(G.box,cream,[sign*6.4,2.3+j*.82,-15.34],[3,.68,.35]);
      if(j%3!==0)m.add(G.box,dark,[sign*7.05,2.65+j*.82,-15.58],[1.45,.3,.22]);
    }
    m.add(G.round,'#b98c65',[sign*6.4,13,-10],[1.7,1.7,1.4]);
    for(const side of [-1,1]) {
      m.add(G.round,'#a88160',[sign*6.4+side*1.2,14.2,-10],[.54,.54,.4]);
      m.add(G.round,dark,[sign*6.4+side*.55,13.3,-11.25],[.16,.19,.1]);
      m.add(G.round,'#e3bf92',[sign*6.4+side*.4,12.65,-11.25],[.51,.37,.3]);
    }
    m.add(G.cone,'#dfb879',[sign*6.4,15.1,-10],[1.5,1.4,1.3]);
    m.add(G.round,'#715e50',[sign*6.4,12.9,-11.5],[.26,.2,.17]);
    m.add(G.box,'#daae91',[sign*6.4,11,-10],[2.6,1.1,2]);
    // Fixed bass cabinet supports the near end of each huge accordion.
    m.add(G.box,'#719c99',[sign*9,6,-6],[3.2,8.3,2]);
    for(let j=0;j<10;j++) {
      m.add(G.box,cream,[sign*10.77,2.8+j*.69,-6],[.3,.58,2.5]);
      if(j%3!==0)m.add(G.box,dark,[sign*10.98,3.1+j*.69,-6.65],[.28,.23,1.2]);
    }
    for (let j=0;j<5;j++) m.add(G.round,'#e4c38d',[sign*7.45,10.65,-10+j*5],[.2,.23,.23]);
  }
  b.batch(m,local);
  const bellows=new WorldModel();
  for(let j=0;j<13;j++){
    bellows.add(G.box,j%2?'#deb69c':'#9db8ad',[0,0,j*.7],[3.3+(j%2)*.8,7.2+(j%2)*.8,.48]);
    bellows.add(G.box,cream,[0,3.85,j*.7],[3.9,.12,.18]);
  }
  const folds=named(b,bellows,2,'accordion-compressing-bellows',local);
  const plate=new WorldModel(); plate.add(G.box,'#6e9c99',[0,0,0],[4.4,8.6,1.1]); plate.add(G.box,'#dcb88c',[0,0,.62],[3.5,7.3,.2]);
  for(let j=0;j<6;j++)plate.add(G.round,cream,[0,-2.8+j*1.15,.8],[.32,.32,.15]);
  const plates=named(b,plate,2,'accordion-moving-endplates',local);
  const paw=new WorldModel(); paw.add(G.round,'#c09a70',[0,-.6,0],[.48,.8,.42]); paw.add(G.round,'#e0bd8d',[0,-1.22,-.25],[.55,.3,.48]);
  const paws=named(b,paw,4,'accordion-keyboard-paws',local);
  const note=new WorldModel(); note.add(G.round,'#e3c283',[0,0,0],[.55,.35,.16]); note.add(G.box,'#e3c283',[.42,.75,0],[.2,1.5,.2]); note.add(G.box,'#e3c283',[.82,1.4,0],[.9,.25,.2]);
  const notes=named(b,note,8,'accordion-floating-notes',local);
  const dummy=new T.Object3D(), stop=at(s,.5);
  b.animate((time,distance,reduced)=>{
    cover.visible=!b.group.userData.cutaway;
    const greet=reduced?0:arrival(distance,stop,22);
    for(let j=0;j<2;j++){
      const sign=j?1:-1, stretch=1+(reduced?0:Math.sin(time*3+j*Math.PI)*greet*.28);
      dummy.position.set(sign*9,6,-5); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,stretch); pose(folds,j,dummy);
      b.place(plates,j,sign*9,6,-5+8.4*stretch);
      for(let k=0;k<2;k++)b.place(paws,j*2+k,sign*6.4+(k?-.7:.7),10.6,-14.8,1,reduced?0:greet*(.15+.25*Math.sin(time*6+k*Math.PI)),0,(k?1:-1)*.12);
      for(let k=0;k<4;k++){const f=reduced?k/4:(time*.24+k/4)%1;b.place(notes,j*4+k,sign*(10.5+f*2),11+f*7,-7+k*3,.3+greet*(1-f)*.8,0,sign*.2,Math.sin(f*4)*.25);}
    }
  });
}
/** A low watercourse, open canyon and broad masonry piers hold the unchanged
 * track. Front mechanisms are separate, well outside the carriage envelope. */
function canyon(s: MiniSection, m: WorldModel, teal: boolean) {
  const c = point(s, .5);
  m.add(G.round, '#87c7cf', [c.x, .1, c.z + 8], [36, .3, 16]);
  for (let j = 0; j < 23; j++) {
    const p = point(s, .04 + j * .04), q = point(s, .04 + (j + 1) * .04);
    const y=Math.min(p.y,q.y)-.5;
    geometry(m,[p.x,y,p.z-2.1,p.x,y,p.z+2.1,q.x,y,q.z-2.1,p.x,y,p.z+2.1,q.x,y,q.z+2.1,q.x,y,q.z-2.1], '#d1c6aa');
    for (const sign of [-1, 1]) { m.add(G.box, '#e2d5b3', [p.x, p.y + .45, p.z + sign * 2.1], [.35, 1.4, .35]); if (j) { const r = point(s, .04 + (j - 1) * .04); m.beam(wood, v(r.x, r.y + .95, r.z + sign * 2.1), v(p.x, p.y + .95, p.z + sign * 2.1), .12); } }
    if (j % 4 === 1) {
      const height = p.y - 1.2;
      m.add(G.box, teal ? '#90ada4' : '#b8ad94', [p.x, height / 2, p.z], [2.8, height, 3.8]);
      m.add(G.box, '#d1cbb0', [p.x, height - .6, p.z], [4.4, 1.6, 4.7]);
      for (let k = 1; k < height / 2; k++) m.add(G.box, '#d4c8ac', [p.x, k * 2, p.z + 1.92], [2.75, .15, .08]);
    }
  }
  for (const t of [.04, .15, .85, .96]) {
    const p = point(s, t);
    m.add(G.rock, teal ? '#90b0a5' : '#baa78f', [p.x, p.y * .32, p.z - 5], [7, p.y * .6 + 2, 7]);
    m.add(G.rock, cream, [p.x, p.y * .85, p.z - 5], [5.7, .65, 5.5]); pine(m, p.x, p.y, p.z - 9, 1.2);
  }
}
function otterModel() {
  const m = new WorldModel();
  m.add(G.round, '#a67f60', [0, 1.4, 0], [1.8, 1.6, 1.2]); m.add(G.round, '#e0bc8f', [0, 1.5, 1], [1.3, 1.1, .25]);
  m.add(G.round, '#ae8764', [0, 3.3, 0], [1.35, 1.2, 1.1]);
  for (const sign of [-1, 1]) { m.add(G.round, '#9e785a', [sign * 1.1, 4, -.1], [.42, .43, .3]); m.add(G.round, dark, [sign * .47, 3.6, .91], [.13, .15, .08]); m.add(G.round, '#d9b38a', [sign * .4, 3.06, 1.05], [.5, .35, .28]); m.add(G.round, '#9c7659', [sign * 1.25, .2, .8], [.6, .25, .8]); }
  m.add(G.round, '#695d54', [0, 3.25, 1.32], [.24, .19, .16]); m.add(G.round, '#aa7e58', [0, .7, -1.7], [.6, .45, 1.7], [.2, 0, 0]);
  m.add(G.box, '#dfad7b', [0, 2.5, 1.1], [2.1, .3, .45]);
  return m;
}
function otters(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); canyon(s, m, true);
  const c = point(s, .5), p = v(c.x, Math.max(5.6, c.y * .25), c.z + 13);
  m.add(G.rock, '#91b3a7', [p.x, p.y / 2, p.z], [5.5, p.y / 2, 5]);
  m.add(G.box, '#c3a074', [p.x, p.y, p.z], [5.5, .6, 6]);
  for (const z of [-2, 2]) { m.beam(wood, v(p.x - 2.4, p.y, p.z + z), v(p.x, p.y + 4.2, p.z + z), .5); m.beam(wood, v(p.x + 2.4, p.y, p.z + z), v(p.x, p.y + 4.2, p.z + z), .5); }
  for (const sign of [-1, 1]) { m.add(G.round, '#cad9be', [p.x + sign * 10, .35, p.z], [5, .5, 4]); for (let j = 0; j < 4; j++) m.add(G.pole, wood, [p.x + sign * 10, .8 + j * .42, p.z], [.34, 6, .34], [Math.PI / 2, 0, sign * .18]); }
  b.batch(m);
  const plank = new WorldModel(); plank.add(G.box, '#c8a171', [0, 0, 0], [22, .65, 3.5]); plank.add(G.box, '#ead4a5', [0, .38, 0], [21.5, .15, 2.9]); for (const sign of [-1, 1]) { plank.add(G.box, '#7fab9f', [sign * 8.5, .8, 0], [3.4, .4, 3.8]); plank.add(G.box, wood, [sign * 7, 1.5, .2], [.25, 2.4, .25]); plank.add(G.box, wood, [sign * 7, 2.6, .2], [.3, .25, 2]); } const planks = named(b, plank, 1, 'otter-balanced-seesaw');
  const riders = named(b, otterModel(), 2, 'otter-seesaw-riders');
  const fish = new WorldModel(); fish.add(G.round, '#e5bd76', [0, 0, 0], [1.1, .5, .42]); fish.add(G.cone, '#d59f67', [-1.15, 0, 0], [.6, .85, .35], [0, 0, -Math.PI / 2]); fish.add(G.round, dark, [.65, .12, .35], [.08, .09, .055]); const fishes = named(b, fish, 2, 'otter-balancing-fish');
  const spray = new WorldModel(); spray.add(G.rock, '#d3eae2', [0, 0, 0], [.3, .5, .3]); const drops = named(b, spray, 16, 'otter-splash-drops');
  const body = new T.Object3D(), child = new T.Object3D(), matrix = new T.Matrix4();
  b.animate((time, distance, reduced) => {
    const greet = reduced ? 0 : arrival(distance, at(s, .5), 24), angle = reduced ? 0 : Math.sin(time * 2.2) * (.1 + greet * .25);
    body.position.set(p.x, p.y + 4, p.z); body.rotation.set(0, 0, angle); body.scale.setScalar(1); pose(planks, 0, body);
    for (let j = 0; j < 2; j++) { const sign = j ? 1 : -1; child.position.set(sign * 8.5, 1, 0); child.rotation.set(0, 0, 0); child.updateMatrix(); matrix.multiplyMatrices(body.matrix, child.matrix); for (const mesh of riders) mesh.setMatrixAt(j, matrix);
      child.position.set(sign * 8.5, 5.5, 0); child.rotation.z = reduced ? 0 : -angle * 1.2; child.updateMatrix(); matrix.multiplyMatrices(body.matrix, child.matrix); for (const mesh of fishes) mesh.setMatrixAt(j, matrix);
      for (let k = 0; k < 8; k++) { const f = reduced ? k / 8 : (time * .5 + k / 8) % 1; b.place(drops, j * 8 + k, p.x + sign * (10 + f * 3), .4 + Math.sin(f * Math.PI) * (1 + greet * 3), p.z + Math.sin(k * 2.4) * f * 3, reduced ? .2 : .4 + greet * .55); }
    }
  });
}
function storks(s: MiniSection, b: VariantBuilder) {
  const m = new WorldModel(); canyon(s, m, false);
  const stops = [.29, .7].map(t => ({ p: point(s, t).add(v(0, -4, 11)), stop: at(s, t) }));
  for (const { p } of stops) {
    terrace(m, p, 4.7, '#bda98e');
    for (const sign of [-1, 1]) { m.add(G.pole, '#d4a270', [p.x + sign * .9, p.y + 3.6, p.z], [.25, 7.2, .25]); m.add(G.round, '#d4a270', [p.x + sign * .9, p.y + .2, p.z + .8], [.6, .2, 1.2]); }
    m.add(G.round, cream, [p.x, p.y + 8.4, p.z], [2.5, 2, 1.75]);
    for (const sign of [-1, 1]) m.add(G.round, '#688a8c', [p.x + sign * 1.65, p.y + 8.7, p.z], [.8, 1.8, 1.6], [0, 0, sign * .3]);
    m.add(G.pole, cream, [p.x, p.y + 11.1, p.z + .8], [.65, 5.2, .65]);
    m.add(G.round, cream, [p.x, p.y + 13.7, p.z + .7], [1.3, 1.25, 1.15]);
    m.add(G.cone, '#dca370', [p.x + 2.4, p.y + 13.4, p.z + .6], [.48, 4.5, .5], [0, 0, -Math.PI / 2]);
    m.add(G.round, dark, [p.x + .47, p.y + 14, p.z + 1.7], [.16, .19, .1]);
    m.add(G.pole, '#83b1a3', [p.x, p.y + 14.7, p.z + .7], [1.55, .24, 1.45]); m.add(G.pole, '#83b1a3', [p.x, p.y + 15.1, p.z + .7], [.9, .65, .9]);
    m.add(G.pole, '#bc976c', [p.x - 3.1, p.y + 1, p.z + .2], [1.25, 1.7, 1.25]); m.add(G.pole, '#8cbbba', [p.x - 3.1, p.y + 1.9, p.z + .2], [1.05, .12, 1.05]);
  }
  b.batch(m);
  const rod = new WorldModel(); rod.beam(wood, v(0, 0, 0), v(7, 1.8, 0), .19); rod.add(G.ring, '#d9c49a', [1, .26, .2], [.65, .65, .65]); const rods = named(b, rod, 2, 'stork-hinged-fishing-rods');
  const line = new WorldModel(); line.add(G.pole, '#f1dfb7', [0, -.5, 0], [.045, 1, .045]); const lines = named(b, line, 2, 'stork-taut-fishing-lines');
  const sock = new WorldModel(); sock.add(G.box, '#dba19b', [0, -1.4, 0], [1.35, 2.8, .75]); sock.add(G.round, '#dba19b', [.62, -2.7, 0], [1.15, .62, .5]); for (let j = 0; j < 3; j++) sock.add(G.box, cream, [0, -.4 - j * .7, 0], [1.4, .29, .8]); sock.add(G.box, '#8fb5a6', [0, -.12, 0], [1.65, .45, .92]); const socks = named(b, sock, 2, 'stork-caught-striped-socks');
  const beak = new WorldModel(); beak.add(G.cone, '#d4a171', [2.3, -.07, 0], [.28, 4.4, .4], [0, 0, -Math.PI / 2]); const beaks = named(b, beak, 2, 'stork-surprised-lower-beaks');
  const drop = new WorldModel(); drop.add(G.rock, '#c3e5df', [0, 0, 0], [.2, .4, .2]); const drips = named(b, drop, 12, 'stork-sock-drips');
  const dummy = new T.Object3D();
  b.animate((time, distance, reduced) => {
    for (let j = 0; j < stops.length; j++) {
      const { p, stop } = stops[j], greet = reduced ? 0 : arrival(distance, stop, 18), angle = -.95 + greet * 1.05;
      const pivotY = p.y + 9, x = p.x + 2, z = p.z + 1.8, tipX = x + Math.cos(angle) * 7 - Math.sin(angle) * 1.8, tipY = pivotY + Math.sin(angle) * 7 + Math.cos(angle) * 1.8;
      b.place(rods, j, x, pivotY, z, 1, 0, 0, angle);
      const length = (tipY - 3.5) * (1 - greet) + 4.5 * greet, y = tipY - length;
      dummy.position.set(tipX, tipY, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, length, 1); pose(lines, j, dummy);
      b.place(socks, j, tipX, y, z, 1, 0, 0, reduced ? 0 : Math.sin(time * 3) * greet * .16);
      b.place(beaks, j, p.x + .15, p.y + 13.2, p.z + .6, 1, 0, 0, -greet * .28);
      for (let k = 0; k < 6; k++) { const f = reduced ? k / 6 : (time * .8 + k / 6) % 1; b.place(drips, j * 6 + k, tipX + Math.sin(k * 2.4) * .4, y - 3 - f * 3.5, z, reduced ? .15 : greet * (1 - f)); }
    }
  });
}

export function createMountainExtraVariant(section: MiniSection, option: 'd' | 'e', material: T.Material, lights: FairgroundLights): PieceAnimation | undefined {
  if (!['mountainpass', 'tunnel', 'ravinebridge'].includes(section.kind)) return undefined;
  const b = new VariantBuilder(material, lights); b.group.name = `mountain-extra-${section.kind}-${option}`;
  if (section.kind === 'mountainpass') (option === 'd' ? laundry : snowCones)(section, b);
  else if (section.kind === 'tunnel') (option === 'd' ? snail : accordion)(section, b);
  else (option === 'd' ? otters : storks)(section, b);
  b.update(0, section.start - 80, false); return b;
}
