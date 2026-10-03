import * as T from 'three';
import type { MiniSection } from '../../games/mini-track';
import type { PieceAnimation } from '../../games/piece-animation';
import type { FairgroundLights } from '../../games/world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { carouselCenter, carouselRideRadius, star } from '../../games/world-night';
import { CarouselMotion } from '../../games/carousel-motion';
import { AttractionDrive } from '../../games/attraction-drive';
import { VariantBuilder, CrossingPulses, arrival, at, point, type InstancePool } from './variant-kit';

const CREAM='#fff0cb',INK='#463955',GOLD='#ffd691',COLORS=['#f29ebb','#91dcd4','#bfacf0','#ffc68c'];
const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const smooth=(x:number)=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const name=(pool:InstancePool,value:string)=>{for(const mesh of pool)mesh.name=value;return pool;};
function face(m:WorldModel,x:number,y:number,z:number,s=1) {
  for(const side of [-1,1]){
    m.add(G.rock,INK,[x+side*.28*s,y+.13*s,z],[.07*s,.105*s,.055*s]);
    m.add(G.rock,'#ee9eb7',[x+side*.48*s,y-.12*s,z-.02],[.13*s,.07*s,.04*s]);
  }
  m.add(G.rock,INK,[x,y-.2*s,z],[.14*s,.07*s,.045*s]);
}
function stops(s:MiniSection,count:number,offset:number,height=0) {
  return Array.from({length:count},(_,i)=>{
    const fraction=.08+i*.84/(count-1),p=point(s,fraction),f=s.frames[Math.round(s.resolution*fraction)];
    p.addScaledVector(f.right,(i%2?1:-1)*offset);p.y=height? p.y+height:0;
    return {p,distance:at(s,fraction)};
  });
}
function tint(pool:InstancePool,count:number,offset=0) {
  const palette=COLORS.map(c=>new T.Color(c));
  for(const mesh of pool)for(let i=0;i<count;i++)mesh.setColorAt(i,palette[(i+offset)%palette.length]);
}

function popcornParade(s:MiniSection,b:VariantBuilder) {
  const locations=stops(s,5,7.3),m=new WorldModel();
  b.group.userData.reviewHeadroom=7;
  for(const [i,{p}]of locations.entries()) {
    m.add(G.box,COLORS[i%4],[p.x,1.9,p.z],[3.4,3.5,2.8]);
    m.add(G.box,'#d394b2',[p.x,.25,p.z],[4,.5,3.3]);
    for(let j=0;j<5;j++)m.add(G.box,CREAM,[p.x+(j-2)*.65,1.9,p.z+1.415],[.3,3.2,.055]);
    m.add(G.pole,'#ddb0b5',[p.x,3.27,p.z],[1.66,.88,1.66]);
    m.add(G.pole,INK,[p.x,3.7,p.z],[1.4,.16,1.4]);
    for(const side of [-1,1])for(const end of [-1,1]){
      m.add(G.pole,INK,[p.x+side*1.55,.45,p.z+end*1.52],[.48,.19,.48],[Math.PI/2,0,0]);
      m.add(G.rock,GOLD,[p.x+side*1.55,.45,p.z+end*1.63],[.18,.18,.09]);
    }
    m.add(G.pole,'#dab988',[p.x-2.35,3.25,p.z-.3],[.1,6.3,.1]);
    m.add(G.round,'#f6c77f',[p.x-2.35,6.25,p.z-.3],[.87,.87,.18]);
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5;
      m.add(G.round,CREAM,[p.x-2.35+Math.sin(a)*.37,6.25+Math.cos(a)*.37,p.z-.09],[.3,.3,.12]);
    }
    face(m,p.x-2.35,6.3,p.z+.045,.54);
    for(const side of [-1,1])m.add(G.round,GOLD,[p.x+side*1.85,3.15,p.z],[.4,.5,.35]);
    m.add(G.box,'#a896c7',[p.x+2.4,.9,p.z],[1.2,1.5,1.7]);
    m.add(G.pole,'#d1bb9a',[p.x+2.4,2.1,p.z],[.1,1.5,.1]);
    m.add(G.box,CREAM,[p.x,1.9,p.z+1.5],[1.55,.92,.09]);
    face(m,p.x,2,p.z+1.58,.8);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4;
      m.add(G.rock,GOLD,[p.x+Math.sin(a)*1.55,3.75,p.z+Math.cos(a)*1.25],[.13,.13,.13],[],true,j*.3+i);
    }
  }
  b.batch(m);
  const lid=new WorldModel();lid.add(G.round,'#e9b18e',[0,.12,1.4],[1.85,.3,1.65]);
  lid.add(G.round,CREAM,[0,.39,1.4],[.34,.28,.34]);
  const lids=name(b.pool(lid,5),'popcorn-kettle-lids'),kernel=new WorldModel();
  for(const [x,y,z,r]of [[0,0,0,.9],[-.6,.25,0,.55],[.6,.25,0,.55],[0,.67,-.1,.6],[-.25,-.35,.35,.57],[.4,-.25,.35,.56]])kernel.add(G.round,CREAM,[x,y,z],[r,r,r]);
  face(kernel,0,.16,.83,.8);
  for(const side of [-1,1])kernel.add(G.round,'#eaaf83',[side*.5,-.69,.22],[.28,.2,.4]);
  const kernels=name(b.pool(kernel,5),'popcorn-pals'),spring=new WorldModel();
  spring.add(G.ring,'#c0a5c8',[0,0,0],[.49,.49,.49],[Math.PI/2,0,0]);
  const springs=name(b.pool(spring,35),'popcorn-spring-coils'),plunger=new WorldModel();
  plunger.add(G.pole,'#b3dfd6',[0,0,0],[.55,.28,.55]);plunger.add(G.rock,GOLD,[0,.22,0],[.2,.2,.2]);
  const plungers=name(b.pool(plunger,5),'popcorn-plungers'),confetti=new WorldModel();
  confetti.add(G.box,GOLD,[0,0,0],[.16,.3,.09],[],true);
  const flakes=name(b.pool(confetti,50),'popcorn-confetti'),pulse=new CrossingPulses(locations.map(p=>p.distance));
  b.animate((time,distance,reduced)=>{
    pulse.update(time,distance);
    for(let i=0;i<5;i++){
      const {p,distance:stop}=locations[i],age=pulse.age(i,time),active=!reduced&&age>=0&&age<4.8;
      // The lid opens before the compressed spring is allowed to extend.
      const lift=active?Math.sin(Math.PI*smooth(age/4.8))*6.1:0;
      const anticip=!reduced&&distance<stop?arrival(distance,stop,7):0;
      const open=active?1-smooth((age-4.2)/.6):anticip;
      b.place(lids,i,p.x,3.85,p.z-1.4,1,-open*1.68);
      b.place(kernels,i,p.x,3.1+lift,p.z,active?1.12:.67,0,0,active?smooth(age/4.8)*Math.PI*2:0);
      b.place(plungers,i,p.x+2.4,2.5-anticip*.62,p.z);
      for(let j=0;j<7;j++)b.place(springs,i*7+j,p.x,3.1+lift*(j+.4)/7,p.z,.8+lift*.025);
      for(let j=0;j<10;j++) {
        const a=j*Math.PI/5,t=active?T.MathUtils.clamp((age-.25)/2.5,0,1):0;
        b.place(flakes,i*10+j,p.x+Math.sin(a)*t*2.1,4.9+Math.sin(t*Math.PI)*5.5,p.z+Math.cos(a)*t*1.8,
          active&&age>.25&&age<2.75?1-t:0,0,j,(active?age*3:0)+j);
      }
    }
  });
}

