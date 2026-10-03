import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { ghostModel, witchHatCenter } from '../../games/world-halloween';
import type { MiniSection } from '../../games/mini-track';
import type { FairgroundLights } from '../../games/world-lighting';
import { VariantBuilder, CrossingPulses, point, at, arrival, type AlternativeOption } from './variant-kit';

const cream='#fff0c7',green='#c7f494',purple='#9676ae',dark='#55416d',pink='#ecb3d5',gold='#e7bd7b';
function eyes(m:WorldModel,x:number,y:number,z:number,size=1){
 for(const side of [-1,1]){m.add(G.round,cream,[x+side*.42*size,y,z],[.26*size,.33*size,.12*size]);m.add(G.round,dark,[x+side*.42*size,y+.02*size,z+.11*size],[.105*size,.16*size,.05*size]);m.add(G.round,pink,[x+side*.72*size,y-.32*size,z],[.22*size,.12*size,.08*size]);}
 m.add(G.round,dark,[x,y-.45*size,z+.05*size],[.26*size,.08*size,.06*size]);
}
function orb(color=green,glow=true){const m=new WorldModel();m.add(G.round,color,[0,0,0],[1,1,1],[],glow);return m;}
function candy(){const m=new WorldModel();m.add(G.rock,pink,[0,0,0],[.45,.3,.3]);for(const side of [-1,1])m.add(G.cone,green,[side*.52,0,0],[.25,.42,.25],[0,0,side*Math.PI/2]);return m;}
function star(m:WorldModel,x:number,y:number,z:number,size:number,color=cream){for(let j=0;j<5;j++){const a=j*Math.PI*.4;m.add(G.cone,color,[x+Math.sin(a)*size*.38,y+Math.cos(a)*size*.38,z],[size*.32,size*.95,size*.12],[0,0,-a],true);}}
function pedestal(m:WorldModel,x:number,y:number,z:number,r=2.4){
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,top=new T.Vector3(x+Math.sin(a)*r*.7,y,z+Math.cos(a)*r*.7),foot=new T.Vector3(x+Math.sin(a)*r*.92,.1,z+Math.cos(a)*r*.92);m.beam('#a68ba6',foot,top,.17);m.add(G.round,gold,foot.toArray(),[.36,.14,.36]);}
 m.add(G.pole,purple,[x,y,z],[r,.45,r]);
 for(let j=0;j<8;j++){const a=j*Math.PI/4;m.add(G.pole,gold,[x+Math.sin(a)*r*.86,y+.35,z+Math.cos(a)*r*.86],[.06,.65,.06]);}
}

/** Big, readable mechanical details stay in the same static batch. */
function gauge(m:WorldModel,x:number,y:number,z:number,r=1){
 m.add(G.pole,gold,[x,y,z],[r,.24,r],[Math.PI/2,0,0]);
 m.add(G.pole,cream,[x,y,z+.14],[r*.84,.04,r*.84],[Math.PI/2,0,0]);
 for(let j=0;j<7;j++){const a=-2.3+j*4.6/6;m.add(G.box,j>4?pink:dark,[x+Math.sin(a)*r*.66,y+Math.cos(a)*r*.66,z+.19],[r*.09,r*.22,.045],[0,0,-a]);}
 m.add(G.round,gold,[x,y,z+.24],[r*.13,r*.13,.1]);
}
function gaugeNeedle(){const n=new WorldModel();n.add(G.box,dark,[0,.34,0],[.085,.76,.08]);n.add(G.round,pink,[0,0,.06],[.15,.15,.07]);return n;}

