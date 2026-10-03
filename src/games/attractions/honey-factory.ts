import * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { FairgroundLights } from '../world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { PieceBuilder, at, arrival, type InstancePool } from './piece-builder';

const TAU=Math.PI*2;

const clamp=T.MathUtils.clamp;

const smooth=(x:number)=>{const v=clamp(x,0,1);return v*v*(3-2*v);};

// Articulated wings bend about their owner's local X axis. Reused scratch
// transforms keep the correct hinge order without allocating during update.

const jointEuler=new T.Euler(),jointBody=new T.Quaternion(),jointBend=new T.Quaternion(),jointAxis=new T.Vector3(1,0,0);

function placeWing(v:PieceBuilder,pool:InstancePool,index:number,x:number,y:number,z:number,size:number,yaw:number,roll:number,bend:number){
 jointBody.setFromEuler(jointEuler.set(0,yaw,roll)).multiply(jointBend.setFromAxisAngle(jointAxis,bend));jointEuler.setFromQuaternion(jointBody);
 v.place(pool,index,x,y,z,size,jointEuler.x,jointEuler.y,jointEuler.z);
}

function finish(v:PieceBuilder,s:MiniSection){v.update(0,s.start-100,true);return v;}


function bee(){
 const m=new WorldModel();m.add(G.round,'#ebc772',[0,0,0],[.74,.44,.43]);
 for(const x of [-.37,0,.36])m.add(G.pole,'#8e7c65',[x,0,0],[.435,.14,.435],[0,0,Math.PI/2]);
 m.add(G.round,'#f2d489',[.69,.07,0],[.38,.4,.38]);
 for(const z of [-.26,.26]){m.add(G.round,'#fff3cf',[.89,.21,z],[.12,.15,.075]);m.add(G.rock,'#5e6058',[.95,.23,z*1.13],[.05,.07,.035]);}
 m.add(G.cone,'#9b8264',[-.89,0,0],[.15,.4,.15],[0,0,-Math.PI/2]);
 for(const side of [-1,1]){m.beam('#8e7c65',new T.Vector3(.73,.32,side*.16),new T.Vector3(.93,.67,side*.28),.035);m.add(G.round,'#d6a6bf',[.93,.67,side*.28],[.09,.09,.09]);}
 m.add(G.box,'#bba9cc',[-.29,-.32,.35],[.51,.43,.14]);m.add(G.box,'#f2e0b5',[-.29,-.29,.434],[.3,.15,.03]);return m;
}