function dragonKites(s:MiniSection,b:VariantBuilder) {
  const locations=stops(s,5,3.3,9.4),anchors=stops(s,5,8.3),m=new WorldModel();
  for(const [i,{p}]of locations.entries()) {
    const a=anchors[i].p;
    m.add(G.pole,'#9ca7c3',[a.x,.5,a.z],[1.5,1,1.5]);
    for(const side of [-1,1])m.add(G.box,'#ddbd9c',[a.x+side*.8,1.4,a.z],[.18,1.8,.24]);
    m.beam('#e6d7bb',v(a.x,1.7,a.z),v(p.x,p.y-.4,p.z),.028);
    for(let j=0;j<4;j++)m.add(G.cone,COLORS[(i+j)%4],[a.x+(j-1.5)*.4,2.7+Math.sin(j)*.2,a.z],[.35,.7,.07],[0,0,Math.PI]);
    m.add(G.rock,COLORS[i%4],[a.x-1.3,.35,a.z+1],[.7,.35,.7]);
    star(m,a.x-1.3,1.05,a.z+1,.45,GOLD);
  }
  b.batch(m);
  const head=new WorldModel();head.add(G.round,'#a6e1c8',[0,0,0],[1.18,.9,1.15]);
  head.add(G.round,CREAM,[0,-.22,.89],[.85,.49,.63]);face(head,0,.08,1.39,1.1);
  for(const side of [-1,1]){
    head.add(G.cone,GOLD,[side*.73,1.02,-.25],[.21,.95,.21],[0,0,-side*.3]);
    head.add(G.round,'#e0bbeb',[side*1.05,.55,-.3],[.55,.75,.11],[0,0,-side*.6]);
    head.beam(CREAM,v(side*.57,-.06,1.25),v(side*1.55,.12,1.2),.04);
  }
  const heads=name(b.pool(head,5),'dragon-kite-heads'),wing=new WorldModel();
  wing.add(G.round,'#f1a9cb',[1.12,.1,-.1],[1.25,.14,.85],[0,.3,0]);
  for(let j=0;j<3;j++)wing.beam(GOLD,v(0,0,0),v(1.7,.07,-.65+j*.6),.035);
  const wings=name(b.pool(wing,10),'dragon-kite-wings'),segment=new WorldModel();
  segment.add(G.round,CREAM,[0,0,0],[.63,.55,1]);
  segment.add(G.cone,GOLD,[0,.58,0],[.26,.48,.29]);
  const tails=name(b.pool(segment,35),'dragon-kite-tail');tint(tails,35);
  const reel=new WorldModel();reel.add(G.pole,'#b699c5',[0,0,0],[.57,1.45,.57],[0,0,Math.PI/2]);
  for(const side of [-1,1])reel.add(G.pole,GOLD,[side*.75,0,0],[.82,.16,.82],[0,0,Math.PI/2]);
  reel.add(G.box,'#a7d9d1',[.95,.5,0],[.2,1,.2]);reel.add(G.round,CREAM,[1.05,1,0],[.22,.22,.22]);
  const reels=name(b.pool(reel,5),'dragon-kite-reels');
  b.animate((time,distance,reduced)=>{
    for(let i=0;i<5;i++){
      const {p,distance:stop}=locations[i],a=anchors[i].p,cheer=reduced?0:arrival(distance,stop,14);
      b.place(heads,i,p.x,p.y,p.z,1,0,0,0);
      for(const side of [-1,1])b.place(wings,i*2+(side>0?1:0),p.x+side*.65,p.y,p.z-.5,1,0,side<0?Math.PI:0,(.15+cheer*.85*(.7+.3*Math.sin(time*7))));
      for(let j=0;j<7;j++){
        const wave=reduced?0:Math.sin(time*3-j*.75+i)*cheer*(j+1)*.16;
        b.place(tails,i*7+j,p.x+wave,p.y-.16-j*.12,p.z-.92-j*.79,1-j*.075,0,wave*.2,0);
      }
      b.place(reels,i,a.x,1.65,a.z,1,reduced?0:T.MathUtils.clamp((distance-stop+20)/40,0,1)*Math.PI*6,0,0);
    }
  });
}

