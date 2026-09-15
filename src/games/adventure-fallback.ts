import { Vector3 } from 'three';
import type { MiniTrack, MiniSection } from './mini-track';
import { AttractionDrive } from './attraction-drive';
import { SceneryFlight } from './scenery-flight';
import { adventureAt } from './adventure-worlds';
import { carouselCenter, carouselRotation } from "./world-night";
import { witchHatCenter } from "./world-halloween";
import { seededRandom } from './mini-rail';
import {SHEEP_STOPS,trackSheepPose} from './world-meadow';
import {mountainCablePoint,mountainGondolaPosition,MOUNTAIN_CABLE_LENGTH} from './mountain-gondolas';
import {PortalImpact,portalHitDistance,portalPumpkin,PORTAL_PUMPKINS} from './pumpkin-portal';

const reducedMotion=typeof matchMedia==="function"?matchMedia("(prefers-reduced-motion: reduce)"):undefined;
const drives=new WeakMap<MiniSection,[AttractionDrive,AttractionDrive]>();
const flights=new WeakMap<MiniSection,Map<string,{body:SceneryFlight,time:number}>>();
const portals=new WeakMap<MiniSection,[PortalImpact,PortalImpact]>();

/** Lightweight world landmarks for devices that cannot create a WebGL context. */
export function drawAdventureFallback(ctx:CanvasRenderingContext2D,track:MiniTrack,distance:number,time:number,project:(p:Vector3)=>[number,number],scale:number,rider=0,gravity=9.81) {
  if(reducedMotion?.matches)time=0;
  const lead=track.sample(distance).position.clone(),tail=track.sample(distance-15).position.clone();
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()};
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
  const triangle=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-w,y);ctx.lineTo(x,y+h);ctx.lineTo(x+w,y);ctx.closePath();ctx.fill()};
  for(const section of track.sections){
    if(section.start>distance+180)continue;
    const world=adventureAt(section.start).world;
    if(!drives.has(section))drives.set(section,[new AttractionDrive(),new AttractionDrive()]);
    const drive=drives.get(section)![rider];drive.update(time,distance,section.start,section.end,!!reducedMotion?.matches);
    if(!flights.has(section))flights.set(section,new Map());
    const float=(key:string,phase:number)=>{
      const cache=flights.get(section)!,id=`${rider}:${key}`;
      if(!cache.has(id))cache.set(id,{body:new SceneryFlight(phase),time});
      const state=cache.get(id)!;state.body.update(time-state.time,gravity);state.time=time;return state.body.height;
    };
    const n=Math.min(10,Math.ceil(section.span/28)),r=seededRandom(track.seed^Math.imul(section.id+17,17041));
    for(let i=0;i<n;i++){
      const x=section.origin.x+section.span*(i+.5)/n,[px,py]=project(new Vector3(x,0,section.origin.z));
      const phase=r()*6.28;
      if(px<-350||px>1450)continue;
      ctx.save();ctx.translate(px,py);ctx.scale(scale,-scale);
      if(world.id==='meadow'){
        oval(0,0,20,6+r()*8,'#8cbb73');
        rect(5,0,.4,4,'#9d805a');oval(5.2,4.4,2.5,2.3,'#689e67');
        for(let j=0;j<2;j++){
          const sx=-7+j*5,sy=Math.sin(time*.9+phase)*.08+float(`sheep:${i}:${j}`,phase+j);
          for(const dx of [-.5,.5])rect(sx+dx-.08,sy,.16,.5,'#646a62');
          oval(sx,.8+sy,.9,.5,'#fff3d8');oval(sx+.8,1+sy,.3,.32,'#60646a');oval(sx+.92,1.09+sy,.06,.07,'#fff8dd');
        }
      }else if(world.id==='mountain'){
        triangle(0,0,17,19+r()*8,'#8b9fa9');triangle(0,19,4,7,'#edf2ea');
        for(const tx of [-10,9]){rect(tx,0,.2,4,'#797368');triangle(tx,1,1.7,4,'#4f8279');triangle(tx,4,.7,1.6,'#deeee8')}
        oval(5,.02,4,.2,'#74cbd3');
      }else if(world.id==='night'){
        for(let j=0;j<9;j++){const sx=-14+r()*28,sy=8+r()*15;oval(sx,sy,.06,.06,'#c9e2ed')}
        if(section.id%4===0&&i===0){
          rect(-.15,0,.3,7,'#8690b0');ctx.strokeStyle='#95e9d8';ctx.lineWidth=.15;ctx.beginPath();ctx.arc(0,7,5.6,0,Math.PI*2);ctx.stroke();
          for(let j=0;j<8;j++){const a=j*Math.PI/4+time*.17+drive.angle*.18;oval(Math.sin(a)*5.6,7+Math.cos(a)*5.6,.35,.4,'#efc5d7')}
        }
        for(const tx of [-7,6]){rect(tx,0,.12,3,'#708c9f');oval(tx,3.2,.35,.55,'#ffd794')}
      }else{
        rect(5,0,3.5,4.7,'#a18dab');triangle(6.6,4.7,3,3.2,'#6f5c83');rect(6,0,1,2.4,'#ffdfa2');
        for(const tx of [-8,-4,1]){
          ctx.save();ctx.translate(0,float(`pumpkin:${i}:${tx}`,phase+tx));
          oval(tx,.8,1,.8,'#e69b53');rect(tx-.1,1.5,.2,.5,'#849c67');
          triangle(tx-.36,.85,.13,.23,'#ffe6a1');triangle(tx+.32,.85,.13,.23,'#ffe6a1');rect(tx-.3,.42,.6,.1,'#ffe6a1');
          ctx.restore();
        }
        const gy=4+Math.sin(time+phase)*.5+float(`ghost:${i}`,phase);
        oval(-4,gy,.7,.95,'#ebdff4');triangle(-4,gy-.7,.85,1.4,'#ebdff4');
        oval(-4.25,gy+.2,.08,.12,'#665479');oval(-3.8,gy+.2,.08,.12,'#665479');
      }
      ctx.restore();
    }
    // Signature silhouettes also work without WebGL. They use the same rail
    // frames as the 3D version, and are drawn behind the real train and rails.
    if(section.kind==='sheepbank'){
      ctx.fillStyle='#96c473';ctx.beginPath();
      const first=project(new Vector3(section.origin.x,0,section.origin.z));ctx.moveTo(...first);
      for(let i=0;i<=40;i++){
        const p=section.frames[Math.round(section.resolution*i/40)].position.clone();p.y-=1.4;ctx.lineTo(...project(p));
      }
      ctx.lineTo(...project(new Vector3(section.origin.x+section.span,0,section.origin.z)));ctx.closePath();ctx.fill();
      SHEEP_STOPS.forEach((fraction,i)=>{
        const phase=i*.83+.4,pose=trackSheepPose(section,section.start+section.length*fraction,distance,phase,time,!!reducedMotion?.matches);
        pose.position.y+=float(`track-sheep:${i}`,phase);
        const [x,y]=project(pose.position);ctx.save();ctx.translate(x,y);ctx.scale(scale,-scale);
        for(const dx of [-.55,.55])rect(dx-.08,0,.16,.6,'#60696a');
        oval(0,1,1,.6,'#fff4da');oval(.85,1.2,.36,.36,'#58676b');oval(.99,1.33,.08,.1,'#ffffff');ctx.restore();
      });
    }
    if(section.kind==='mountainpass'){
      const band=(top:(p:Vector3,t:number)=>void,bottom:(p:Vector3,t:number)=>void,color:string)=>{
        ctx.fillStyle=color;ctx.beginPath();
        for(let i=0;i<=48;i++){
          const t=i/48,p=section.frames[Math.round(section.resolution*t)].position.clone();top(p,t);
          if(i===0)ctx.moveTo(...project(p));else ctx.lineTo(...project(p));
        }
        for(let i=48;i>=0;i--){const t=i/48,p=section.frames[Math.round(section.resolution*t)].position.clone();bottom(p,t);ctx.lineTo(...project(p))}
        ctx.closePath();ctx.fill();
      };
      band((p,t)=>{p.y+=Math.sin(Math.PI*t)*(16+3*Math.sin(t*29)**2)},p=>{p.y-=.7},'#899ea8');
      band((p,t)=>{p.y+=Math.sin(Math.PI*t)*(16+3*Math.sin(t*29)**2)},(p,t)=>{p.y+=Math.sin(Math.PI*t)*(13+3*Math.sin(t*29)**2)},'#dce7e4');
      band(p=>{p.y-=.7},p=>{p.y=.3},'#708c97');
      const a=project(new Vector3(section.origin.x,.1,section.origin.z)),b=project(new Vector3(section.origin.x+section.span,.1,section.origin.z));
      ctx.strokeStyle='#72c6d0';ctx.lineWidth=scale*.7;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    }
    if(section.kind==='pondbridge'||section.kind==='ravinebridge'){
      const p=section.frames[Math.round(section.resolution*.5)].position.clone(),bridge=section.kind==='ravinebridge';
      const [x,y]=project(new Vector3(p.x,.1,p.z));ctx.save();ctx.translate(x,y);ctx.scale(scale,-scale);
      oval(0,0,section.width*.3,1.5,bridge?'#69bfcf':'#7bbfc1');
      if(bridge){rect(2,.3,3,p.y*.75,'#8bd6db');for(let i=0;i<6;i++)oval(2.5+(i%2)*1.7,.3+(1-(time*.7+i/6)%1)**2*p.y*.75,.1,.3,'#d8f0ed')}
      else for(let i=0;i<7;i++){oval(-15+i*4,0,.7,.18,'#6b9e6e');if(i%2)oval(-15+i*4,.15,.2,.17,'#edbad0')}
      ctx.restore();
      ctx.strokeStyle='#c4a375';ctx.lineWidth=scale*.2;ctx.beginPath();
      for(let d=0;d<=section.length;d+=6){const p=section.sample(section.start+d).position;ctx.moveTo(...project(new Vector3(p.x,0,p.z)));ctx.lineTo(...project(p))}ctx.stroke();
    }
    if(section.kind==='windmillloop'){
      const y=section.origin.y+section.amplitude,[px,py]=project(new Vector3(section.origin.x+section.width*.5,y,section.origin.z));
      ctx.save();ctx.translate(px,py);ctx.scale(scale,-scale);
      triangle(0,-y,2.7,y,'#e9d3a4');triangle(0,-1.5,3,3,'#d98d72');
      ctx.rotate(drive.angle);for(let i=0;i<4;i++){rect(-.5,0,1,section.amplitude*.57,'#fff0cc');ctx.rotate(Math.PI/2)}ctx.restore();
    }
    if(section.kind==='witchhat'||section.kind==='carouselhelix'){
      const hat=section.kind==='witchhat',c=hat?witchHatCenter(section):carouselCenter(section);
      const [px,py]=project(new Vector3(section.origin.x+c.x,0,section.origin.z+c.z));ctx.save();ctx.translate(px,py);ctx.scale(scale,-scale);
      if(hat){oval(0,1.5,c.radius-.4,.45,'#b099bf');triangle(0,1.5,c.radius-2,section.amplitude,'#aa8cb8');rect(-2.3,3,4.6,.9,'#dcaf66');oval(0,11,.7,.85,'#ffe1a2')}
      else {rect(-c.radius,1,c.radius*2,1,'#c19bb7');triangle(0,7,c.radius+1,3,'#c896b9');for(let i=0;i<6;i++){const x=Math.sin((reducedMotion?.matches?0:carouselRotation(section,distance))+i*Math.PI/3)*c.radius*.7;rect(x,2,.08,5,'#dcc493');oval(x,4,.5,.25,'#e9d8c4')}}
      ctx.restore();
    }
    if(world.id==='night'||['witchhat'].includes(section.kind)){
      const colors=['#ffd298','#efa4ca','#b2e9d7','#c1aff0'];
      for(let i=0;i<65;i++){
        const f=section.sample(section.start+section.length*i/64),p=f.position.clone().addScaledVector(f.up,section.kind==='lanternrun'?4:-1);
        const [x,y]=project(p);ctx.globalAlpha=.35+.65*(.5+.5*Math.sin(time*1.4-i*.28))**2;
        const near=Math.min(p.distanceToSquared(lead),p.distanceToSquared(tail));
        const arrival=Math.exp(-near/190);
        if(arrival>.05){
          ctx.globalAlpha=arrival*.65;
          const r=scale*.9,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,colors[Math.floor(i/5)%4]);g.addColorStop(1,'transparent');
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
        }
        ctx.globalAlpha=.5+arrival*.5;oval(x,y,scale*.2,scale*.2,arrival>.4?'#fff7db':colors[Math.floor(i/5)%4]);
      }
      ctx.globalAlpha=1;
    }
    if(section.kind==='tunnel'){
      const p=section.sample(section.start+section.length*.5).position,[x,y]=project(p);
      ctx.save();ctx.translate(x,y);ctx.scale(scale,-scale);
      // A side cutaway through a substantial snow-capped mountain. The real
      // train is drawn afterwards, so low-powered devices keep it readable.
      ctx.fillStyle='#91a6ae';ctx.beginPath();ctx.moveTo(-16,-.7);ctx.lineTo(-14,9);ctx.lineTo(-8,15);
      ctx.lineTo(-3,18);ctx.lineTo(1,16);ctx.lineTo(6,19);ctx.lineTo(14,9);ctx.lineTo(16,-.7);ctx.closePath();ctx.fill();
      ctx.fillStyle='#e3ece7';ctx.beginPath();ctx.moveTo(-8,15);ctx.lineTo(-3,18);ctx.lineTo(1,16);ctx.lineTo(6,19);
      ctx.lineTo(9,15);ctx.lineTo(5,16);ctx.lineTo(1,14);ctx.lineTo(-3,16);ctx.closePath();ctx.fill();
      rect(-14,-.5,28,4.2,'#526c79');
      for(const tx of [-14,14]){rect(tx-.3,-.5,.6,4.7,'#d2ceba');rect(tx-1,3.7,2,.6,'#e1d8bd')}
      for(let tx=-12;tx<=12;tx+=3){oval(tx,2.8,.15,.22,'#ffdfa0');if(tx%2===0)triangle(tx,.1,.2,.7,'#8dd5d8')}
      ctx.restore();
      const f=section.sample(section.start+section.length/2);
      ctx.strokeStyle='#536b7c';ctx.lineWidth=Math.max(1,scale*.06);ctx.beginPath();
      for(let i=0;i<=100;i++){
        const point=mountainCablePoint(i/100*MOUNTAIN_CABLE_LENGTH).applyQuaternion(f.rotation).add(f.position),xy=project(point);
        if(i===0)ctx.moveTo(...xy);else ctx.lineTo(...xy);
      }ctx.stroke();
      for(let i=0;i<6;i++){
        const p=mountainGondolaPosition(section,reducedMotion?.matches?section.start:distance,i/6),[x,y]=project(p);
        ctx.save();ctx.translate(x,y);ctx.scale(scale,-scale);
        rect(-.07,1,.14,1.2,'#6f8791');rect(-.95,-.7,1.9,1.55,'#e8ac5b');rect(-.9,.15,1.8,.6,'#b5e5e4');rect(-1,.85,2,.16,'#6b7888');ctx.restore();
      }
    }
    if(section.kind==='pumpkintunnel'){
      if(!portals.has(section))portals.set(section,[new PortalImpact(),new PortalImpact()]);
      const portal=portals.get(section)![rider];portal.update(time,distance,portalHitDistance(section),!!reducedMotion?.matches);
      for(let i=0;i<PORTAL_PUMPKINS&&portal.age<6;i++){
        const p=portalPumpkin(section,i,portal.age,gravity),[x,y]=project(p.position);
        // Spread the stack's depth slightly in the side-view fallback.
        const spread=portal.age<0?Math.sin(i*2.4)*scale*1.8:0;
        ctx.save();ctx.translate(x+spread,y);ctx.rotate(p.spin*.35);ctx.scale(scale*p.size,-scale*p.size);
        oval(0,.65,.85,.67,'#ee9a4f');rect(-.08,1.2,.16,.55,'#879b65');
        for(const side of [-1,1])triangle(side*.28,.7,.16,.25,'#f4ffd1');rect(-.36,.35,.72,.1,'#efffc0');ctx.restore();
      }
      if(portal.age>=0&&portal.age<2){
        const p=section.sample(section.start+section.length/2).position.clone();p.y+=1.5;const [x,y]=project(p),t=portal.age;
        ctx.save();ctx.globalCompositeOperation='lighter';
        const r=scale*(1+t*8),g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#d2ff9577');g.addColorStop(.5,'#4ded7777');g.addColorStop(1,'#45e59e00');
        ctx.globalAlpha=1-t/2;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#b4ff73';ctx.lineWidth=scale*.14;ctx.beginPath();ctx.arc(x,y,r*.85,0,Math.PI*2);ctx.stroke();
        for(let i=0;i<22;i++){const a=i*2.4;oval(x+Math.cos(a)*r,y+Math.sin(a)*r,scale*.18,scale*.18,i%3?'#9dffac':'#ffdc81')}
        ctx.restore();
      }
    }
  }
}
