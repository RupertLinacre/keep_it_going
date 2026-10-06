import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { christmasLayout } from '../christmas-rails';
import type { MiniSection } from '../mini-track';
import { ChristmasBuilder, C, star, gift, lamp, chalet, nearest, sparkles } from './christmas-builder';
import { arrival } from './piece-builder';
import { ChristmasLights, type ChristmasBulb } from './christmas-lights';
import { createSnowGlobeEffects, SNOW_GLOBE_OPENING } from './snow-globe-effects';
const TAU=Math.PI*2,V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const ball=new T.IcosahedronGeometry(1,2);
const hatCylinder=new T.CylinderGeometry(1,1,1,16);
const gem=new T.BufferGeometry(),facets:number[]=[];
for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,b=a+Math.PI/5,r=i%2?.45:1,rr=(i+1)%2?.45:1;const p=[Math.cos(a)*r,Math.sin(a)*r,0],q=[Math.cos(b)*rr,Math.sin(b)*rr,0];facets.push(0,0,.36,...p,...q,0,0,-.16,...q,...p);}
gem.setAttribute('position',new T.Float32BufferAttribute(facets,3));gem.computeVertexNormals();
/** Low-poly gold jewels: raised triangular faces, no costly beveled extrudes. */
function jewel(m:WorldModel,x:number,y:number,z:number,r:number,angle=0){
 m.add(gem,'#f1bd63',[x,y,z],[r,r,r],[0,0,angle]);
 m.add(G.rock,'#ffdf96',[x,y,z+.35*r],[r*.15,r*.15,r*.10],[],true);
 m.softGlow([x,y,z+.2*r],C.gold,r*1.55,.48);
}
/** Banked sleepers carry their own continuous gold fairy-light string. One
 * luminous batch, sparse soft halos; never a PointLight per bulb. */
