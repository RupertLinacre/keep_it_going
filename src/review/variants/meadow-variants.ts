import * as T from 'three';
import type { MiniSection } from '../../games/mini-track';
import type { PieceAnimation } from '../../games/piece-animation';
import type { FairgroundLights } from '../../games/world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { VariantBuilder, CrossingPulses, point, at, arrival, type InstancePool } from './variant-kit';

const TAU=Math.PI*2;
const palette=['#e9a08e','#8ec7c0','#ebcd79','#bba5ce'];
const clamp=T.MathUtils.clamp;
const smooth=(x:number)=>{const v=clamp(x,0,1);return v*v*(3-2*v);};

// Articulated wings bend about their owner's local X axis. Reused scratch
// transforms keep the correct hinge order without allocating during update.
const jointEuler=new T.Euler(),jointBody=new T.Quaternion(),jointBend=new T.Quaternion(),jointAxis=new T.Vector3(1,0,0);
function placeWing(v:VariantBuilder,pool:InstancePool,index:number,x:number,y:number,z:number,size:number,yaw:number,roll:number,bend:number){
 jointBody.setFromEuler(jointEuler.set(0,yaw,roll)).multiply(jointBend.setFromAxisAngle(jointAxis,bend));jointEuler.setFromQuaternion(jointBody);
 v.place(pool,index,x,y,z,size,jointEuler.x,jointEuler.y,jointEuler.z);
}