function loopBounds(s:MiniSection) {
  const xs=s.frames.map(f=>f.position.x-s.origin.x),zs=s.frames.map(f=>f.position.z-s.origin.z),ys=s.frames.map(f=>f.position.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.max(...ys);
  return {left,right,top,cx:(left+right)/2,cy:(s.origin.y+top)/2,back:Math.min(...zs)-5.6,width:right-left};
}
function circusJuggle(s:MiniSection,b:VariantBuilder) {
  const {left,right,top,cx,cy,back,width}=loopBounds(s),m=new WorldModel();
  for(const side of [-1,1]){
    const x=side<0?left-3.8:right+3.8;
    m.add(G.pole,'#e5b28c',[x,(top+2)/2,back],[.43,top+2,.43]);
    for(let j=0;j<7;j++)m.add(G.pole,COLORS[j%4],[x,2+j*(top-1)/7,back],[.5,.9,.5]);
    m.add(G.cone,'#de93ba',[x,top+3.6,back],[2.2,4,2.2]);
    m.add(G.rock,GOLD,[x,top+5.8,back],[.35,.45,.35],[],true);
    m.add(G.pole,'#b0d8d2',[cx+side*width*.23,1.2,back+2],[3.2,2.4,2.3]);
    for(let j=0;j<7;j++)m.add(G.box,CREAM,[cx+side*width*.23+(j-3)*.67,1.2,back+4.18],[.32,2.1,.09]);
  }
  // Alternating canvas panels make a complete peaked big-top roof. Each
  // front/back wedge shares the same mast and scalloped eave.
  for(const depth of [-2.3,2.3])for(let j=0;j<12;j++){
    const x0=left-3.8+j*(width+7.6)/12,x1=left-3.8+(j+1)*(width+7.6)/12;
    const vertices=[cx,top+8.7,back,x0,top+1.8,back+depth,x1,top+1.8,back+depth];
    const panel=new T.BufferGeometry();panel.setAttribute('position',new T.Float32BufferAttribute([...vertices,...vertices.slice(6),...vertices.slice(3,6),...vertices.slice(0,3)],3));panel.computeVertexNormals();
    m.add(panel,j%2?'#f0cad9':'#d794bb',[0,0,0]);panel.dispose();
  }
  for(let j=0;j<=18;j++){
    const x=left-3.7+j*(width+7.4)/18,y=top+1.8+Math.sin(j*Math.PI/18)*.8;
    m.add(G.round,COLORS[j%4],[x,y,back+2.3],[.76,.48,.34]);
    m.add(G.rock,GOLD,[x,y-.5,back+2.55],[.17,.17,.12],[],true,j*.3);
  }
  m.add(G.pole,'#c7a0c2',[cx,top+9.5,back],[.08,2.2,.08]);
  m.add(G.cone,'#9cded4',[cx+1.1,top+10.2,back],[.8,2.3,.1],[0,0,-Math.PI/2]);
  star(m,cx,cy+4,back-.2,1.4,GOLD);
  b.batch(m);
  const seal=new WorldModel();seal.add(G.round,'#8ec9d3',[0,1.5,0],[1.22,1.6,.95]);
  seal.add(G.round,'#b6e3dd',[0,2.7,.2],[1.02,.9,.93]);
  seal.add(G.round,CREAM,[0,2.45,1],[.62,.36,.25]);
  seal.add(G.round,INK,[0,2.72,1.14],[.19,.15,.14]);face(seal,0,2.75,1,.85);
  seal.add(G.cone,'#f1a5bb',[0,3.8,.1],[.72,1.55,.72]);seal.add(G.rock,GOLD,[0,4.6,.1],[.25,.25,.25]);
  for(const side of [-1,1])seal.add(G.round,'#79b3c6',[side*.53,.15,-.55],[.42,.24,.87],[0,side*.5,0]);
  const seals=name(b.pool(seal,2),'circus-balancing-seals'),flipper=new WorldModel();
  flipper.add(G.round,'#a7d9dc',[.69,-.12,0],[.87,.28,.28],[0,0,-.2]);
  const flippers=name(b.pool(flipper,4),'circus-seal-flippers'),ball=new WorldModel();
  ball.add(G.round,CREAM,[0,0,0],[.7,.7,.7]);
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5;ball.add(G.rock,'#eb9cbb',[Math.sin(a)*.38,Math.cos(a)*.38,.55],[.15,.15,.12]);}
  const balls=name(b.pool(ball,6),'circus-juggling-balls');tint(balls,6);
  const club=new WorldModel();club.add(G.pole,CREAM,[0,0,0],[.13,1.1,.13]);club.add(G.round,'#a8dbd1',[0,.65,0],[.33,.63,.33]);
  const clubs=name(b.pool(club,4),'circus-juggling-clubs'),ray=new WorldModel();star(ray,0,0,0,.32,GOLD);
  const rays=name(b.pool(ray,18),'circus-applause-stars'),pose=new T.Object3D(),hand=new T.Vector3();
  b.animate((time,distance,reduced)=>{
    const progress=T.MathUtils.clamp((distance-s.start)/s.length,0,1),active=reduced?0:arrival(distance,at(s,.5),s.length*.58);
    for(let i=0;i<2;i++){
      const side=i?1:-1,x=cx+side*width*.23,y=2.43,z=back+2;
      const sway=reduced?0:Math.sin(progress*Math.PI*8+i*Math.PI)*active*.16;
      b.place(seals,i,x,y,z,1,0,0,sway);pose.position.set(x,y,z);pose.rotation.set(0,0,sway);pose.updateMatrix();
      for(let j=0;j<2;j++){
        const handSide=j?1:-1;hand.set(handSide*.9,1.5,.18).applyMatrix4(pose.matrix);
        b.place(flippers,i*2+j,hand.x,hand.y,hand.z,1,0,j?0:Math.PI,sway+handSide*(.3+active*.55*Math.sin(progress*Math.PI*8+j*Math.PI)));
      }
      for(let j=0;j<3;j++){
        const a=(reduced?0:progress*Math.PI*10)+j*Math.PI*2/3+i*Math.PI/2;
        b.place(balls,i*3+j,x+Math.sin(a)*2.15,y+5.1+(1-Math.cos(a))*3.2,z+.55,1,0,0,a);
      }
      for(let j=0;j<2;j++){
        const a=(reduced?0:progress*Math.PI*8)+j*Math.PI;
        b.place(clubs,i*2+j,x+Math.sin(a)*2.7,y+4.4+(1-Math.cos(a))*2.2,z-.55,.8,0,0,a*2);
      }
    }
    const cheer=reduced?0:arrival(distance,at(s,.56),13);
    for(let i=0;i<18;i++){
      const a=i*Math.PI/9;
      b.place(rays,i,cx+Math.sin(a)*(width*.44+1),cy+Math.cos(a)*(top*.4),back+.55,.35+cheer*.9,0,0,reduced?0:time*.35);
    }
  });
}

