import * as T from 'three';
import type { MiniSection } from '../../games/mini-track';
import type { PieceAnimation } from '../../games/piece-animation';
import type { FairgroundLights } from '../../games/world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../../games/world-models';
import { carouselCenter, carouselRideRadius, star } from '../../games/world-night';
import { CarouselMotion } from '../../games/carousel-motion';
import { VariantBuilder, CrossingPulses, arrival, at, point } from './variant-kit';

const GOLD='#ffe0a0', INK='#453868', CREAM='#fff0cf';
const CANDY=['#f6a9ce','#9fe1d9','#d4b0f0','#ffcc8d'];
const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const smooth=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

function face(m:WorldModel,x:number,y:number,z:number,size=1) {
  for(const side of [-1,1]) {
    m.add(G.rock,INK,[x+side*size*.3,y+size*.12,z],[size*.085,size*.12,size*.06]);
    m.add(G.rock,'#f59ebc',[x+side*size*.52,y-size*.12,z-.02],[size*.15,size*.09,size*.035]);
  }
  m.add(G.rock,INK,[x,y-size*.24,z],[size*.16,size*.08,size*.04]);
}

function rocketModel() {
  const m=new WorldModel();
  m.add(G.pole,CREAM,[0,0,0],[.78,3,.78]);
  m.add(G.cone,'#ed91b6',[0,2,0],[.81,1.35,.81]);
  m.add(G.pole,'#8bcdd1',[0,-1.4,0],[.9,.3,.9]);
  m.add(G.pole,'#7771ad',[0,-1.7,0],[.52,.45,.52]);
  for(let j=0;j<3;j++) {
    const a=j*Math.PI*2/3;
    m.add(G.cone,'#9cd8d4',[Math.sin(a)*.8,-.95,Math.cos(a)*.8],[.5,1.5,.24],[0,a,-.12]);
  }
  m.add(G.ring,GOLD,[0,.3,.78],[.52,.52,.52]);
  m.add(G.round,'#7d91d0',[0,.3,.8],[.43,.43,.12],[],true);
  m.add(G.round,'#b9e5ab',[0,.25,.93],[.28,.28,.08]);face(m,0,.29,1,.36);
  for(const side of [-1,1])m.add(G.rock,GOLD,[side*.33,1.2,.7],[.09,.09,.07],[],true);
  return m;
}