function potionHops(s:MiniSection,v:VariantBuilder){
 const m=new WorldModel(),sites=[0,1,2].map(i=>point(s,(i+.5)/3)),stops=[0,1,2].map(i=>at(s,(i+.5)/3));
 for(let i=0;i<3;i++){
  const p=sites[i],x=p.x,z=p.z-6.7,y=p.y-1;
  pedestal(m,x,y-1,z,3.1);
  m.add(G.round,i%2?'#ba8aad':'#8073a9',[x,y+.6,z],[2.7,2.1,2.6]);
  m.add(G.pole,gold,[x,y+2,z],[2.55,.3,2.55]);m.add(G.pole,green,[x,y+2.18,z],[2.3,.12,2.3],[],true);
  eyes(m,x,y+.75,z+2.42,1.7);
  for(const side of [-1,1]){
   m.add(G.ring,gold,[x+side*2.6,y+.9,z],[.65,.65,.65],[0,Math.PI/2,0]);
   m.add(G.pole,pink,[x+side*3.7,y+1,z],[.52,2.6,.52]);m.add(G.round,green,[x+side*3.7,y+.3,z],[.95,1.3,.95],[],true);
   m.add(G.pole,gold,[x+side*3.7,y+2.4,z],[.63,.18,.63]);
  }
  // Copper pipework follows the outside of the hill, never through the rails.
  m.beam(gold,new T.Vector3(x-3.7,y+2.3,z),new T.Vector3(x-3.7,y+4.7,z),.18);
  m.beam(gold,new T.Vector3(x-3.7,y+4.7,z),new T.Vector3(x,y+4.7,z),.18);
  star(m,x,y+5.9,z,.8);
  gauge(m,x+3.65,y+4.6,z,1.12);
  m.beam(gold,new T.Vector3(x+3.65,y+2.3,z),new T.Vector3(x+3.65,y+3.5,z),.18);
  for(let j=0;j<4;j++)m.add(G.box,j%2?pink:gold,[x+3.65,y+2.8+j*.18,z],[.6,.12,.4]);
  // Broad riveted feet and curved drain taps make this a connected machine.
  for(const side of [-1,1])m.add(G.box,gold,[x+side*1.8,y-1.1,z],[.7,.9,1.7]);
  m.beam(gold,new T.Vector3(x,y,z+2.5),new T.Vector3(x,y,z+3.2),.26);
  m.add(G.ring,gold,[x,y+.2,z+3.3],[.42,.42,.42]);
 }
 for(let i=1;i<3;i++){
  let previous:T.Vector3|undefined;
  for(let j=0;j<=12;j++){const f=(i-.5+j/12)/3,p=point(s,f);p.z-=10.2;p.y-=1.4;if(previous)m.beam(gold,previous,p,.2);previous=p;}
 }
 v.batch(m);
 const needles=v.pool(gaugeNeedle(),3);
 const spoon=new WorldModel();spoon.add(G.pole,gold,[0,0,0],[.12,4,.12]);spoon.add(G.round,purple,[0,-1.65,0],[.52,.7,.18]);
 const stir=v.pool(spoon,3),bubbles=v.pool(orb(),45),corks=v.pool((()=>{const n=new WorldModel();n.add(G.pole,'#b9916e',[0,0,0],[.56,.7,.56]);n.add(G.box,cream,[0,.37,0],[.6,.04,.3]);return n;})(),6);
 const pulses=new CrossingPulses(stops);
 v.animate((t,d,reduced)=>{
  pulses.update(t,d);
  for(let i=0;i<3;i++){
   const p=sites[i],age=pulses.age(i,t),hello=arrival(d,stops[i],15),clock=reduced?0:t*.6+hello;
   v.place(needles,i,p.x+3.65,p.y+3.6,p.z-6.44,1,0,0,1.7-hello*3.3);
   v.place(stir,i,p.x+Math.sin(clock+i)*.7,p.y+2.2,p.z-6.7+Math.cos(clock+i)*.7,1,.25*Math.sin(clock),clock,.25);
   for(let j=0;j<15;j++){
    const active=!reduced&&age>=0&&age<3.5,u=active?age:(reduced?j/15:(t*.18+j/15)%1),a=j*2.399;
    const height=active?Math.max(0,(7+j%3)*u-2.6*u*u):u*2;
    v.place(bubbles,i*15+j,p.x+Math.sin(a)*(active?u*.9:1.5),p.y+1.3+height,p.z-6.7+Math.cos(a)*(active?u*.9:1.5),active?Math.max(.02,.38*(1-u/3.5)):.18+.06*(j%3));
   }
   for(let j=0;j<2;j++){
    const corkAge=age-j*.17,hop=!reduced&&corkAge>=0&&corkAge<2?Math.sin(corkAge/2*Math.PI)*(4.5+j):0;
    v.place(corks,i*2+j,p.x+(j?1:-1)*3.7,p.y+1.9+hop,p.z-6.7,1,hop*.25,hop*.3,hop*.2);
   }
  }
 });
}