function gumballFactory(s:MiniSection,b:VariantBuilder) {
  const {left,right,top,cx,cy,back,width}=loopBounds(s),m=new WorldModel(),rx=width*.5+3.1,ry=(top-s.origin.y)*.5+3.2;
  for(const depth of [-1.4,0,1.4])m.add(G.ring,depth?'#92c9d4':'#dbddeb',[cx,cy,back+depth],[rx,ry,1]);
  m.add(G.ring,'#aad4dc',[cx,cy,back],[rx*.25,ry,1],[0,.55,0]);
  m.add(G.ring,'#aad4dc',[cx,cy,back],[rx*.25,ry,1],[0,-.55,0]);
  m.add(G.pole,'#be91bd',[cx,1.3,back],[rx*.8,2.6,3.4]);
  m.add(G.box,'#eccb97',[cx,2.7,back],[rx*1.65,.26,6.4]);
  m.add(G.cone,'#efbbbc',[cx,top+4.2,back],[rx*.75,2.5,2.6]);
  m.add(G.round,GOLD,[cx,top+5.7,back],[.6,.6,.6]);
  for(let j=0;j<16;j++){
    const a=j*Math.PI/8;
    m.add(G.rock,COLORS[j%4],[cx+Math.sin(a)*rx,cy+Math.cos(a)*ry,back+1.6],[.26,.26,.26],[],true,j*.45);
  }
  const chuteX=right+5.3,gateY=cy+3,bowlY=1.4,route=[v(chuteX,gateY+.1,back+2)];
  for(const side of [-1,1]){
    m.add(G.box,'#8797b4',[chuteX+side*2,(gateY-1)/2,back+1.3],[.25,gateY-1,.3]);
    m.add(G.rock,'#c9bacd',[chuteX+side*2,.25,back+1.3],[.55,.25,.6]);
  }
  m.beam('#ddc5a0',v(cx+rx*.67,gateY+1.6,back),v(chuteX,gateY+1.6,back+1.7),.28);
  m.add(G.box,'#edbf9c',[chuteX,gateY+.8,back+1.7],[.8,1.6,.8]);
  m.add(G.box,'#cab5d4',[chuteX,gateY-1,back+1.7],[3,1,1.3]);
  m.add(G.box,INK,[chuteX,gateY,back+1.8],[1.7,1.5,.2]);
  for(let j=0;j<4;j++){
    const y=gateY-2.3-j*(gateY-4)/4,side=j%2?1:-1;
    m.add(G.box,'#c3dcd8',[chuteX,y,back+2],[3.8,.17,1],[0,0,side*.22]);
    m.add(G.box,GOLD,[chuteX,y+.25,back+2.52],[3.8,.25,.09],[0,0,side*.22]);
    route.push(v(chuteX+side*1.6,y+.82,back+2),v(chuteX-side*1.6,y+.11,back+2));
  }
  const bowl=new T.CylinderGeometry(1.65,.85,1.1,12,1,true);
  m.add(bowl,'#f0cbb0',[chuteX,bowlY,back+2],[1,1,1]);bowl.dispose();
  m.add(G.pole,'#b9d9d0',[chuteX,bowlY-.52,back+2],[.9,.08,.9]);
  m.add(G.ring,CREAM,[chuteX,bowlY+.55,back+2],[1.65,1.65,1.65],[Math.PI/2,0,0]);
  m.add(G.pole,'#c6a9c8',[chuteX,.35,back+2],[2,.7,2]);
  route.push(v(chuteX,bowlY+.02,back+2));
  face(m,chuteX,bowlY,back+3.38,.8);
  m.add(G.box,CREAM,[left-2,4.5,back+1.8],[2.8,2,.2]);face(m,left-2,4.6,back+1.95,1.05);
  b.batch(m);
  const scoop=new WorldModel();scoop.add(G.pole,'#e9c49a',[0,0,0],[.68,.2,.68]);scoop.add(G.round,'#f1aec6',[0,.45,0],[.56,.56,.56]);
  scoop.add(G.box,'#b2c5d6',[0,-.5,0],[.18,.8,.16]);
  const scoops=name(b.pool(scoop,12),'gumball-candy-scoops'),candy=new WorldModel();candy.add(G.round,CREAM,[0,0,0],[.49,.49,.49]);
  candy.add(G.rock,'#ffffff',[-.15,.18,.41],[.13,.12,.035]);
  const candies=name(b.pool(candy,20),'gumball-dispensed-sweets');tint(candies,20);
  const handle=new WorldModel();handle.add(G.pole,GOLD,[0,0,0],[.3,1,.3],[Math.PI/2,0,0]);handle.add(G.box,'#b7dacf',[0,.7,.45],[.27,1.4,.24]);handle.add(G.round,'#edadd1',[0,1.4,.68],[.38,.38,.38]);
  const crank=name(b.pool(handle,1),'gumball-crank'),gate=new WorldModel();gate.add(G.box,'#a6cacc',[0,.68,0],[1.85,1.35,.15]);
  gate.add(G.rock,GOLD,[0,.65,.13],[.2,.2,.08]);const gates=name(b.pool(gate,1),'gumball-dispenser-door');
  const mouse=new WorldModel();mouse.add(G.round,'#b9b3d6',[0,.4,0],[.82,1,.65]);mouse.add(G.round,CREAM,[0,1.55,.12],[.72,.67,.55]);
  for(const side of [-1,1]){mouse.add(G.round,'#d7b2ce',[side*.65,2,.1],[.39,.42,.18]);mouse.add(G.round,'#dcb697',[side*.35,-.48,.35],[.3,.2,.42]);}
  face(mouse,0,1.6,.66,.8);mouse.add(G.round,'#efa8c0',[0,1.43,.79],[.21,.13,.12]);
  const mice=name(b.pool(mouse,1),'gumball-bowl-mouse'),pulse=new CrossingPulses([at(s,.3),at(s,.55),at(s,.8)]),drive=new AttractionDrive();
  let previousTime=-Infinity,previousDistance=-Infinity;
  const candyPoint=new T.Vector3();
  b.animate((time,distance,reduced)=>{
    if(time<previousTime||distance<previousDistance-.01){drive.angle=0;drive.speed=0;}
    previousTime=time;previousDistance=distance;drive.update(time,distance,s.start,s.end,reduced);pulse.update(time,distance);
    const turn=reduced?0:drive.angle;
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6+turn;
      b.place(scoops,i,cx+Math.sin(a)*rx*.8,cy+Math.cos(a)*ry*.79,back+.5,1,0,0,-a);
    }
    b.place(crank,0,left-2,2.3,back+2,1,0,0,-turn*2);
    let opening=0,delight=0;
    for(let i=0;i<3;i++){
      const age=pulse.age(i,time),active=!reduced&&age>=0&&age<3.8,drop=active?smooth((age-.28)/3.1):0;
      if(active){opening=Math.max(opening,1-smooth((age-.75)/.3));delight=Math.max(delight,Math.sin(drop*Math.PI));}
      // Dispenser clearance precedes the drop. The moving sweet follows the
      // same alternating chute slope until it lands inside the bowl.
      const segment=Math.min(route.length-2,Math.floor(drop*(route.length-1))),blend=drop*(route.length-1)-segment;
      candyPoint.copy(route[segment]).lerp(route[segment+1],blend);
      b.place(candies,i,candyPoint.x,candyPoint.y,candyPoint.z,active?.9:0,0,0,drop*8);
    }
    for(let i=3;i<20;i++){
      const a=i*2.4,r=(i%3+1)*rx*.17;
      b.place(candies,i,cx+Math.sin(a)*r,cy-ry*.45+(i%5)*1.3,back-.65,.85);
    }
    b.place(gates,0,chuteX,gateY-.65,back+1.92,1,-opening*1.7);
    b.place(mice,0,chuteX+2.7,.75+delight*.55,back+2,.9,0,-.35,delight*.12);
  });
}

