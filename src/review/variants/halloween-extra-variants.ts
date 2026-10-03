import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { witchHatCenter } from '../../games/world-halloween';
import type { MiniSection } from '../../games/mini-track';
import type { FairgroundLights } from '../../games/world-lighting';
import { VariantBuilder, CrossingPulses, point, at, arrival, type ExtraOption } from './variant-kit';

const cream='#fff0ce',mint='#b6e5b4',violet='#a18ac9',pink='#eeadc5',gold='#e6bc79',ink='#564263';
const colors=[violet,mint,pink,gold];
function face(m:WorldModel,x:number,y:number,z:number,size=1){
 for(const side of [-1,1]){m.add(G.round,cream,[x+side*.35*size,y,z],[.24*size,.3*size,.1*size]);m.add(G.round,ink,[x+side*.35*size,y,z+.09*size],[.09*size,.15*size,.06*size]);m.add(G.round,pink,[x+side*.6*size,y-.26*size,z],[.16*size,.09*size,.06*size]);}
 m.add(G.round,ink,[x,y-.36*size,z],[.19*size,.07*size,.05*size]);
}
function bone(m:WorldModel,a:T.Vector3,b:T.Vector3,r=.16,color=cream){m.beam(color,a,b,r);for(const p of [a,b])m.add(G.round,color,p.toArray(),[r*1.5,r*1.5,r*1.5]);}
function star(){const m=new WorldModel();for(let i=0;i<5;i++){const a=i*Math.PI*.4;m.add(G.cone,gold,[Math.sin(a)*.23,Math.cos(a)*.23,0],[.21,.65,.12],[0,0,-a],true);}return m;}
function platform(m:WorldModel,x:number,y:number,z:number,r:number){
 m.add(G.pole,violet,[x,y-.25,z],[r,.5,r]);m.add(G.pole,gold,[x,y+.03,z],[r+.1,.12,r+.1]);
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,px=x+Math.sin(a)*r*.75,pz=z+Math.cos(a)*r*.75;m.beam('#968599',new T.Vector3(px,.1,pz),new T.Vector3(px,y-.4,pz),.18);m.add(G.round,gold,[px,.12,pz],[.48,.16,.48]);}
}
function portalFrame(s:MiniSection,v:VariantBuilder){const f=s.sample(s.start+s.length/2),root=new T.Group();root.position.copy(f.position);root.position.x-=s.origin.x;root.position.z-=s.origin.z;root.quaternion.copy(f.rotation);v.group.add(root);return root;}