function ghostLaundry(s:MiniSection,v:VariantBuilder){
 const m=new WorldModel(),sites=[0,1,2].map(i=>point(s,(i+.5)/3)),stops=[0,1,2].map(i=>at(s,(i+.5)/3));
 for(let i=0;i<3;i++){
  const p=sites[i],z=p.z+6.3,y=p.y-.8;
  pedestal(m,p.x,y-1.7,z,2.75);m.add(G.box,i%2?pink:'#b9cba4',[p.x,y+.1,z],[4.2,3.8,3.1]);
  m.add(G.box,cream,[p.x,y+1.75,z+1.58],[4.15,.55,.1]);
  m.add(G.ring,gold,[p.x,y,z+1.62],[1.35,1.35,1.35]);m.add(G.pole,'#8bafbf',[p.x,y,z+1.61],[1.26,.07,1.26],[Math.PI/2,0,0]);
  for(let j=0;j<3;j++)m.add(G.round,[green,pink,gold][j],[p.x-1+j*.8,y+1.8,z+1.68],[.16,.16,.06],[],true);
  for(const side of [-1,1]){
   m.add(G.pole,gold,[p.x+side*4,y+2,z],[.18,8,.18]);m.add(G.round,cream,[p.x+side*4,y+6,z],[.4,.4,.4]);
  }
  m.beam('#cdc6a5',new T.Vector3(p.x-4,y+5.6,z),new T.Vector3(p.x+4,y+5.6,z),.06);
  for(let j=0;j<5;j++){
   const x=p.x-3+j*1.5;if(j>0&&j<4)m.add(G.box,[pink,green,purple][j%3],[x,y+4.8,z],[.85,1.3,.05],[0,0,(j-2)*.08]);
   if(j%2)m.add(G.box,[pink,green,purple][j%3],[x+.28,y+4.2,z],[1.25,.35,.13]);
   m.add(G.box,gold,[x,y+5.48,z+.07],[.12,.36,.16],[0,0,.1]);
  }
  for(let j=0;j<7;j++)m.add(G.round,j%2?pink:cream,[p.x-1.8+j*.6,y+2.17,z+1.65],[.32,.25,.15]);
  for(const side of [-1,1]){m.add(G.round,dark,[p.x+side*1.8,y-1.9,z+.7],[.42,.24,.6]);m.add(G.round,gold,[p.x+side*1.65,y+.9,z+1.68],[.13,.13,.1]);}
  m.add(G.box,pink,[p.x+2.6,y-1.7,z+1.7],[1.4,.5,1]);
  m.add(G.box,cream,[p.x+2.6,y-1.42,z+1.7],[.9,.07,.55]);
 }
 v.batch(m);
 const g=ghostModel(),ghosts=v.pool(g,6),wash=new WorldModel();ghosts.forEach(m=>m.name='laundry-ghosts');
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;wash.add(G.round,cream,[Math.sin(a)*.67,Math.cos(a)*.67,0],[.34,.43,.12]);}
 const wheels=v.pool(wash,3),bubbles=v.pool(orb('#e0d9f2'),30),pulses=new CrossingPulses(stops);
 v.animate((t,d,reduced)=>{
  pulses.update(t,d);
  for(let i=0;i<3;i++){
   const p=sites[i],age=pulses.age(i,t),hello=arrival(d,stops[i],13);
   v.place(wheels,i,p.x,p.y-.8,p.z+7.99,1,0,0,reduced?0:t*1.4+hello*2);
   for(let j=0;j<2;j++){
    // Each ghost shoots gently out of the drum, somersaults once, then hangs
    // up to dry. Staggering keeps this from looking like one rigid crowd.
    const u=reduced?1:T.MathUtils.clamp((age-j*.22)/2.5,0,1),f=u*u*(3-2*u),side=j?1:-1;
    const resting=age<0||reduced,travel=reduced?1:age<0?0:f;
    v.place(ghosts,i*2+j,p.x+side*(.63+2.37*travel),p.y-.7+travel*3.8+(!resting?Math.sin(u*Math.PI)*1.6:0),p.z+8.25-travel*1.95,.85,0,0,reduced?0:(!resting&&u<1?side*Math.sin(u*Math.PI)*.65:Math.sin(t*1.5+j)*.09));
   }
   for(let j=0;j<10;j++){const u=reduced?j/10:(t*.19+j/10)%1;v.place(bubbles,i*10+j,p.x+Math.sin(j*2.4)*2.2,p.y+1+u*5,p.z+6.5+Math.cos(j)*1.2,.12+.18*Math.sin(u*Math.PI));}
  }
 });
}

