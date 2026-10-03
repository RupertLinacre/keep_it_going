import * as T from "three";
import { nightBackground } from "./background-night";
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function nightScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number,variant?:number) {
  nightBackground(m,x,back,front,r,variant);
}

export function lanternParade(m:WorldModel,section:MiniSection) {
  for(let i=0;i<7;i++) {
    const f=section.sample(lanternDistance(section,i));
    const center=f.position.clone();center.x-=section.origin.x;center.z-=section.origin.z;
    const h=center.y+5.5;
    for(const side of [-1,1]){
      const p=center.clone().addScaledVector(f.right,side*4.4);
      m.add(G.pole,'#9675b0',[p.x,h/2,p.z],[.18,h,.18]);
      m.add(G.pole,'#e8c489',[p.x,.3,p.z],[.58,.6,.58]);
      // Candy-striped columns and little petal lanterns give each gate a face.
      for(let j=0;j<5;j++)m.add(G.pole,BULBS[(i+j)%4],[p.x,h*(j+.5)/5,p.z],[.23,.3,.23]);
      for(let j=0;j<5;j++){
        const a=j*Math.PI*2/5;
        m.add(G.rock,BULBS[i%4],[p.x+Math.sin(a)*.5,h+.2+Math.cos(a)*.5,p.z],[.32,.38,.24],[],true,i*.7+j*.1);
      }
      m.add(G.round,'#fff0b1',[p.x,h+.2,p.z+.2],[.26,.26,.2],[],true,i*.7);
      star(m,p.x,h+1.3,p.z,.48,'#ffe29c');
    }
    // The train passes through seven colourful prosceniums. Every pendant is
    // at least four metres above the sampled rail; the mascot floats above it.
    let previous:T.Vector3|undefined;
    for(let j=0;j<=12;j++){
      const p=center.clone().addScaledVector(f.right,(j/12-.5)*8.8);p.y=h+.9-Math.sin(j*Math.PI/12)*.65;
      if(previous)m.beam('#8d83ad',previous,p,.04);
      m.add(j%2?G.rock:G.round,BULBS[(i+j)%4],p.toArray(),[.22,.22,.22],[],true,i*.8+j*.35);
      if(j%2===0){m.add(G.cone,BULBS[(i+j)%4],[p.x,p.y-.5,p.z],[.34,.7,.08],[0,0,Math.PI]);}
      previous=p;
    }
    // A second scallop makes a shallow theatrical arch instead of a lone wire.
    const a=center.clone().addScaledVector(f.right,-4.4),b=center.clone().addScaledVector(f.right,4.4);
    a.y=b.y=h-.2;m.beam('#d8b0b9',a,b,.07);
    // Broad rainbow ribbons turn the thin garlands into recognisable gateways.
    for(let band=0;band<3;band++) {
      const positions:number[]=[];
      for(let j=0;j<20;j++) {
        const quad:number[][]=[];
        for(const [t,edge]of [[j/20,0],[(j+1)/20,0],[(j+1)/20,1],[j/20,1]]) {
          const p=center.clone().addScaledVector(f.right,(t-.5)*8.8);
          p.y=h+.45+Math.sin(t*Math.PI)*1.8+band*.22+edge*.17;
          quad.push(p.toArray());
        }
        positions.push(...quad[0],...quad[1],...quad[2],...quad[0],...quad[2],...quad[3]);
        positions.push(...quad[2],...quad[1],...quad[0],...quad[3],...quad[2],...quad[0]);
      }
      const ribbon=new T.BufferGeometry();ribbon.setAttribute('position',new T.Float32BufferAttribute(positions,3));ribbon.computeVertexNormals();
      m.add(ribbon,BULBS[(band+i)%4],[0,0,0]);ribbon.dispose();
    }
    for(const side of [-1,1]){
      const p=center.clone().addScaledVector(f.right,side*4.4);
      m.add(G.cone,BULBS[(i+1)%4],[p.x,1.3,p.z],[.75,1.6,.75]);
      m.add(G.rock,'#ffe2ae',[p.x,2.2,p.z],[.3,.3,.3],[],true,i*.7);
    }
  }
}

export const lanternDistance=(section:MiniSection,index:number)=>section.start+section.length*(.06+index*.146);

