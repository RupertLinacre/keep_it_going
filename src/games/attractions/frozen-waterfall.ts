import { waterfallBore, carveWaterfall, lineWaterfall, mantleWaterfall } from './waterfall-tunnel';
import { iceRibbon, iceGlitter, hangingLantern } from './waterfall-ice';
import * as T from 'three';
import type { MiniSection } from '../mini-track';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { ChristmasBuilder, C, chalet, lamp, railLights, sparkles, nearest } from './christmas-builder';
import { christmasLayout } from '../christmas-rails';

/** Matte faceted ice and a deliberately open, dry gallery beneath its curtain. */
export function frozenWaterfall(v:ChristmasBuilder,s:MiniSection){
 const m=new WorldModel(),l=christmasLayout('frozenwaterfall',s.width,s.amplitude,s.hand),x=l.center.x,z=l.center.z,h=s.amplitude,oy=s.origin.y,hand=s.hand;
 const bore=waterfallBore(s),terrain=new WorldModel(),glitter:T.Vector3[]=[];
 const rock=new T.IcosahedronGeometry(1,2),column=new T.CylinderGeometry(1,1,1,24,8);
 const ground=(shape:T.BufferGeometry,color:string,position:number[],scale:number[],rotation:number[]=[])=>terrain.add(shape,color,position,scale,rotation);
 const p=(dx:number,y:number,dz:number)=>[x+dx,y,z+dz*hand];
 const roofs=s.frames.filter((_,i)=>i%8===0).map(f=>f.position.clone().sub(new T.Vector3(s.origin.x,0,s.origin.z)).addScaledVector(f.up,1.1));
 const clearPost=(q:T.Vector3)=>!roofs.some(p=>p.y<q.y+1&&p.y>.3&&Math.hypot(p.x-q.x,p.z-q.z)<1.3);
 const beam=(color:string,a:number[],b:number[],r:number)=>m.beam(color,new T.Vector3(...a),new T.Vector3(...b),r);
 // The rear foundation stops short of the coach gallery. The front is genuinely
 // open from side to side, rather than hidden by an opaque decorative rock.
 ground(rock,'#7896b2',p(0,(oy+9)*.5,-3),[15,(oy+9)*.5,12]);
 ground(rock,'#a5bfd2',p(0,oy+9,0),[14,3,13]);
 const tiers=[{y:oy+10,r:13,d:8.2},{y:oy+17,r:9.6,d:6.4},{y:oy+h-1,r:6.5,d:5.4}];
 for(let k=0;k<tiers.length;k++){
  const t=tiers[k],bottom=k?tiers[k-1].y:t.y-3;
  ground(column,k%2?'#91afc7':'#a7c1d4',p(0,(t.y+bottom)/2,-1),[t.r,t.y-bottom,t.r],[0,k*.27,0]);
  ground(column,'#edf5ef',p(0,t.y+.1,-1),[t.r+.65,.6,t.r+.65],[0,k*.27,0]);
  // Broad staggered frozen sheets: irregular tips and crystalline blue ribs.
  const width=t.r*1.55,front=t.r+1;
  for(let i=0;i<11;i++){
   const dx=(i/10-.5)*width,len=t.d*(.8+.23*Math.sin(i*2.31+k));
   iceRibbon(m,p(dx,t.y,front),width/10+.13,len,.65,hand);
   for(let j=0;j<4;j++){const f=.12+j*.2;glitter.push(new T.Vector3(...p(dx+Math.sin(i*3+j)*width/35,t.y-len*f,front+.7)));}
   m.add(G.cone,i%2?'#bceaf0':'#8ed5e7',p(dx,t.y-len,front+.06),[width/19,len*.75,.6],[0,0,Math.PI]);
   m.add(G.rock,'#dff5f1',p(dx,t.y+.1,front-.9),[width/17,.25,.65]);
  }
  for(const side of [-1,1]){lamp(m,...p(side*t.r*.72,t.y+.35,t.r*.77-2.8) as [number,number,number],.55);hangingLantern(m,p(side*t.r*.52,t.y-2.1,front+1.15),.8);}
 }
 // Two lower frozen falls frame an open central grotto and reach the lake.
 for(let i=0;i<12;i++){
  const dx=i<9?-10+i*1.15:12+(i-9)*1.05,top=oy+7.2+(i%3)*.25,front=17;
  iceRibbon(m,p(dx,top,front),1.25,top*.94,1.3,hand);
  for(let j=0;j<7;j++)glitter.push(new T.Vector3(...p(dx+Math.sin(i+j)*.32,top*(.12+j*.12),front+1.4)));
  m.add(G.cone,'#c8f2f1',p(dx,top*.15,front+.1),[.65,top*.4,.8],[0,0,Math.PI]);
  m.add(G.rock,'#edf8f1',p(dx,top+.1,front),[.85,.55,1.5]);
 }
 // A substantial rear ridge encloses the upper entrance behind the chalet.
 ground(rock,'#8facbf',p(-2,oy+h+.1,-10),[8,3.8,5.5]);
 ground(rock,'#91aec4',p(-2,oy+(h+17)*.5,-6),[6,(h-17)*.5+1,4]);
 ground(rock,'#edf5f0',p(-2,oy+h+3.0,-10),[8,.55,5.5]);
 mantleWaterfall(terrain,s,bore);
 const terrainGroup=v.festive(terrain);terrainGroup.name='waterfall-hollow-mountain';carveWaterfall(terrainGroup,bore);rock.dispose();column.dispose();
 // Warm summit lodge, terrace fencing and snow-dusted firs.
 chalet(m,x,oy+h-.4,z-hand*2,2.5);
 for(const side of [-1,1]){
  for(let i=0;i<5;i++){const dx=side*(2+i),dz=5.5;beam('#ad8062',p(dx,oy+h,dz),p(dx,oy+h+1.8,dz),.13);}
  beam('#ad8062',p(side*2,oy+h+1.2,5.5),p(side*6,oy+h+1.2,5.5),.11);
 }
 // Snowy eaves, timber trim and a real wreath add readable chalet detail.
 const cabinY=oy+h-.4,cabinZ=z-hand*2;
 for(const side of [-1,1]){
  m.add(G.box,'#c69772',[x+side*3.45,cabinY+3,cabinZ+3.18],[.2,5.8,.15]);
  m.add(G.box,C.wood,[x+side*2.075,cabinY+3.75,cabinZ+3.3],[1.5,.13,.07]);
 }
 m.add(G.ring,C.green,[x,cabinY+4.9,cabinZ+3.23],[.85,.85,.85]);
 m.add(G.box,C.red,[x,cabinY+4.35,cabinZ+3.3],[.45,.25,.13]);
 for(let i=0;i<9;i++){const dx=(i-4)*.88,y=cabinY+7.1-Math.abs(dx)*.68;m.add(G.cone,'#d7eef4',[x+dx,y-.4,cabinZ+3.85],[.15,.8+(i%3)*.15,.15],[0,0,Math.PI]);}
 // Rails have a continuous teal deck; sparse wooden trestles leave the ice open.
 for(let i=1;i<s.frames.length;i+=24){
  if(s.start+s.distances[i]>bore.entry-2&&s.start+s.distances[i]<bore.exit+2)continue;
  const a=s.frames[i-1],b=s.frames[Math.min(i+23,s.frames.length-1)];
  const aa=a.position.clone().sub(new T.Vector3(s.origin.x,0,s.origin.z)).addScaledVector(a.up,-.45),bb=b.position.clone().sub(new T.Vector3(s.origin.x,0,s.origin.z)).addScaledVector(b.up,-.45);
  m.beam('#468f9b',aa,bb,.16);
  if(i%192===1&&aa.y>2){for(const side of [-1,1]){
   const q=aa.clone().addScaledVector(a.right,side*1.8);if(!clearPost(q))continue;m.beam('#a87d67',new T.Vector3(q.x,.4,q.z),q,.16);
   m.add(G.box,'#e9f2e8',[q.x,.24,q.z],[1.1,.45,1.1]);
  }}
 }
 const tree=(dx:number,y:number,dz:number,size:number)=>{
  m.add(G.pole,C.wood,p(dx,y+size,dz),[.3,size*2,.3]);
  for(let i=0;i<3;i++){m.add(G.cone,'#468b84',p(dx,y+size*(1+i*.65),dz),[size*(1-i*.22),size*1.6,size*(1-i*.22)]);m.add(G.cone,'#eff6f0',p(dx,y+size*(1.55+i*.65),dz),[size*(.64-i*.15),size*.65,size*(.64-i*.15)]);}
 };
 tree(-4,oy+h,-4,1.8);tree(5,oy+h,-3,1.4);
 tree(-6,oy+h+3,-10,1.1);tree(-8.5,oy+h+2.8,-8,1.0);
 for(const [dx,dz,size] of [[-15,1,2.5],[14,-2,2.2],[-12,15,2],[15,18,2.5],[-7,21,1.8]])tree(dx,0,dz,size);
 m.add(G.rock,'#9dbcd2',p(-6,1.15,17),[8,2.1,4.3]);
 m.add(G.rock,'#edf5ee',p(-6,.45,17),[14,.5,8]);
 // A small frozen plunge pool with a broken crown of crystalline floes.
 m.add(G.pole,'#67becf',p(0,.08,20),[10,.22,6]);
 for(let i=0;i<13;i++){const a=i*Math.PI*2/13;m.add(G.rock,i%2?'#dff3ef':'#a1ddea',p(Math.cos(a)*9,.5,20+Math.sin(a)*5),[1.7,.8,1.35]);}
 for(const side of [-1,1])lamp(m,...p(side*13,oy+1,12) as [number,number,number],.8);
 // Hanging warm lights trace the real track rather than floating fake rails.
 for(let d=s.start+10;d<s.end-8;d+=17){if(d>bore.entry-2&&d<bore.exit+2)continue;const f=s.sample(d),q=f.position.clone().sub(new T.Vector3(s.origin.x,0,s.origin.z)).addScaledVector(f.up,-1.4);if(!roofs.some(r=>r.distanceTo(q)<1.4))hangingLantern(m,q.toArray(),.48);}
 railLights(m,s);const scenery=v.festive(m);carveWaterfall(scenery,bore);
 const lining=new WorldModel();lineWaterfall(lining,s,bore);v.festive(lining);
 const glitterUpdate=iceGlitter(v,glitter);
 const crystal=new WorldModel();crystal.add(G.rock,'#e6ffff',[0,0,0],[.12,.23,.12],[],true);
 const pool=v.pool(crystal,32);pool[0].name='frozen-cascade-glints';
 const icicle=new WorldModel();icicle.add(G.cone,C.cream,[0,0,0],[.18,.75,.18],[0,0,Math.PI],true);
 const icicles=v.pool(icicle,12);icicles[0].name='train-lit-icicles';
 const anchors=tiers.flatMap(t=>[-1,1].flatMap(side=>[.35,.65].map(f=>new T.Vector3(...p(side*t.r*f,t.y-1.5,t.r*.77)))));
 const stops=anchors.map(q=>nearest(s,q));
 const sparkle=sparkles(v,s,l.landmarks,true);
 v.animate((time,distance,reduced)=>{
  const clock=reduced?0:time;glitterUpdate(time,reduced);
  for(let i=0;i<32;i++){const a=i*2.3999,cycle=(clock*.28+i/32)%1;
   v.place(pool,i,x+Math.sin(a)*7,.6+cycle*2,z+hand*(19+Math.cos(a)*3),.45+.5*Math.sin(cycle*Math.PI)**2,0,a,clock*.3+i);
  }
  for(let i=0;i<anchors.length;i++){const q=anchors[i],near=Math.exp(-(((distance-stops[i])/22)**2));v.place(icicles,i,q.x,q.y,q.z,.45+near*.65);}
  sparkle(time,distance,reduced);
 });
}
