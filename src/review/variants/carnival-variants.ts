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
      scenery.add(G.rock,'#404767',[gx,1.3+j*1.2,p.z+.35],[.29,.29,.12]);
    }
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3;
      scenery.add(G.rock,CANDY[(i+j)%4],[p.x+Math.sin(a)*2.1,.8,p.z+Math.cos(a)*2.1],[.2,.2,.2],[],true,i+j*.5);
    }
    scenery.add(G.rock,'#889cc0',[p.x+side*2.3,.65,p.z+1.7],[1.2,.65,.7]);
    star(scenery,p.x+side*2.3,1.55,p.z+1.8,.45,GOLD);
    for(const sign of [-1,1]){
      scenery.add(G.box,'#c6ceda',[p.x+sign*1.5,.75,p.z],[.18,.3,2.6]);
      scenery.add(G.box,'#ecca96',[p.x+sign*1.5,.95,p.z],[.25,.07,2.6]);
    }
  }
  for(const fraction of [.27,.71]) {
    const frame=s.frames[Math.round(s.resolution*fraction)],center=point(s,fraction).addScaledVector(frame.up,1.1),rotation=new T.Euler().setFromQuaternion(frame.rotation);
    scenery.add(G.ring,'#c4bddf',center.toArray(),[4.7,4.7,4.7],[rotation.x,rotation.y,rotation.z]);
    scenery.add(G.ring,'#9fe1d9',center.toArray(),[4.45,4.45,4.45],[rotation.x,rotation.y,rotation.z],true);
    for(let j=0;j<8;j++) {
      const a=j*Math.PI/4,p=center.clone().addScaledVector(frame.right,Math.sin(a)*4.7).addScaledVector(frame.up,Math.cos(a)*4.7);
      scenery.add(G.rock,CANDY[j%4],p.toArray(),[.24,.24,.24],[],true,j*.5);
    }
  }
  const moon=point(s,.5);moon.y=Math.max(...s.frames.map(f=>f.position.y))+10.8;
  scenery.add(G.round,'#f1dca0',moon.toArray(),[2.4,2.4,.8],[],true);
  face(scenery,moon.x,moon.y,moon.z+.79,1.6);
  for(const [dx,dy]of [[-1.6,.8],[1.6,-.65]])scenery.add(G.rock,'#e9d79f',[moon.x+dx,moon.y+dy,moon.z+.65],[.2,.2,.04]);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;star(scenery,moon.x+Math.sin(a)*4,moon.y+Math.cos(a)*3.3,moon.z,.36,CANDY[i%4]);}
  b.batch(scenery);
  const rockets=b.pool(rocketModel(),5),spark=new WorldModel();star(spark,0,0,0,.28,GOLD);
  const exhaust=b.pool(spark,50),pulses=new CrossingPulses(stops.map(stop=>stop.distance));
  const flame=new WorldModel();flame.add(G.cone,'#ffce84',[0,-.5,0],[.53,1.85,.53],[0,0,Math.PI],true);
  flame.add(G.cone,'#a4e3e8',[0,-.16,.02],[.32,1.2,.32],[0,0,Math.PI],true);const flames=b.pool(flame,5);
  // The countdown and exhaust share one tiny luminous star pool.
  const countdown=exhaust,arm=new WorldModel();
  arm.add(G.box,'#b0c9d8',[1.1,0,0],[2.2,.22,.22]);
  arm.add(G.box,GOLD,[2.17,0,0],[.25,.55,.7]);
  arm.add(G.pole,'#e7c6a3',[0,0,0],[.27,.35,.27],[Math.PI/2,0,0]);
  const clamps=b.pool(arm,10);for(const mesh of clamps)mesh.name='launch-gantry-arms';
  for(const mesh of flames)mesh.name='rocket-flames';
  for(const mesh of countdown)mesh.name='launch-countdown';
  const lampColors=['#f3a5c5','#ffe29b','#a3e4cd'].map(color=>new T.Color(color));
  for(const mesh of countdown)for(let i=0;i<15;i++)mesh.setColorAt(i,lampColors[i%3]);
  b.animate((time,distance,reduced)=>{
    pulses.update(time,distance);
    for(let i=0;i<stops.length;i++) {
      const {p}=stops[i],age=pulses.age(i,time),active=!reduced&&age>=0&&age<6;
      const lift=active?11*smooth(age/2.5)*(1-smooth((age-4.2)/1.8)):0;
      const bank=active?Math.sin(age*1.4)*.08:0;
      b.place(rockets,i,p.x,3.5+lift,p.z,1.12,0,.2*Math.sin(i),bank);
      b.place(flames,i,p.x,1.44+lift,p.z,active&&lift>.3?.85+.12*Math.sin(time*14+i):0);
      const gap=stops[i].distance-distance;
      // Gantries release before ignition, remain clear in flight, and close on landing.
      const release=reduced?0:Math.max(1-smooth((gap-1)/9),active?1:0)*(active?1-smooth((age-5.5)/.5):gap>0?1:0);
      for(let side=0;side<2;side++)b.place(clamps,i*2+side,p.x+stops[i].side*2.5,3.2,p.z+(side?1:-1)*.8,1,0,stops[i].side>0?Math.PI:0,release*.95,'YXZ');
      for(let j=0;j<3;j++) {
        const lit=j===0?gap>12&&gap<30:j===1?gap>2&&gap<=12:gap<=2&&(reduced||age<2.5);
        b.place(countdown,i*3+j,p.x+stops[i].side*2.5,1.3+j*1.2,p.z+.42,lit?1.15:.28);
      }
      for(let j=0;j<7;j++) {
        const progress=active?(age*1.6+j/7)%1:0;
        b.place(exhaust,15+i*7+j,p.x+Math.sin(j*2.4+(active?age:0))*progress*.9,1.55+lift-progress*2.1,p.z+Math.cos(j*2.4)*progress*.9,
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
  m.add(G.rock,GOLD,[0,1.37,0],[.25,.38,.25],[],true);
  for(const side of [-1,1])m.add(G.rock,'#d5b8ed',[side*.52,1.22,0],[.2,.28,.2],[],true);
  for(let j=0;j<8;j++) {
    const a=j*Math.PI/4,x=Math.sin(a)*1.42,z=Math.cos(a)*1.42;
    m.add(G.round,CANDY[j%4],[x,-.04,z],[.3,.24,.3],[],true);

  }
  return m;
}

function jellyfishDreamway(s:MiniSection,b:VariantBuilder) {
  const scenery=new WorldModel(),stops=Array.from({length:7},(_,i)=>{
    const f=.06+i*.146,p=point(s,f),frame=s.frames[Math.round(s.resolution*f)];
    p.addScaledVector(frame.right,i%2===0?0:(i%4===1?-6.3:6.3));
    p.y+=i%2===0?7.5:5.6;return {p,distance:at(s,f)};
  });
  const clams:{p:T.Vector3;distance:number}[]=[];
  for(let i=0;i<10;i++) {
    const f=.035+i*.103,frame=s.frames[Math.round(s.resolution*f)],p=point(s,f),side=i%2?1:-1;
    p.addScaledVector(frame.right,side*6.3);p.y=.3;
    scenery.add(G.round,'#94b5cc',p.toArray(),[2,.35,1.5]);
    for(let j=0;j<3;j++) {
      const base=p.clone().add(v((j-1)*.72,0,0)),top=base.clone().add(v((j-1)*.35,2.4+(i+j)%3*.5,.2));
      scenery.beam(CANDY[(i+j)%4],base,top,.18);
      for(const side of [-1,1])scenery.beam(CANDY[(i+j)%4],base.clone().lerp(top,.5),top.clone().add(v(side*.65,-.55,.12)),.12);
      scenery.add(G.rock,CANDY[(i+j)%4],top.toArray(),[.29,.29,.29],[],true,i+j*.4);
    }
    // An open clam and its luminous pearl anchor the floating jellyfish forest.
    scenery.add(G.round,'#d1a5cb',[p.x+side*1.4,.65,p.z+.9],[.85,.24,.65]);
    scenery.add(G.round,GOLD,[p.x+side*1.4,.95,p.z+.94],[.28,.28,.28],[],true,i*.3);
    clams.push({p:v(p.x+side*1.4,.7,p.z+.65),distance:at(s,f)});
    for(let j=0;j<5;j++) {
      const a=(j-2)*.33;
      scenery.add(G.round,CANDY[(i+1)%4],[p.x+Math.sin(a)*1.15,.6+Math.cos(a)*1.15,p.z-1],[.16,.9,.16],[0,0,-a]);
    }
  }
  b.batch(scenery);
  const jellies=b.pool(jellyModel(),7),bubble=new WorldModel();
  bubble.add(G.rock,'#c4f1e9',[0,0,0],[.24,.31,.24],[],true);
  const bubbles=b.pool(bubble,308);for(const mesh of bubbles)mesh.name='jellyfish-pearl-fringe';
  const shell=new WorldModel();shell.add(G.round,'#e9bfd8',[0,.68,0],[.93,.77,.17]);
  for(let j=0;j<5;j++)shell.beam('#f4d7bd',v(0,0,.14),v((j-2)*.31,1.23-Math.abs(j-2)*.09,.14),.04);
  const lids=b.pool(shell,10),fish=new WorldModel();
  fish.add(G.round,'#f4c08f',[0,0,0],[.75,.38,.25]);fish.add(G.cone,'#eaaaad',[-.85,0,0],[.38,.55,.08],[0,0,Math.PI/2]);
  fish.add(G.cone,'#f2dc9c',[0,.39,0],[.24,.35,.08]);
  for(const side of [-1,1])fish.add(G.rock,INK,[.38,.06,side*.22],[.085,.1,.06]);
  const fishPool=b.pool(fish,7);
  for(const mesh of lids)mesh.name='pearl-clam-lids';
  b.animate((time,distance,reduced)=>{
    for(let i=0;i<7;i++) {
      const stop=stops[i],near=arrival(distance,stop.distance,12),bob=reduced?0:Math.sin(time*1.25+i)*.22+near*.65;
      const size=1+(reduced?0:near*.08);
      b.place(jellies,i,stop.p.x,stop.p.y+bob,stop.p.z,size);
      for(let strand=0;strand<8;strand++)for(let pearl=0;pearl<5;pearl++) {
        const a=strand*Math.PI/4,t=(pearl+1)/5;
        const curl=reduced?0:Math.sin(time*2.2+i+strand*.7-t*1.8)*(.12+near*.48)*t;
        const radius=1.42+curl,drop=.24+(pearl+.5)*.48;
        b.place(bubbles,28+i*40+strand*5+pearl,stop.p.x+Math.sin(a)*radius*size,stop.p.y+bob-drop*size,stop.p.z+Math.cos(a)*radius*size,.86*size,0,a,0);
      }
      const swim=(reduced?0:time*.6+near*.8)+i*.8;
      b.place(fishPool,i,stop.p.x+Math.sin(swim)*2.9,stop.p.y+1.35+Math.cos(swim)*.3,stop.p.z+Math.cos(swim)*2.9,.78,0,swim);
      for(let j=0;j<4;j++) {
        const rise=reduced?j*.45:(time*.55+j*.75+i*.21)%3;
        b.place(bubbles,i*4+j,stop.p.x+Math.sin(j*1.7+i)*2.25,stop.p.y+.5+rise,stop.p.z+Math.cos(j*1.7)*1.9,
          1.3+near*.7+(j%2)*.3,0,reduced?0:Math.sin(time*.4+j)*.4);
      }
    }
    for(let i=0;i<clams.length;i++){
      const clam=clams[i],open=reduced?0:arrival(distance,clam.distance,10);
      b.place(lids,i,clam.p.x,clam.p.y,clam.p.z,1,1.3-open*1.17);
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
  m.add(G.box,'#8e78ad',[cx,1,back+1.2],[width+5.6,2,4.5]);
  m.add(G.box,'#eed09b',[cx,2.08,back+1.2],[width+5.8,.16,4.7]);
  for(let j=0;j<8;j++)m.add(G.box,CANDY[j%4],[cx+(j-3.5)*(width+4)/8,1,back+3.48],[(width+4)/10,.6,.05]);
  b.batch(m);
  const bumper=new WorldModel();bumper.add(G.round,'#f1a5cb',[0,0,0],[1.6,1.6,.55],[],true);face(bumper,0,0,.54,1);
  for(const side of [-1,1]){
    bumper.add(G.cone,'#ffc2dd',[side*.88,1.42,0],[.4,.83,.3],[0,0,-side*.22],true);
    bumper.add(G.rock,'#ffd1b3',[side*1.38,-.84,.18],[.38,.47,.3]);
    for(let j=0;j<3;j++)bumper.beam('#f8dbb8',v(side*.68,-.14+j*.12,.59),v(side*1.2,-.26+j*.24,.58),.035);
  }
  const caps=b.pool(bumper,3),flipper=new WorldModel();for(const mesh of caps)mesh.name='pinball-kitten-bumpers';
  flipper.add(G.box,'#f6ca87',[1.5,0,0],[3,.75,.55]);flipper.add(G.round,'#ffddb0',[3,0,0],[.5,.4,.3]);
  flipper.add(G.pole,'#99d3ce',[0,0,0],[.55,.7,.55],[Math.PI/2,0,0]);
  const flips=b.pool(flipper,2),ball=new WorldModel();ball.add(G.round,'#d1e5e6',[0,0,0],[.82,.82,.82]);
  ball.add(G.rock,CREAM,[-.28,.33,.65],[.22,.19,.07]);const balls=b.pool(ball,1);
  const segment=new WorldModel();segment.add(G.box,GOLD,[0,0,0],[.16,.73,.1],[],true);
  const digits=b.pool(segment,45),patterns=[0b0111111,0b0000110,0b1011011,0b1001111,0b1100110,0b1101101,0b1111101,0b0000111,0b1111111,0b1101111];
  for(const mesh of digits)mesh.name='pinball-display-and-rays';
  const segmentLayout=[[0,.94,1],[.49,.47,0],[.49,-.47,0],[0,-.94,1],[-.49,-.47,0],[-.49,.47,0],[0,0,1]];
  const ballRoute=[v(cx-width*.27,3.3,back+1.65),bumpers[0].clone().add(v(-2.2,.6,.85)),bumpers[1].clone().add(v(2.2,.6,.85)),bumpers[2].clone().add(v(0,-2.3,.85)),v(cx+width*.27,3.3,back+1.65)];
  const ballStops=[s.start,at(s,.22),at(s,.5),at(s,.78),s.end];
  for(const mesh of balls)mesh.name='pinball-ball';
  const impacts=new CrossingPulses([.22,.5,.78].map(t=>at(s,t)));
  b.animate((time,distance,reduced)=>{
    impacts.update(time,distance);
    const progress=T.MathUtils.clamp((distance-s.start)/s.length,0,1);
    let i=0;while(i<3&&distance>ballStops[i+1])i++;
    const blend=T.MathUtils.clamp((distance-ballStops[i])/(ballStops[i+1]-ballStops[i]),0,1),p=ballRoute[i],q=ballRoute[i+1];
    b.place(balls,0,p.x+(q.x-p.x)*blend,p.y+(q.y-p.y)*blend,p.z+(q.z-p.z)*blend);
    for(let j=0;j<3;j++) {
      const age=impacts.age(j,time),pop=!reduced&&age>=0&&age<1.5?Math.exp(-age*3.2)*Math.abs(Math.sin(age*13)):0,p=bumpers[j];
      b.place(caps,j,p.x,p.y,p.z+.42+pop*.35,1+pop*.18);
      for(let ray=0;ray<8;ray++) {
        const a=ray*Math.PI/4,r=2.35+pop*.7;
        b.place(digits,21+j*8+ray,p.x+Math.sin(a)*r,p.y+Math.cos(a)*r,p.z+.48,pop*.9,0,0,-a);
      }
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
  for(const side of [-1,1]){
    m.add(G.round,'#aa86b6',[cx+side*(width*.5+1.2),cy+1,back-.08],[2,(top-s.origin.y)*.4,.18]);
    m.add(G.round,'#dfb7cd',[cx+side*(width*.5+.6),cy+5,back+.08],[1.1,6,.12],[0,0,side*.13]);
    m.add(G.box,GOLD,[cx+side*(width*.5+1.2),cy-1,back+.14],[2.5,.23,.1]);
  }
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
  key.add(G.pole,'#caa37d',[-3.55,0,0],[.48,6.5,.48],[0,0,Math.PI/2]);
  for(let j=0;j<16;j++){
    const x=-.5-j*.4,a=j*Math.PI*.63;
    key.add(G.box,GOLD,[x,Math.sin(a)*.5,Math.cos(a)*.5],[.1,.17,.17]);
  }
  const keys=b.pool(key,1);for(const mesh of keys)mesh.name='music-box-winding-drum';
  const piano=new WorldModel();piano.add(G.box,CREAM,[0,0,0],[.72,.16,1.25]);piano.add(G.box,INK,[.24,.14,-.33],[.25,.16,.55]);
  const keyboard=b.pool(piano,20),keyStops=Array.from({length:20},(_,i)=>s.start+s.length*(i+.5)/20);
  for(const mesh of keyboard)mesh.name='piano-keyboard';
  b.animate((time,distance,reduced)=>{
    const on=arrival(distance,(s.start+s.end)/2,s.length*.55),progress=T.MathUtils.clamp((distance-s.start)/s.length,0,1);
    const beat=reduced?0:Math.sin(progress*Math.PI*16)*on;
    b.place(fairy,0,cx,fairyY+Math.max(0,beat)*.16,back+1,1.9,0,reduced?0:progress*Math.PI*4,beat*.035);
    b.place(keys,0,right+3.8,3.1,back+1.6,1,reduced?0:progress*Math.PI*8,0,0);
    for(let j=0;j<16;j++) {
      const a=j*Math.PI*2/16,rx=width*.5+2.6,ry=(top-s.origin.y)*.5+2.8;
      const play=reduced?0:arrival(distance,s.start+s.length*(j+.5)/16,8),bounce=reduced?0:Math.sin(time*1.8+j)*.16+play*1.15;
      b.place(notes,j,cx+Math.sin(a)*rx,cy+Math.cos(a)*ry+bounce,back+1.3,.65+(j%3)*.1+play*.35,0,0,-.12*Math.sin(a));
    }
    for(let i=0;i<20;i++){
      const press=reduced?0:arrival(distance,keyStops[i],3.5);
      b.place(keyboard,i,cx+(i-9.5)*(width+3)/20,2.36-press*.12,back+5.6,1,press*.08);
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
  m.add(G.round,CREAM,[0,.76,0],[.49,.46,.41]);
  for(const side of [-1,1]){
    m.add(G.round,CREAM,[side*.23,1.34,0],[.15,.49,.15],[0,0,-side*.13]);
    m.add(G.rock,'#eaa6c6',[side*.23,1.36,.13],[.06,.3,.035],[0,0,-side*.13]);
  }
  face(m,0,.81,.41,.57);
  for(const side of [-1,1])m.add(G.rock,CREAM,[side*.39,.46,.55],[.17,.12,.19]);
  for(let j=0;j<6;j++){const a=j*Math.PI/3;m.add(G.rock,CANDY[j%4],[Math.sin(a)*.76,.06,Math.cos(a)*.76],[.11,.18,.07],[0,a,0]);}
  return m;
}

function teapot(m:WorldModel,y:number,radius:number) {
  const size=radius/3.15;
  m.add(G.round,'#aee0d7',[0,y,0],[1.5*size,1.48*size,1.25*size]);
  m.add(G.cone,'#edd5a3',[0,y+1.37*size,0],[1.08*size,.48*size,.93*size]);
  m.add(G.round,'#ecabd0',[0,y+1.77*size,0],[.26*size,.26*size,.26*size]);
  m.add(G.ring,'#efd3a0',[-1.35*size,y,0],[.95*size,1.05*size,.8*size]);
  const spout=[v(.95*size,y-.1*size,0),v(1.65*size,y+.25*size,0),v(1.95*size,y+.85*size,0),v(2.55*size,y+1.15*size,0)];
  for(let i=1;i<spout.length;i++)m.beam('#bce5dc',spout[i-1],spout[i],(.43-i*.07)*size);
  face(m,0,y,1.23*size,1.06*size);face(m,0,y,-1.23*size,1.06*size);
  for(const side of [-1,1])m.add(G.rock,'#edb4cb',[side*.65*size,y-.77*size,1.05*size],[.22*size,.22*size,.06*size]);
}

function teaParty(s:MiniSection,b:VariantBuilder) {
  const c=carouselCenter(s),r=carouselRideRadius(s),rotor=new T.Group(),base=new WorldModel(),m=new WorldModel();
  rotor.name='carousel-rotor';rotor.position.set(c.x,0,c.z);b.group.add(rotor);
  base.add(G.pole,'#93729c',[c.x,.45,c.z],[r,.9,r]);base.add(G.pole,'#e8cda5',[c.x,.97,c.z],[r,.16,r]);b.batch(base);
  const step=(s.origin.y+s.amplitude*.69-2)/3,floors=[2,2+step,2+2*step],potY=2+step*3;
  m.add(G.pole,'#d9bd90',[0,(potY+2)/2,0],[r*.2,potY-2,r*.2]);
  for(let level=0;level<3;level++) {
    const y=floors[level];
    const cake=new T.CylinderGeometry(r*.93,r*.88,.9,16);
    m.add(cake,level%2?'#c698bf':'#e9c7a3',[0,y-.43,0]);cake.dispose();
    m.add(G.pole,'#a3d7d1',[0,y,0],[r*.97,.38,r*.97]);
    m.add(G.pole,CREAM,[0,y+.24,0],[r*.89,.13,r*.89]);
    m.add(G.ring,GOLD,[0,y+.13,0],[r*.91,r*.91,r*.91],[Math.PI/2,0,0]);
    for(let j=0;j<12;j++) {
      const a=j*Math.PI/6;
      m.add(G.rock,CREAM,[Math.sin(a)*r*.89,y-.45,Math.cos(a)*r*.89],[.29,.47,.26]);
      m.add(G.rock,GOLD,[Math.sin(a)*r*.93,y+.28,Math.cos(a)*r*.93],[.12,.12,.12],[],true,j*.4+level);
    }
    m.add(G.round,CANDY[level],[0,y+step*.48,0],[r*.28,step*.28,r*.28]);
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3;
      m.add(G.box,'#eac5a2',[Math.sin(a)*r*.2,y+step*.48,Math.cos(a)*r*.2],[.13,step*.5,.13],[0,a,.15]);
    }
    // Tall gilded spoons form a colonnade between the iced china tiers.
    for(let j=0;j<4;j++) {
      const a=j*Math.PI/2+Math.PI/4,x=Math.sin(a)*r*.82,z=Math.cos(a)*r*.82,top=y+step-1.1;
      m.add(G.pole,'#e7c896',[x,(y+top)/2,z],[.07,top-y,.07]);
      m.add(G.round,'#f2dba8',[x,top-.25,z],[.24,.48,.09],[0,a,0]);
      for(let k=1;k<6;k++) {
        const angle=a+k/6*Math.PI/2;
        m.add(G.rock,CANDY[(level+j)%4],[Math.sin(angle)*r*.84,top-.45-Math.sin(k/6*Math.PI)*.3,Math.cos(angle)*r*.84],[.21,.28,.12],[0,angle,0]);
      }
    }
  }
  const crown=new T.CylinderGeometry(r*.34,r*.9,1,16);
  m.add(crown,'#ecc3d7',[0,potY-2.05,0]);crown.dispose();
  m.add(G.ring,GOLD,[0,potY-2.52,0],[r*.86,r*.86,r*.86],[Math.PI/2,0,0]);
  b.batch(m,rotor);
  const pouringPot=new T.Group(),pot=new WorldModel();pouringPot.name='pouring-teapot';pouringPot.position.y=potY;rotor.add(pouringPot);teapot(pot,0,r);b.batch(pot,pouringPot);
  const cups=b.pool(teacupModel(),12,rotor),steam=new WorldModel();
  steam.add(G.rock,'#d9e7dd',[0,0,0],[.3,.42,.3],[],true);const steamPool=b.pool(steam,22,rotor),motion=new CarouselMotion(s);
  for(const mesh of steamPool){mesh.name='teapot-steam-and-pour';for(let i=0;i<22;i++)mesh.setColorAt(i,new T.Color(i<10?'#ffffff':'#e6b676'));}
  const teaLip=new T.Vector3(),potSize=r/3.15;
  for(const mesh of cups)mesh.name='toasting-teacups';
  const greetings=[.2,.42,.65].map(t=>at(s,t));
  b.animate((time,distance,reduced)=>{
    rotor.rotation.y=motion.update(time,distance,reduced);
    pouringPot.rotation.z=reduced?0:-arrival(distance,at(s,.7),16)*.16;
    for(let i=0;i<12;i++) {
      const level=Math.floor(i/4),a=(i%4)*Math.PI/2,spin=reduced?0:rotor.rotation.y*.7,toast=reduced?0:arrival(distance,greetings[level]+i%4,11);
      b.place(cups,i,Math.sin(a)*r*.61,floors[level]+.81+(reduced?0:Math.sin(rotor.rotation.y*2+a)*.1)+toast*.4,Math.cos(a)*r*.61,
        Math.min(.94,r*.27),0,a+spin,toast*.08*Math.sin(a));
    }
    pouringPot.updateMatrix();teaLip.set(2.55*potSize,1.15*potSize,0).applyMatrix4(pouringPot.matrix);
    const pour=reduced?0:arrival(distance,at(s,.7),16);
    for(let i=0;i<12;i++){
      const t=reduced?i/12:(time*1.1+i/12)%1,spread=t*.35;
      b.place(steamPool,10+i,teaLip.x+spread,teaLip.y-t*2.6,teaLip.z,.24*pour*(1-t*.4));
    }
    for(let i=0;i<10;i++) {
      const rise=reduced?i*.26:(time*.65+i*.28)%2.8;
      b.place(steamPool,i,Math.sin(rise*2.4)*.38-Math.sin(pouringPot.rotation.z)*r/3.15*1.9,potY+r/3.15*1.9+rise,Math.cos(rise*2.4)*.2,(1-rise/3.4)*.9);
    }
  });
}

function saucerModel() {
  const m=new WorldModel();m.add(G.pole,'#d4c1e6',[0,0,0],[.92,.24,.92]);
  m.add(G.round,'#b1dcda',[0,.29,0],[.6,.48,.6]);
  m.add(G.round,'#b3dea8',[0,.56,.15],[.36,.36,.29]);face(m,0,.59,.46,.5);
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
    const hull=new T.CylinderGeometry(r*.93,r*.64,.95,16);
    m.add(hull,level%2?'#9695c3':'#8aadc0',[0,y-.43,0]);hull.dispose();
    m.add(G.pole,'#d2d5e4',[0,y+.03,0],[r*.89,.13,r*.89]);
    m.add(G.ring,'#accfe0',[0,y,0],[r*.91,r*.91,r*.91],[Math.PI/2,0,0]);
    m.add(G.ring,CANDY[level],[0,y+.32,0],[r*.77,r*.77,r*.77],[Math.PI/2,0,0],true);
    // The three smiling ringed worlds turn independently inside the rotating ride.
    m.add(G.ring,'#accddd',[0,y+step-1,0],[r*.89,r*.89,r*.89],[Math.PI/2,0,0]);
    for(let j=0;j<8;j++) {
      const a=j*Math.PI/4;
      m.beam('#8daabb',v(0,y,0),v(Math.sin(a)*r*.9,y,Math.cos(a)*r*.9),.085);
      m.add(G.rock,GOLD,[Math.sin(a)*r*.85,y+.13,Math.cos(a)*r*.85],[.13,.13,.13],[],true,j*.6+level);
      m.add(G.box,CANDY[(j+level)%4],[Math.sin(a)*r*.85,y-.36,Math.cos(a)*r*.85],[.37,.23,.06],[0,a,0],true,j*.4);
      if(j%2===1){
        m.beam('#b0bdde',v(Math.sin(a)*r*.82,y,Math.cos(a)*r*.82),v(Math.sin(a)*r*.82,y+step-1,Math.cos(a)*r*.82),.12);
        m.add(G.cone,'#dad6e8',[Math.sin(a)*r*.82,y+step-1.65,Math.cos(a)*r*.82],[.23,1.1,.23]);
      }
    }
  }
  m.add(G.round,'#f0cf97',[0,crown,0],[r*.59,r*.59,r*.59],[],true);face(m,0,crown,r*.585,1.1);
  for(const dy of [-.7,.7])m.add(G.ring,'#eabb95',[0,crown+dy,0],[r*.52,r*.52,r*.52],[Math.PI/2,0,0]);
  m.add(G.ring,'#cfb7e9',[0,crown,0],[r*.91,r*.91,r*.91],[Math.PI*.35,0,.2],true);
  star(m,0,crown+r*.58+1,0,.65,GOLD);b.batch(m,rotor);
  const planet=new WorldModel();planet.add(G.round,'#d8c4eb',[0,0,0]);
  planet.add(G.ring,GOLD,[0,0,0],[1.325,1.325,1.325],[Math.PI*.56,0,.13]);
  face(planet,0,.06,.96,.55);
  for(const [dx,dy]of [[-.62,.34],[.62,-.4]])planet.add(G.rock,'#afcce2',[dx,dy,.67],[.14,.18,.04]);
  const planets=b.pool(planet,3,rotor);for(const mesh of planets)mesh.name='smiling-orbiting-planets';
  const ufos=b.pool(saucerModel(),12,rotor),comet=new WorldModel();
  comet.add(G.cone,CREAM,[0,0,0],[.16,.42,.08],[0,0,-Math.PI/2],true);const comets=b.pool(comet,36,rotor),motion=new CarouselMotion(s);
  for(const mesh of comets)mesh.name='planetary-comet-trails';
  for(const mesh of ufos)mesh.name='greeting-saucers';
  const greetings=[.2,.42,.65].map(t=>at(s,t));
  b.animate((time,distance,reduced)=>{
    rotor.rotation.y=motion.update(time,distance,reduced);
    for(let level=0;level<3;level++){
      const cheer=reduced?0:arrival(distance,greetings[level],12);
      b.place(planets,level,0,floors[level]+3.45,0,r*.43,0,reduced?0:time*.35+level*.7,cheer*.2);
    }
    for(let i=0;i<12;i++) {
      const level=Math.floor(i/4),a=(i%4)*Math.PI/2,bob=reduced?0:Math.sin(rotor.rotation.y*2+a)*.14+arrival(distance,greetings[level]+i%4,12)*.8;
      b.place(ufos,i,Math.sin(a)*r*.64,floors[level]+.85+bob,Math.cos(a)*r*.64,Math.min(1.06,r*.3),0,a,bob*.05);
    }
    for(let i=0;i<24;i++) {
      const level=Math.floor(i/8),a=(i%8)*.14+(reduced?0:time*.65)+level*1.8;
      const cheer=reduced?0:arrival(distance,greetings[level],12);
      b.place(comets,i,Math.sin(a)*r*.87,floors[level]+step-1,Math.cos(a)*r*.87,(1-(i%8)*.055)*(1+cheer*.75),0,a);
    }
    for(let i=0;i<12;i++){
      const level=Math.floor(i/4),a=(i%4)*Math.PI/2,launch=reduced?0:arrival(distance,greetings[level]+i%4,12),bob=reduced?0:Math.sin(rotor.rotation.y*2+a)*.14;
      b.place(comets,24+i,Math.sin(a)*r*.64,floors[level]+.25+bob+launch*.8,Math.cos(a)*r*.64,launch*1.15,0,0,-Math.PI/2);
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