const BULBS = ['#ffc876', '#ed97c6', '#9cdfd4', '#b8a3f5'];

/** Keep a ribbon of reactive lamps beside the rails between signature rides. */
export function tracksideLights(m:WorldModel,section:MiniSection) {
  const steps=Math.min(120,Math.ceil(section.length/4));
  for(let i=0;i<=steps;i++){
    const f=section.sample(section.start+section.length*i/steps);
    for(const side of [-1,1]){
      const p=f.position.clone().addScaledVector(f.right,side*1.65).addScaledVector(f.up,-.3);
      p.x-=section.origin.x;p.z-=section.origin.z;
      m.add(G.round,BULBS[Math.floor(i/4)%4],p.toArray(),[.18,.18,.18],[],true,i*.3);
    }
  }
}

export function marqueeLoop(m: WorldModel, section: MiniSection) {
  const previous: (T.Vector3|undefined)[]=[];
  for (let i = 0; i <= 72; i++) {
    const f = section.sample(section.start + section.length * i / 72);
    for(let side=0;side<2;side++){
      const p = f.position.clone().addScaledVector(f.up, -1.55).addScaledVector(f.right,(side-.5)*3.6);
      p.x -= section.origin.x; p.z -= section.origin.z;
      if (previous[side]) m.beam('#886cac', previous[side]!, p, .11);
      m.add(i%2?G.rock:G.round, BULBS[(Math.floor(i / 4)+side) % 4], p.toArray(), [.25, .25, .25], [], true, i * .25+side*.7);
      if (i % 4 === 0) {
        m.beam('#d8b382',p,p.clone().addScaledVector(f.up,.8),.065);
        if(side===1)star(m,p.x,p.y,p.z+.1,.48,BULBS[Math.floor(i/4)%4]);
      }
      previous[side]=p;
    }
  }
  const top = section.frames[Math.round(section.resolution / 2)].position;
  const x = top.x - section.origin.x, y = top.y + 5.8, z = top.z - section.origin.z;
  // A big smiling sun is a landmark above the loop, outside the train envelope.
  // The rays belong to the small reactive animation pool and fan out at the apex.
  m.add(G.round,'#ffdc8e',[x,y,z],[1.94,1.94,.46],[],true);
  for(const side of [-1,1]){
    m.add(G.round,'#62527f',[x+side*.65,y+.29,z+.43],[.15,.25,.1]);
    m.add(G.round,'#f397b0',[x+side*1.12,y-.28,z+.42],[.31,.19,.09]);
  }
  m.add(G.round,'#805784',[x,y-.58,z+.45],[.54,.34,.06]);
  m.add(G.round,'#ffdc8e',[x,y-.38,z+.51],[.56,.29,.06],[],true);
  // Twin ribbon towers frame the complete inversion without entering its plane.
  const xs=section.frames.map(f=>f.position.x-section.origin.x);
  for(const [side,tx]of [[-1,Math.min(...xs)-3.5],[1,Math.max(...xs)+3.5]]){
    const tz=section.shift/2;
    m.add(G.pole,'#a178ad',[tx,4,tz],[.38,8,.38]);
    m.add(G.pole,'#e9bc87',[tx,.4,tz],[1,.8,1]);
    for(let j=0;j<5;j++)m.add(G.pole,BULBS[j%4],[tx,1.3+j*1.4,tz],[.43,.4,.43]);
    m.add(G.cone,'#db8dbe',[tx,8.4,tz],[1.05,1.7,1.05]);
    star(m,tx,9.8,tz,.85,'#ffe0a0');
    m.add(G.box,BULBS[side===-1?1:2],[tx+side*.7,7,tz],[1.2,.65,.07],[0,0,side*.15]);
    // A theatrical fan on each tower carries the same colours as the sun.
    for(let j=0;j<5;j++) {
      const a=(j-2)*.3;
      m.add(G.cone,BULBS[j%4],[tx+Math.sin(a)*1.5,8.4+Math.cos(a)*1.4,tz-.2],[.27,1.5,.1],[0,0,-a]);
    }
  }
}