function rocketRally(s:MiniSection,b:VariantBuilder) {
  const scenery=new WorldModel(),stops=Array.from({length:5},(_,i)=>{
    const fraction=.09+i*.195,f=s.frames[Math.round(s.resolution*fraction)],p=point(s,fraction);
    p.addScaledVector(f.right,(i%2?1:-1)*6.2);
    return {p,distance:at(s,fraction),side:i%2?1:-1};
  });
  for(const [i,{p,side}]of stops.entries()) {
    const top=Math.max(6,p.y+1.1);
    scenery.add(G.pole,'#858fbd',[p.x,.28,p.z],[2.4,.55,2.4]);
    scenery.add(G.pole,'#acc9d1',[p.x,.61,p.z],[1.8,.16,1.8]);
    // Wide launchpad, gantry and countdown lights form five miniature spaceports.
    const gx=p.x+side*2.5;
    scenery.add(G.box,'#8ea9b7',[gx,top*.5,p.z],[.35,top,.35]);
    scenery.add(G.box,'#ebc899',[gx-side*.8,top,p.z],[1.9,.28,.32]);
    for(let j=0;j<3;j++) {
      scenery.add(G.box,'#667794',[gx,1.3+j*1.2,p.z+.25],[.8,.85,.12]);
      scenery.add(G.rock,CANDY[(i+j)%4],[gx,1.3+j*1.2,p.z+.35],[.24,.24,.12],[],true,i+j*.8);
    }
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3;
      scenery.add(G.rock,CANDY[(i+j)%4],[p.x+Math.sin(a)*2.1,.8,p.z+Math.cos(a)*2.1],[.2,.2,.2],[],true,i+j*.5);
    }
    scenery.add(G.rock,'#889cc0',[p.x+side*2.3,.65,p.z+1.7],[1.2,.65,.7]);
    star(scenery,p.x+side*2.3,1.55,p.z+1.8,.45,GOLD);
  }
  const moon=point(s,.5);moon.y=Math.max(...s.frames.map(f=>f.position.y))+10.8;
  scenery.add(G.round,'#f1dca0',moon.toArray(),[2.4,2.4,.8],[],true);
  face(scenery,moon.x,moon.y,moon.z+.79,1.6);
  for(const [dx,dy]of [[-1.6,.8],[1.6,-.65]])scenery.add(G.rock,'#e9d79f',[moon.x+dx,moon.y+dy,moon.z+.65],[.2,.2,.04]);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;star(scenery,moon.x+Math.sin(a)*4,moon.y+Math.cos(a)*3.3,moon.z,.36,CANDY[i%4]);}
  b.batch(scenery);
  const rockets=b.pool(rocketModel(),5),spark=new WorldModel();star(spark,0,0,0,.28,GOLD);
  const exhaust=b.pool(spark,35),pulses=new CrossingPulses(stops.map(stop=>stop.distance));
  b.animate((time,distance,reduced)=>{
    pulses.update(time,distance);
    for(let i=0;i<stops.length;i++) {
      const {p}=stops[i],age=pulses.age(i,time),active=!reduced&&age>=0&&age<6;
      const lift=active?11*smooth(age/2.5)*(1-smooth((age-4.2)/1.8)):0;
      const bank=active?Math.sin(age*1.4)*.08:0;
      b.place(rockets,i,p.x,3.1+lift,p.z,1,0,.2*Math.sin(i),bank);
      for(let j=0;j<7;j++) {
        const progress=active?(age*1.6+j/7)%1:0;
        b.place(exhaust,i*7+j,p.x+Math.sin(j*2.4+(active?age:0))*progress*.9,1.55+lift-progress*2.1,p.z+Math.cos(j*2.4)*progress*.9,
          active&&lift>.6?(1-progress)*1.25:0,0,0,j+(reduced?0:time));
      }
    }
  });
}

function jellyModel() {
  const m=new WorldModel(),dome=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);
  m.add(dome,'#a4e7e2',[0,0,0],[1.65,1.35,1.65],[],true);dome.dispose();
  m.add(G.pole,'#bfa7e3',[0,.04,0],[1.64,.12,1.64],[],true);
  face(m,0,.43,1.48,.95);
  for(let j=0;j<8;j++) {
    const a=j*Math.PI/4,x=Math.sin(a)*1.42,z=Math.cos(a)*1.42;
    m.add(G.round,CANDY[j%4],[x,-.04,z],[.3,.24,.3],[],true);
    let previous=v(x,-.15,z);
    for(let k=1;k<=5;k++) {
      const p=v(x+Math.sin(k*1.1+j)*.2,-k*.52,z+Math.cos(k*.8+j)*.2);
      m.beam(CANDY[j%4],previous,p,.055,true);previous=p;
    }
    m.add(G.rock,GOLD,previous.toArray(),[.14,.19,.14],[],true);
  }
  return m;
}