function fairyRails(m:WorldModel,s:MiniSection){
 const prev:(T.Vector3|undefined)[]=[];
 for(let d=s.start;d<=s.end;d+=1.8){
  const f=s.sample(d);
  for(let j=0;j<2;j++){
   const p=f.position.clone().sub(V(s.origin.x,0,s.origin.z)).addScaledVector(f.right,j?1.2:-1.2).addScaledVector(f.up,.08);
   if(prev[j])m.beam('#d8af64',prev[j]!,p,.035);prev[j]=p;
   if(Math.floor((d-s.start)/1.8)%2===0){
    const bulb=p.clone().addScaledVector(f.up,-.19);m.add(G.rock,'#ffe5ae',bulb.toArray(),[.17,.22,.17],[],true,d*.21);
    if(Math.floor((d-s.start)/3.6)%2===0)m.softGlow(bulb.toArray(),C.gold,1.05,.6);
   }
  }
 }
}
function fir(m:WorldModel,x:number,z:number,h:number){
 m.add(G.pole,C.wood,[x,h*.2,z],[.2,h*.4,.2]);
 for(let i=0;i<3;i++){const y=h*(.35+i*.2),r=h*(.35-i*.075);m.add(G.cone,'#336a70',[x,y,z],[r,h*.6,r]);m.add(G.cone,'#c6dafa',[x,y+.1*h,z],[r*.75,h*.45,r*.75]);}
}
function villageSnow(m:WorldModel,c:T.Vector3,r:number){
 // A low snowy island, little footpaths and a fence all belong to the model.
 m.add(G.pole,'#bbd1ed',[c.x,.05,c.z],[r+.8,.3,r+.8]);
 for(let i=0;i<10;i++){const a=i*TAU/10,x=c.x+Math.cos(a)*(r+2),z=c.z+Math.sin(a)*(r+2);m.add(G.rock,C.snow,[x,.45,z],[1.6,.9,1.1]);}
 for(let i=0;i<11;i++){const a=Math.PI*.08+i/10*Math.PI*.72,x=c.x+Math.cos(a)*(r+1),z=c.z+Math.sin(a)*(r+1);m.add(G.box,'#96725b',[x,.65,z],[.15,1.3,.15]);if(i){const b=Math.PI*.08+(i-1)/10*Math.PI*.72;for(const y of [.5,1])m.beam('#ac886b',V(c.x+Math.cos(b)*(r+1),y,c.z+Math.sin(b)*(r+1)),V(x,y,z),.055);}}
}
export function treeLandmark(v:ChristmasBuilder,s:MiniSection){
 const m=new WorldModel(),l=christmasLayout('startree',s.width,s.amplitude,s.hand),c=l.center,r=l.radius,top=s.origin.y+s.amplitude+4;
 const bulbs:ChristmasBulb[]=[],colours=['#ffd87c','#ff6b89','#73ead4','#bca1ff'];
 const outerRadius=(height:number)=>{
  let radius=0;
  for(let k=0;k<7;k++){const bottom=3+k*(top-8)/7,h=(top-3)/7+5,t=(height-bottom)/h;
   if(t>=0&&t<=1)radius=Math.max(radius,r*(.80-k*.072)*(1-t));}
  return radius+.28;
 };
 villageSnow(m,c,r*.83);m.add(G.pole,C.wood,[c.x,2.7,c.z],[1.1,5.4,1.1]);
 // Full overlapping boughs, rather than separated stacked traffic cones.
 for(let i=0;i<7;i++){
  const y=3+i*(top-8)/7,rr=r*(.80-i*.072),height=(top-3)/7+5;
  m.add(G.cone,i%2?'#38796e':'#306d67',[c.x,y+height*.5,c.z],[rr,height,rr],[0,i*.17,0]);
  for(let j=0;j<5;j++){
   const a=j*TAU/5+i*.43,rad=rr*.74;
   jewel(m,c.x+Math.sin(a)*rad,y+height*.24,c.z+Math.cos(a)*rad,1.30-i*.055,a*.1);
   m.add(G.round,j%2?'#b34b62':'#f0a94c',[c.x+Math.sin(a+.42)*rad,y+height*.19,c.z+Math.cos(a+.42)*rad],[.38,.5,.38]);
  }
  let previous:T.Vector3|undefined;
  // Keep the garlands on the outside of overlapping boughs: lamps buried
  // inside a higher branch cannot light up visibly as the train passes.
  for(let j=0;j<=36;j++){const a=j*TAU/36,height=y+.9+.4*Math.cos(a*5),rad=outerRadius(height),p=V(c.x+Math.cos(a)*rad,height,c.z+Math.sin(a)*rad);
   if(previous)m.beam('#e4bc70',previous,p,.055);previous=p;
   if(j<36&&j%3===0)bulbs.push({position:p,stop:nearest(s,p.clone().add(V(0,-s.origin.y,0))),color:colours[(j/3+i)%colours.length],size:.25,halo:1.65});}
 }
 const crown=new WorldModel();jewel(crown,0,0,0,2.9);crown.softGlow([0,0,0],C.gold,5,.65);const head=v.festive(crown);head.position.set(c.x,top,c.z);
 for(let i=0;i<12;i++){const a=i*TAU/12;gift(m,c.x+Math.cos(a)*r*.74,0,c.z+Math.sin(a)*r*.74,.9+i%3*.3,[C.red,C.teal,'#bd87ce'][i%3]);}
 for(const dx of [-r-3,r+3])lamp(m,c.x+dx,0,c.z+3,1.2);
 for(const dx of [-r-8,r+7])fir(m,c.x+dx,c.z-7,6);
 m.softGlow([c.x,.35,c.z+4],C.gold,9,.21,true);fairyRails(m,s);v.festive(m);
 const treeLights=new ChristmasLights(v,s,bulbs,'star-tree');
 const twinkle=sparkles(v,s,l.landmarks),stop=nearest(s,l.landmarks.at(-1)!);
 v.animate((time,distance,reduced)=>{treeLights.update(time,distance,reduced,s.start);const near=arrival(distance,stop,35);head.rotation.y=reduced?0:Math.sin(time*.45)*.15;head.scale.setScalar(1+(reduced?0:near*.07*Math.sin(time*3)));twinkle(time,distance,reduced);});
}
/** A real diagonal tunnel through the snowball, facing the camera. The bore
 * uses its own local X axis; rotate the shell AND lining as one assembly. */