function carouselBase(s:MiniSection,b:VariantBuilder,color:string) {
  const c=carouselCenter(s),r=carouselRideRadius(s),rotor=new T.Group(),base=new WorldModel();
  rotor.name='carousel-rotor';rotor.position.set(c.x,0,c.z);b.group.add(rotor);
  base.add(G.pole,color,[c.x,.48,c.z],[r*.95,.96,r*.95]);
  base.add(G.pole,GOLD,[c.x,1.03,c.z],[r*.93,.16,r*.93]);b.batch(base);
  const step=(s.origin.y+s.amplitude*.77-2)/3,floors=[2,2+step,2+step*2],crown=2+step*3;
  return {r,rotor,step,floors,crown};
}
function octopusPalace(s:MiniSection,b:VariantBuilder) {
  const {r,rotor,step,floors,crown}=carouselBase(s,b,'#ae9dce'),m=new WorldModel();
  m.add(G.pole,'#d3becd',[0,(crown+1)/2,0],[r*.15,crown-1,r*.15]);
  for(let level=0;level<3;level++){
    const y=floors[level];
    m.add(G.pole,'#b5dcd5',[0,y-.25,0],[r*.94,.5,r*.94]);
    m.add(G.ring,GOLD,[0,y+.08,0],[r*.89,r*.89,r*.89],[Math.PI/2,0,0]);
    for(let j=0;j<10;j++){
      const a=j*Math.PI/5;
      m.add(G.round,COLORS[level],[Math.sin(a)*r*.76,y-.32,Math.cos(a)*r*.76],[r*.2,.42,r*.2]);
      m.add(G.rock,GOLD,[Math.sin(a)*r*.9,y+.08,Math.cos(a)*r*.9],[.12,.12,.12],[],true,j*.5+level);
    }
    for(let j=0;j<4;j++){
      const a=j*Math.PI/2+Math.PI/4,x=Math.sin(a)*r*.76,z=Math.cos(a)*r*.76;
      m.add(G.pole,'#cbb9db',[x,y+(step-1)/2,z],[.1,step-1,.1]);
      m.add(G.round,'#edd0dd',[x,y+step-1.2,z],[.24,.48,.24]);
    }
    m.add(G.round,'#d3b7dd',[0,y+step*.5,0],[r*.28,.75,r*.28]);
  }
  m.add(G.round,'#efaecb',[0,crown,0],[r*.5,1.8,r*.5]);face(m,0,crown,r*.49,1.05);
  for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5;
    m.add(G.cone,GOLD,[Math.sin(a)*r*.23,crown+1.9,Math.cos(a)*r*.23],[.24,.9,.24]);
  }
  m.add(G.pole,'#dcc2a4',[0,crown+1.52,0],[r*.34,.2,r*.34]);
  b.batch(m,rotor);
  const arm=new WorldModel();
  for(let j=0;j<8;j++){
    const t=j/7,x=r*(.2+.62*t),y=-Math.sin(t*Math.PI*.75)*2.45,z=0;
    arm.add(G.round,'#e8a7c9',[x,y,z],[r*(.15-.075*t),.42,.35]);
    arm.add(G.rock,'#ffdfca',[x,y-.25,.22],[.13,.14,.07]);
  }
  const arms=name(b.pool(arm,8,rotor),'octopus-crown-tentacles'),crab=new WorldModel();
  crab.add(G.round,'#f2b798',[0,.25,0],[.77,.35,.58]);
  for(const side of [-1,1]){
    crab.add(G.pole,'#f2b798',[side*.31,.7,.32],[.07,.53,.07]);crab.add(G.round,CREAM,[side*.31,.95,.32],[.17,.19,.17]);
    crab.add(G.rock,INK,[side*.31,.95,.47],[.065,.09,.04]);
    for(let j=0;j<3;j++)crab.beam('#e8a393',v(side*.4,.25,.27-j*.27),v(side*.99,.04,.45-j*.42),.055);
  }
  face(crab,0,.27,.56,.65);
  const crabs=name(b.pool(crab,12,rotor),'octopus-crab-gondolas'),claw=new WorldModel();
  claw.add(G.pole,'#f2b798',[.27,.1,0],[.08,.57,.08],[0,0,-1.1]);
  for(const side of [-1,1])claw.add(G.cone,'#f4c2a2',[.6,.25,side*.14],[.18,.49,.17],[side*.45,0,-.75]);
  const claws=name(b.pool(claw,24,rotor),'octopus-crab-claws'),bubble=new WorldModel();
  bubble.add(G.rock,'#d5efe7',[0,0,0],[.16,.21,.16],[],true);
  const bubbles=name(b.pool(bubble,30,rotor),'octopus-palace-bubbles'),motion=new CarouselMotion(s),pose=new T.Object3D(),joint=new T.Vector3(),greetings=[.2,.42,.65].map(t=>at(s,t));
  const scale=Math.min(.65,r*.2);
  b.animate((time,distance,reduced)=>{
    rotor.rotation.y=motion.update(time,distance,reduced);
    const salute=reduced?0:arrival(distance,at(s,.73),17);
    for(let i=0;i<8;i++)b.place(arms,i,0,crown-.8,0,1,0,i*Math.PI/4,-salute*(.16+.09*Math.sin(time*3+i)));
    for(let i=0;i<12;i++){
      const level=Math.floor(i/4),a=i%4*Math.PI/2,y=floors[level]+.32,cheer=reduced?0:arrival(distance,greetings[level]+i%4*2.4,9),x=Math.sin(a)*r*.59,z=Math.cos(a)*r*.59;
      b.place(crabs,i,x,y+cheer*.28,z,scale,0,a,0);
      pose.position.set(x,y+cheer*.28,z);pose.rotation.set(0,a,0);pose.scale.setScalar(scale);pose.updateMatrix();
      for(let side=0;side<2;side++){
        joint.set(side?.58:-.58,.3,.3).applyMatrix4(pose.matrix);
        b.place(claws,i*2+side,joint.x,joint.y,joint.z,scale,0,a+(side?0:Math.PI),(side?1:-1)*cheer*.9);
      }
    }
    for(let i=0;i<30;i++){
      const level=i%3,a=i*2.399,rise=reduced?(i%10)*.35:(time*.5+i*.39)%(step-1);
      b.place(bubbles,i,Math.sin(a)*r*.38,floors[level]+.65+rise,Math.cos(a)*r*.38,.6+(i%3)*.2);
    }
  });
}