/** Three cheerful skeletons play broad bone keys beside the three crests. */
function boneBand(s:MiniSection,v:VariantBuilder){
 const sites=[0,1,2].map(i=>point(s,(i+.5)/3)),stops=[0,1,2].map(i=>at(s,(i+.5)/3)),m=new WorldModel();
 for(const p of sites){const x=p.x,y=p.y,z=p.z-7.5;platform(m,x,y-1,z,3.5);
  m.add(G.box,pink,[x,y+.15,z+1],[6.4,.35,2]);
  for(let j=0;j<7;j++){const bx=x+(j-3)*.8;m.add(G.pole,colors[j%4],[bx,y-.4,z+1],[.27,1.4+j*.18,.27]);bone(m,new T.Vector3(bx,y+.51,z+.25),new T.Vector3(bx,y+.51,z+1.85-j*.08),.22);}
  bone(m,new T.Vector3(x,y,z-1),new T.Vector3(x,y+2.9,z-1),.22);
  for(let j=0;j<3;j++){const yy=y+1.45+j*.48;for(const side of [-1,1]){bone(m,new T.Vector3(x,yy,z-1),new T.Vector3(x+side*.9,yy+.12,z-.8),.12);bone(m,new T.Vector3(x+side*.9,yy+.12,z-.8),new T.Vector3(x+side*.7,yy-.12,z-.15),.12);}}
  for(const side of [-1,1]){bone(m,new T.Vector3(x+side*.23,y+.5,z-1),new T.Vector3(x+side*.75,y-.55,z-.5),.17);m.add(G.round,cream,[x+side*.75,y-.65,z-.08],[.42,.18,.62]);
   bone(m,new T.Vector3(x+side*.8,y+2.55,z-.8),new T.Vector3(x+side*1.8,y+2.1,z+.2),.14);
   bone(m,new T.Vector3(x+side*1.8,y+2.1,z+.2),new T.Vector3(x+side*1.3,y+2.88,z+1.2),.14);m.add(G.round,cream,[x+side*1.3,y+2.88,z+1.2],[.23,.23,.23]);
  }
  for(let j=0;j<9;j++){const a=j*Math.PI/8;bone(m,new T.Vector3(x+Math.cos(a)*3.6,y+1.5+Math.sin(a)*3.6,z-2),new T.Vector3(x+Math.cos(a+.18)*3.6,y+1.5+Math.sin(a+.18)*3.6,z-2),.11,gold);}
 }
 v.batch(m);
 const skull=new WorldModel();skull.add(G.round,cream,[0,0,0],[1.05,.96,.78]);face(skull,0,.04,.73,1.2);
 for(let j=0;j<4;j++)skull.add(G.box,cream,[(j-1.5)*.27,-.69,.56],[.21,.3,.31]);
 skull.add(G.pole,violet,[0,.76,0],[1.08,.16,.85]);skull.add(G.pole,violet,[0,1.12,0],[.7,.65,.6]);skull.add(G.box,mint,[0,.96,.61],[1.1,.15,.05]);
 const heads=v.pool(skull,3),stick=new WorldModel();bone(stick,new T.Vector3(0,0,0),new T.Vector3(0,-1.7,0),.11);stick.add(G.round,pink,[0,-1.77,0],[.34,.27,.34]);
 const mallets=v.pool(stick,6),notes=v.pool(star(),12),pulses=new CrossingPulses(stops);heads.forEach(o=>o.name='bone-band-heads');mallets.forEach(o=>o.name='bone-band-mallets');
 v.animate((t,d,reduced)=>{pulses.update(t,d);
  sites.forEach((p,i)=>{const hello=arrival(d,stops[i],18),age=pulses.age(i,t);v.place(heads,i,p.x,p.y+3.6,p.z-8.5,1,0,reduced?0:hello*Math.sin(t*4)*.2,reduced?0:hello*Math.sin(t*7+i)*.12);
   for(let side=0;side<2;side++){const beat=reduced?0:hello*Math.max(0,Math.sin(t*13+side*Math.PI));v.place(mallets,i*2+side,p.x+(side?1:-1)*1.3,p.y+2.88,p.z-6.3,1,0,0,(side?1:-1)*(.8-beat*.8));}
   for(let j=0;j<4;j++){const u=age-j*.18,active=!reduced&&u>=0&&u<2.2;v.place(notes,i*4+j,p.x+(j-1.5)*.7,p.y+1.6+Math.max(0,u)*3,p.z-6.3,active?Math.sin(u/2.2*Math.PI)*.7:0,0,0,active?u:0);}
  });
 });
}