function ellipse(m:WorldModel,color:string,x:number,y:number,z:number,rx:number,rz:number){
 const v:number[]=[];
 for(let i=0;i<36;i++){
  const a=i*TAU/36,b=(i+1)*TAU/36;
  v.push(x,y,z,x+Math.cos(b)*rx,y,z+Math.sin(b)*rz,x+Math.cos(a)*rx,y,z+Math.sin(a)*rz);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();m.add(g,color,[0,0,0]);g.dispose();
}
function roof(m:WorldModel,x:number,y:number,z:number,r:number,height:number){
 for(let i=0;i<12;i++){
  const a=i*TAU/12,b=(i+1)*TAU/12;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x,y+height,z,x+Math.sin(a)*r,y,z+Math.cos(a)*r,x+Math.sin(b)*r,y,z+Math.cos(b)*r],3));g.computeVertexNormals();
  m.add(g,i%2?'#fff0c8':palette[Math.floor(i/3)],[0,0,0]);g.dispose();
 }
}
function sheep(costume:'circus'|'scarf'|undefined=undefined){
 const m=new WorldModel();
 m.add(G.round,'#fff2d6',[0,1,0],[1,.65,.67]);
 for(const x of [-.55,.55])for(const z of [-.36,.36])m.add(G.pole,'#777278',[x,.32,z],[.1,.64,.1]);
 for(const x of [-.5,0,.5])m.add(G.rock,'#fff7e4',[x,1.35,.08],[.42,.4,.48]);
 m.add(G.round,'#766b75',[.84,1.13,0],[.41,.41,.4]);
 for(const z of [-.32,.32]){
  m.add(G.rock,'#938392',[.86,1.46,z],[.26,.12,.26]);
  m.add(G.round,'#fff9e7',[1.04,1.24,z],[.12,.13,.065]);m.add(G.rock,'#534a56',[1.1,1.24,z*1.13],[.05,.06,.03]);
 }
 m.add(G.round,'#efb8b5',[1.23,1.06,0],[.08,.16,.23]);
 if(costume==='circus'){
  // A tiny ringmaster costume gives the tumbling performer a readable front.
  m.add(G.pole,'#8ebcb6',[.82,1.6,0],[.45,.1,.45]);m.add(G.pole,'#bba6cd',[.82,1.86,0],[.27,.46,.27]);
  m.add(G.pole,'#f3d78f',[.82,1.72,0],[.28,.1,.28]);
  for(const side of [-1,1])m.add(G.rock,'#e8a092',[1.2,.81,side*.2],[.12,.17,.23],[side*.4,0,0]);
  m.add(G.round,'#ebcf84',[1.23,.81,0],[.13,.13,.12]);
 }else if(costume==='scarf'){
  m.add(G.round,'#d9a4b9',[.65,.83,0],[.43,.18,.7]);
  m.add(G.box,'#d9a4b9',[.63,.53,.58],[.44,.68,.1],[0,0,.18]);
  for(let i=0;i<3;i++)m.add(G.box,i%2?'#e8c77e':'#a5c7bd',[.63,.32+i*.17,.647],[.4,.07,.045]);
  for(let i=0;i<4;i++)m.add(G.pole,'#edd4a3',[.46+i*.1,.13,.64],[.027,.22,.027]);
 }
 return m;
}
function star(){
 const m=new WorldModel(),v:number[]=[];
 for(let i=0;i<10;i++){
  const a=i*Math.PI/5,b=(i+1)*Math.PI/5,ra=i%2?.43:1,rb=(i+1)%2?.43:1;
  v.push(0,0,.1,Math.sin(a)*ra,Math.cos(a)*ra,0,Math.sin(b)*rb,Math.cos(b)*rb,0);
  v.push(0,0,-.1,Math.sin(b)*rb,Math.cos(b)*rb,0,Math.sin(a)*ra,Math.cos(a)*ra,0);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();m.add(g,'#f2cb73',[0,0,0]);g.dispose();return m;
}
function ribbonGround(m:WorldModel,s:MiniSection){
 const rows=[-6,-3,0,3,6];
 for(let j=0;j<4;j++){
  const v:number[]=[];
  for(let i=0;i<32;i++){
   const a=point(s,i/32),b=point(s,(i+1)/32),ya=Math.max(.08,a.y-2),yb=Math.max(.08,b.y-2);
   const p=(f:T.Vector3,z:number,y:number)=>[f.x,y*(1-Math.abs(z)/6),f.z+z];
   v.push(...p(a,rows[j],ya),...p(a,rows[j+1],ya),...p(b,rows[j],yb),...p(b,rows[j],yb),...p(a,rows[j+1],ya),...p(b,rows[j+1],yb));
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();m.add(g,j%2?'#a8c98d':'#bfd59c',[0,0,0]);g.dispose();
 }
}
function bridge(m:WorldModel,s:MiniSection,color='#b7c991'){
 let last:T.Vector3[]|undefined;
 for(let d=0;d<=s.length;d+=3){
  const f=s.sample(s.start+d),p=f.position.clone();p.x-=s.origin.x;p.z-=s.origin.z;
  m.add(G.box,color,[p.x,p.y-.4,p.z],[3.55,.2,2.9],new T.Euler().setFromQuaternion(f.rotation).toArray().slice(0,3) as number[]);
  if(Math.round(d)%6)continue;
  const posts=[-1,1].map(side=>p.clone().addScaledVector(f.right,side*1.95));
  for(let k=0;k<2;k++){
   const q=posts[k];m.add(G.pole,'#90a888',[q.x,q.y*.5,q.z],[.11,q.y,.11]);q.y+=.55;
   m.add(G.round,'#efd497',[q.x,q.y,q.z],[.18,.18,.18]);
   if(last)m.beam('#d0d6a5',last[k],q,.055);
  }
  last=posts;
 }
}
function water(m:WorldModel,s:MiniSection,z:number){
 ellipse(m,'#b9cf91',s.span*.5,.06,z,s.span*.42,14.7);
 ellipse(m,'#d2dfad',s.span*.5,.11,z,s.span*.395,13.8);
 ellipse(m,'#7cbfbb',s.span*.5,.18,z,s.span*.37,12.8);
 ellipse(m,'#97d0c7',s.span*.53,.19,z+1,s.span*.26,8);
}
function finish(v:VariantBuilder,s:MiniSection){v.update(0,s.start-100,true);return v;}

/** Three enormous circus trampolines; sheep bounce inside the star hoops,
 * always at least 4.5m to the side of the carriage corridor. */
function circus(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new VariantBuilder(material,lights),m=new WorldModel();ribbonGround(m,s);
 const sites=[.18,.5,.82].map((t,i)=>{const p=point(s,t);return {x:p.x,y:Math.max(1.5,p.y-3.2),z:p.z+(i%2?-1:1)*8.4,at:at(s,t)};});
 for(const [i,p]of sites.entries()){
  for(let j=0;j<8;j++){
   const a=j*TAU/8,x=p.x+Math.sin(a)*2.65,z=p.z+Math.cos(a)*2.65;
   m.add(G.pole,j%2?'#f0d58d':'#b79cc5',[x,p.y*.5,z],[.14,p.y,.14]);
   m.add(G.round,palette[i],[x,.2,z],[.35,.2,.35]);
  }
  m.add(G.ring,'#edd3a1',[p.x,p.y+.12,p.z],[3.16,3.16,3.16],[Math.PI/2,0,0]);
  for(let j=0;j<16;j++) {
   const a=j*TAU/16;m.beam('#eee0b6',new T.Vector3(p.x+Math.sin(a)*2.73,p.y+.2,p.z+Math.cos(a)*2.73),new T.Vector3(p.x+Math.sin(a)*3.15,p.y+.2,p.z+Math.cos(a)*3.15),.04);
  }
  m.add(G.ring,'#f8e7b7',[p.x,p.y+3.4,p.z-.28],[3.1,3.1,3.1]);
  for(const side of [-1,1])m.add(G.pole,'#90b7aa',[p.x+side*3.15,(p.y+3.4)/2,p.z-.28],[.12,p.y+3.4,.12]);
  for(let j=0;j<8;j++){
   const a=j*TAU/8;m.add(G.round,palette[j%4],[p.x+Math.sin(a)*3.1,p.y+3.4+Math.cos(a)*3.1,p.z-.25],[.21,.21,.17]);
  }
 }
 const tentX=s.span*.13,tentZ=Math.min(...s.frames.map(f=>f.position.z-s.origin.z))-11.5;
 // Canvas panels leave a true open doorway rather than a dark decal.
 for(let j=0;j<12;j++)if(j!==0&&j!==11) {
  const a=j*TAU/12,b=(j+1)*TAU/12;
  m.add(G.box,j%2?'#efc1a4':'#f6e3b9',[tentX+(Math.sin(a)+Math.sin(b))*2.725,1.1,tentZ+(Math.cos(a)+Math.cos(b))*2.725],[2.83,2.2,.14],[0,(a+b)/2,0]);
 }
 roof(m,tentX,2.2,tentZ,5.8,4.7);
 for(const side of [-1,1])m.add(G.rock,'#d6a8bf',[tentX+side*2.15,1.18,tentZ+4.7],[.7,1.3,.28],[0,0,side*.2]);
 m.add(G.pole,'#a8997b',[tentX,7.45,tentZ],[.075,1.2,.075]);
 m.add(G.box,'#e9a18b',[tentX+.62,7.8,tentZ],[1.25,.7,.06]);
 const mat=new WorldModel(),matVertices:number[]=[];
 // A shallow radial mesh stretches from a fixed rim to the sheep's feet.
 for(let j=0;j<24;j++)for(let ring=0;ring<3;ring++){
  const a=j*TAU/24,b=(j+1)*TAU/24,r0=ring/3,r1=(ring+1)/3;
  const q=(r:number,t:number)=>[Math.sin(t)*2.76*r,-(1-r*r),Math.cos(t)*2.76*r];
  matVertices.push(...q(r0,a),...q(r1,a),...q(r1,b),...q(r0,a),...q(r1,b),...q(r0,b));
 }
 const bedGeometry=new T.BufferGeometry();bedGeometry.setAttribute('position',new T.Float32BufferAttribute(matVertices,3));bedGeometry.computeVertexNormals();mat.add(bedGeometry,'#bbaacb',[0,0,0]);bedGeometry.dispose();
 const mats=v.pool(mat,3),lambs=v.pool(sheep('circus'),3),stars=v.pool(star(),6),pulses=new CrossingPulses(sites.map(p=>p.at));mats[0].name="trampoline-mats";lambs[0].name="trampoline-sheep";v.batch(m);
 const matPose=new T.Object3D();
 v.animate((time,distance,reduced)=>{
  pulses.update(time,distance);
  sites.forEach((p,i)=>{
   const age=pulses.age(i,time),active=!reduced&&age>=0&&age<5,cycle=active?Math.abs(Math.sin(age*3.6)):0,bounce=active?cycle*Math.exp(-age*.5)*4.2:0;
   const compression=active?.17*Math.exp(-age*.5)*Math.pow(1-cycle,4):.05;
   matPose.position.set(p.x,p.y+.275,p.z);matPose.rotation.set(0,0,0);matPose.scale.set(1,compression,1);matPose.updateMatrix();for(const mesh of mats)mesh.setMatrixAt(i,matPose.matrix);
   // One crisp somersault on the first rebound; subsequent bounces settle.
   const flip=!reduced&&age>0&&age<Math.PI/3.6?TAU*smooth(age/(Math.PI/3.6)):0;
   const lean=flip||(reduced?0:Math.sin(age>0?age*3.6:0)*bounce*.045),size=1.08;
   v.place(lambs,i,p.x+Math.sin(reduced?0:time*2+i)*bounce*.12+Math.sin(lean)*size,p.y+.275-compression+bounce+size*(1-Math.cos(lean)),p.z+.28,size,0,0,lean);
   for(let j=0;j<2;j++)v.place(stars,i*2+j,p.x+(j?1:-1)*3.15,p.y+7.15,p.z-.25,.63,0,reduced?0:time*.5+bounce*.3,(j?1:-1)*.15);
  });
 });return finish(v,s);
}

function reel(){
 const m=new WorldModel();
 for(const z of [-.84,.84])m.add(G.pole,'#d4b585',[0,0,z],[2.85,.23,2.85],[Math.PI/2,0,0]);
 m.add(G.pole,'#d8a9c2',[0,0,0],[2.5,1.55,2.5],[Math.PI/2,0,0]);
 for(let i=0;i<8;i++)m.add(G.ring,i%2?'#bba6cb':'#edbed1',[0,0,-.7+i*.2],[2.48,2.48,2.48]);
 for(let i=0;i<8;i++){
  const a=i*TAU/8;m.add(G.box,'#ecd49e',[Math.sin(a)*1.6,Math.cos(a)*1.6,.97],[.13,2.1,.11],[0,0,-a]);
 }
 m.add(G.round,'#9caaa1',[0,0,1.02],[.45,.45,.15]);return m;
}
function knitting(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new VariantBuilder(material,lights),m=new WorldModel(),center=point(s,.51),x=center.x,z=Math.min(...s.frames.map(f=>f.position.z-s.origin.z))-11.4;
 // The emerging scarf runs from the loom feet to its large take-up roller.
 const rollZ=center.z+8.8,scarfLength=rollZ-z;
 for(let i=0;i<18;i++)m.add(G.box,palette[i%3],[x,.15,z+(i+.5)*scarfLength/18],[6.3,.16,scarfLength/18+.01]);
 for(const side of [-1,1])m.add(G.box,'#bd9b72',[x+side*3.95,.66,rollZ],[.4,1.3,2.8]);
 for(const side of [-1,1]){
  m.add(G.box,'#bb9469',[x+side*6.15,5.45,z],[.55,10.9,.7]);
  m.add(G.round,'#e3c89c',[x+side*6.15,11,z],[.55,.55,.55]);
  m.add(G.box,'#c8a376',[x+side*9.6,.35,z+1],[6.4,.6,3.5]);
  for(const dx of [-2.4,2.4])m.add(G.pole,'#a88465',[x+side*9.6+dx,1.8,z+1],[.15,3.6,.15]);
 }
 for(const y of [1,10.5])m.add(G.box,'#c6a376',[x,y,z],[12.8,.5,.75]);
 for(let j=0;j<13;j++)m.add(G.pole,'#eed6ac',[x+(j-6)*.78,5.6,z+.1],[.022,9.2,.022]);
 for(let i=0;i<6;i++)m.add(G.round,palette[i%4],[x+(i-2.5)*1.5,11.2,z],[.44,.48,.44]);
 const patch=new WorldModel();
 for(let i=0;i<3;i++){
  patch.add(G.box,palette[i],[0,(i-1)*.33,0],[2.08,.33,.16]);
  for(const dx of [-.67,0,.67])for(const side of [-1,1])patch.beam('#f9e6be',new T.Vector3(dx,(i-1)*.33-.12,.13),new T.Vector3(dx+side*.16,(i-1)*.33+.11,.13),.035);
 }
 const needle=new WorldModel();needle.add(G.pole,'#e5d6aa',[0,3.55,0],[.09,7.1,.09]);needle.add(G.cone,'#a8aaa2',[0,7.5,0],[.11,.9,.11]);needle.add(G.round,'#9dbdb5',[0,-.2,0],[.33,.33,.33]);
 const roller=new WorldModel();roller.add(G.pole,'#dcaac0',[0,0,0],[1.2,7.3,1.2],[0,0,Math.PI/2]);
 for(const side of [-1,1])roller.add(G.pole,'#d1b184',[side*3.8,0,0],[1.38,.23,1.38],[0,0,Math.PI/2]);
 for(let j=0;j<12;j++){const a=j*TAU/12;roller.add(G.box,palette[j%3],[0,Math.sin(a)*1.17,Math.cos(a)*1.17],[7.25,.13,.23],[a,0,0]);}
 const shuttle=new WorldModel();shuttle.add(G.round,'#cba273',[0,0,0],[1.3,.25,.35]);shuttle.add(G.round,'#eac5d4',[0,.17,0],[.65,.23,.26]);shuttle.add(G.pole,'#9a9e91',[0,.23,0],[.075,1.95,.075],[0,0,Math.PI/2]);
 const reels=v.pool(reel(),2),cloth=v.pool(patch,21),needles=v.pool(needle,2),lambs=v.pool(sheep('scarf'),2),rollers=v.pool(roller,1),shuttles=v.pool(shuttle,1);
 reels[0].name="scarf-spools";cloth[0].name="woven-scarf";shuttles[0].name="loom-shuttle";
 // Threads visibly feed the working warp; scarf fringes finish the output.
 for(const side of [-1,1])for(let i=0;i<3;i++)m.beam(palette[i],new T.Vector3(x+side*9.6,5.5,z+1+i*.14),new T.Vector3(x+side*(2.3+i*.75),10.45,z+.14),.035);
 for(let i=0;i<14;i++)m.add(G.pole,palette[i%3],[x+(i-6.5)*.43,.3,rollZ+1.45],[.055,.5,.055],[Math.PI/2,0,0]);
 v.batch(m);const stop=at(s,.51);
 v.animate((time,distance,reduced)=>{
  const travel=clamp(distance-s.start,0,s.length+30),turn=reduced?0:time*.14+travel*.09,greet=arrival(distance,stop,30);
  for(const side of [-1,1])v.place(reels,side<0?0:1,x+side*9.6,3.25,z+1,1,0,0,side*turn);
  v.place(rollers,0,x,1.35,rollZ,1,turn,0,0);
  v.place(shuttles,0,x+(reduced?0:Math.sin(time*2+travel*.08)*3.7),5.15,z+.68,1);
  for(let i=0;i<21;i++){
   const drift=reduced?0:time*.15+travel*.12,y=1.55+((Math.floor(i/3)*1.23+8.5-drift%8.5)%8.5);
   v.place(cloth,i,x+(i%3-1)*2.08,y,z+.26,1);
  }
  for(let i=0;i<2;i++)v.place(needles,i,x+(i?1:-1)*4.25,2.3,z+.65,1,0,0,(i?1:-1)*(.12+(reduced?0:Math.sin(time*5)*(.035+greet*.12))));
  for(let i=0;i<2;i++)v.place(lambs,i,s.span*(i?.82:.18),.3+(reduced?0:Math.abs(Math.sin(time*3+i))*greet*.45),center.z+8.4,1.4,0,i?Math.PI:0,reduced?0:(i?1:-1)*Math.sin(time*3+i)*greet*.08);
 });return finish(v,s);
}

function frog(){
 const m=new WorldModel();
 for(const side of [-1,1]){
  m.add(G.round,'#80af86',[side*.9,.45,.1],[.9,.48,.85]);m.add(G.round,'#a6c795',[side*.82,.19,.78],[.7,.18,.48]);
 }
 m.add(G.round,'#9ac793',[0,1.15,0],[1.18,1.1,.9]);m.add(G.round,'#deebad',[0,1.15,.67],[.82,.75,.22]);
 m.add(G.round,'#94bd82',[0,2.05,.15],[1.2,.73,.83]);
 for(const side of [-1,1]){
  m.add(G.round,'#8bb780',[side*.68,2.62,.13],[.48,.5,.47]);
  m.add(G.round,'#fff2ce',[side*.68,2.72,.47],[.31,.34,.18]);m.add(G.round,'#57645b',[side*.68,2.72,.62],[.12,.17,.055]);
  m.add(G.rock,'#e7b8ac',[side*.9,1.9,.81],[.21,.12,.07]);
 }
 m.add(G.round,'#637e67',[0,1.84,.91],[.42,.065,.03]);
 m.add(G.round,'#9cc38c',[-.83,1.22,.89],[.25,.22,.2]);m.add(G.round,'#9cc38c',[.83,1.22,.89],[.25,.22,.2]);return m;
}
function musicNote(){
 const m=new WorldModel();m.add(G.pole,'#c1a2d1',[.28,.49,0],[.07,.95,.07]);m.add(G.round,'#c1a2d1',[0,0,0],[.34,.22,.14],[0,0,.25]);
 m.add(G.box,'#e4bed0',[.48,.88,0],[.48,.12,.11],[0,0,-.25]);return m;
}
function orchestra(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new VariantBuilder(material,lights),m=new WorldModel(),z=s.hand*4;water(m,s,z);bridge(m,s);
 const sites=[{x:s.span*.23,y:.36,z:z+8.2,size:1.35},{x:s.span*.5,y:.84,z:z-9.4,size:1.7},{x:s.span*.76,y:.36,z:z+7.8,size:1.45}];
 m.add(G.pole,'#d9c89b',[sites[1].x,.58,sites[1].z],[2.2,.5,2.2]);
 sites.forEach((p,i)=>{
  m.add(G.round,'#82b886',[p.x,.25,p.z],[3.5,.18,2.9]);
  for(let j=0;j<7;j++){
   const a=j*TAU/7;m.add(G.rock,j%2?'#f0b9cb':'#f4d4d6',[p.x+Math.sin(a)*2.5,.5,p.z+Math.cos(a)*2.05],[.7,.23,.53],[0,-a,0]);
  }
  // Reed organ pipes rise beside each lily stage.
  for(let j=0;j<3;j++){
   const px=p.x-3.7+j*.35,h=2.2+j*.75;m.add(G.pole,'#adc397',[px,h*.5,p.z-.8],[.13,h,.13]);m.add(G.pole,'#eee1a9',[px,h,p.z-.8],[.2,.17,.2]);
  }
 });
 const brass=sites[0],drummer=sites[2],bx=brass.x+1.13,bz=brass.z+1.22;
 m.add(G.ring,'#e8c37d',[bx,1.65,bz],[.85,1.05,.85]);
 m.add(G.pole,'#edce8d',[bx+.78,2.3,bz],[.18,1.65,.18]);
 m.add(G.cone,'#efd39a',[bx+.78,3.2,bz],[.83,1.05,.83],[Math.PI,0,0]);
 m.add(G.pole,'#988f68',[bx+.78,3.72,bz],[.64,.03,.64]);
 for(let i=0;i<3;i++)m.add(G.pole,'#f6dfad',[bx-.35+i*.32,2.39,bz+.15],[.075,.42,.075]);
 // The percussion frog has a broad two-octave wooden xylophone.
 m.add(G.box,'#b4916a',[drummer.x,1.25,drummer.z+1.85],[4,.2,1.55]);
 for(let i=0;i<8;i++)m.add(G.box,palette[i%4],[drummer.x+(i-3.5)*.43,1.43,drummer.z+1.85],[.36,.15,1.45-i*.09]);
 for(const side of [-1,1])m.add(G.box,'#c4a57b',[drummer.x+side*1.55,.71,drummer.z+1.85],[.16,1.12,.9]);
 const baton=new WorldModel();baton.add(G.pole,'#dcc9a0',[0,.68,0],[.055,1.35,.055]);baton.add(G.round,'#fff1c3',[0,1.4,0],[.13,.13,.13]);
 const cheek=new WorldModel();cheek.add(G.round,'#d9e6a1',[0,0,0],[.76,.4,.39]);cheek.add(G.round,'#729869',[0,.26,.3],[.38,.055,.03]);
 const throats=v.pool(cheek,3);throats[0].name="frog-throats";
 const frogs=v.pool(frog(),3),batons=v.pool(baton,3),notes=v.pool(musicNote(),12),pulses=new CrossingPulses([.23,.5,.76].map(t=>at(s,t)));batons[0].name="frog-batons";v.batch(m);
 v.animate((time,distance,reduced)=>{
  pulses.update(time,distance);
  sites.forEach((p,i)=>{
   const age=pulses.age(i,time),song=!reduced&&age>=0&&age<4?Math.exp(-age*.5):0,bob=reduced?0:Math.abs(Math.sin(time*5+i))*song*.28;
   const lean=reduced?0:Math.sin(time*4+i)*song*.04;
   v.place(frogs,i,p.x,p.y+bob,p.z,p.size,0,0,lean);
   const puff=reduced?0:song*(.25+.75*Math.max(0,Math.sin(time*6+i)));
   v.place(throats,i,p.x-Math.sin(lean)*1.57*p.size,p.y+bob+Math.cos(lean)*1.57*p.size,p.z+.84*p.size,p.size*(.42+puff*.7),0,0,lean);
   if(i===1)v.place(batons,0,p.x-1.15*p.size,p.y+1.3*p.size+bob,p.z+.95,1.2,0,0,-.4+(reduced?0:Math.sin(time*7)*song*.8));
   if(i===2)for(let j=0;j<2;j++) {
    const strike=reduced?0:Math.max(0,Math.sin(time*9+j*Math.PI))*song;
    v.place(batons,j+1,p.x+(j?1:-1)*.95,1.505+1.53*.7,p.z+1.85,.7,0,0,Math.PI-(1-strike)*.66);
   }
   for(let j=0;j<4;j++){
    const t=age-j*.3,active=!reduced&&t>=0&&t<2.7;
    v.place(notes,i*4+j,p.x+(i===0?1.9:0)+(active?Math.sin(t*2+j)*.5:0),p.y+(i===2?1.6:2.8*p.size)+(active?t*1.8:0),p.z+.8,active?.5*(1-t/3):.001,0,0,active?Math.sin(t*2)*.18:0);
   }
  });
 });return finish(v,s);
}

function bathtub(m:WorldModel,s:MiniSection,z:number){
 const x=s.span*.5,rx=s.span*.405,rz=13.6,ix=rx-1.05,iz=rz-1.05,side:number[]=[],rim:number[]=[];
 for(let i=0;i<40;i++){
  const a=i*TAU/40,b=(i+1)*TAU/40;
  const p=(angle:number,r1:number,r2:number,y:number)=>[x+Math.cos(angle)*r1,y,z+Math.sin(angle)*r2];
  const a1=p(a,rx,rz,2.3),b1=p(b,rx,rz,2.3),a0=p(a,rx*.96,rz*.94,.42),b0=p(b,rx*.96,rz*.94,.42),ai=p(a,ix,iz,2.3),bi=p(b,ix,iz,2.3);
  side.push(...a1,...b1,...a0,...a0,...b1,...b0);rim.push(...a1,...ai,...b1,...b1,...ai,...bi);
  const innerA=p(a,ix,iz,1.93),innerB=p(b,ix,iz,1.93);
  rim.push(...ai,...innerA,...bi,...bi,...innerA,...innerB);
 }
 for(const [verts,color]of [[side,'#e5bdd1'],[rim,'#fff0d5']] as const){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();m.add(g,color,[0,0,0]);g.dispose();}
 ellipse(m,'#97ccc5',x,1.96,z,ix,iz);ellipse(m,'#bce0d2',x-1,1.97,z+2,ix*.66,iz*.64);
 for(const side of [-1,1])for(const end of [-1,1])m.add(G.round,'#dec899',[x+side*rx*.6,.23,z+end*8.5],[1.7,.35,1.5]);
}
function bathDuck(){
 const m=new WorldModel();m.add(G.round,'#f2d483',[0,.65,0],[1.24,.7,.84]);m.add(G.round,'#ffe09b',[.7,1.56,0],[.64,.66,.61]);
 m.add(G.round,'#e7b36f',[1.3,1.44,.05],[.62,.105,.4]);m.add(G.rock,'#ffe5a8',[-1.05,.85,0],[.42,.35,.48],[0,0,-.4]);
 for(const side of [-1,1]){m.add(G.round,'#fff5d8',[.95,1.74,side*.47],[.15,.19,.1]);m.add(G.rock,'#626056',[1.02,1.75,side*.53],[.065,.095,.06]);}
 return m;
}
function bath(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new VariantBuilder(material,lights),m=new WorldModel(),z=s.hand*4;bathtub(m,s,z);bridge(m,s,'#e2c6a2');
 const tx=s.span*.26,tz=z-12.5;
 m.add(G.pole,'#d4bf97',[tx,2.65,tz],[.48,5.3,.48]);m.add(G.pole,'#f0d6a1',[tx,.34,tz],[1,.5,1]);
 const points=[new T.Vector3(tx,5.3,tz),new T.Vector3(tx,6.5,tz),new T.Vector3(tx+.7,7.2,tz+.6),new T.Vector3(tx+2,7.1,tz+1.7),new T.Vector3(tx+3,6.25,tz+2.7),new T.Vector3(tx+3,5.55,tz+3)];
 for(let i=1;i<points.length;i++)m.beam('#e4c99c',points[i-1],points[i],.4);
 m.add(G.pole,'#b8d2ca',[tx+3,5.48,tz+3],[.63,.28,.63]);
 const knob=new WorldModel();knob.add(G.round,'#d3a6be',[0,0,0],[.36,.36,.22]);for(let i=0;i<4;i++){const a=i*Math.PI/2;knob.add(G.pole,'#eccda0',[Math.sin(a)*.44,Math.cos(a)*.44,0],[.11,.8,.11],[0,0,-a]);knob.add(G.round,'#f6e5bd',[Math.sin(a)*.79,Math.cos(a)*.79,0],[.18,.18,.16]);}
 const foam=new WorldModel();foam.add(G.round,'#dfecda',[0,0,0],[1,1,1]);foam.add(G.rock,'#fff8df',[-.31,.39,.79],[.24,.16,.07]);
 const drop=new WorldModel();drop.add(G.round,'#a8d8d1',[0,0,0],[.22,.5,.22]);
 const wing=new WorldModel();wing.add(G.round,'#e6bc6d',[0,-.22,0],[.77,.4,.15]);wing.add(G.rock,'#f9d992',[-.25,-.33,.07],[.3,.17,.08]);
 const jaw=new WorldModel();jaw.add(G.round,'#d8a267',[.34,0,.05],[.56,.075,.36]);jaw.add(G.round,'#ecb19f',[.45,.066,.05],[.28,.025,.23]);
 const jaws=v.pool(jaw,4);jaws[0].name="duck-quacking-jaws";
 const wings=v.pool(wing,8),ducks=v.pool(bathDuck(),4),bubbles=v.pool(foam,18),drops=v.pool(drop,9),knobs=v.pool(knob,2);wings[0].name="bath-wings";ducks[0].name="bath-ducks";v.batch(m);
 const sites=[{x:s.span*.23,z:z+6.8,size:1.2},{x:s.span*.45,z:z-6.6,size:1.4},{x:s.span*.69,z:z+6.7,size:1.65},{x:s.span*.77,z:z-5.3,size:.85}],stop=at(s,.5);
 v.animate((time,distance,reduced)=>{
  const greet=arrival(distance,stop,s.length*.55),travel=clamp(distance-s.start,0,s.length+35),turn=reduced?0:time*.15+travel*.055;
  for(let i=0;i<4;i++){
   const p=sites[i],px=p.x+(reduced?0:Math.sin(turn+i)*.8),py=2.02+(reduced?0:Math.sin(time*2+i)*(.05+greet*.13)),yaw=(i%2?Math.PI:0)+(reduced?0:Math.sin(turn+i)*.2),roll=reduced?0:Math.sin(time*2.5+i)*greet*.06;
   v.place(ducks,i,px,py,p.z,p.size,0,yaw,roll);
   const chirp=reduced?0:greet*Math.pow(Math.max(0,Math.sin(time*8+i*1.6)),3)*.4;
   const jawX=(.95*Math.cos(roll)-1.34*Math.sin(roll))*p.size,jawY=(.95*Math.sin(roll)+1.34*Math.cos(roll))*p.size;
   v.place(jaws,i,px+jawX*Math.cos(yaw),py+jawY,p.z-jawX*Math.sin(yaw),p.size,0,yaw,roll-chirp,'YXZ');
   for(let j=0;j<2;j++){
    const side=j?1:-1,lx=(-.12*Math.cos(roll)-Math.sin(roll))*p.size,ly=(-.12*Math.sin(roll)+Math.cos(roll))*p.size,lz=side*.68*p.size,flap=reduced?0:(.2+.6*greet)*(.5+.5*Math.sin(time*7+i));
    placeWing(v,wings,i*2+j,px+lx*Math.cos(yaw)+lz*Math.sin(yaw),py+ly,p.z-lx*Math.sin(yaw)+lz*Math.cos(yaw),p.size,yaw,roll,-side*flap);
   }
  }
  for(let i=0;i<18;i++){
   const t=reduced?(i%6)/6:(time*.16+i/18)%1,p=sites[i%4];
   v.place(bubbles,i,p.x+Math.sin(i*2.4)*1.6,2.2+t*(2.3+greet*1.8),p.z+Math.cos(i*2.4)*1.2,(.3+(i%3)*.2)*(1-t*.45));
  }
  for(let i=0;i<9;i++){const t=reduced?i/9:(time*.65+i/9)%1;v.place(drops,i,tx+3+Math.sin(t*7)*.08,5.34-t*3.3,tz+3,.75+greet*.35);}
  for(let i=0;i<2;i++)v.place(knobs,i,tx+(i?1:-1)*.95,3.2,tz+.42,.7,0,0,(i?1:-1)*turn);
 });return finish(v,s);
}

function cuckooBird(){
 const m=new WorldModel();m.add(G.round,'#91bfba',[0,.53,0],[.62,.72,.55]);m.add(G.round,'#f2d48a',[0,.49,.38],[.4,.5,.22]);m.add(G.round,'#b8d7b7',[0,1.16,.13],[.58,.54,.53]);
 for(const side of [-1,1]){m.add(G.round,'#f9ebc7',[side*.23,1.27,.56],[.17,.2,.085]);m.add(G.rock,'#5f6464',[side*.23,1.27,.63],[.075,.11,.035]);}
 m.add(G.cone,'#e9af78',[0,1.02,.91],[.25,.66,.2],[Math.PI/2,0,0]);m.add(G.rock,'#d4b1ca',[0,1.65,.08],[.22,.4,.17],[0,0,.25]);
 for(const side of [-1,1]){m.add(G.round,'#e4b97f',[side*.22,-.04,.43],[.14,.06,.25]);m.add(G.rock,'#e7b8b3',[side*.38,1.08,.55],[.13,.08,.035]);}
 for(let i=0;i<3;i++)m.add(G.rock,palette[i],[0,.32-i*.1,-.5-i*.22],[.23,.13,.34],[.15,0,0]);return m;
}
function cuckoo(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new VariantBuilder(material,lights),m=new WorldModel(),x=s.width*.5,z=Math.min(0,s.shift)-7.4,cy=s.origin.y+s.amplitude,base=Math.max(13,cy+3);
 const outline=new T.Shape();outline.moveTo(-3.35,0);outline.lineTo(3.35,0);outline.lineTo(4.45,base*.4);outline.lineTo(4.25,base);outline.lineTo(-4.25,base);outline.lineTo(-4.45,base*.4);outline.closePath();
 const casing=new T.ExtrudeGeometry(outline,{depth:3.4,bevelEnabled:false});m.add(casing,'#b7ceb6',[x,0,z-1.7]);casing.dispose();
 for(const side of [-1,1]){
  m.beam('#d9b989',new T.Vector3(x+side*3.35,0,z+1.74),new T.Vector3(x+side*4.45,base*.4,z+1.74),.16);
  m.beam('#d9b989',new T.Vector3(x+side*4.45,base*.4,z+1.74),new T.Vector3(x+side*4.25,base,z+1.74),.16);
 }
 m.add(G.box,'#e8c48f',[x,.35,z],[10,.6,4.1]);
 for(const side of [-1,1])m.add(G.box,side<0?'#d4a4b9':'#bfa4c8',[x+side*2.45,base+1.14,z],[5.6,.42,4.5],[0,0,-side*.42]);
 const face=new T.CylinderGeometry(1,1,1,24);m.add(face,'#e7ca93',[x,cy,z+1.94],[4.15,.35,4.15],[Math.PI/2,0,0]);m.add(face,'#fff0cb',[x,cy,z+2.16],[3.76,.12,3.76],[Math.PI/2,0,0]);face.dispose();
 for(let i=0;i<12;i++){const a=i*TAU/12;m.add(G.round,palette[i%4],[x+Math.sin(a)*3.22,cy+Math.cos(a)*3.22,z+2.27],[.23,.32,.1],[0,0,-a]);}
 const doorY=cy-6.25;
 m.add(G.box,'#7a8886',[x,doorY+.72,z+1.77],[2.1,2.05,.14]);m.add(G.box,'#efd9a7',[x,doorY-.39,z+2.2],[2.7,.24,1.1]);
 for(const side of [-1,1]){
  m.add(G.box,'#efd5a4',[x+side*1.16,doorY+.65,z+1.9],[.15,2.35,.2]);
  m.add(G.pole,'#b69772',[x+side*3.15,3.5,z+1.85],[.035,6,.035]);m.add(G.cone,'#d5b985',[x+side*3.15,.85,z+1.85],[.42,1.4,.42],[Math.PI,0,0]);
 }
 m.add(G.box,'#efd5a4',[x,doorY+1.85,z+1.9],[2.5,.2,.3]);
 // Carved gable, visible hanging chains and a proper cuckoo landing shelf.
 for(let i=0;i<7;i++)m.add(G.rock,palette[i%4],[x+(i-3)*1.06,base+.38-Math.abs(i-3)*.05,z+2.05],[.29,.37,.11]);
 for(const side of [-1,1]){
  m.add(G.box,'#e6ca99',[x+side*1.3,doorY-.17,z+2.42],[.16,.44,1.4]);
  for(let i=0;i<8;i++)m.add(G.ring,'#d5b984',[x+side*3.15,1.75+i*.58,z+1.87],[.13,.2,.13],[0,i%2?Math.PI/2:0,0]);
 }
 const hand=new WorldModel();hand.add(G.box,'#8fa9a3',[0,1.25,0],[.18,2.5,.13]);hand.add(G.rock,'#cb9bab',[0,2.55,0],[.36,.47,.16]);hand.add(G.round,'#c7a278',[0,0,.1],[.24,.24,.1]);
 const pendulum=new WorldModel();pendulum.add(G.pole,'#e3bd79',[0,-2.5,0],[.08,5,.08]);pendulum.add(G.pole,'#e8ca89',[0,-5,0],[.93,.27,.93],[Math.PI/2,0,0]);pendulum.add(G.round,'#f5dfaa',[0,-5,.18],[.45,.45,.12]);
 const door=new WorldModel();door.add(G.box,'#dfafaa',[.47,0,0],[.94,1.78,.15]);for(const y of [-.42,.42])door.add(G.box,'#efcfac',[.47,y,.1],[.8,.055,.055]);door.add(G.round,'#f5dfa5',[.78,-.05,.14],[.08,.08,.04]);
 const wing=new WorldModel();wing.add(G.rock,'#81aeb1',[0,-.3,0],[.3,.52,.3]);wing.add(G.rock,'#acd0c1',[0,-.55,.1],[.26,.2,.17]);
 const wings=v.pool(wing,2),hands=v.pool(hand,2),pendulums=v.pool(pendulum,1),birds=v.pool(cuckooBird(),1),doors=v.pool(door,2),notes=v.pool(musicNote(),5),pulse=new CrossingPulses([at(s,.43)]);hands[0].name="clock-hands";birds[0].name="cuckoo-bird";doors[0].name="cuckoo-doors";v.batch(m);
 v.animate((time,distance,reduced)=>{
  pulse.update(time,distance);const age=pulse.age(0,time),active=!reduced&&age>=0&&age<4,open=active?smooth(age/.35)*(1-smooth((age-3.15)/.6)):0;
  const travel=clamp(distance-s.start,0,s.length+30),turn=reduced?0:time*.16+travel*.09;
  v.place(hands,0,x,cy,z+2.35,1,0,0,-Math.PI/3-turn);v.place(hands,1,x,cy,z+2.47,.7,0,0,Math.PI/3-Math.PI/36-turn/12);
  v.place(pendulums,0,x,Math.max(6,doorY-.35),z+2.2,1,0,0,reduced?0:Math.sin(time*2.1)*(.22+arrival(distance,at(s,.5),35)*.28));
  const emerge=active?smooth((age-.38)/.42)*(1-smooth((age-2.7)/.4)):0,birdY=doorY-.26+(active?Math.max(0,Math.sin((age-.7)*8))*emerge*.22:0),birdZ=z+.6+emerge*2.3;
  v.place(birds,0,x,birdY,birdZ,.93);
  for(let j=0;j<2;j++){const side=j?1:-1;v.place(wings,j,x+side*.52*.93,birdY+.82*.93,birdZ,.93,0,0,side*(.22+(reduced?0:Math.sin(time*12)*emerge*.65)));}
  v.place(doors,0,x-1.01,doorY+.73,z+1.95,1,0,-open*1.55);v.place(doors,1,x+1.01,doorY+.73,z+1.95,1,0,Math.PI+open*1.55);
  for(let i=0;i<5;i++){const t=age-.3-i*.25,active=!reduced&&t>=0&&t<2.2;v.place(notes,i,x+Math.sin(i*1.8)*1.3,doorY+2+(active?t*1.6:0),z+2.6,active?.38*(1-t/2.2):.001,0,0,active?Math.sin(t*2)*.2:0);}
 });return finish(v,s);
}

function bee(){
 const m=new WorldModel();m.add(G.round,'#ebc772',[0,0,0],[.74,.44,.43]);
 for(const x of [-.37,0,.36])m.add(G.pole,'#8e7c65',[x,0,0],[.435,.14,.435],[0,0,Math.PI/2]);
 m.add(G.round,'#f2d489',[.69,.07,0],[.38,.4,.38]);
 for(const z of [-.26,.26]){m.add(G.round,'#fff3cf',[.89,.21,z],[.12,.15,.075]);m.add(G.rock,'#5e6058',[.95,.23,z*1.13],[.05,.07,.035]);}
 m.add(G.cone,'#9b8264',[-.89,0,0],[.15,.4,.15],[0,0,-Math.PI/2]);
 for(const side of [-1,1]){m.beam('#8e7c65',new T.Vector3(.73,.32,side*.16),new T.Vector3(.93,.67,side*.28),.035);m.add(G.round,'#d6a6bf',[.93,.67,side*.28],[.09,.09,.09]);}
 m.add(G.box,'#bba9cc',[-.29,-.32,.35],[.51,.43,.14]);m.add(G.box,'#f2e0b5',[-.29,-.29,.434],[.3,.15,.03]);return m;
}
function honeyFactory(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new VariantBuilder(material,lights),m=new WorldModel(),x=s.width*.5,cy=s.origin.y+s.amplitude,z=Math.min(0,s.shift)-7.2;
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
 jars[0].name="indexed-honey-jars";drops[0].name="honey-streams";fills[0].name="honey-fill-levels";v.batch(m);
 const stop=at(s,.5);
 v.animate((time,distance,reduced)=>{
  const greet=arrival(distance,stop,s.length*.5),travel=clamp(distance-s.start,0,s.length+30),turn=reduced?0:time*.15+travel*.028;
  v.place(flowers,0,x,cy,z-.22,1+(reduced?0:greet*.045*Math.sin(time*3)),0,0,turn*.6);
  for(let i=0;i<5;i++){
   const a=i*TAU/5+turn,r=5.5+(reduced?0:Math.sin(time*.9+i)*(.2+greet*.65));
   const bx=x+Math.sin(a)*r,by=cy+Math.cos(a)*r,bz=z+1.05;v.place(bees,i,bx,by,bz,.85,0,0,-a);
   for(let j=0;j<2;j++){
    const side=j?1:-1,flap=reduced?.25:.25+.6*Math.sin(time*18+i);
    placeWing(v,wings,i*2+j,bx+(-.13*Math.cos(a)+.25*Math.sin(a))*.85,by+(.13*Math.sin(a)+.25*Math.cos(a))*.85,bz+side*.31*.85,.85,0,-a,side*flap);
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
export function createMeadowVariant(section:MiniSection,option:'b'|'c',material:T.Material,lights:FairgroundLights):PieceAnimation|undefined {
 if(section.kind==='sheepbank')return (option==='b'?circus:knitting)(section,material,lights);
 if(section.kind==='pondbridge')return (option==='b'?orchestra:bath)(section,material,lights);
 if(section.kind==='windmillloop')return (option==='b'?cuckoo:honeyFactory)(section,material,lights);
 return undefined;
}