/** Build portal machinery in the exact cross-track frame. */
function portalFrame(s:MiniSection,v:VariantBuilder){const frame=s.sample(s.start+s.length/2),root=new T.Group();root.position.copy(frame.position);root.position.x-=s.origin.x;root.position.z-=s.origin.z;root.quaternion.copy(frame.rotation);v.group.add(root);return root;}
function monsterPortal(s:MiniSection,v:VariantBuilder){
 const root=portalFrame(s,v),m=new WorldModel();
 for(const side of [-1,1]){
  m.add(G.round,'#bad890',[side*5.3,2,0],[1.6,4.4,2.25]);m.add(G.round,'#cbe0aa',[side*5.3,-2,1],[2,.7,2.4]);
  for(let j=0;j<3;j++)m.add(G.cone,cream,[side*(4.35+j*.8),-1.65,3],[.3,.6,.3],[Math.PI/2,0,0]);
  m.add(G.round,pink,[side*5.3,3.6,2.12],[.8,.45,.11]);
  for(let j=0;j<4;j++)m.add(G.round,j%2?gold:pink,[side*5.3,1+j*.65,-2.07],[.45,.25,.15]);
 }
 m.add(G.box,'#b3d4ad',[0,-1.15,0],[10.3,.6,4]);m.add(G.round,pink,[0,-.84,1.35],[2.5,.12,1.9]);v.batch(m,root);
 const head=new WorldModel();
 head.add(G.round,'#c0dc9e',[0,0,0],[6.5,2.5,2.35]);
 for(const side of [-1,1]){
  head.add(G.round,'#c4df9e',[side*2.65,2,.25],[1.55,1.8,1.5]);
  for(const face of [-1,1]){head.add(G.round,cream,[side*2.65,2.2,face*1.65],[1.05,1.18,.25]);head.add(G.round,dark,[side*2.65,2.16,face*1.88],[.4,.6,.13]);head.add(G.round,cream,[side*2.5,2.46,face*1.98],[.14,.18,.06]);}
  head.add(G.round,pink,[side*4.5,-.15,2.1],[.8,.5,.18]);
  for(const face of [-1,1])head.add(G.box,purple,[side*2.7,3.65,face*1.57],[2,.34,.3],[0,0,side*.14]);
  head.add(G.cone,gold,[side*4.9,2.3,0],[.72,2.65,.6],[0,0,-side*.3]);
 }
 for(let j=0;j<7;j++)head.add(G.cone,cream,[(j-3)*1.05,-1.95,1.35],[.4,1.15,.3],[0,0,Math.PI]);
 const jaw=v.batch(head,root);jaw.position.y=7;
 const paw=new WorldModel();paw.add(G.round,'#bad890',[0,-1.1,0],[.65,1.8,.85]);paw.add(G.round,'#c0dc9e',[0,.55,0],[1.1,1.25,.6]);
 for(let j=0;j<3;j++){paw.add(G.round,'#c0dc9e',[(j-1)*.7,1.4,0],[.36,.7,.4]);paw.add(G.round,pink,[(j-1)*.62,.7,.55],[.2,.24,.07]);}
 const paws=v.pool(paw,2,root);
 const sweets=v.pool(candy(),24,root),pulses=new CrossingPulses([s.start+s.length/2]);
 v.animate((t,d,reduced)=>{
  pulses.update(t,d);const hello=arrival(d,s.start+s.length/2,30),age=pulses.age(0,t);
  const burp=!reduced&&age>0&&age<2?Math.sin(age*8)*Math.exp(-age*2):0;
  jaw.position.y=7+(reduced?2:hello*2)+burp*.35;jaw.rotation.z=reduced?0:Math.sin(t)*.025*(1-hello);
  for(let i=0;i<2;i++){const side=i?1:-1;v.place(paws,i,side*7.2,4.8,1.4,1,0,0,side*(.25+(reduced?0:hello*.4+Math.sin(t*6+i)*hello*.23)));}
  for(let i=0;i<24;i++){
   const active=!reduced&&age>=0&&age<3,u=active?age:0,a=i*2.399;
   v.place(sweets,i,Math.sin(a)*(3+u*2),7+u*(4+i%3)-2.4*u*u,2+Math.cos(a)*u*3,active?Math.max(.01,.8*(1-u/3)):0,u*2,a,u);
  }
 });
}

