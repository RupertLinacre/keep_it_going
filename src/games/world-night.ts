import * as T from "three";
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function nightScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number) {
  m.add(G.round,'#394660',[x,-2,back-13],[23,8+r()*7,15]);
  m.add(G.round,'#28364e',[x+10,-3,back-32],[28,15+r()*8,18]);
  // Pools reflect a ribbon of lantern colours.
  m.add(G.round,'#284969',[x,-.06,front+8],[11,.25,4]);
  for(let i=0;i<12;i++)m.add(G.box,i%2?'#b8a7f2':'#7bdbc8',[x-8+i*1.4,.18,front+6+r()*4],[.5+r(),.025,.06],[],true,i*.6);
  for(let i=0;i<20;i++){
    const sx=x-17+r()*34,sy=8+r()*21,sz=back-5-r()*16;
    m.add(G.round,i%4?'#97bad8':'#ffe8b8',[sx,sy,sz],[.065,.065,.065],[],true);
    if(i%7===0){
      m.add(G.box,'#d9f4e7',[sx,sy,sz],[.5,.05,.05],[],true);
      m.add(G.box,'#d9f4e7',[sx,sy,sz],[.05,.5,.05],[],true);
    }
  }
  // Mushroom lamps: warm tops, mint stems, a patch of soft light underneath.
  for(let i=0;i<6;i++){
    const lx=x-12+r()*24,lz=front+r()*6,h=.8+r();
    m.add(G.pole,'#82aaad',[lx,h*.5,lz],[.12,h,.12]);
    m.add(G.round,i%2?'#f5b98e':'#ab9ee4',[lx,h,lz],[.7,.35,.7],[],true,i*.5);
    m.add(G.round,'#547275',[lx,.05,lz],[1.7,.055,1.4]);
  }
  if(r()<.3){
    const fx=x-6,fz=front+6;
    m.add(G.pole,'#736589',[fx,.24,fz],[2.8,.45,2.8]);
    m.add(G.pole,'#6283a0',[fx,.48,fz],[2.5,.08,2.5]);
    for(let j=0;j<6;j++){
      const a=j*Math.PI/3;let previous=new T.Vector3(fx,.5,fz);
      for(let k=1;k<=10;k++){
        const t=k/10,p=new T.Vector3(fx+Math.sin(a)*2.3*t,.5+Math.sin(t*Math.PI)*2.3,fz+Math.cos(a)*2.3*t);
        m.beam(BULBS[j%4],previous,p,.055,true,j*.6-k*.35);previous=p;
      }
    }
    m.add(G.ring,'#b29ae3',[fx,.52,fz],[2.55,2.55,2.55],[Math.PI/2,0,0],true);
  }
  // Candy-floss and ticket booths along the midway, below the sightline.
  if(r()<.65){
    const bx=x-7,bz=back+5;
    m.add(G.box,'#bd83a1',[bx,1.5,bz],[4.2,3,2.7]);
    m.add(G.box,'#ffe4b7',[bx,2,bz+1.4],[3.4,1.2,.08],[],true);
    m.add(G.box,'#e1bda1',[bx,1.2,bz+1.6],[4.5,.22,.65]);
    for(let i=0;i<6;i++)m.add(G.box,i%2?'#f0c99d':'#bd769d',[bx-1.8+i*.72,3.15,bz+1.4],[.71,.6,1.3],[.2,0,0]);
    star(m,bx,4.15,bz+1.5,.7,'#ffdf9c');
    for(const dx of [-1.8,1.8])m.add(G.round,'#e2b3d3',[bx+dx,2.5,bz+1.55],[.28,.4,.28]);
  }
  // A tiny striped fairground pavilion.
  if(r()<.55){
    const px=x+8,pz=back+2;
    m.add(G.pole,'#736789',[px,2,pz],[.2,4,.2]);
    m.add(G.cone,'#b57caf',[px,3.7,pz],[3.4,2.5,3.4]);
    for(const dx of [-2.4,2.4])for(const dz of [-1.7,1.7])m.add(G.pole,'#edc5ac',[px+dx,1.5,pz+dz],[.095,3,.095]);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;m.add(G.round,i%2?'#ffd994':'#8fe9d6',[px+Math.sin(a)*3.3,2.55,pz+Math.cos(a)*3.3],[.16,.16,.16],[],true)}
    m.add(G.round,'#e7d597',[px,5.2,pz],[.35,.5,.35],[],true);
  }
  for(let i=0;i<5;i++){
    const tx=x-15+i*7,tz=back+3;
    m.add(G.pole,'#41627b',[tx,2,tz],[.19,4,.19]);
    m.add(G.round,'#526c85',[tx,4.3,tz],[1.6,2.1,1.6]);
    m.add(G.round,'#8be0d0',[tx+.55,4.5,tz+1.3],[.11,.11,.11],[],true);
    m.add(G.round,'#e3b9de',[tx-.4,5.1,tz+1.2],[.11,.11,.11],[],true);
  }
}