function jellyfishDreamway(s:MiniSection,b:VariantBuilder) {
  const scenery=new WorldModel(),stops=Array.from({length:7},(_,i)=>{
    const f=.06+i*.146,p=point(s,f),frame=s.frames[Math.round(s.resolution*f)];
    p.addScaledVector(frame.right,i%2===0?0:(i%4===1?-6.3:6.3));
    p.y+=i%2===0?7.5:5.6;return {p,distance:at(s,f)};
  });
  for(let i=0;i<10;i++) {
    const f=.035+i*.103,frame=s.frames[Math.round(s.resolution*f)],p=point(s,f),side=i%2?1:-1;
    p.addScaledVector(frame.right,side*6.3);p.y=.3;
    scenery.add(G.round,'#94b5cc',p.toArray(),[2,.35,1.5]);
    for(let j=0;j<3;j++) {
      const base=p.clone().add(v((j-1)*.72,0,0)),top=base.clone().add(v((j-1)*.35,2.4+(i+j)%3*.5,.2));
      scenery.beam(CANDY[(i+j)%4],base,top,.18);
      for(const side of [-1,1])scenery.beam(CANDY[(i+j)%4],base.clone().lerp(top,.5),top.clone().add(v(side*.65,-.55,.12)),.12);
      scenery.add(G.round,CANDY[(i+j)%4],top.toArray(),[.25,.25,.25],[],true,i+j*.4);
    }
    // An open clam and its luminous pearl anchor the floating jellyfish forest.
    scenery.add(G.round,'#d1a5cb',[p.x+side*1.4,.65,p.z+.9],[.85,.24,.65]);
    scenery.add(G.round,'#ebc4d2',[p.x+side*1.4,1.1,p.z+.5],[.85,.65,.22],[.4,0,0]);
    scenery.add(G.round,GOLD,[p.x+side*1.4,.95,p.z+.94],[.28,.28,.28],[],true,i*.3);
  }
  b.batch(scenery);
  const jellies=b.pool(jellyModel(),7),bubble=new WorldModel();
  bubble.add(G.ring,'#bcf5ee',[0,0,0],[.45,.45,.45],[],true);
  bubble.add(G.rock,CREAM,[-.22,.26,.01],[.065,.1,.04],[],true);
  const bubbles=b.pool(bubble,28);
  b.animate((time,distance,reduced)=>{
    for(let i=0;i<7;i++) {
      const stop=stops[i],near=arrival(distance,stop.distance,12),bob=reduced?0:Math.sin(time*1.25+i)*.22+near*.65;
      b.place(jellies,i,stop.p.x,stop.p.y+bob,stop.p.z,1,0,.2*Math.sin(i),reduced?0:Math.sin(time+i)*.04);
      for(let j=0;j<4;j++) {
        const rise=reduced?j*.45:(time*.55+j*.75+i*.21)%3;
        b.place(bubbles,i*4+j,stop.p.x+Math.sin(j*1.7+i)*2.25,stop.p.y+.5+rise,stop.p.z+Math.cos(j*1.7)*1.9,
          .48+near*.45+(j%2)*.22,0,reduced?0:Math.sin(time*.4+j)*.4);
      }
    }
  });
}