/** A web is a trampoline, not a trap: friendly spiders bounce beside the rail. */
function spiderFair(s:MiniSection,v:VariantBuilder){
 const sites=[0,1,2].map(i=>point(s,(i+.5)/3)),stops=[0,1,2].map(i=>at(s,(i+.5)/3)),m=new WorldModel();
 for(const p of sites){const z=p.z-8;platform(m,p.x,p.y,z,3.75);
  for(const side of [-1,1]){m.add(G.pole,gold,[p.x+side*3.6,p.y+2.8,z],[.16,5.8,.16]);m.add(G.cone,pink,[p.x+side*3.6,p.y+6.1,z],[.65,.95,.65]);}
  m.beam(gold,new T.Vector3(p.x-3.6,p.y+5.7,z),new T.Vector3(p.x+3.6,p.y+5.7,z),.16);
  for(let j=0;j<9;j++)m.add(G.cone,colors[j%4],[p.x-3.2+j*.8,p.y+5.3,z],[.27,.65,.12],[0,0,Math.PI]);
 }
 v.batch(m);const web=new WorldModel();
 for(let i=0;i<8;i++){const a=i*Math.PI/4;web.beam(cream,new T.Vector3(),new T.Vector3(Math.sin(a)*3.3,0,Math.cos(a)*3.3),.055);for(let ring=1;ring<=3;ring++)web.beam(cream,new T.Vector3(Math.sin(a)*ring,0,Math.cos(a)*ring),new T.Vector3(Math.sin(a+Math.PI/4)*ring,0,Math.cos(a+Math.PI/4)*ring),.05);}
 const webs=v.pool(web,3),body=new WorldModel();body.add(G.round,violet,[0,0,-.5],[1.35,.85,1.4]);body.add(G.round,pink,[0,.12,.83],[.88,.71,.77]);face(body,0,.19,1.49,1.1);body.add(G.cone,mint,[0,1.03,-.5],[.6,1.1,.6]);body.add(G.round,gold,[0,1.65,-.5],[.23,.23,.23]);
 for(let j=0;j<4;j++)body.add(G.round,cream,[(j-1.5)*.4,.74,-.45],[.12,.1,.12]);
 const spiders=v.pool(body,3),leg=new WorldModel();bone(leg,new T.Vector3(),new T.Vector3(1.7,-.38,0),.16,violet);bone(leg,new T.Vector3(1.7,-.38,0),new T.Vector3(2.5,-1.78,.25),.13,violet);leg.add(G.round,gold,[2.5,-1.78,.25],[.28,.12,.32]);
 const legs=v.pool(leg,24),spark=v.pool(star(),12),pulses=new CrossingPulses(stops),dummy=new T.Object3D(),local=new T.Object3D(),matrix=new T.Matrix4();
 spiders.forEach(o=>o.name='spring-spiders');legs.forEach(o=>o.name='spring-spider-legs');webs.forEach(o=>o.name='spring-webs');
 v.animate((t,d,reduced)=>{pulses.update(t,d);sites.forEach((p,i)=>{
  const age=pulses.age(i,t),u=Math.max(0,age),bounce=!reduced&&age>=0&&age<3.2?Math.abs(Math.sin(u*Math.PI/1.05))*Math.exp(-u*.43)*2.2:0,prepare=reduced?0:arrival(d,stops[i]-7,5)*.2;
  v.place(webs,i,p.x,p.y+1-prepare,p.z-8,1);dummy.position.set(p.x,p.y+2.78+bounce-prepare,p.z-8);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();for(const o of spiders)o.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<8;j++){const side=j<4?1:-1;local.position.set(side*.45,0,(j%4-1.5)*.45);local.rotation.set(0,(side<0?Math.PI:0)+(j%4-1.5)*.25,side*bounce*.05);local.updateMatrix();matrix.multiplyMatrices(dummy.matrix,local.matrix);for(const o of legs)o.setMatrixAt(i*8+j,matrix);}
  for(let j=0;j<4;j++){const a=(reduced?0:t)+i+j*Math.PI/2;v.place(spark,i*4+j,p.x+Math.cos(a)*2.6,p.y+4.5+bounce*.5,p.z-8+Math.sin(a)*2.6,reduced?.13:.13+bounce*.13,0,0,reduced?0:a);}
 });});
}

