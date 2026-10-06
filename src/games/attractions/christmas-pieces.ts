import { chimneyHouse } from './chimney-house';
import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { christmasLayout, isChristmasKind } from '../christmas-rails';
import type { MiniSection } from '../mini-track';
import type { FairgroundLights } from '../world-lighting';
import { ChristmasBuilder, C, star, gift, chalet, sparkles, nearest, railLights } from './christmas-builder';

import { treeLandmark, snowmanLandmark, globeLandmark } from './christmas-landmarks';

const TAU=Math.PI*2;
const V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const clamp=T.MathUtils.clamp;

const treePiece=treeLandmark;

/** A snowball shell with a real bore along X. The hole has no hidden solid
 * sphere inside it, and the gold mouth frames are placed beyond the shell. */
export function tunnelSnowball(radius:number,centerY:number,tunnelY:number,bore:number){
  const g=new T.SphereGeometry(radius,24,14),p=g.getAttribute('position'),indices:number[]=[];
  const index=g.index!;
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    // Keep only facets outside the bore; whole-triangle removal leaves a
    // slightly generous faceted opening rather than any clipping triangles.
    const clear=ids.some(k=>Math.hypot(p.getY(k)+centerY-tunnelY,p.getZ(k))<bore);
    if(!clear)indices.push(...ids);
  }
  g.setIndex(indices);g.computeVertexNormals();return g;
}
const snowmanPiece=snowmanLandmark;

function ribbonPiece(v:ChristmasBuilder,s:MiniSection){
  const m=new WorldModel(),w=s.width,h=s.amplitude,oy=s.origin.y,cz=s.hand*15;
  chalet(m,w*.5,0,cz,2.8);
  const knotY=oy+h*.63;
  m.add(G.ring,C.gold,[w*.5,knotY+2,cz],[1.05,1.05,1.05],[],true);
  // A snowy workshop with an oversized wreath and wrapping bench.
  m.add(G.ring,C.green,[w*.5,5.6,cz+s.hand*3.55],[1.2,1.2,1.2]);
  star(m,w*.5,5.6,cz+s.hand*3.7,.6);
  m.add(G.box,C.wood,[w*.5,1.7,cz+s.hand*5.3],[6,.25,1.4]);
  for(const dx of [-2.6,2.6])m.add(G.box,C.gold,[w*.5+dx,.85,cz+s.hand*5.3],[.18,1.7,.8]);
  const spools=new WorldModel(),r=h*.24;
  spools.add(G.pole,C.red,[0,0,0],[r*.72,3.6,r*.72],[Math.PI/2,0,0]);
  for(const z of [-2,2]){
    spools.add(G.pole,C.wood,[0,0,z],[r,.4,r],[Math.PI/2,0,0]);
    spools.add(G.ring,C.gold,[0,0,z+Math.sign(z)*.23],[r*.92,r*.92,r*.92]);
    for(let i=0;i<8;i++){const a=i*TAU/8;spools.beam('#bc9771',V(0,0,z+.25),V(Math.sin(a)*r*.8,Math.cos(a)*r*.8,z+.25),.15);}
    star(spools,0,0,z+Math.sign(z)*.3,r*.35);
  }
  const reelPool=v.pool(spools,2);reelPool[0].name='train-driven-ribbon-reels';
  // A gold-edged red ribbon hugs the REAL bow rails. No fake decorative bow.
  const ribbon:T.Vector3[]=[];
  for(let i=0;i<s.frames.length;i+=12){
    const f=s.frames[i],p=f.position.clone().sub(V(s.origin.x,0,s.origin.z)).addScaledVector(f.up,-.35);
    ribbon.push(p);
  }
  for(let i=1;i<ribbon.length;i++)m.beam(C.red,ribbon[i-1],ribbon[i],.25);
  // Ribbon tails from the reel to the workbench, safely below the route.
  for(const side of [-1,1]){
    const x=w*(side<0?.28:.72),y=oy+h*.28;
    const path=[V(x,y,cz),V(x+side*5,2,cz),V(w*.5+side*4,1.8,cz+4)];
    for(let i=1;i<path.length;i++)m.beam(C.red,path[i-1],path[i],.38);
    m.add(G.pole,C.gold,[x,y,cz],[.4,5,.4],[Math.PI/2,0,0]);
    for(const dz of [-2.8,2.8]){m.beam(C.wood,V(x-2,0,cz+dz),V(x,y,cz+dz),.28);m.beam(C.wood,V(x+2,0,cz+dz),V(x,y,cz+dz),.28);}
    for(let i=0;i<4;i++)gift(m,x+(i-1.5)*1.2,0,cz+s.hand*4,.9,i%2?C.green:C.red);
  }
  const elf=new WorldModel();elf.add(G.round,'#ffd5b1',[0,1.3,0],[.36,.43,.35]);elf.add(G.cone,C.green,[0,1.93,0],[.55,.85,.55]);
  elf.add(G.round,C.cream,[.28,2.24,0],[.1,.1,.1],[],true);elf.add(G.box,C.green,[0,.6,0],[.65,.95,.55]);
  for(const dx of [-.21,.21]){elf.add(G.round,C.dark,[dx,1.4,.32],[.055,.08,.045]);elf.add(G.box,C.red,[dx,.04,.13],[.3,.18,.5]);}
  const elves=v.pool(elf,3);
  railLights(m,s);v.festive(m);
  const layout=christmasLayout('ribbonreel',w,h,s.hand),sparkle=sparkles(v,s,layout.landmarks);
  let lastTime=0,lastDistance=s.start,spin=0,velocity=0;
  v.animate((time,distance,reduced)=>{
    const dt=clamp(time-lastTime,0,.1),travel=distance-lastDistance;
    if(time<lastTime||travel<0){spin=0;velocity=0;}
    else if(dt>0){const engaged=distance>s.start&&distance<s.end;velocity=engaged?clamp(travel/dt*.038,0,3):velocity*Math.exp(-dt*.85);spin+=velocity*dt;}
    lastTime=time;lastDistance=distance;
    for(let i=0;i<2;i++)v.place(reelPool,i,w*(i?.72:.28),oy+h*.28,cz,1,0,0,reduced?0:spin*(i?-1:1));
    for(let i=0;i<3;i++)v.place(elves,i,w*.5+(i-1)*1.6,1.1+(reduced?0:Math.max(0,Math.sin(time*5+i))*Math.min(velocity,.4)),cz+s.hand*4.3,1,0,s.hand<0?Math.PI:0,reduced?0:Math.sin(time*3+i)*.08);
    sparkle(time,distance,reduced);
  });
}

const globePiece=globeLandmark;

export function createChristmasPiece(s:MiniSection,material:T.Material,lights:FairgroundLights){
  if(!isChristmasKind(s.kind))return;
  const v=new ChristmasBuilder(material,lights);v.group.name=s.kind+'-christmas-attraction';
  switch(s.kind){
    case 'chimneyhouse':chimneyHouse(v,s);break;
    case 'startree':treePiece(v,s);break;
    case 'snowmanscarf':snowmanPiece(v,s);break;
    case 'ribbonreel':ribbonPiece(v,s);break;
    case 'snowglobe':globePiece(v,s);break;
  }
  v.update(0,s.start-100,true);return v;
}