function puppetPortal(s:MiniSection,v:VariantBuilder){
 const root=portalFrame(s,v),m=new WorldModel();
 m.add(G.box,gold,[0,-.9,0],[17,.6,5]);m.add(G.box,dark,[0,-1.6,0],[16,.8,4.5]);
 for(const side of [-1,1]){
  m.add(G.box,purple,[side*7,5.3,0],[2,11.6,3]);m.add(G.box,gold,[side*7,5.3,1.55],[.18,11.6,.18]);
  m.add(G.cone,pink,[side*7,11.9,0],[1.8,2.4,1.8]);
  for(let j=0;j<5;j++)m.add(G.round,cream,[side*7,1+j*1.7,1.65],[.22,.22,.12],[],true);
 }
 for(const side of [-1,1]){
  m.add(G.box,gold,[side*7,11.75,1.75],[2.4,.18,.25]);
  m.add(G.box,dark,[side*8.4,-.45,2.5],[2.4,.32,1.4]);
  for(let j=0;j<4;j++)m.add(G.round,j%2?pink:cream,[side*(6.1+j*.6),11.3,1.8],[.28,.3,.16]);
 }
 m.add(G.box,purple,[0,10.7,0],[14,2,3]);m.add(G.box,gold,[0,11.8,0],[16,.3,3.4]);star(m,0,13.2,1.3,1.6);
 for(let j=0;j<9;j++)m.add(G.round,j%2?pink:green,[(j-4)*1.45,9.95,1.65],[.27,.27,.15],[],true);
 for(let x=0;x<8;x++)for(let z=0;z<3;z++)m.add(G.box,(x+z)%2?cream:purple,[(x-3.5)*1.9,-.57,(z-1)*1.5],[1.85,.05,1.45]);
 v.batch(m,root);
 const curtain=new WorldModel();for(let j=0;j<6;j++)curtain.add(G.pole,j%2?'#bd7dac':'#a96d9a',[(j-2.5)*.35,0,0],[.27,7.4,.32]);
 curtain.add(G.box,gold,[0,-.9,.35],[2.1,.2,.15]);const drapes=v.pool(curtain,2,root);
 const puppet=new WorldModel();puppet.add(G.round,cream,[0,1.45,0],[.65,.7,.45]);eyes(puppet,0,1.48,.4,.8);
 puppet.add(G.pole,cream,[0,.45,0],[.11,1.1,.11]);
 for(let j=0;j<3;j++)puppet.add(G.box,cream,[0,.65-j*.3,0],[.95-j*.12,.12,.19]);
 for(const side of [-1,1]){
  puppet.add(G.round,gold,[side*.44,.8,0],[.12,.12,.13]);
  puppet.add(G.pole,'#a3a59b',[side*.9,1.7,0],[.018,3,.018]);
 }
 puppet.add(G.box,gold,[0,3.2,0],[2.2,.12,.15]);puppet.add(G.cone,pink,[0,2.32,0],[.55,1.1,.45]);
 const puppets=v.pool(puppet,3,root),sparkModel=new WorldModel();star(sparkModel,0,0,0,.32);const sparks=v.pool(sparkModel,18,root);
 const arm=new WorldModel();arm.add(G.pole,cream,[0,-.42,0],[.1,.85,.1]);arm.add(G.round,cream,[0,-.93,0],[.22,.23,.14]);
 const leg=new WorldModel();leg.add(G.pole,cream,[0,-.42,0],[.1,.85,.1]);leg.add(G.box,gold,[0,-.94,.16],[.38,.22,.6]);
 const arms=v.pool(arm,6,root),legs=v.pool(leg,6,root);
 v.animate((t,d,reduced)=>{
  const hello=arrival(d,s.start+s.length/2,24),clock=reduced?0:t;
  for(let i=0;i<2;i++)v.place(drapes,i,(i?1:-1)*(4.7+hello*1.15),3.8,1.2,1,0,0,0);
  for(let i=0;i<3;i++){
   const x=i===1?0:(i-1)*7.9,y=(i===1?7.2:2.8)+(reduced?0:hello*Math.max(0,Math.sin(clock*4+i))*.65),size=i===1?1:1.25;
   v.place(puppets,i,x,y,2.1,size,0,0,0);
   for(let j=0;j<2;j++){const side=j?1:-1,swing=reduced?0:Math.sin(clock*5+i+j*Math.PI)*hello;
    v.place(arms,i*2+j,x+side*.44*size,y+.8*size,2.1,size,0,0,side*(.65+hello*.4)+swing*.5);
    v.place(legs,i*2+j,x+side*.25*size,y,2.1,size,swing*.35,0,side*.16+swing*.3);
   }
  }
  for(let i=0;i<18;i++){const a=i*2.4+clock*.3;v.place(sparks,i,Math.sin(a)*7.2,12+Math.cos(a)*1.1,1.8,.5+hello*.5,0,0,a);}
 });
}