function loopBounds(s:MiniSection) {
  const xs=s.frames.map(f=>f.position.x-s.origin.x),zs=s.frames.map(f=>f.position.z-s.origin.z),ys=s.frames.map(f=>f.position.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.max(...ys);
  return {left,right,top,cx:(left+right)/2,cy:(s.origin.y+top)/2,back:Math.min(...zs)-4.5,width:right-left};
}

function pinballParade(s:MiniSection,b:VariantBuilder) {
  const {left,right,top,cx,cy,back,width}=loopBounds(s),m=new WorldModel(),margin=3.2;
  // The entire arcade cabinet sits behind the rail plane, with a raised header.
  m.add(G.box,'#565888',[cx,(top+4)/2,back-1],[width+margin*2,top+4,1.5]);
  m.add(G.box,'#304d71',[cx,(top+3)/2,back-.18],[width+margin*2-1.2,top+1.8,.15]);
  for(const x of [left-margin,right+margin])m.add(G.box,'#e9bd82',[x,(top+4)/2,back],[.5,top+4,.4]);
  for(const y of [1,top+4])m.add(G.box,'#a4dfd3',[cx,y,back],[width+margin*2,.5,.4],[],true);
  m.add(G.box,'#e6a2c0',[cx,top+5.6,back-.3],[width+margin*2+1,3.2,1.5]);
  m.add(G.box,'#3e527c',[cx,top+5.6,back+.5],[width+margin*2-1,2.3,.12]);
  for(const side of [-1,1])star(m,cx+side*(width*.5+.4),top+5.6,back+.63,.66,GOLD);
  const bumpers=[v(cx-width*.2,cy+2.2,back+.8),v(cx+width*.21,cy+2.5,back+.8),v(cx,cy-3,back+.8)];
  for(const [i,p]of bumpers.entries()) {
    m.add(G.pole,'#9298bb',p.toArray(),[2.2,.4,2.2],[Math.PI/2,0,0]);
    m.add(G.ring,GOLD,[p.x,p.y,p.z+.3],[2.12,2.12,2.12],[],true,i*.6);
  }
  for(let j=0;j<20;j++) {
    const a=j*Math.PI/10,rx=width*.5+1.6,ry=(top-s.origin.y)*.5+1.5;
    m.add(G.rock,CANDY[j%4],[cx+Math.sin(a)*rx,cy+Math.cos(a)*ry,back+.35],[.25,.25,.13],[],true,j*.4);
  }
  // Graphic arrows and coloured lanes turn the panel into a pinball playfield.
  for(const side of [-1,1])for(let j=0;j<4;j++) {
    const x=cx+side*(width*.36+1.3),y=cy-7+j*3.7;
    m.add(G.cone,CANDY[(j+1)%4],[x,y,back+.3],[.62,1.3,.1],[],true,j*.8);
    m.beam('#807fac',v(x-side*.8,y-1,back+.23),v(x-side*.8,y+1,back+.23),.05);
  }
  for(const side of [-1,1]){
    m.add(G.box,'#7865a0',[cx+side*(width*.5+2),.3,back+2],[2.4,.6,5]);
    m.add(G.round,'#e7ad97',[cx+side*(width*.5+2),1.4,back+3.8],[.65,.65,.65]);
  }
  b.batch(m);
  const bumper=new WorldModel();bumper.add(G.round,'#f1a5cb',[0,0,0],[1.6,1.6,.55],[],true);face(bumper,0,0,.54,1);
  const caps=b.pool(bumper,3),flipper=new WorldModel();
  flipper.add(G.box,'#f6ca87',[1.5,0,0],[3,.75,.55]);flipper.add(G.round,'#ffddb0',[3,0,0],[.5,.4,.3]);
  flipper.add(G.pole,'#99d3ce',[0,0,0],[.55,.7,.55],[Math.PI/2,0,0]);
  const flips=b.pool(flipper,2),ball=new WorldModel();ball.add(G.round,'#d1e5e6',[0,0,0],[.82,.82,.82]);
  ball.add(G.rock,CREAM,[-.28,.33,.65],[.22,.19,.07]);const balls=b.pool(ball,1);
  const segment=new WorldModel();segment.add(G.box,GOLD,[0,0,0],[.16,.73,.1],[],true);
  const digits=b.pool(segment,21),patterns=[0b0111111,0b0000110,0b1011011,0b1001111,0b1100110,0b1101101,0b1111101,0b0000111,0b1111111,0b1101111];
  const segmentLayout=[[0,.94,1],[.49,.47,0],[.49,-.47,0],[0,-.94,1],[-.49,-.47,0],[-.49,.47,0],[0,0,1]];
  const cached=s.frames.map(f=>v(f.position.x-s.origin.x,f.position.y,f.position.z-s.origin.z-4.25));
  b.animate((time,distance,reduced)=>{
    const progress=T.MathUtils.clamp((distance-s.start)/s.length,0,1),route=progress*s.length;
    let i=0,end=s.resolution;
    while(end-i>1){const middle=(i+end)>>1;if(s.distances[middle]<=route)i=middle;else end=middle;}
    const blend=(route-s.distances[i])/(s.distances[i+1]-s.distances[i]);
    const p=cached[i],q=cached[i+1];b.place(balls,0,p.x+(q.x-p.x)*blend,p.y+(q.y-p.y)*blend,p.z+(q.z-p.z)*blend);
    for(let j=0;j<3;j++) {
      const pulse=arrival(distance,at(s,.22+j*.28),10),p=bumpers[j];
      b.place(caps,j,p.x,p.y,p.z+.42,1+(reduced?0:pulse*.23));
    }
    const flip=arrival(distance,s.start+4,14)+arrival(distance,s.end-5,14);
    b.place(flips,0,cx-width*.27,3.3,back+1.6,1,0,0,.25+(reduced?0:flip*.55));
    b.place(flips,1,cx+width*.27,3.3,back+1.6,1,0,Math.PI,-.25-(reduced?0:flip*.55));
    for(let digit=0;digit<3;digit++)for(let bit=0;bit<7;bit++) {
      const [dx,dy,horizontal]=segmentLayout[bit],number=digit===0?Math.min(9,Math.floor(progress*10)):0;
      b.place(digits,digit*7+bit,cx+(digit-1)*2.3+dx,top+5.6+dy,back+.65,(patterns[number]&(1<<bit))?1:0,0,0,horizontal*Math.PI/2);
    }
  });
}

function musicNote() {
  const m=new WorldModel();m.add(G.round,GOLD,[0,0,0],[.34,.22,.11],[],true);
  m.add(G.box,GOLD,[.24,.63,0],[.12,1.2,.1],[],true);
  m.add(G.box,GOLD,[.53,1.12,0],[.63,.18,.1],[0,0,-.22],true);return m;
}

function fairyAutomaton() {
  const m=new WorldModel();
  m.add(G.round,'#b5d9de',[0,2.1,0],[.62,1,.4]);
  m.add(G.cone,'#dda9d2',[0,1.15,0],[1.7,1.4,1.7]);
  m.add(G.round,CREAM,[0,3.45,0],[.75,.78,.65]);face(m,0,3.5,.63,.9);
  for(const side of [-1,1]) {
    m.add(G.round,'#d2c1ed',[side*1.15,2.5,-.3],[.95,1.25,.13],[0,0,-side*.45],true);
    m.beam(CREAM,v(side*.4,2.5,.1),v(side*1.45,3.05,.2),.15);
    m.add(G.round,CREAM,[side*1.5,3.09,.2],[.2,.2,.2]);
    m.add(G.pole,'#dbb780',[side*.34,.13,0],[.12,1,.12]);
  }
  for(let j=0;j<5;j++)m.add(G.cone,GOLD,[(j-2)*.23,4.23,.1],[.16,.5+(j===2?.2:0),.16]);
  star(m,1.6,3.9,.2,.35,GOLD);m.beam(GOLD,v(1.45,3.05,.2),v(1.6,3.9,.2),.04);
  return m;
}

function windupWonderland(s:MiniSection,b:VariantBuilder) {
  const {left,right,top,cx,cy,back,width}=loopBounds(s),m=new WorldModel();
  m.add(G.box,'#8d659c',[cx,1.1,back+3],[width+7,1.9,8]);
  m.add(G.box,'#edc794',[cx,2.12,back+3],[width+7.3,.22,8.3]);
  m.add(G.box,'#b989b4',[cx,1.15,back+7.05],[width+5.8,1.1,.12]);
  for(const x of [left-2,right+2])for(const z of [back,back+6])m.add(G.round,'#cfac81',[x,.15,z],[.55,.55,.55]);
  // An oval, jewel-lined lid opens behind the railway; five music-staff lines
  // and a pipe organ distinguish this silhouette from the pinball cabinet.
  m.add(G.round,'#d7becd',[cx,cy,back-1],[width*.5+4,(top-s.origin.y)*.5+4,.6]);
  m.add(G.ring,GOLD,[cx,cy,back-.32],[width*.5+4,(top-s.origin.y)*.5+4,1]);
  for(let j=0;j<5;j++)m.beam('#ad91b4',v(left-1,cy-2+j,back-.22),v(right+1,cy-2+j,back-.22),.055);
  for(let j=0;j<14;j++) {
    const a=j*Math.PI/7;
    m.add(G.rock,CANDY[j%4],[cx+Math.sin(a)*(width*.5+3.8),cy+Math.cos(a)*((top-s.origin.y)*.5+3.8),back+.15],[.38,.38,.18],[],true,j*.7);
  }
  for(const side of [-1,1])for(let j=0;j<4;j++) {
    const x=(side<0?left-3.4:right+3.4)+side*j*.85,h=5.5+j*1.6,z=back+2;
    m.add(G.pole,'#ddb784',[x,2+h/2,z],[.28,h,.28]);
    m.add(G.pole,'#f0d296',[x,h+2,z],[.48,.5,.48]);
    m.add(G.rock,'#625d85',[x,h+2.24,z],[.29,.07,.29]);
    m.add(G.pole,'#a9cfd0',[x,2.4,z],[.39,.4,.39]);
  }
  const fairyY=cy-4;
  m.add(G.pole,'#cbb78d',[cx,(fairyY+2)/2,back+1],[.13,fairyY-2,.13]);
  m.add(G.pole,'#b3d7d5',[cx,fairyY-.4,back+1],[1.5,.24,1.5]);
  for(const side of [-1,1]){
    const nx=cx+side*width*.32;
    m.add(G.round,GOLD,[nx,cy+side*1.5,back+.3],[.55,.35,.12],[],true);
    m.add(G.box,GOLD,[nx+.42,cy+side*1.5+1,back+.3],[.14,2,.1],[],true);
    m.add(G.box,GOLD,[nx+.78,cy+side*1.5+1.9,back+.3],[.8,.2,.1],[0,0,-.15],true);
  }
  star(m,cx,top+6,back,.95,GOLD);b.batch(m);
  const fairy=b.pool(fairyAutomaton(),1),notes=b.pool(musicNote(),16),key=new WorldModel();
  key.add(G.box,'#ecc797',[0,0,0],[2.6,.28,.25]);
  for(const side of [-1,1])key.add(G.ring,'#ecc797',[side*.58,.55,0],[.55,.6,.55]);
  const keys=b.pool(key,1);
  b.animate((time,distance,reduced)=>{
    const on=arrival(distance,(s.start+s.end)/2,s.length*.55),progress=T.MathUtils.clamp((distance-s.start)/s.length,0,1);
    b.place(fairy,0,cx,fairyY,back+1,1.9,0,reduced?0:progress*Math.PI*4);
    b.place(keys,0,right+6.8,3.6,back+5,1,reduced?0:progress*Math.PI*8,Math.PI/2,0);
    for(let j=0;j<16;j++) {
      const a=j*Math.PI*2/16,rx=width*.5+2.6,ry=(top-s.origin.y)*.5+2.8;
      const bounce=reduced?0:Math.sin(time*1.8+j)*.2+on*Math.max(0,Math.sin(time*2-j*.55))*.65;
      b.place(notes,j,cx+Math.sin(a)*rx,cy+Math.cos(a)*ry+bounce,back+1.3,.65+(j%3)*.1,0,0,-.12*Math.sin(a));
    }
  });
}

function teacupModel() {
  const m=new WorldModel(),bowl=new T.CylinderGeometry(.85,.57,.9,12,1,true);
  m.add(bowl,'#f3c5ce',[0,.05,0]);bowl.dispose();
  m.add(G.pole,'#ad7f9c',[0,-.32,0],[.65,.09,.65]);
  m.add(G.ring,GOLD,[0,.5,0],[.83,.83,.83],[Math.PI/2,0,0]);
  m.add(G.ring,'#edcfa3',[.94,.08,0],[.4,.47,.4]);
  m.add(G.pole,'#c5e3db',[0,-.51,0],[1.03,.12,1.03]);
  // A little rabbit sits inside every cup, with ears visible above the rim.
  m.add(G.round,CREAM,[0,.67,0],[.42,.4,.36]);
  for(const side of [-1,1])m.add(G.round,CREAM,[side*.2,1.17,0],[.13,.4,.14],[0,0,-side*.13]);
  face(m,0,.72,.35,.48);
  for(let j=0;j<6;j++){const a=j*Math.PI/3;m.add(G.rock,CANDY[j%4],[Math.sin(a)*.76,.06,Math.cos(a)*.76],[.11,.18,.07],[0,a,0]);}
  return m;
}

function teapot(m:WorldModel,y:number,radius:number) {
  const size=radius/3.15;
  m.add(G.round,'#aee0d7',[0,y,0],[1.35*size,1.25*size,1.1*size]);
  m.add(G.cone,'#edd5a3',[0,y+1.15*size,0],[.95*size,.45*size,.82*size]);
  m.add(G.round,'#ecabd0',[0,y+1.53*size,0],[.23*size,.23*size,.23*size]);
  m.add(G.ring,'#efd3a0',[-1.35*size,y,0],[.95*size,1.05*size,.8*size]);
  const spout=[v(.95*size,y-.1*size,0),v(1.65*size,y+.25*size,0),v(1.95*size,y+.85*size,0),v(2.55*size,y+1.15*size,0)];
  for(let i=1;i<spout.length;i++)m.beam('#bce5dc',spout[i-1],spout[i],(.43-i*.07)*size);
  face(m,0,y,1.03*size,.92*size);
}

function teaParty(s:MiniSection,b:VariantBuilder) {
  const c=carouselCenter(s),r=carouselRideRadius(s),rotor=new T.Group(),base=new WorldModel(),m=new WorldModel();
  rotor.name='carousel-rotor';rotor.position.set(c.x,0,c.z);b.group.add(rotor);
  base.add(G.pole,'#93729c',[c.x,.45,c.z],[r,.9,r]);base.add(G.pole,'#e8cda5',[c.x,.97,c.z],[r,.16,r]);b.batch(base);
  const step=(s.origin.y+s.amplitude*.69-2)/3,floors=[2,2+step,2+2*step],potY=2+step*3;
  m.add(G.pole,'#d9bd90',[0,(potY+2)/2,0],[r*.2,potY-2,r*.2]);
  for(let level=0;level<3;level++) {
    const y=floors[level];
    m.add(G.pole,'#a3d7d1',[0,y,0],[r*.97,.38,r*.97]);
    m.add(G.pole,CREAM,[0,y+.24,0],[r*.89,.13,r*.89]);
    m.add(G.ring,GOLD,[0,y+.13,0],[r*.91,r*.91,r*.91],[Math.PI/2,0,0]);
    for(let j=0;j<12;j++) {
      const a=j*Math.PI/6;
      m.add(G.round,CANDY[(j+level)%4],[Math.sin(a)*r*.89,y-.19,Math.cos(a)*r*.89],[.25,.3,.25]);
      m.add(G.rock,GOLD,[Math.sin(a)*r*.93,y+.28,Math.cos(a)*r*.93],[.12,.12,.12],[],true,j*.4+level);
    }
    m.add(G.round,CANDY[level],[0,y+step*.48,0],[r*.28,step*.28,r*.28]);
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3;
      m.add(G.box,'#eac5a2',[Math.sin(a)*r*.2,y+step*.48,Math.cos(a)*r*.2],[.13,step*.5,.13],[0,a,.15]);
    }
  }
  teapot(m,potY,r);b.batch(m,rotor);
  const cups=b.pool(teacupModel(),12,rotor),steam=new WorldModel();
  steam.add(G.rock,'#d9e7dd',[0,0,0],[.3,.42,.3],[],true);const steamPool=b.pool(steam,10,rotor),motion=new CarouselMotion(s);
  b.animate((time,distance,reduced)=>{
    rotor.rotation.y=motion.update(time,distance,reduced);
    for(let i=0;i<12;i++) {
      const level=Math.floor(i/4),a=(i%4)*Math.PI/2+level*.4,spin=reduced?0:rotor.rotation.y*.7;
      b.place(cups,i,Math.sin(a)*r*.59,floors[level]+.72+(reduced?0:Math.sin(rotor.rotation.y*2+a)*.12),Math.cos(a)*r*.59,
        Math.min(.8,r*.25),0,a+spin);
    }
    for(let i=0;i<10;i++) {
      const rise=reduced?i*.26:(time*.65+i*.28)%2.8;
      b.place(steamPool,i,Math.sin(rise*2.4)*.38,potY+r/3.15*1.7+rise,Math.cos(rise*2.4)*.2,(1-rise/3.4)*.9);
    }
  });
}