function boredBall(radius:number,centerY:number,tunnelY:number,bore:number){
 const g=new T.SphereGeometry(radius,32,20),p=g.getAttribute('position'),index=g.index!,ids:number[]=[];
 for(let i=0;i<index.count;i+=3){const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!triangle.some(k=>Math.hypot(p.getY(k)+centerY-tunnelY,p.getZ(k))<bore))ids.push(...triangle);}
 g.setIndex(ids);g.computeVertexNormals();return g;
}
export function snowmanLandmark(v:ChristmasBuilder,s:MiniSection){
 const m=new WorldModel(),l=christmasLayout('snowmanscarf',s.width,s.amplitude,s.hand),c=l.center,oy=s.origin.y,h=s.amplitude;
 const bottom=oy+3,middle=oy+h*.48,head=oy+h-.9,r=8.3,tunnelY=oy+1.2,bore=3.8,angle=-Math.atan2(.6*s.hand,.8);
 const snow=new WorldModel(),snowTrain={value:V(1e6,1e6,1e6)},snowStrength={value:0},bulbs:ChristmasBulb[]=[];
 const colours=['#ffd87c','#79ecdd','#ffa3cf','#bca8ff'];
 const addBulb=(position:T.Vector3,color:string,size=.25,halo=1.65,stop=nearest(s,position.clone().add(V(0,-oy,0))))=>bulbs.push({position,color,size,halo,stop});
 villageSnow(m,c,10);
 const shell=boredBall(r,bottom,tunnelY,bore);snow.add(shell,'#dfebfb',[c.x,bottom,c.z],[1,1,1],[0,angle,0]);shell.dispose();
 const lining=new T.CylinderGeometry(bore,bore,14.8,24,1,true);const index=lining.index!;for(let i=0;i<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);}lining.computeVertexNormals();
 const q=new T.Quaternion().setFromUnitVectors(V(0,1,0),V(.8,0,.6*s.hand)),e=new T.Euler().setFromQuaternion(q);
 m.add(lining,'#536780',[c.x,tunnelY,c.z],[1,1,1],[e.x,e.y,e.z]);lining.dispose();
 for(const sign of [-1,1]){
  const p=V(c.x+sign*.8*7.5,tunnelY,c.z+sign*.6*s.hand*7.5);m.add(G.ring,C.gold,p.toArray(),[bore,bore,bore],[0,Math.PI/2+angle,0],true);
  for(let j=0;j<9;j++){const a=j*Math.PI/8,off=V(0,Math.sin(a)*bore,Math.cos(a)*bore).applyAxisAngle(V(0,1,0),angle),b=p.clone().add(off);m.add(G.round,C.cream,b.toArray(),[.2,.2,.2],[],true,j*.6);if(j%2===0)m.softGlow(b.toArray(),C.gold,1.25,.65);}
 }
 snow.add(ball,'#e3efff',[c.x,middle,c.z],[6.3,6.3,6.3]);snow.add(ball,'#edf4ff',[c.x,head,c.z],[4.9,4.9,4.9]);
 v.litSnow(snow,snowTrain,snowStrength);
 for(const [i,dy]of [-1.4,1.4].entries()){
  m.add(G.rock,C.dark,[c.x,middle+dy,c.z+6.1],[.65,.65,.2]);
  addBulb(V(c.x,middle+dy,c.z+6.38),i?C.pink:C.gold,.48,2.4);
 }
 for(const dx of [-1.5,1.5]){m.add(G.round,C.dark,[c.x+dx,head+1,c.z+4.55],[.53,.65,.2]);m.add(G.round,C.cream,[c.x+dx-.12,head+1.22,c.z+4.74],[.12,.14,.045],[],true);}
 for(let i=0;i<8;i++){const a=.15*Math.PI+i*.1*Math.PI;m.add(G.round,C.dark,[c.x+Math.cos(a)*2,head-.75-Math.sin(a)*1.1,c.z+4.48],[.22,.23,.15]);}
 m.add(G.cone,'#f9a658',[c.x,head-.15,c.z+5.5],[.85,3.2,.85],[Math.PI/2,0,0]);
 // A jaunty snowy hat with holly and a warm lantern hung from its brim.
 const hat=new WorldModel(),hatY=head+4.45;
 hat.add(hatCylinder,'#283e57',[0,0,0],[6.1,.65,6.1]);hat.add(hatCylinder,'#283e57',[0,2.55,0],[3.8,5.1,3.8]);hat.add(hatCylinder,C.red,[0,1.05,0],[3.86,.9,3.86]);hat.add(hatCylinder,C.snow,[0,5.18,0],[3.95,.25,3.95]);
 for(const dx of [-.6,.6])hat.add(G.rock,'#3f8b70',[dx,1.1,3.85],[.9,.45,.15],[0,0,dx*.7]);for(const dx of [-.25,.25,0])hat.add(G.round,'#e05b6a',[dx,.95+Math.abs(dx),4.05],[.28,.28,.18]);
 let hatPrevious:T.Vector3|undefined;
 for(let i=0;i<=24;i++){
  const a=i*TAU/24,p=V(Math.cos(a)*6.22,.12,Math.sin(a)*6.22);
  if(hatPrevious)hat.beam(C.gold,hatPrevious,p,.045);hatPrevious=p;
  if(i<24)addBulb(p.clone().applyAxisAngle(V(0,0,1),-.1).add(V(c.x,hatY,c.z)),colours[i%4],.28,1.8);
 }
 const hatGroup=v.festive(hat);hatGroup.position.set(c.x,hatY,c.z);hatGroup.rotation.z=-.1;
 m.beam(C.gold,V(c.x+4.8,hatY-.4,c.z+2),V(c.x+4.8,hatY-2.3,c.z+2),.055);lamp(m,c.x+4.8,hatY-5.7,c.z+2,.8);
 m.add(G.pole,C.red,[c.x,head-4.2,c.z],[5.1,1.5,5.1]);
 // The striped, broad scarf is literally a ribbon under the climbing rail.
 let previous:T.Vector3|undefined;const rotation=new T.Euler(),axis=V(0,0,1);
 for(let d=s.start;d<s.end;d+=1.2){const f=s.sample(d),local=f.position.clone().sub(V(s.origin.x,0,s.origin.z));const radial=Math.hypot(local.x-c.x,local.z-c.z);if(local.y<oy+7||radial>l.radius+1||local.y>oy+h+.1){previous=undefined;continue;}
  const p=local.addScaledVector(f.up,-.72);if(previous){const delta=p.clone().sub(previous);rotation.setFromQuaternion(s.sample(d-.6).rotation);m.add(G.box,Math.floor(d/3.6)%2?C.red:'#487e6f',p.clone().add(previous).multiplyScalar(.5).toArray(),[2.5,.12,delta.length()+.04],[rotation.x,rotation.y,rotation.z]);}previous=p;
  if(Math.floor((d-s.start)/1.2)%3===0)for(const sign of [-1,1])addBulb(p.clone().addScaledVector(f.right,sign*1.34),colours[Math.floor((d-s.start)/3.6)%4],.2,1.25,d);
 }
 // Long scarf tail along the far outside of the descent, clear of train roof.
 const tail:T.Vector3[]=[];for(let i=0;i<=12;i++){const p=V(c.x+5+i*1.6,middle-2-i*.52,c.z+8+i*.55);tail.push(p);if(i){const a=tail[i-1],d=p.clone().sub(a);rotation.setFromQuaternion(new T.Quaternion().setFromUnitVectors(axis,d.clone().normalize()));m.add(G.box,i%4<2?C.red:'#487e6f',p.clone().add(a).multiplyScalar(.5).toArray(),[3.1,.16,d.length()+.03],[rotation.x,rotation.y,rotation.z]);}}
 for(const sign of [-1,1]){const a=V(c.x+sign*5.5,middle+.3,c.z+3),b=V(c.x+sign*6.9,middle-.5,c.z+2.5);m.beam(C.wood,a,b,.33);for(let j=-1;j<=1;j++)m.beam(C.wood,b,V(b.x+sign*1.2,b.y+1+j*.7,b.z+j*.6),.17);}
 for(let i=0;i<7;i++)gift(m,c.x+(i-3)*1.8,0,c.z+10,1+i%2*.4,i%2?C.red:C.teal);
 lamp(m,c.x-11,0,c.z+6,1.2);m.softGlow([c.x,.35,c.z+4],C.gold,9,.21,true);fairyRails(m,s);v.festive(m);
 const snowmanLights=new ChristmasLights(v,s,bulbs,'snowman');
 const tassel=new WorldModel();tassel.add(G.pole,C.cream,[0,-.7,0],[.09,1.4,.09]);const fringe=v.pool(tassel,9),end=tail.at(-1)!,stop=nearest(s,l.landmarks[0]),twinkle=sparkles(v,s,l.landmarks);
 v.animate((time,distance,reduced)=>{
  snowmanLights.update(time,distance,reduced,s.start);
  const f=s.sample(T.MathUtils.clamp(distance,s.start,s.end));snowTrain.value.copy(f.position);snowTrain.value.x-=s.origin.x;snowTrain.value.z-=s.origin.z;snowTrain.value.y-=v.group.position.y;
  const outside=Math.max(0,s.start-distance,distance-s.end);snowStrength.value=Math.exp(-outside*outside/400);
  const wave=arrival(distance,stop,35);hatGroup.rotation.z=-.1+(reduced?0:Math.sin(time*3)*wave*.025);for(let i=0;i<9;i++)v.place(fringe,i,end.x+(i-4)*.27,end.y,end.z,1,reduced?0:Math.sin(time*4+i*.5)*wave*.2);twinkle(time,distance,reduced);});
}
export function globeLandmark(v:ChristmasBuilder,s:MiniSection){
 const m=new WorldModel(),l=christmasLayout('snowglobe',s.width,s.amplitude,s.hand),c=l.center,r=l.radius;
 const globe=createSnowGlobeEffects(v,s,c,r,s.origin.y+s.amplitude+7),top=globe.top;
 const foot=Math.sqrt(globe.radius**2-(1.3-globe.center.y)**2);
 m.add(G.pole,'#335e74',[c.x,.6,c.z],[foot+.9,1.2,foot+.9]);
 for(const y of [.25,1.1])m.add(G.ring,'#edbe69',[c.x,y,c.z],[foot+.7,foot+.7,foot+.7],[Math.PI/2,0,0]);
 // Royal base, snowy terrace and a generous entrance staircase.
 m.add(G.pole,'#d6e5f6',[c.x,1.25,c.z],[foot+.3,.35,foot+.3]);
 for(let i=0;i<36;i++){const a=i*TAU/36;star(m,c.x+Math.sin(a)*(foot+.78),.68,c.z+Math.cos(a)*(foot+.78),.38,C.gold,true,0,i*.5);}
 for(let i=0;i<4;i++)m.add(G.box,'#d6e5f6',[c.x,.14+i*.23,c.z+foot+3-i*.7],[7,.28,3.3-i*.55]);
 // The globe is glass rather than a cage. A delicate necklace of warm bulbs
 // defines its snowy foot; the star and portal arches keep the festive trim.
 for(let i=0;i<48;i++){const a=i*TAU/48,x=c.x+Math.cos(a)*(foot-.2),z=c.z+Math.sin(a)*(foot-.2);m.add(G.rock,C.cream,[x,1.55,z],[.18,.2,.18],[],true,i*.43);if(i%2===0)m.softGlow([x,1.55,z],C.gold,1.1,.6);}
 // A gold lip follows each actual glass cutout on the spherical surface.
 // These are curved circle/sphere intersections, not flat rings through glass.
 for(const portal of globe.portals){
  const normal=portal.clone().sub(globe.center),length=normal.length();normal.divideScalar(length);
  const along=(globe.radius**2+length**2-SNOW_GLOBE_OPENING**2)/(2*length),mouth=globe.center.clone().addScaledVector(normal,along),rho=Math.sqrt(Math.max(0,globe.radius**2-along**2));
  const up=V(0,1,0).addScaledVector(normal,-normal.y).normalize(),right=new T.Vector3().crossVectors(normal,up).normalize();let previous:T.Vector3|undefined;
  for(let i=0;i<=40;i++){const a=i*TAU/40,p=mouth.clone().addScaledVector(up,Math.cos(a)*rho).addScaledVector(right,Math.sin(a)*rho);if(previous)m.beam('#e9c782',previous,p,.14);previous=p;
   if(i%5===0){m.add(G.rock,C.cream,p.toArray(),[.21,.23,.21],[],true,i*.5);m.softGlow(p.toArray(),C.gold,1.2,.65);}}
  const crest=mouth.clone().addScaledVector(up,rho+.9);jewel(m,crest.x,crest.y,crest.z,.9);
 }
 const crown=new WorldModel();jewel(crown,0,0,0,2.7);crown.softGlow([0,0,0],C.gold,4.2,.7);const crownGroup=v.festive(crown);crownGroup.position.set(c.x,top+2,c.z);
 // Hanging crystalline snowflake, above the little village and below the dome.
 m.beam('#e9d4a1',V(c.x,top,c.z),V(c.x,top-4,c.z),.045);
 for(let j=0;j<6;j++){const a=j*TAU/6,d=V(Math.sin(a),Math.cos(a),0),base=V(c.x,top-6,c.z),tip=base.clone().addScaledVector(d,2.4);m.beam('#e9f7ff',base,tip,.09,true);for(const f of [.58,.8])for(const sign of [-1,1]){const p=base.clone().addScaledVector(d,2.4*f),branch=V(Math.sin(a+sign*.7),Math.cos(a+sign*.7),0);m.beam('#d1f4ff',p,p.clone().addScaledVector(branch,.6),.06,true);}}
 m.softGlow([c.x,top-6,c.z],C.teal,3.4,.6);
 chalet(m,c.x,1.5,c.z,1.9);
 m.add(G.box,'#b47b62',[c.x,8.7,c.z],[2.3,4.7,2.3]);m.add(G.cone,'#bc5466',[c.x,12.2,c.z],[2.2,3,2.2]);m.add(G.cone,C.snow,[c.x,12.6,c.z],[1.8,2.4,1.8]);jewel(m,c.x,14.2,c.z,1);
 for(const sign of [-1,1]){m.add(G.round,C.cream,[c.x,9.3,c.z+sign*1.2],[.85,.85,.08],[],true);m.softGlow([c.x,9.3,c.z+sign*1.3],C.gold,2,.55);m.beam(C.dark,V(c.x,9.3,c.z+sign*1.31),V(c.x+.4,9.5,c.z+sign*1.31),.065);m.beam(C.dark,V(c.x,9.3,c.z+sign*1.31),V(c.x,9.95,c.z+sign*1.31),.065);}
 for(const side of [-1,1]){
  chalet(m,c.x+side*5,1.5,c.z+1,1.25);chalet(m,c.x+side*3.6,1.5,c.z-4.6,.78);
  m.add(G.box,'#bbcde3',[c.x+side*3.2,1.44,c.z+2.8],[3.8,.04,1.1]);
 }
 fir(m,c.x+4,c.z+6,5.5);jewel(m,c.x+4,6,c.z+6,.7);
 for(let i=0;i<8;i++){gift(m,c.x+(i-3.5)*1.1,1.4,c.z+5,.65+i%2*.2,i%2?C.red:C.teal);}
 for(const side of [-1,1])lamp(m,c.x+side*4.8,1.4,c.z+5.7,.85);
 m.softGlow([c.x,.35,c.z+4],C.gold,9,.21,true);fairyRails(m,s);v.festive(m);
 const stops=globe.portals.map(p=>nearest(s,p.clone().add(V(0,-s.origin.y,0)))),twinkle=sparkles(v,s,l.landmarks,true);
 v.animate((time,distance,reduced)=>{let shake=0;for(const stop of stops)shake=Math.max(shake,arrival(distance,stop,22));crownGroup.rotation.z=reduced?0:Math.sin(time*4)*shake*.035;
  globe.update(time,shake,reduced);
  twinkle(time,distance,reduced);
 });
}