/** An open storybook over the railway, with page turns and a curious bookworm. */
function bookwormLibrary(s:MiniSection,v:VariantBuilder){
 const root=portalFrame(s,v),m=new WorldModel();
 for(const side of [-1,1])for(let level=0;level<4;level++){const yy=level*1.85;
  m.add(G.box,colors[level%4],[side*6.5,yy,0],[3.5,1.75,5],[0,side*.035*(level%2?1:-1),0]);m.add(G.box,cream,[side*6.5,yy,2.52],[3.1,1.2,.12]);
  for(let line=0;line<3;line++)m.add(G.box,gold,[side*6.5,yy-.4+line*.4,2.62],[2.85,.04,.04]);m.add(G.box,pink,[side*6.8,yy+.58,2.7],[.42,1.3,.06]);
 }
 m.add(G.box,ink,[0,7.2,0],[16,.5,5.5]);m.add(G.box,gold,[0,7.6,0],[16.4,.3,5.8]);
 // The giant open book forms a roof; every turning leaf remains above 7.8 m.
 for(const side of [-1,1]){m.add(G.box,violet,[side*3.45,8.25,0],[7,.36,5.1],[0,0,side*.13]);m.add(G.box,cream,[side*3.4,8.65,0],[6.6,.55,4.7],[0,0,side*.13]);}
 for(let i=0;i<9;i++)m.add(G.round,colors[i%4],[(i-4)*1.45,7.38,2.92],[.2,.2,.15],[],true);
 v.batch(m,root);const leaf=new WorldModel();leaf.add(G.box,cream,[3.1,0,0],[6.2,.08,4.5]);
 for(let line=0;line<5;line++)leaf.add(G.box,line%2?violet:gold,[3,.065,-1.7+line*.75],[4.6,.025,.07]);
 const pages=v.pool(leaf,3,root);pages.forEach(o=>o.name='library-turning-pages');
 const worm=new WorldModel();for(let j=0;j<5;j++)worm.add(G.round,j%2?mint:'#9ac69e',[0,-j*.7,-j*.35],[.93,.81,.83]);face(worm,0,.11,.79,1.15);
 for(const side of [-1,1]){worm.add(G.ring,gold,[side*.43,.17,.96],[.39,.39,.09]);worm.add(G.pole,gold,[side*.43,1.04,0],[.07,.7,.07],[0,0,-side*.22]);worm.add(G.round,pink,[side*.51,1.39,0],[.18,.18,.18]);}
 const reader=v.pool(worm,1,root),letters=v.pool(star(),12,root),stop=s.start+s.length/2;
 v.animate((t,d,reduced)=>{const hello=arrival(d,stop,24);for(let i=0;i<3;i++){const turn=reduced?0:T.MathUtils.smoothstep(d,stop-19+i*10,stop-7+i*10)*Math.PI;v.place(pages,i,0,9.1+i*.08,0,1,0,0,turn);}
  v.place(reader,0,-5.4,9.1+(reduced?0:hello*1.5),-.6,1,0,reduced?0:Math.sin(t*2)*hello*.2,0);
  for(let i=0;i<12;i++){const a=i*2.399+(reduced?0:t*.6);v.place(letters,i,Math.sin(a)*(2.5+i%3),10+i%4*.75+hello,Math.cos(a)*1.6,reduced?.12:hello*(.16+.06*(i%3)),0,0,a);}
 });
}