function potionTower(s:MiniSection,v:VariantBuilder){
 const c=witchHatCenter(s),r=Math.max(2.4,c.radius-2.9),height=s.amplitude+3,m=new WorldModel();
 pedestal(m,c.x,1.2,c.z,r+.25);
 const levels=[.17,.44,.71].map(f=>2+f*height);
 for(let i=0;i<3;i++){
  const y=levels[i];m.add(G.round,[purple,pink,'#8bb7af'][i],[c.x,y,c.z],[r*.8,height*.115,r*.8]);
  m.add(G.pole,[green,'#f4d090','#bfdaef'][i],[c.x,y+.1,c.z],[r*.82,.7,r*.82],[],true);
  m.add(G.pole,gold,[c.x,y+height*.105,c.z],[r*.45,.22,r*.45]);m.add(G.pole,purple,[c.x,y+height*.15,c.z],[r*.32,height*.12,r*.32]);
  eyes(m,c.x,y,c.z+r*.76,.85);
  gauge(m,c.x+r*.63,y+height*.07,c.z+r*.65,.62);
  for(const side of [-1,1])m.beam(gold,new T.Vector3(c.x+side*r*.67,y-height*.11,c.z),new T.Vector3(c.x+side*r*.67,y+height*.11,c.z),.15);
  for(let j=0;j<8;j++){const a=j*Math.PI/4;m.add(G.round,cream,[c.x+Math.sin(a)*r*.8,y+.12,c.z+Math.cos(a)*r*.8],[.08,.08,.08],[],true);}
 }
 // Copper plumbing and a spiral of tiny indicator bulbs connect the three vats.
 let lastPipe:T.Vector3|undefined;
 for(let j=0;j<48;j++){const a=j*.3,y=2+j*height/52,p=new T.Vector3(c.x+Math.sin(a)*r*.94,y,c.z+Math.cos(a)*r*.94);m.add(G.round,gold,p.toArray(),[.18,.18,.18]);if(lastPipe)m.beam(gold,lastPipe,p,.1);lastPipe=p;}
 for(let j=0;j<8;j++){const a=j*Math.PI/4;m.add(G.box,gold,[c.x+Math.sin(a)*r*.7,1.65,c.z+Math.cos(a)*r*.7],[.5,1,.5],[0,a,0]);}
 m.add(G.pole,gold,[c.x,height*.5,c.z],[.23,height,.23]);v.batch(m);
 const spoon=new WorldModel();spoon.add(G.box,gold,[0,0,0],[r*1.55,.2,.3]);spoon.add(G.round,cream,[r*.7,0,0],[.4,.12,.5]);
 const spoons=v.pool(spoon,3),bubble=v.pool(orb(),36),rocket=new WorldModel();
 rocket.add(G.pole,'#c4a17b',[0,0,0],[r*.32,1.3,r*.32]);rocket.add(G.cone,pink,[0,1.15,0],[r*.39,1.6,r*.39]);eyes(rocket,0,.2,r*.3,.6);
 for(const side of [-1,1])rocket.add(G.cone,gold,[side*r*.32,-.5,0],[.4,1,.4],[0,0,-side*.4]);
 const cork=v.pool(rocket,1),needles=v.pool(gaugeNeedle(),3),pulses=new CrossingPulses([at(s,.4)]);
 v.animate((t,d,reduced)=>{
  pulses.update(t,d);const age=pulses.age(0,t),hello=arrival(d,at(s,.4),40),u=T.MathUtils.clamp(age/4,0,1),jump=!reduced&&age>=0&&age<4?Math.sin(u*Math.PI)**.8*7:0;
  for(let i=0;i<3;i++){
   v.place(spoons,i,c.x,levels[i]+height*.12,c.z,1,0,reduced?0:t*.5+i+hello,0);
   v.place(needles,i,c.x+r*.63,levels[i]+height*.07,c.z+r*.65+.25,.56,0,0,1.5-hello*2.8);
  }
  v.place(cork,0,c.x,height*.94+jump,c.z,1,0,reduced?0:jump*.4,0);
  for(let i=0;i<36;i++){
   const q=reduced?i/36:(t*.22+i/36)%1,a=i*2.4,exhaust=i>=24&&jump>.1;
   v.place(bubble,i,c.x+Math.sin(a)*(exhaust?.5:r*.5),exhaust?height*.94+jump-1-q*5:2+q*height,c.z+Math.cos(a)*(exhaust?.5:r*.5),exhaust?(.2+.45*q)*Math.min(1,jump):(.1+Math.sin(q*Math.PI)*.17)*(1+hello*.3));
  }
 });
}