export function lanternParade(m:WorldModel,section:MiniSection) {
  for(let i=0;i<7;i++) {
    const f=section.sample(section.start+section.length*(.06+i*.146));
    const center=f.position.clone();center.x-=section.origin.x;center.z-=section.origin.z;
    const h=center.y+4.2;
    for(const side of [-1,1]){
      const p=center.clone().addScaledVector(f.right,side*3.6);
      m.add(G.pole,'#ac91b5',[p.x,h/2,p.z],[.11,h,.11]);
      m.add(G.round,BULBS[i%4],[p.x,h+.35,p.z],[.4,.62,.4],[],true,i*.7);
    }
    // A high scalloped light garland: plenty of headroom for flying coaches.
    let previous:T.Vector3|undefined;
    for(let j=0;j<=12;j++){
      const p=center.clone().addScaledVector(f.right,(j/12-.5)*7.2);p.y=h+2.2-Math.sin(j*Math.PI/12)*.65;
      if(previous)m.beam('#8d83ad',previous,p,.04);
      m.add(G.round,BULBS[(i+j)%4],p.toArray(),[.18,.18,.18],[],true,i*.8+j*.35);
      if(j%3===0){m.add(G.cone,BULBS[(i+j)%4],[p.x,p.y-.45,p.z],[.3,.65,.06],[0,0,Math.PI]);}
      previous=p;
    }
  }
}

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
  let previous: number[] | undefined;
  for (let i = 0; i <= 100; i++) {
    const f = section.sample(section.start + section.length * i / 100);
    const p = f.position.clone().addScaledVector(f.up, -1.05); p.x -= section.origin.x; p.z -= section.origin.z;
    if (previous) m.beam('#646a9d', new T.Vector3(...previous), p, .14);
    m.add(G.round, BULBS[Math.floor(i / 6) % 4], p.toArray(), [.23, .23, .23], [], true, i * .28);
    if (i % 5 === 0) m.beam('#807aab', p, p.clone().addScaledVector(f.up, .85), .055);
    previous = p.toArray();
  }
  const top = section.frames[Math.round(section.resolution / 2)].position;
  const x = top.x - section.origin.x, y = top.y + 3, z = top.z - section.origin.z;
  star(m, x, y, z, 1.6, '#ffdb92');
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
export function carouselClimb(m: WorldModel, section: MiniSection) {
  const {x,z,radius}=carouselCenter(section);
  m.add(G.pole,'#ac88a0',[x,1,z],[radius+1,2,radius+1]);
  m.add(G.pole,'#dfc098',[x,1.9,z],[radius+1.1,.25,radius+1.1]);
  m.add(G.pole,'#b2a6d2',[x,5.1,z],[.32,6.4,.32]);
  // Alternating triangular canopy panels, rather than a single solid cone.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6,r=radius+1;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,10,0,Math.sin(a)*r,7,Math.cos(a)*r,Math.sin(b)*r,7,Math.cos(b)*r],3));g.computeVertexNormals();
    m.add(g,i%2?'#dab392':'#ac6ca3',[x,0,z]);g.dispose();
    m.add(G.round,BULBS[i%4],[x+Math.sin(a)*r,7,z+Math.cos(a)*r],[.23,.23,.23],[],true,i*.6);
  }
  star(m,x,11,z,1.1,'#ffe29c');
  for(let i=0;i<70;i++){
    const f=section.sample(section.start+section.length*i/69),p=f.position.clone().addScaledVector(f.right,1.25).addScaledVector(f.up,-.25);
    m.add(G.round,BULBS[Math.floor(i/5)%4],[p.x-section.origin.x,p.y,p.z-section.origin.z],[.17,.17,.17],[],true,i*.3);
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