function honeybeeCarousel(s:MiniSection,b:VariantBuilder) {
  const {r,rotor,step,floors,crown}=carouselBase(s,b,'#c798af'),m=new WorldModel();
  m.add(G.pole,'#a5c8ae',[0,(crown+2)/2,0],[r*.14,crown-2,r*.14]);
  for(let level=0;level<3;level++){
    const y=floors[level];
    m.add(G.pole,'#efc188',[0,y-.3,0],[r*.91,.6,r*.91]);
    m.add(G.pole,CREAM,[0,y+.02,0],[r*.86,.12,r*.86]);
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6;
      m.add(G.pole,'#ad856c',[Math.sin(a)*r*.84,y-.29,Math.cos(a)*r*.84],[.23,.1,.23],[Math.PI/2,a,0]);
      m.add(G.rock,GOLD,[Math.sin(a)*r*.88,y+.12,Math.cos(a)*r*.88],[.11,.11,.11],[],true,j*.5+level);
    }
    for(let j=0;j<4;j++){
      const a=j*Math.PI/2+Math.PI/4,x=Math.sin(a)*r*.74,z=Math.cos(a)*r*.74;
      m.add(G.pole,'#a5c8ae',[x,y+(step-1)/2,z],[.08,step-1,.08]);
      m.add(G.round,'#b3d3a5',[x,y+step*.48,z],[.36,.75,.13],[0,a,.35]);
    }
    m.add(G.round,'#edc98b',[0,y+step-1.1,0],[r*.36,.55,r*.36]);
  }
  m.add(G.round,'#edb276',[0,crown-.15,0],[r*.56,1.3,r*.56]);
  m.add(G.pole,'#a57565',[0,crown+.79,0],[r*.42,.18,r*.42]);
  m.add(G.pole,GOLD,[0,crown+.89,0],[r*.38,.1,r*.38]);face(m,0,crown-.2,r*.54,1.1);
  b.batch(m,rotor);
  const dipperGroup=new T.Group();dipperGroup.name='honey-crown-dipper';dipperGroup.position.set(0,crown+.88,0);rotor.add(dipperGroup);
  const dipper=new WorldModel();dipper.add(G.pole,'#d9b084',[0,1.4,0],[.12,2.8,.12]);
  for(let i=0;i<4;i++)dipper.add(G.pole,'#e8bf88',[0,2.15+i*.27,0],[.52,.14,.52]);
  dipper.add(G.round,GOLD,[.18,1.95,.2],[.15,.4,.14]);b.batch(dipper,dipperGroup);
  const bee=new WorldModel();bee.add(G.round,'#f3cd82',[0,.35,0],[.48,.44,.83]);
  for(const z of [-.35,.05])bee.add(G.pole,INK,[0,.35,z],[.46,.17,.46],[Math.PI/2,0,0]);
  bee.add(G.round,CREAM,[0,.5,.65],[.48,.43,.4]);face(bee,0,.53,1,.55);
  for(const side of [-1,1]){bee.beam(INK,v(side*.18,.78,.6),v(side*.33,1.09,.65),.035);bee.add(G.rock,'#eea9c1',[side*.33,1.1,.65],[.085,.085,.085]);}
  bee.add(G.pole,'#e4ac99',[0,-.1,0],[.79,.17,.79]);
  const bees=name(b.pool(bee,12,rotor),'honeybee-gondolas'),wing=new WorldModel();
  wing.add(G.round,'#dceae5',[.53,.17,0],[.64,.09,.37],[0,-.25,.12]);
  wing.beam('#b5c9d1',v(0,0,0),v(.95,.2,.03),.035);
  const wings=name(b.pool(wing,24,rotor),'honeybee-attached-wings'),petal=new WorldModel();
  petal.add(G.round,CREAM,[0,.1,.43],[.32,.12,.55]);petal.add(G.rock,'#ecc28b',[0,.13,.22],[.14,.1,.16]);
  const petals=name(b.pool(petal,24,rotor),'honeybee-opening-petals');tint(petals,24);
  const motion=new CarouselMotion(s),greetings=[.2,.42,.65].map(t=>at(s,t)),pose=new T.Object3D(),joint=new T.Vector3(),scale=Math.min(.78,r*.24);
  b.animate((time,distance,reduced)=>{
    rotor.rotation.y=motion.update(time,distance,reduced);
    dipperGroup.rotation.z=reduced?.28:.28+arrival(distance,at(s,.73),15)*Math.sin(time*3)*.12;
    for(let i=0;i<12;i++){
      const level=Math.floor(i/4),a=i%4*Math.PI/2,cheer=reduced?0:arrival(distance,greetings[level]+i%4*2.4,10),x=Math.sin(a)*r*.57,z=Math.cos(a)*r*.57,y=floors[level]+.35+cheer*.62;
      b.place(bees,i,x,y,z,scale,0,a,cheer*.09);
      pose.position.set(x,y,z);pose.rotation.set(0,a,cheer*.09);pose.scale.setScalar(scale);pose.updateMatrix();
      for(let side=0;side<2;side++){
        joint.set(side?.28:-.28,.69,-.06).applyMatrix4(pose.matrix);
        const flap=reduced?.18:.18+cheer*(.6+.35*Math.sin(time*15+i));
        b.place(wings,i*2+side,joint.x,joint.y,joint.z,scale,0,a+(side?0:Math.PI),cheer*.09+flap);
      }
    }
    for(let i=0;i<24;i++){
      const level=Math.floor(i/8),a=i%8*Math.PI/4,open=reduced?0:arrival(distance,greetings[level],13);
      b.place(petals,i,Math.sin(a)*r*.32,floors[level]+step-1.15,Math.cos(a)*r*.32,r*.64,-.95+open*.9,a,0,'YXZ');
    }
  });
}

/** Six fixed-budget Carnival options. Rotating decks inherit train angle and
 * drag from the common carousel controller; every animated actor is prebuilt. */
export function createCarnivalExtraVariant(s:MiniSection,option:'d'|'e',material:T.Material,lights:FairgroundLights):PieceAnimation|undefined {
  if(!['lanternrun','midwayloop','carouselhelix'].includes(s.kind))return undefined;
  const b=new VariantBuilder(material,lights);
  if(s.kind==='lanternrun')(option==='d'?popcornParade:dragonKites)(s,b);
  else if(s.kind==='midwayloop')(option==='d'?circusJuggle:gumballFactory)(s,b);
  else(option==='d'?octopusPalace:honeybeeCarousel)(s,b);
  b.update(0,s.start-12,false);return b;
}
