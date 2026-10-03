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

const pennant = new T.BufferGeometry();
pennant.setAttribute('position',new T.Float32BufferAttribute([-.42,0,0,.42,0,0,0,-.65,0,0,-.65,0,.42,0,0,-.42,0,0],3));
pennant.computeVertexNormals();
const millColors=['#eb9c78','#79b9b5','#ecc56c','#9eb988'];

/** Terraced picnic pasture; the 5.4m shoulder matches the sheep landing zone. */
export function sheepBanks(m: WorldModel, section: MiniSection) {
  const rows: number[][] = [], offsets=[-9,-7,-5.4,-3,0,3,5.4,7,9];
  for (let i = 0; i <= 40; i++) {
    const p = section.frames[Math.round(section.resolution * i / 40)].position, y = Math.max(.15, p.y - 1.55);
    rows.push(offsets.flatMap((z,j)=>[p.x-section.origin.x,[0,y*.2,y*.5,y*.85,y,y*.85,y*.5,y*.2,0][j],p.z-section.origin.z+z]));
  }
  for(let j=0;j<offsets.length-1;j++) {
    const vertices:number[]=[];
    for (let i = 0; i < 40; i++) {
      const a=rows[i].slice(j*3,j*3+3),b=rows[i+1].slice(j*3,j*3+3),c=rows[i].slice((j+1)*3,(j+2)*3),d=rows[i+1].slice((j+1)*3,(j+2)*3);
      vertices.push(...a,...c,...b,...b,...c,...d);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    m.add(g,['#81ac59','#a1c46d','#b4ce7b','#95bd65','#95bd65','#b4ce7b','#a1c46d','#81ac59'][j],[0,0,0]);g.dispose();
  }
  // Low cream fencing stays beyond both the fleeing sheep and their flowers.
  for(const side of [-1,1]) {
    let last:T.Vector3|undefined;
    for(let i=0;i<=14;i++) {
      const p=section.sample(section.start+section.length*i/14).position;
      const q=new T.Vector3(p.x-section.origin.x,.65,p.z-section.origin.z+side*10.1);
      m.add(G.box,'#f3e2b4',q.toArray(),[.19,1.3,.19]);
      m.add(G.cone,'#e7c889',[q.x,1.4,q.z],[.18,.23,.18]);
      if(last)for(const h of [.42,.95])m.beam('#eddbac',new T.Vector3(last.x,h,last.z),new T.Vector3(q.x,h,q.z),.055);
      if(i>0&&i<14&&i%2===0) {
        m.add(G.round,i%4?'#edb677':'#c4d98d',[q.x,.25,q.z+side*.3],[.8,.25,.65]);
        for(let k=0;k<3;k++)m.add(G.round,k===1?'#fff7d6':'#f3ce96',[q.x+(k-1)*.28,.53,q.z+side*.3],[.22,.18,.2]);
      }
      last=q;
    }
  }
  // A little red shepherd's hut and a tidy hay cart give the rolling bank a home.
  const hx=section.span*.23,hz=-13.3;
  m.add(G.box,'#cf8875',[hx,1.55,hz],[5.2,3.1,3.4]);
  for(const dx of [-2.35,2.35])m.add(G.box,'#f7e7c0',[hx+dx,1.65,hz+1.74],[.18,3.3,.16]);
  for(const side of [-1,1])m.add(G.box,'#78979b',[hx+side*1.35,3.53,hz],[3.1,.22,4.1],[0,0,-side*.37]);
  m.add(G.box,'#f7e7c0',[hx,.98,hz+1.79],[1.3,1.96,.15]);m.add(G.box,'#83b8b4',[hx,.93,hz+1.9],[1.03,1.8,.13]);
  for(const dx of [-1.7,1.7]) {
    m.add(G.box,'#f7e7c0',[hx+dx,1.95,hz+1.78],[.95,.95,.15]);m.add(G.box,'#78a7af',[hx+dx,1.95,hz+1.87],[.67,.65,.1]);
  }
  const cartX=section.span*.72,cartZ=-12.2;
  m.add(G.box,'#a78358',[cartX,.66,cartZ],[4.8,.28,2.35]);
  for(const dx of [-1.65,1.65])for(const dz of [-1.15,1.15])m.add(G.ring,'#79654f',[cartX+dx,.55,cartZ+dz],[.48,.48,.48]);
  for(let i=0;i<3;i++) {
    const x=cartX+(i-1)*1.4;m.add(G.box,'#e4bd6b',[x,1.35,cartZ],[1.28,1.1,2]);
    for(const dx of [-.38,.38])m.add(G.box,'#ba9452',[x+dx,1.35,cartZ],[.055,1.15,2.04]);
  }
  // Ribbon flags are on the pasture fence, with no overhead rail obstructions.
  for(let i=0;i<8;i++) {
    const x=hx-4+i*1.13,y=2.45-Math.sin(i/7*Math.PI)*.45;
    m.add(pennant,millColors[i%4],[x,y,hz+2.2]);
    if(i<7)m.beam('#be9d70',new T.Vector3(x,y,hz+2.2),new T.Vector3(x+1.13,2.45-Math.sin((i+1)/7*Math.PI)*.45,hz+2.2),.025);
  }
  for(const dx of [-4.45,4.4])m.add(G.pole,'#bd9c6d',[hx+dx,1.3,hz+2.2],[.08,2.6,.08]);
}

export function pondWaterwheel(section:MiniSection) { return {x:section.span*.76,y:2.2,z:section.hand*4+8.3}; }

export function lilyBridge(m: WorldModel, section: MiniSection) {
  const x = section.span * .5, z = section.hand * 4;
  m.add(G.round, '#adc783', [x, -.28, z], [section.span * .41, .36, 14.7]);
  m.add(G.round, '#d0dfab', [x, -.1, z], [section.span * .385, .17, 13.5]);
  m.add(G.round, '#72b9bf', [x, .13, z], [section.span * .36, .13, 12.5]);
  m.add(G.round, '#8dcac6', [x+2, .2, z+1.5], [section.span * .28, .055, 8.8]);
  for (let i = 0; i < 16; i++) {
    const a=i*2.4,px=x+Math.sin(a)*section.span*.27,pz=z+Math.cos(a)*(7+i%3);
    m.add(G.round, '#659b75', [px, .29, pz], [.95, .06, .73]);
    m.add(G.pole,'#8abb7a',[px,.38,pz],[.045,.15,.045]);
    if (i % 3 === 0) {
      for (let j = 0; j < 7; j++)m.add(G.round,j%2?'#f9cbd8':'#e7a6c8',[px+Math.sin(j*Math.PI*2/7)*.3,.46,pz+Math.cos(j*Math.PI*2/7)*.3],[.26,.18,.26]);
      m.add(G.round, '#ffe2a0', [px, .65, pz], [.2, .12, .2]);
    }
  }
  // Framing reeds live along the outer rim, away from the ducks' swimming route.
  for(let i=0;i<14;i++) {
    const a=i*Math.PI*2/14,px=x+Math.cos(a)*section.span*.345,pz=z+Math.sin(a)*12.1;
    for(let k=0;k<3;k++) {
      const y=.65+(i+k)%3*.17,rx=px+(k-1)*.25;
      m.add(G.pole,'#779865',[rx,y*.5,pz],[.035,y,.035]);m.add(G.round,'#ba905f',[rx,y,pz],[.095,.24,.095]);
    }
    if(i%2===0)m.add(G.rock,'#c2c6a6',[px,.15,pz],[.8,.35,.6]);
  }
  // The timber deck, trestles and handrails follow the curved railway exactly.
  let previous: T.Vector3[] | undefined;
  for (let d = 0; d <= section.length; d += 2) {
    const f=section.sample(section.start+d),p=f.position.clone();p.x-=section.origin.x;p.z-=section.origin.z;
    m.add(G.box,Math.floor(d/2)%3?'#c99d6b':'#dab37e',[p.x,p.y-.45,p.z],[3.5,.23,1.9],new T.Euler().setFromQuaternion(f.rotation).toArray().slice(0,3) as number[]);
    if (Math.floor(d) % 6) continue;
    const rails=[-1,1].map(side=>p.clone().addScaledVector(f.right,side*1.85));
    for(let i=0;i<2;i++) {
      const q=rails[i];
      m.add(G.pole,'#a27f55',[q.x,(q.y+.9)/2,q.z],[.13,q.y+.9,.13]);
      m.add(G.round,'#edcf8e',[q.x,q.y+1,q.z],[.24,.18,.24]);
      q.y+=.65;if(previous)m.beam('#e4bd7f',previous[i],q,.075);
      if(d>6&&d<section.length-6&&Math.floor(d)%12===0) {
        // Mint lanterns sit outside the handrail rather than over the train.
        const side=i===0?-1:1,l=q.clone().addScaledVector(f.right,side*.32);
        m.add(G.box,'#76afac',[l.x,l.y+.36,l.z],[.42,.45,.42]);
        m.add(G.box,'#fff0bd',[l.x,l.y+.36,l.z+.22],[.25,.27,.035]);
        m.add(G.cone,'#dfae73',[l.x,l.y+.68,l.z],[.35,.25,.35]);
      }
    }
    if(d>0&&d<section.length)for(const side of [-1,1]) {
      const a=p.clone().addScaledVector(f.right,side*1.5);a.y-=.58;
      const b=p.clone().addScaledVector(f.right,-side*1.4);b.y=Math.max(.35,p.y-3.6);m.beam('#ad8860',a,b,.105);
    }
    previous=rails;
  }
  const wheel=pondWaterwheel(section);
  for(const dz of [-.72,.72]) {
    m.add(G.box,'#caad78',[wheel.x,.25,wheel.z+dz],[4.8,.25,.5]);
    for(const side of [-1,1])m.beam('#b89462',new T.Vector3(wheel.x+side*1.7,.38,wheel.z+dz),new T.Vector3(wheel.x,2.6,wheel.z+dz),.11);
  }
  m.add(G.pole,'#e7c888',[wheel.x,wheel.y,wheel.z],[.15,2,.15],[Math.PI/2,0,0]);
  // A striped toy-boathouse and launch slip tie the duck regatta together.
  const dockX=section.span*.27,dockZ=z+11.1;
  for(const side of [-1,1]){
    m.add(G.pole,'#b99666',[dockX+side*2.3,1.95,dockZ+.8],[.12,3.8,.12]);
    m.add(G.box,'#88b6ad',[dockX+side*1.2,3.96,dockZ],[2.9,.16,3.2],[0,0,-side*.32]);
  }
  for(let i=0;i<6;i++)m.add(pennant,millColors[i%4],[dockX-2.05+i*.82,3.24-Math.sin(i/5*Math.PI)*.24,dockZ+1.3],[.7,.7,.7]);
  m.add(G.ring,'#edb39b',[dockX,2.15,dockZ+.9],[.46,.46,.46]);
  // Broad lily stepping stones and a duck-sized dock are easy to read at speed.
  for(let i=0;i<5;i++)m.add(G.round,'#d9d4ad',[section.span*.25+i*.8,.23,z+11.2-i*.22],[.62,.18,.5]);
  m.add(G.box,'#d4ad7c',[section.span*.27,.55,z+11.1],[5.5,.18,2.1]);
  for(const dx of [-2.4,2.4])for(const dz of [-.78,.78])m.add(G.pole,'#ae895d',[section.span*.27+dx,.5,z+11.1+dz],[.095,1,.095]);
}

const windmillTower = new T.CylinderGeometry(1.7, 3.1, 1, 7);
export function meadowWindmill(m: WorldModel, section: MiniSection) {
  const x=section.width*.5,y=section.origin.y+section.amplitude;
  const rotorZ=Math.min(0,section.shift)-2.8,size=section.amplitude*.22,roofRadius=3.4;
  // The unchanged sail envelope remains wholly behind every rail. All additions
  // stay behind that envelope, or below its lowest possible blade tip.
  const z=rotorZ-roofRadius-.65-size*.045,height=y+.5;
  const facet=Math.cos(Math.PI/7),slope=1.4/height*facet;
  const facade=(at:number)=>z+3.1*facet-at*slope;
  m.add(windmillTower,'#f2dfb0',[x,height/2,z],[1,height,1],[0,-Math.PI/7,0]);
  m.add(G.pole,'#cab787',[x,.24,z],[3.6,.48,3.6]);
  m.add(G.pole,'#e3cda0',[x,.58,z],[3.25,.2,3.25]);
  m.add(G.cone,'#da8e6e',[x,height+1.7,z],[roofRadius,3.4,roofRadius],[0,-Math.PI/7,0]);
  m.add(G.cone,'#e7ab7b',[x,height+2.16,z],[2.5,2.5,2.5],[0,-Math.PI/7,0]);
  m.add(G.round,'#ebc779',[x,height+3.5,z],[.3,.46,.3]);
  const lean=[-Math.atan(slope),0,0];
  m.add(G.box,'#cba774',[x,1.65,facade(1.65)+.06],[1.6,3.3,.13],lean);
  m.add(G.box,'#739693',[x,1.65,facade(1.65)+.15],[1.3,3.05,.08],lean);
  m.add(G.round,'#f6d68c',[x+.43,1.5,facade(1.5)+.24],[.09,.09,.055]);
  for(const wy of [height*.4,height*.66]) {
    m.add(G.box,'#fff0cc',[x,wy,facade(wy)+.06],[1.3,1.55,.14],lean);
    m.add(G.box,'#7fabb1',[x,wy,facade(wy)+.15],[.96,1.2,.08],lean);
    m.add(G.box,'#f3dfad',[x,wy,facade(wy)+.22],[.07,1.2,.07],lean);
    m.add(G.box,'#f3dfad',[x,wy,facade(wy)+.22],[.98,.075,.07],lean);
    for(const side of [-1,1])m.add(G.box,'#9bba9c',[x+side*.91,wy,facade(wy)-.12],[.36,1.4,.13],lean);
  }
  // A cream balcony and planted window box break up the tall silhouette.
  const balconyY=height*.39,radius=3.18;
  m.add(G.pole,'#e4c592',[x,balconyY,z],[radius,.19,radius]);
  for(let i=0;i<14;i++) {
    const a=i*Math.PI*2/14,b=(i+1)*Math.PI*2/14;
    const p=new T.Vector3(x+Math.sin(a)*radius,balconyY+.55,z+Math.cos(a)*radius);
    m.add(G.pole,'#f2e0ba',[p.x,balconyY+.28,p.z],[.045,.62,.045]);
    m.beam('#f2e0ba',p,new T.Vector3(x+Math.sin(b)*radius,balconyY+.55,z+Math.cos(b)*radius),.045);
  }
  const boxY=height*.66-.92,boxZ=facade(boxY)+.2;
  m.add(G.box,'#b99a70',[x,boxY,boxZ],[1.65,.3,.55]);
  for(let i=0;i<5;i++)m.add(G.round,i%2?'#f6cc86':'#e9a3a3',[x+(i-2)*.3,boxY+.24,boxZ],[.23,.23,.2]);
  const axleBack=facade(y)-.25;
  m.add(G.pole,'#9c7652',[x,y,(axleBack+rotorZ)/2],[.23,rotorZ-axleBack,.23],[Math.PI/2,0,0]);
  m.add(G.round,'#9c7652',[x,y,rotorZ+.1],[.65,.65,.4]);
  m.add(G.round,'#edcb82',[x,y,rotorZ+.43],[.28,.28,.12]);
  // A small oval packing belt connects the lower gears to visible moving bags.
  const conveyorZ=rotorZ-.5;
  m.add(G.box,'#9aa896',[x,1.1,conveyorZ],[6.3,.2,.94]);
  for(const side of [-1,1]) {
    m.add(G.pole,'#bda170',[x+side*3.15,1.1,conveyorZ],[.48,.2,.48]);
    for(const dx of [-2.65,2.65])m.add(G.pole,'#ad8d65',[x+dx,.54,conveyorZ+side*.32],[.085,1.08,.085]);
    m.beam('#d4b889',new T.Vector3(x-3,1.22,conveyorZ+side*.6),new T.Vector3(x+3,1.22,conveyorZ+side*.6),.05);
  }
  m.beam('#a68962',new T.Vector3(x,2.99,rotorZ-1.52),new T.Vector3(x,1.15,conveyorZ),.075);
  // The two packing heads run on visible guides above the front/back belt.
  for(const side of [-1,1]){
    const pz=conveyorZ+side*.47;
    for(const dx of [-.75,.75])m.add(G.pole,'#b69b74',[x+dx,1.66,pz],[.065,3.22,.065]);
    m.add(G.box,'#d7ba88',[x,3.26,pz],[1.65,.17,.8]);
    m.add(G.round,'#83aea5',[x,3.5,pz],[.3,.24,.25]);
  }
  // Flour sacks and grain sheaves give the animated lower gears a purpose.
  for(const side of [-1,1]) {
    const sx=x+side*4.2,sz=z+1.25;
    m.add(G.box,'#d2b488',[sx,.2,sz],[2.45,.28,2.4]);
    for(let i=0;i<3;i++) {
      const px=sx+(i-1)*.65;m.add(G.round,'#eee0b5',[px,.77,sz+(i%2)*.45],[.51,.65,.43]);
      m.add(G.round,'#b79765',[px,1.35,sz+(i%2)*.45],[.25,.11,.23]);
      m.add(G.box,millColors[i],[px,.83,sz+(i%2)*.45+.42],[.34,.28,.04]);
    }
    for(let i=0;i<4;i++) {
      const px=x+side*(5.2+i*.38),pz=z-1.6+(i%2)*.4;
      m.add(G.pole,'#b49e62',[px,.68,pz],[.035,1.35,.035],[0,0,side*.12]);
      m.add(G.round,'#e2c37a',[px+side*.08,1.42,pz],[.14,.36,.13],[0,0,side*.12]);
    }
  }
  for(let i=0;i<5;i++) {
    const side=i%2?-1:1,px=x+side*(4+Math.floor(i/2)*.85),py=2.1+(i%2)*.2;
    m.add(G.pole,'#91a071',[px,py*.5,z+1.25],[.045,py,.045]);
  }
  return {x,y,z:rotorZ,size};
}

/** Shared with the existing actor: a lattice and coloured tips, at the original
 * original blade radius and forward depth, need no extra meshes or draw calls. */
export function meadowSailsModel() {
  const m=new WorldModel();
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2,place=(x:number,y:number,z:number)=>[Math.cos(a)*x+Math.sin(a)*y,-Math.sin(a)*x+Math.cos(a)*y,z];
    m.add(G.box,'#fff0c8',place(0,1.55,0),[.55,2.7,.09],[0,0,-a]);
    m.add(G.box,millColors[i],place(0,2.62,.048),[.55,.52,.012],[0,0,-a]);
    for(const side of [-1,1])m.add(G.box,'#bb9366',place(side*.25,1.52,.065),[.043,2.77,.055],[0,0,-a]);
    for(let j=0;j<6;j++)m.add(G.box,'#bd9568',place(0,.38+j*.41,.073),[.55,.038,.044],[0,0,-a]);
    m.add(G.box,'#a77f57',place(0,1.45,.08),[.065,3,.04],[0,0,-a]);
  }
  m.add(G.round,'#e8c482',[0,0,.05],[.27,.27,.08]);return m;
}

export function duckModel() {
  const m = new WorldModel();
  m.add(G.round, '#ffdd7c', [0, .35, 0], [.55, .35, .36]);
  m.add(G.round, '#ffe8a3', [.38, .72, 0], [.27, .29, .26]);
  m.add(G.box, '#e9964f', [.65, .68, 0], [.3, .09, .24]);
  for (const z of [-.23, .23]) m.add(G.round, '#455251', [.48, .8, z], [.035, .045, .025]);
  m.add(G.round, '#efc866', [-.1, .46, .28], [.3, .18, .1]);
  m.add(G.round,'#fbe2a0',[-.53,.42,0],[.26,.15,.18],[0,0,-.2]);
  return m;
}
