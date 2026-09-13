import { Vector3 } from 'three';
import type { MiniTrack } from './mini-track';
import { adventureAt } from './adventure-worlds';
import { seededRandom } from './mini-rail';

/** Lightweight world landmarks for devices that cannot create a WebGL context. */
export function drawAdventureFallback(ctx:CanvasRenderingContext2D,track:MiniTrack,distance:number,time:number,project:(p:Vector3)=>[number,number],scale:number) {
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()};
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
  const triangle=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-w,y);ctx.lineTo(x,y+h);ctx.lineTo(x+w,y);ctx.closePath();ctx.fill()};
  for(const section of track.sections){
    if(section.start>distance+180)continue;
    const world=adventureAt(section.start).world;
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
          const sx=-7+j*5,sy=Math.sin(time*.9+phase)*.08;
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
          for(let j=0;j<8;j++){const a=j*Math.PI/4+time*.17;oval(Math.sin(a)*5.6,7+Math.cos(a)*5.6,.35,.4,'#efc5d7')}
        }
        for(const tx of [-7,6]){rect(tx,0,.12,3,'#708c9f');oval(tx,3.2,.35,.55,'#ffd794')}
      }else{
        rect(5,0,3.5,4.7,'#a18dab');triangle(6.6,4.7,3,3.2,'#6f5c83');rect(6,0,1,2.4,'#ffdfa2');
        for(const tx of [-8,-4,1]){
          oval(tx,.8,1,.8,'#e69b53');rect(tx-.1,1.5,.2,.5,'#849c67');
          triangle(tx-.36,.85,.13,.23,'#ffe6a1');triangle(tx+.32,.85,.13,.23,'#ffe6a1');rect(tx-.3,.42,.6,.1,'#ffe6a1');
        }
        const gy=4+Math.sin(time+phase)*.5;
        oval(-4,gy,.7,.95,'#ebdff4');triangle(-4,gy-.7,.85,1.4,'#ebdff4');
        oval(-4.25,gy+.2,.08,.12,'#665479');oval(-3.8,gy+.2,.08,.12,'#665479');
      }
      ctx.restore();
    }
    if(section.kind==='tunnel'){
      const p=section.sample(section.start+section.length*.5).position,[x,y]=project(p);
      ctx.save();ctx.translate(x,y);ctx.scale(scale,-scale);
      // Side cutaway, matching the readable open wall of the 3D model.
      rect(-7,0,14,5,world.id==='halloween'?'#b18157':'#849399');
      rect(-7,4.7,14,.4,world.id==='halloween'?'#efb267':'#d9cbb0');
      for(const tx of [-7,0,7]){rect(tx,0,.35,5,'#d9cbb0');oval(tx+1,3.8,.18,.3,'#ffe4a0')}
      ctx.restore();
    }
  }
}