/** Big rounded fossil ribs form a tunnel; its feet and head stay beside it. */
function ticklishFossil(s:MiniSection,v:VariantBuilder){
 const root=portalFrame(s,v),m=new WorldModel();m.add(G.box,violet,[0,-1.05,0],[15,.6,13]);
 for(const side of [-1,1])for(const z of [-4,4]){m.add(G.round,mint,[side*5.8,-.38,z],[1.3,.55,1.65]);bone(m,new T.Vector3(side*5.8,0,z),new T.Vector3(side*4.9,3.2,z),.36);}
 // Twelve broad arched segments give clear rail headroom throughout the bore.
 for(let j=0;j<5;j++){const z=-4+j*2;for(let k=0;k<12;k++){const a=k*Math.PI/12,b=(k+1)*Math.PI/12;bone(m,new T.Vector3(Math.cos(a)*5,2+Math.sin(a)*6,z),new T.Vector3(Math.cos(b)*5,2+Math.sin(b)*6,z),.22);}}
 bone(m,new T.Vector3(0,8,-4.8),new T.Vector3(0,8,4.8),.38);
 for(let j=0;j<6;j++)m.add(G.cone,pink,[0,8.8,-4+j*1.6],[.6,1.4,.55]);
 bone(m,new T.Vector3(0,7.8,4.5),new T.Vector3(-3.8,7.5,6.8),.48);bone(m,new T.Vector3(-3.8,7.5,6.8),new T.Vector3(-5.9,6.5,7.5),.48);
 v.batch(m,root);const skull=new WorldModel();skull.add(G.round,cream,[0,0,0],[1.8,1.6,1.4]);skull.add(G.round,cream,[0,-.65,1.8],[1.6,.75,1.5]);face(skull,0,.23,1.21,1.7);
 for(const side of [-1,1])skull.add(G.round,pink,[side*1.25,-.4,1.72],[.35,.22,.13]);
 const heads=v.pool(skull,1,root),jawModel=new WorldModel();jawModel.add(G.round,cream,[0,-.5,1.1],[1.45,.24,1.4]);for(let i=0;i<4;i++)jawModel.add(G.box,cream,[(i-1.5)*.65,-.2,1.9],[.28,.35,.35]);
 const jaws=v.pool(jawModel,1,root),tailModel=new WorldModel();for(let j=0;j<5;j++)bone(tailModel,new T.Vector3(j*.7,-j*.25,-j*.9),new T.Vector3((j+1)*.7,-(j+1)*.25,-(j+1)*.9),.3-j*.04);tailModel.add(G.round,pink,[3.8,-1.2,-4.6],[.5,.4,.65]);
 const tails=v.pool(tailModel,1,root),giggles=v.pool(star(),10,root),pulses=new CrossingPulses([s.start+s.length/2]);
 const dummy=new T.Object3D(),hinge=new T.Object3D(),matrix=new T.Matrix4();heads.forEach(o=>o.name='fossil-head');jaws.forEach(o=>o.name='fossil-jaw');
 v.animate((t,d,reduced)=>{pulses.update(t,d);const age=pulses.age(0,t),hello=arrival(d,s.start+s.length/2,18),laugh=reduced?0:hello*(.5+.5*Math.sin(t*11));
  dummy.position.set(-6.2,6.6+hello*.25,7.6);dummy.rotation.set(0,-.25,reduced?0:Math.sin(t*7)*hello*.1);dummy.updateMatrix();for(const o of heads)o.setMatrixAt(0,dummy.matrix);
  hinge.position.set(0,-.8,.15);hinge.rotation.set(laugh*.32,0,0);hinge.updateMatrix();matrix.multiplyMatrices(dummy.matrix,hinge.matrix);for(const o of jaws)o.setMatrixAt(0,matrix);
  v.place(tails,0,0,8,-4.8,1,0,reduced?0:Math.sin(t*5)*hello*.36,0);
  for(let i=0;i<10;i++){const ageI=age-i*.1,active=!reduced&&ageI>=0&&ageI<2.2,u=active?ageI:0;v.place(giggles,i,-6.2+Math.sin(i)*u,7+u*2.2,9.5+u,active?Math.sin(u/2.2*Math.PI)*.45:0,0,0,u);}
 });
}

