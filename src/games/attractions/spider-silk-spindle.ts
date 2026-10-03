import * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { PieceAnimation } from '../piece-animation';
import type { FairgroundLights } from '../world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { PieceBuilder, at, arrival } from './piece-builder';
import { witchHatCenter } from '../world-halloween';

const cream='#fff0ce',mint='#b6e5b4',violet='#a18ac9',pink='#eeadc5',gold='#e6bc79',ink='#564263';

const colors=[violet,mint,pink,gold];

function face(m:WorldModel,x:number,y:number,z:number,size=1){
 for(const side of [-1,1]){m.add(G.round,cream,[x+side*.35*size,y,z],[.24*size,.3*size,.1*size]);m.add(G.round,ink,[x+side*.35*size,y,z+.09*size],[.09*size,.15*size,.06*size]);m.add(G.round,pink,[x+side*.6*size,y-.26*size,z],[.16*size,.09*size,.06*size]);}
 m.add(G.round,ink,[x,y-.36*size,z],[.19*size,.07*size,.05*size]);
}

function bone(m:WorldModel,a:T.Vector3,b:T.Vector3,r=.16,color=cream){m.beam(color,a,b,r);for(const p of [a,b])m.add(G.round,color,p.toArray(),[r*1.5,r*1.5,r*1.5]);}

function silkSpindle(s:MiniSection,v:PieceBuilder){
 const c=witchHatCenter(s),r=Math.max(2.4,c.radius-2.7),h=s.amplitude+2,m=new WorldModel();
 // The mast ends at the top web, underneath the spider rather than through it.
 m.add(G.pole,gold,[c.x,(2+h*.54)/2,c.z],[r*.19,2+h*.54,r*.19]);
 for(let level=0;level<3;level++){const y=2+h*level*.27;for(const offset of [-.35,.35])m.add(G.ring,colors[level],[c.x,y+offset,c.z],[r*.91,r*.91,.7],[Math.PI/2,0,0]);
  for(let j=0;j<16;j++){const a=j*Math.PI/8;m.beam(cream,new T.Vector3(c.x+Math.sin(a)*r*.28,y,c.z+Math.cos(a)*r*.28),new T.Vector3(c.x+Math.sin(a)*r*.86,y,c.z+Math.cos(a)*r*.86),.06);}
  for(let ring=1;ring<4;ring++)for(let j=0;j<16;j++){const a=j*Math.PI/8,b=a+Math.PI/8,rr=r*ring*.23;m.beam(cream,new T.Vector3(c.x+Math.sin(a)*rr,y,c.z+Math.cos(a)*rr),new T.Vector3(c.x+Math.sin(b)*rr,y,c.z+Math.cos(b)*rr),.055);}
 }
 for(let j=0;j<8;j++){const a=j*Math.PI/4;bone(m,new T.Vector3(c.x+Math.sin(a)*r*.85,1,c.z+Math.cos(a)*r*.85),new T.Vector3(c.x+Math.sin(a)*r*.6,2+h*.54,c.z+Math.cos(a)*r*.6),.095,gold);}
 v.batch(m);const spider=new WorldModel();spider.add(G.round,violet,[0,0,0],[r*.48,1.55,r*.45]);spider.add(G.round,pink,[0,-.15,r*.43],[r*.33,1.15,r*.3]);face(spider,0,.02,r*.7,1.5);spider.add(G.cone,mint,[0,1.7,0],[r*.27,2.4,r*.27]);spider.add(G.round,gold,[0,3,0],[.36,.36,.36]);
 const bodies=v.pool(spider,1),leg=new WorldModel();bone(leg,new T.Vector3(),new T.Vector3(r*.3,-.3,0),.18,violet);bone(leg,new T.Vector3(r*.3,-.3,0),new T.Vector3(r*.52,-2.2,0),.15,violet);leg.add(G.round,gold,[r*.52,-2.2,0],[.25,.25,.25]);
 const legs=v.pool(leg,8),bead=new WorldModel();bead.add(G.round,mint,[0,0,0],[.23,.3,.23],[],true);const beads=v.pool(bead,24);
 const shuttle=new WorldModel();shuttle.add(G.round,pink,[0,0,0],[.7,.25,.3]);shuttle.add(G.pole,cream,[0,.14,0],[.16,.8,.16],[0,0,Math.PI/2]);const shuttles=v.pool(shuttle,3);
 legs.forEach(o=>o.name='silk-spider-legs');bodies.forEach(o=>o.name='silk-spider');
 const dummy=new T.Object3D(),local=new T.Object3D(),matrix=new T.Matrix4();
 v.animate((t,d,reduced)=>{const hello=arrival(d,at(s,.65),45),clock=reduced?0:t;dummy.position.set(c.x,4.3+h*.54,c.z);dummy.rotation.set(0,Math.sin(clock*.4)*hello*.09,0);dummy.updateMatrix();for(const o of bodies)o.setMatrixAt(0,dummy.matrix);
  for(let j=0;j<8;j++){const a=j*Math.PI/4;local.position.set(Math.sin(a)*r*.36,-.1,Math.cos(a)*r*.36);local.rotation.set(0,a-Math.PI/2,reduced?0:Math.sin(clock*5+j)*hello*.12);local.updateMatrix();matrix.multiplyMatrices(dummy.matrix,local.matrix);for(const o of legs)o.setMatrixAt(j,matrix);}
  for(let level=0;level<3;level++){const y=2+h*level*.27,energy=reduced?0:arrival(d,at(s,.23+level*.2),23);v.place(shuttles,level,c.x+Math.sin(clock*2+level)*r*.6,y+.45,c.z,1,0,0,0);
   for(let j=0;j<8;j++){const a=j*Math.PI/4,u=reduced?.4:(clock*.35+j*.12)%1,rr=r*(.28+u*.58);v.place(beads,level*8+j,c.x+Math.sin(a)*rr,y+.16,c.z+Math.cos(a)*rr,.5+energy*1.3);}
  }
 });
}

export function createSpiderSilkSpindle(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation {
 const piece=new PieceBuilder(material,lights);silkSpindle(section,piece);
 piece.update(0,section.start-12,false);return piece;
}