function saucerModel() {
  const m=new WorldModel();m.add(G.pole,'#d4c1e6',[0,0,0],[.92,.24,.92]);
  m.add(G.round,'#b1dcda',[0,.29,0],[.6,.48,.6]);
  m.add(G.round,'#b3dea8',[0,.46,.15],[.29,.3,.24]);face(m,0,.49,.4,.4);
  for(const side of [-1,1]) {
    m.beam('#b3dea8',v(side*.17,.63,.1),v(side*.32,.95,.1),.045);
    m.add(G.rock,GOLD,[side*.32,.98,.1],[.1,.1,.1],[],true);
  }
  for(let j=0;j<6;j++){const a=j*Math.PI/3;m.add(G.rock,CANDY[j%4],[Math.sin(a)*.83,-.03,Math.cos(a)*.83],[.12,.12,.12],[],true,j*.5);}
  m.add(G.cone,'#9cdbdf',[0,-.36,0],[.38,.5,.38],[0,0,Math.PI],true);return m;
}

function planetParade(s:MiniSection,b:VariantBuilder) {
  const c=carouselCenter(s),r=carouselRideRadius(s),rotor=new T.Group(),base=new WorldModel(),m=new WorldModel();
  rotor.name='carousel-rotor';rotor.position.set(c.x,0,c.z);b.group.add(rotor);
  base.add(G.pole,'#6d779b',[c.x,.5,c.z],[r,1,r]);base.add(G.pole,'#b8d6dc',[c.x,1.1,c.z],[r*.85,.2,r*.85]);b.batch(base);
  const step=(s.origin.y+s.amplitude*.8-2.1)/3,floors=[2.1,2.1+step,2.1+step*2],crown=2.1+step*3;
  m.add(G.pole,'#92bac8',[0,(crown+2)/2,0],[.16,crown-2,.16]);
  for(let level=0;level<3;level++) {
    const y=floors[level];
    m.add(G.ring,'#accfe0',[0,y,0],[r*.91,r*.91,r*.91],[Math.PI/2,0,0]);
    m.add(G.ring,CANDY[level],[0,y+.32,0],[r*.77,r*.77,r*.77],[Math.PI/2,0,0],true);
    m.add(G.round,CANDY[(level+1)%4],[0,y+2.45,0],[r*.35,r*.35,r*.35]);
    face(m,0,y+2.5,r*.35,.6);
    m.add(G.ring,GOLD,[0,y+2.45,0],[r*.51,r*.51,r*.51],[Math.PI*.37,0,.2*level]);
    for(let j=0;j<8;j++) {
      const a=j*Math.PI/4;
      m.beam('#8daabb',v(0,y,0),v(Math.sin(a)*r*.9,y,Math.cos(a)*r*.9),.085);
      m.add(G.rock,GOLD,[Math.sin(a)*r*.85,y+.13,Math.cos(a)*r*.85],[.13,.13,.13],[],true,j*.6+level);
      if(j%2===0)m.beam('#b0bdde',v(Math.sin(a)*r*.82,y,Math.cos(a)*r*.82),v(Math.sin(a+.3)*r*.82,y+step-.5,Math.cos(a+.3)*r*.82),.06);
    }
  }
  m.add(G.round,'#f0cf97',[0,crown,0],[r*.49,r*.49,r*.49],[],true);face(m,0,crown,r*.48,.88);
  m.add(G.ring,'#cfb7e9',[0,crown,0],[r*.91,r*.91,r*.91],[Math.PI*.35,0,.2],true);
  star(m,0,crown+r*.58+1,0,.65,GOLD);b.batch(m,rotor);
  const ufos=b.pool(saucerModel(),12,rotor),comet=new WorldModel();
  comet.add(G.rock,CREAM,[0,0,0],[.19,.19,.19],[],true);const comets=b.pool(comet,24,rotor),motion=new CarouselMotion(s);
  b.animate((time,distance,reduced)=>{
    rotor.rotation.y=motion.update(time,distance,reduced);
    for(let i=0;i<12;i++) {
      const level=Math.floor(i/4),a=(i%4)*Math.PI/2+level*.4,bob=reduced?0:Math.sin(rotor.rotation.y*2+a)*.22;
      b.place(ufos,i,Math.sin(a)*r*.65,floors[level]+.8+bob,Math.cos(a)*r*.65,Math.min(.86,r*.26),0,a);
    }
    for(let i=0;i<24;i++) {
      const level=Math.floor(i/8),a=(i%8)*.14+(reduced?0:time*.65)+level*1.8;
      b.place(comets,i,Math.sin(a)*r*.83,floors[level]+2.2+Math.cos(a)*.3,Math.cos(a)*r*.83,1-(i%8)*.08);
    }
  });
}

/** Complete carnival alternatives. No meshes or scene lights are created during
 * update, and both carousel architectures inherit the exact train/coast motion. */
export function createCarnivalVariant(s:MiniSection,option:'b'|'c',material:T.Material,lights:FairgroundLights):PieceAnimation|undefined {
  if(!['lanternrun','midwayloop','carouselhelix'].includes(s.kind))return undefined;
  const b=new VariantBuilder(material,lights);
  if(s.kind==='lanternrun')(option==='b'?rocketRally:jellyfishDreamway)(s,b);
  else if(s.kind==='midwayloop')(option==='b'?pinballParade:windupWonderland)(s,b);
  else (option==='b'?teaParty:planetParade)(s,b);
  b.update(0,s.start-12,false);return b;
}