/** Crooked guest rooms, opening shutters and a glass-front ghost lift. */
function booHotel(s:MiniSection,v:VariantBuilder){
 const c=witchHatCenter(s),r=Math.max(2.2,c.radius-3.25),h=s.amplitude+2,m=new WorldModel(),floors=[.16,.43,.70].map(f=>2+h*f);
 for(let level=0;level<3;level++){const y=floors[level],rr=r*(1-level*.065);m.add(G.box,colors[level],[c.x,y,c.z],[rr*1.6,h*.2,rr*1.6],[0,0,(level%2?1:-1)*.035]);m.add(G.box,gold,[c.x,y-h*.105,c.z],[rr*1.8,.25,rr*1.8]);
  m.add(G.cone,violet,[c.x,y+h*.16,c.z],[rr*1.22,h*.19,rr*1.22],[0,Math.PI/4,0]);
  for(const side of [-1,1]){m.add(G.box,ink,[c.x+side*rr*.4,y+.25,c.z+rr*.81],[rr*.57,h*.105,.13]);m.add(G.box,gold,[c.x+side*rr*.4,y-h*.055,c.z+rr*.95],[rr*.7,.18,rr*.3]);}
  for(const side of [-1,1]){
   m.add(G.box,gold,[c.x+side*rr*.81,y+.3,c.z],[.12,1.55,1.35]);m.add(G.box,cream,[c.x+side*rr*.88,y+.3,c.z],[.05,1.24,1.08]);
   m.add(G.box,violet,[c.x+side*rr*.92,y+.3,c.z],[.06,1.27,.12]);m.add(G.box,violet,[c.x+side*rr*.92,y+.3,c.z],[.06,.12,1.12]);
  }
  m.add(G.ring,gold,[c.x,y+.3,c.z-rr*.82],[.75,.75,.12]);m.add(G.round,cream,[c.x,y+.3,c.z-rr*.84],[.66,.66,.08]);
 }
 for(const side of [-1,1]){m.add(G.pole,gold,[c.x+side*r*.26,h*.5,c.z+r*.98],[.09,h,.09]);m.add(G.round,pink,[c.x+side*r*.26,h+1,c.z+r*.98],[.22,.22,.22]);}
 m.add(G.box,ink,[c.x,1.3,c.z+r*.81],[r*.6,2.6,.18]);m.add(G.cone,pink,[c.x,h+3,c.z],[r*.65,4,r*.65]);face(m,c.x,h+1,c.z+r*.64,.75);
 v.batch(m);const shutter=new WorldModel();shutter.add(G.box,violet,[.21,0,0],[.42,1.45,.15]);for(let i=0;i<4;i++)shutter.add(G.box,gold,[.21,-.5+i*.33,.11],[.335,.05,.05]);
 const shutters=v.pool(shutter,12),makeGhost=()=>{const ghost=new WorldModel();ghost.add(G.round,cream,[0,.6,0],[.62,.8,.42]);ghost.add(G.cone,cream,[0,-.1,0],[.66,1.2,.45]);face(ghost,0,.75,.4,.65);for(const side of [-1,1])ghost.add(G.round,cream,[side*.7,.2,0],[.28,.15,.15]);return ghost;};
 const guests=v.pool(makeGhost(),6),liftModel=new WorldModel();liftModel.add(G.box,gold,[0,0,0],[1.8,.2,1.4]);for(const side of [-1,1]){liftModel.add(G.pole,pink,[side*.8,1.2,0],[.07,2.4,.07]);}liftModel.add(G.box,gold,[0,2.4,0],[1.8,.18,1.4]);
 const lift=v.pool(liftModel,1),liftGuest=v.pool(makeGhost(),1),bells=v.pool(star(),6);lift.forEach(o=>o.name='hotel-lift');liftGuest.forEach(o=>o.name='hotel-lift-guest');shutters.forEach(o=>o.name='hotel-shutters');guests.forEach(o=>o.name='hotel-window-guests');
 v.animate((t,d,reduced)=>{const ride=T.MathUtils.clamp((d-s.start)/s.length,0,1),liftY=reduced?2:2+Math.sin(Math.PI*ride)*h*.8;v.place(lift,0,c.x,liftY,c.z+r*.98);v.place(liftGuest,0,c.x,liftY+.72,c.z+r*.98,.85);
  for(let level=0;level<3;level++){const rr=r*(1-level*.065),hello=arrival(d,at(s,.25+level*.19),25),opening=reduced?0:T.MathUtils.smoothstep(hello,.08,.45),emerge=reduced?0:T.MathUtils.smoothstep(hello,.52,.95);
   for(let side=0;side<2;side++){const x=c.x+(side?1:-1)*rr*.4;v.place(guests,level*2+side,x,floors[level]+.18,c.z+rr*.81-.6+emerge*1.35,.8,0,0,reduced?0:Math.sin(t*6+side)*emerge*.1);
    for(let door=0;door<2;door++){const sign=door?1:-1;v.place(shutters,level*4+side*2+door,x+sign*rr*.285,floors[level]+.25,c.z+rr*.83,rr*.57/.84,0,door?Math.PI-opening*1.7:opening*1.7,0);}
    v.place(bells,level*2+side,x,floors[level]+2.1,c.z+rr*1.06,.2+emerge*.25,0,0,reduced?0:Math.sin(t*6)*hello*.3);
   }
  }
 });
}

/** A giant seamstress spider plucks a three-tier silk loom around the helix. */
function silkSpindle(s:MiniSection,v:VariantBuilder){
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

export function createHalloweenExtraVariant(s:MiniSection,option:ExtraOption,material:T.Material,lights:FairgroundLights){
 if(!['pumpkinhop','pumpkintunnel','witchhat'].includes(s.kind))return;
 const v=new VariantBuilder(material,lights);
 if(s.kind==='pumpkinhop')(option==='d'?boneBand:spiderFair)(s,v);
 else if(s.kind==='pumpkintunnel')(option==='d'?bookwormLibrary:ticklishFossil)(s,v);
 else(option==='d'?booHotel:silkSpindle)(s,v);
 v.update(0,s.start-12,false);return v;
}