export function star(m: WorldModel, x: number, y: number, z: number, size: number, color: string) {
  const vertices: number[] = [];
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,b=(i+1)*Math.PI/5,r=i%2?.44:1,s=(i+1)%2?.44:1;
    vertices.push(0,0,0, -Math.sin(a)*r,Math.cos(a)*r,0, -Math.sin(b)*s,Math.cos(b)*s,0);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
  m.add(g,color,[x,y,z],[size,size,size],[],true);g.dispose();
}

export function carouselCenter(section: MiniSection) {
  const radius=section.width*.12;
  return {x:section.width*.2+radius*.325,z:section.hand*radius,radius:radius-2.7};
}
/** Match the engine's actual angular position about the carousel, including
 * either handedness and the small lateral drift in the ascending helix. */
export function carouselRotation(section: MiniSection, distance: number) {
  const {x,z}=carouselCenter(section);
  const first=section.start+section.distances[Math.round(section.resolution*.1)];
  const last=section.start+section.distances[Math.round(section.resolution*.78)];
  const p=section.sample(T.MathUtils.clamp(distance,first,last)).position;
  return Math.atan2(p.x-section.origin.x-x,p.z-section.origin.z-z);
}
/** The helix drifts laterally, so its nominal radius is not its inner clearance. */
export function carouselRideRadius(section:MiniSection) {
  const {x,z}=carouselCenter(section);
  let nearest=Infinity;
  for(let i=Math.round(section.resolution*.1);i<=Math.round(section.resolution*.78);i++){
    const p=section.frames[i].position;
    nearest=Math.min(nearest,Math.hypot(p.x-section.origin.x-x,p.z-section.origin.z-z));
  }
  return Math.max(.6,nearest-1.8);
}
export function carouselClimb(m: WorldModel, section: MiniSection) {
  const {x,z}=carouselCenter(section),radius=carouselRideRadius(section);
  m.add(G.pole,'#ac88a0',[x,.8,z],[radius,1.6,radius]);
  m.add(G.pole,'#dfc098',[x,1.55,z],[radius,.25,radius]);
  // The three storeys, animals and roof belong to one bounded moving assembly.
  // Its footprint leaves 1.8m between every rail centre and every spinning part.
  for(let i=0;i<70;i++){
    const f=section.sample(section.start+section.length*i/69),p=f.position.clone().addScaledVector(f.right,1.25).addScaledVector(f.up,-.25);
    m.add(i%2?G.rock:G.round,BULBS[Math.floor(i/5)%4],[p.x-section.origin.x,p.y,p.z-section.origin.z],[.19,.19,.19],[],true,i*.3);
  }
}

export function carouselModel() {
  const m=new WorldModel();
  // Six round little horses on their brass poles, all batched into one moving ride.
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,x=Math.sin(a)*2.7,z=Math.cos(a)*2.7;
    // Contrasting spokes make the one-to-one rotation easy to see from above.
    m.add(G.box,i%2?'#eec27d':'#cf8bb8',[Math.sin(a)*1.7,1.85,Math.cos(a)*1.7],[.22,.12,3.3],[0,a,0]);
    m.add(G.pole,'#efd2a0',[x,3.4,z],[.07,4.8,.07]);
    const color=i%2?'#ecd0c3':'#c5e3db';
    m.add(G.round,color,[x,3,z],[.75,.42,.35],[0,-a,0]);
    m.add(G.round,color,[x+Math.cos(a)*.5,3.6,z+Math.sin(a)*.5],[.23,.55,.25],[0,-a,-.25]);
    m.add(G.round,'#e7ba71',[x,3.3,z],[.3,.14,.37],[0,-a,0]);
    for(const dx of [-.5,.5])m.add(G.box,color,[x+Math.cos(a)*dx,2.6,z+Math.sin(a)*dx],[.13,.6,.2],[0,-a,-.15]);
  }
  return m;
}

export function gondolaModel() {
  const m=new WorldModel();
  m.add(G.box,'#e9b686',[0,0,0],[.95,.6,.8]);
  m.add(G.box,'#adcfe0',[0,.55,0],[.85,.65,.75]);
  m.add(G.cone,'#cb8cab',[0,1.02,0],[.85,.45,.8],[0,Math.PI/4,0]);
  return m;
}