function moonConservatory(s:MiniSection,v:VariantBuilder){
 const c=witchHatCenter(s),r=Math.max(2.3,c.radius-3),height=s.amplitude+3,m=new WorldModel();
 const potY=1.8;m.add(G.pole,pink,[c.x,potY,c.z],[r,2.6,r]);m.add(G.pole,gold,[c.x,potY+1.4,c.z],[r+.2,.25,r+.2]);
 eyes(m,c.x,potY+.2,c.z+r*.94,1.2);
 let previous=new T.Vector3(c.x,2,c.z);
 for(let i=1;i<=18;i++){const y=2+i*height/18,p=new T.Vector3(c.x+Math.sin(i*.28)*r*.3,y,c.z+Math.cos(i*.3)*r*.2);m.beam('#86a78d',previous,p,.3*(1-i/35));previous=p;
  if(i%3===0)for(let j=0;j<3;j++){const a=j*Math.PI*2/3+i*.4,end=new T.Vector3(c.x+Math.sin(a)*r*.68,y+.6,c.z+Math.cos(a)*r*.68);m.beam(gold,p,end,.12);m.add(G.round,green,end.toArray(),[1.45,.28,.85],[0,a,.3],false);}
 }
 // An open, jewel-like greenhouse: thin ribs define a full silhouette without
 // transparent glass or hiding the railway. All ribs stay inside the coils.
 for(let j=0;j<8;j++){
  const a=j*Math.PI/4;let prev:T.Vector3|undefined;
  for(let k=0;k<=16;k++){const u=k/16,rad=r*(.86-.55*Math.max(0,(u-.8)/.2)),p=new T.Vector3(c.x+Math.sin(a)*rad,3+u*(height+1),c.z+Math.cos(a)*rad);if(prev)m.beam(gold,prev,p,.055);prev=p;}
 }
 for(const f of [.12,.5,.87])for(let j=0;j<24;j++){const a=j*Math.PI/12,b=(j+1)*Math.PI/12,u=f*height/(height+1),rad=r*(.86-.55*Math.max(0,(u-.8)/.2));m.beam(gold,new T.Vector3(c.x+Math.sin(a)*rad,3+f*height,c.z+Math.cos(a)*rad),new T.Vector3(c.x+Math.sin(b)*rad,3+f*height,c.z+Math.cos(b)*rad),.035);}
 for(let i=0;i<9;i++){const a=i*2.399;m.add(G.round,['#e4b5d5','#c8dff0',green][i%3],[c.x+Math.sin(a)*r*.6,3+i*height*.08,c.z+Math.cos(a)*r*.6],[.38,.45,.27],[],true);}
 // Floating moon canopy sits above the centre, clear of the rising track.
 m.add(G.round,cream,[c.x,height+4.5,c.z],[2,2,.27],[],true);m.add(G.round,purple,[c.x+.8,height+4.85,c.z+.2],[1.6,1.65,.18]);
 v.batch(m);
 const leaf=new WorldModel();leaf.add(G.round,pink,[0,1.05,0],[.65,1.65,.22]);leaf.add(G.pole,gold,[0,1.1,.2],[.05,2.8,.05]);
 const petals=v.pool(leaf,28),moth=new WorldModel(),wing=new WorldModel();petals.forEach(m=>m.name='moonflower-petals');
 wing.add(G.round,'#e5d7ac',[.62,.1,0],[.68,.55,.14]);wing.add(G.round,pink,[.45,-.4,0],[.42,.4,.1]);
 for(const face of [-1,1])wing.add(G.round,purple,[.72,.12,face*.13],[.19,.21,.035]);
 moth.add(G.round,green,[0,0,.15],[.13,.6,.16]);moth.add(G.pole,gold,[.14,.6,0],[.025,.55,.025],[0,0,-.5]);moth.add(G.pole,gold,[-.14,.6,0],[.025,.55,.025],[0,0,.5]);
 const moths=v.pool(moth,6),wings=v.pool(wing,12),spark=v.pool(orb('#e5e5b0'),18);
 v.animate((t,d,reduced)=>{
  const hello=arrival(d,at(s,.4),45),clock=reduced?0:t;
  for(let i=0;i<10;i++){const a=i*Math.PI/5;v.place(petals,i,c.x+Math.sin(a)*.8,height+1.8,c.z+Math.cos(a)*.8,.8,hello*.8,a,0,'YXZ');}
  // Three moonflower crowns open in sequence down the spiral, giving the
  // glasshouse a living silhouette rather than an empty wire cage.
  for(let crown=0;crown<3;crown++)for(let j=0;j<6;j++){
   const a=j*Math.PI/3,turn=arrival(d,at(s,.48+crown*.16),18),y=height*(.7-crown*.22)+3;
   v.place(petals,10+crown*6+j,c.x+Math.sin(a)*.5,y,c.z+Math.cos(a)*.5,.7,.2+turn*.85,a,0,'YXZ');
  }
  for(let i=0;i<6;i++){
   const a=i*2.399+clock*.25,rad=r*.49,x=c.x+Math.sin(a)*rad,y=6+i*height*.12+Math.sin(clock+i)*.35,z=c.z+Math.cos(a)*rad;
   v.place(moths,i,x,y,z,1,0,a,0);
   for(let j=0;j<2;j++){const flap=reduced?.3:.3+Math.sin(clock*5+i)*.45;v.place(wings,i*2+j,x,y,z,1,0,a+(j?Math.PI-flap:flap),0);}
  }
  for(let i=0;i<18;i++){const u=reduced?i/18:(clock*.09+i/18)%1,a=i*2.399;v.place(spark,i,c.x+Math.sin(a)*r*.83,3+u*height,c.z+Math.cos(a)*r*.83,.08+hello*.09);}
 });
}

export function createHalloweenVariant(s:MiniSection,option:AlternativeOption,material:T.Material,lights:FairgroundLights){
 if(!['pumpkinhop','pumpkintunnel','witchhat'].includes(s.kind))return;
 const v=new VariantBuilder(material,lights);
 if(s.kind==='pumpkinhop')(option==='b'?potionHops:ghostLaundry)(s,v);
 else if(s.kind==='pumpkintunnel')(option==='b'?monsterPortal:puppetPortal)(s,v);
 else(option==='b'?potionTower:moonConservatory)(s,v);
 v.update(0,s.start-12,false);return v;
}