export function createHoneyFactory(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new PieceBuilder(material,lights),m=new WorldModel(),x=s.width*.5,cy=s.origin.y+s.amplitude,z=Math.min(0,s.shift)-7.2;
 m.beam('#93ac79',new T.Vector3(x,0,z),new T.Vector3(x,cy,z),.45);
 for(const side of [-1,1]){
  m.add(G.rock,'#a2bf84',[x+side*2.05,cy*.45,z],[2.5,.63,1.05],[0,0,side*.4]);
  m.add(G.pole,'#dec288',[x+side*6,1.3,z],[2.45,2.6,2.45]);
  for(let i=0;i<3;i++)m.add(G.pole,i%2?'#e8ce91':'#e1bd7b',[x+side*6,2.75+i*.44,z],[2.2-i*.4,.46,2.2-i*.4]);
  m.add(G.round,'#a38765',[x+side*6,.92,z+2.18],[.55,.67,.14]);
  m.add(G.round,'#f4d9a1',[x+side*6,4.14,z],[.31,.3,.31]);
  m.beam('#dac283',new T.Vector3(x+side*.75,cy*.4,z),new T.Vector3(x+side*6,5.1,z),.15);
  m.beam('#dac283',new T.Vector3(x+side*6,5.1,z),new T.Vector3(x+side*6,5.1,z+4.6),.15);
  m.beam('#dac283',new T.Vector3(x+side*6,5.1,z+4.6),new T.Vector3(x+side*6,4.55,z+4.6),.15);
 }
 m.add(G.pole,'#dfb975',[x,cy,z],[2.55,.55,2.55],[Math.PI/2,0,0]);m.add(G.pole,'#ecc985',[x,cy,z+.32],[2.27,.12,2.27],[Math.PI/2,0,0]);
 for(const side of [-1,1]){m.add(G.round,'#fff1c8',[x+side*.79,cy+.45,z+.52],[.4,.51,.16]);m.add(G.round,'#706e59',[x+side*.79,cy+.42,z+.67],[.16,.24,.07]);m.add(G.round,'#e4a993',[x+side*1.28,cy-.35,z+.5],[.33,.19,.09]);}
 m.add(G.round,'#a68b61',[x,cy-.81,z+.5],[.48,.13,.07]);
 const petals=new WorldModel();
 for(let i=0;i<12;i++){const a=i*TAU/12;petals.add(G.round,i%2?'#efd387':'#e9c375',[Math.sin(a)*3.38,Math.cos(a)*3.38,0],[.95,1.85,.3],[0,0,-a]);}
 const jar=new WorldModel(),jarWall=new T.CylinderGeometry(.66,.66,1.3,12,1,true);jar.add(jarWall,'#e3b778',[0,.65,0]);jarWall.dispose();
 jar.add(G.ring,'#efcf99',[0,1.3,0],[.64,.64,.64],[Math.PI/2,0,0]);jar.add(G.pole,'#aa855e',[0,.05,0],[.64,.1,.64]);
 jar.add(G.box,'#f4e3b8',[0,.67,.64],[.65,.48,.06]);jar.add(G.rock,'#a4b887',[0,.67,.7],[.16,.18,.035]);
 const fill=new WorldModel();fill.add(G.pole,'#eebe62',[0,0,0],[.585,.05,.585]);
 const wing=new WorldModel();wing.add(G.round,'#dce8d9',[0,.28,0],[.5,.38,.1]);wing.add(G.rock,'#f4efce',[-.14,.43,.07],[.2,.12,.025]);
 for(const side of [-1,1]){m.add(G.pole,'#a9b5a2',[x+side*6,.17,z+3.8],[2.6,.28,1.8]);for(const dx of [-1.9,1.9])m.add(G.pole,'#c2a573',[x+side*6+dx,.16,z+3.8],[.12,.32,.12]);}
 const drop=new WorldModel();drop.add(G.round,'#f2cc74',[0,0,0],[.16,.3,.16]);
 const flowers=v.pool(petals,1),bees=v.pool(bee(),5),jars=v.pool(jar,6),drops=v.pool(drop,12),wings=v.pool(wing,10),fills=v.pool(fill,6);
 bees[0].name="honey-delivery-bees";wings[0].name="delivery-bee-wings";jars[0].name="indexed-honey-jars";drops[0].name="honey-streams";fills[0].name="honey-fill-levels";v.batch(m);
 const stop=at(s,.5);
 v.animate((time,distance,reduced)=>{
  const greet=arrival(distance,stop,s.length*.5),travel=clamp(distance-s.start,0,s.length+30),turn=reduced?0:time*.15+travel*.028;
  v.place(flowers,0,x,cy,z-.22,1+(reduced?0:greet*.045*Math.sin(time*3)),0,0,turn*.6);
  for(let i=0;i<5;i++){
   const side=i%2?-1:1,phase=i*TAU/5+turn*.9,a=phase+.28*Math.sin(phase);
   // Nectar couriers make tall delivery circuits from flower to hive roof;
   // their shallow lower arc slows naturally for the drop-off.
   const bx=x+side*(6+Math.sin(a)*2.4),by=5+(cy-3)*(.5+.5*Math.cos(a)),bz=z+2.2+Math.sin(a+.8)*1.15;
   // Depth is phase-shifted so a courier can smoothly turn at the top and
   // bottom, instead of abruptly flipping its yaw at a vertical tangent.
   const dx=side*2.4*Math.cos(a),dy=-(cy-3)*.5*Math.sin(a),dz=1.15*Math.cos(a+.8),yaw=Math.atan2(-dz,dx),roll=Math.atan2(dy,Math.hypot(dx,dz))*.48;
   v.place(bees,i,bx,by,bz,.95,0,yaw,roll);
   for(let j=0;j<2;j++){
    const wingSide=j?1:-1,flap=reduced?.25:.25+.6*Math.sin(time*18+i),lx=(-.13*Math.cos(roll)-.25*Math.sin(roll))*.95,ly=(-.13*Math.sin(roll)+.25*Math.cos(roll))*.95,lz=wingSide*.31*.95;
    placeWing(v,wings,i*2+j,bx+lx*Math.cos(yaw)+lz*Math.sin(yaw),by+ly,bz-lx*Math.sin(yaw)+lz*Math.cos(yaw),.95,yaw,roll,wingSide*flap);
   }
  }
  // A three-position indexing table dwells under each tap, then advances.
  const clock=reduced?0:time*.24+travel*.018,step=Math.floor(clock),u=clock-step,index=smooth((u-.74)/.26);
  for(let i=0;i<6;i++){
   const side=i<3?-1:1,j=i%3,a=(step+index+j)*TAU/3,px=x+side*6+Math.sin(a)*1.65,pz=z+3.8+Math.cos(a)*.8;
   v.place(jars,i,px,.32,pz,.82);
   const station=(step+j)%3,level=station===0?clamp(u/.7,0,1):station===1?1:.04;
   v.place(fills,i,px,.32+(.15+level*1.08)*.82,pz,.82);
  }
  for(let i=0;i<12;i++){
   const side=i%2?-1:1,t=reduced?(i%6)/6:(time*1.05+i/12)%1,pouring=!reduced&&u<.68;
   v.place(drops,i,x+side*6,4.5-t*3.05,z+4.6,pouring?.6+greet*.4:.001);
  }
 });return finish(v,s);
}

/** Six complete, independent alternatives; production proposal A is untouched. */
