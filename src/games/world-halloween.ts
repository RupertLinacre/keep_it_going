import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';
import { halloweenLandscape } from './background-halloween';
export type PumpkinPlacement = (x:number,y:number,z:number,size:number,color?:string)=>void;

export function pumpkin(m:WorldModel,x:number,y:number,z:number,size:number,color='#ed984c') {
  for(let i=0;i<7;i++) {
    const a=i*Math.PI*2/7;
    m.add(G.round,color,[x+Math.sin(a)*size*.32,y+size*.65,z+Math.cos(a)*size*.32],[size*.58,size*.67,size*.58]);
  }
  m.add(G.pole,'#76834d',[x,y+size*1.4,z],[size*.12,size*.5,size*.12],[.1,0,-.22]);
  for(const side of [-1,1])m.add(G.cone,'#ffe5a0',[x+side*size*.31,y+size*.85,z+size*.82],[size*.15,size*.28,size*.07],[],true);
  for(let i=0;i<5;i++)m.add(G.box,'#ffdf8e',[x+(i-2)*size*.13,y+size*(.37+.035*(i-2)**2),z+size*.86],[size*.14,size*.09,size*.055],[],true);
}
export function halloweenScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number,place:PumpkinPlacement=(...args)=>pumpkin(m,...args),variant?:number) {
  halloweenLandscape(m,x,back,front,r,place,variant);
}

export function pumpkinHops(m:WorldModel,section:MiniSection,place:PumpkinPlacement=(...args)=>pumpkin(m,...args)) {
  for(let i=0;i<3;i++) {
    const f=section.frames[Math.round(section.resolution*(i+.5)/3)];
    const x=f.position.x-section.origin.x,z=f.position.z-section.origin.z-5;
    place(x,0,z,2.3+i*.25);
    // A pumpkin percussion balcony beside each crest. The train plays both
    // drums; sticks and a short candy-green shower are separately instanced.
    for(const side of [-1,1]){
      const dz=f.position.z-section.origin.z+side*4.8,top=f.position.y;
      m.add(G.pole,'#89788a',[x,top/2,dz],[.32,top,.32]);
      m.add(G.pole,'#aa79a7',[x,top-.25,dz],[1.9,.4,1.9]);
      m.add(G.pole,i%2?'#c9a0dc':'#eda66c',[x,top+.6,dz],[1.25,1.35,1.25]);
      for(const y of [top+.03,top+1.2])m.add(G.pole,'#f5dc9e',[x,y,dz],[1.34,.12,1.34]);
      m.add(G.pole,'#dcf3b2',[x,top+1.27,dz],[1.18,.08,1.18]);
      for(let j=0;j<10;j++){
        const a=j*Math.PI/5;
        m.add(G.box,'#fff0c9',[x+Math.sin(a)*1.26,top+.6,dz+Math.cos(a)*1.26],[.07,1,.07]);
      }
      for(const eye of [-1,1])m.add(G.round,'#4e4563',[x+eye*.34,top+.7,dz+1.2],[.1,.15,.08]);
      m.add(G.round,'#724d79',[x,top+.36,dz+1.24],[.2,.08,.06]);
      // Marching-band uniforms: a ruffled balcony, gold braiding and little
      // feet turn each drum into a character rather than a floating cylinder.
      for(let j=0;j<8;j++){const a=j*Math.PI/4;m.add(G.cone,j%2?'#f0b5d0':'#c5d998',[x+Math.sin(a)*1.65,top-.75,dz+Math.cos(a)*1.65],[.38,1,.38],[0,0,Math.PI]);}
      for(const cheek of [-1,1]){
        m.add(G.round,'#e79ac0',[x+cheek*.76,top+.46,dz+1.07],[.24,.16,.1]);
        m.add(G.box,'#654c7b',[x+cheek*.32,top+1,dz+1.17],[.4,.09,.08],[0,0,cheek*.17]);
        m.add(G.round,'#e6c787',[x+cheek*.6,top-.27,dz+1.45],[.37,.16,.6]);
      }
      m.add(G.box,'#c195d2',[x,top+1.18,dz-1],[.45,.25,.13]);
      // Cross-braced bandstand legs and a gold star medallion finish the podium.
      for(const brace of [-1,1])m.beam('#c8a18f',new T.Vector3(x+brace*1.5,top-.45,dz),new T.Vector3(x,Math.max(.2,top-3),dz),.12);
      m.add(G.cone,'#f2d899',[x,top+.42,dz+1.29],[.16,.26,.055]);
      // A broad fan-shaped shell behind each drum reads as a tiny bandstand.
      for(let j=0;j<7;j++){const a=(j-3)*.26;
        m.add(G.box,j%2?'#e9b077':'#bea2d4',[x+Math.sin(a)*1.9,top+2.3+Math.cos(a)*.4,dz-1.6],[.6,2.2,.2],[0,0,-a]);
        m.add(G.round,'#eed2a1',[x+Math.sin(a)*2.9,top+2.3+Math.cos(a)*1.4,dz-1.6],[.32,.35,.14]);
      }

    }
    m.add(G.pole,'#a99a78',[x-2,1.5,z+1],[.1,3,.1]);
    m.add(G.box,'#f6cd7a',[x-1.6,2.5,z+1],[1.5,.75,.12]);
    // Curving vines carry little lanterns beside each hop.
    for(let j=0;j<8;j++){
      const a=j*Math.PI/7,px=x-4+j*1.15,py=.8+Math.sin(a)*2;
      m.add(G.round,'#9b9a73',[px,py,z+1.5],[.55,.13,.14]);
      if(j%2)m.add(G.round,j%3?'#edb168':'#bda2df',[px,py-.38,z+1.5],[.2,.3,.2],[],true,i+j*.4);
    }
  }
}

/** A wonky sweet-shop arch frames the smashable pumpkin pile. The opening is
 * deliberately wide/high enough for the entire train and its airborne wagons. */
export function pumpkinPortalFrame(m:WorldModel,section:MiniSection){
  const f=section.sample(section.start+section.length/2);
  const place=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyQuaternion(f.rotation).add(f.position).sub(new T.Vector3(section.origin.x,0,section.origin.z));
  const rotation=new T.Euler().setFromQuaternion(f.rotation);
  const diskRotation=new T.Euler().setFromQuaternion(f.rotation.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2)));
  for(const side of [-1,1]){
    for(let j=0;j<9;j++)m.add(G.pole,j%2?'#c4e69b':'#f0b8d2',place(side*(5.7+j*.045),j*.8-.1,0).toArray(),[.72,.83,.72],[rotation.x,rotation.y,rotation.z]);
    m.add(G.cone,'#a387c2',place(side*6.1,7.7,0).toArray(),[1.25,2.1,1.25],[rotation.x,rotation.y,rotation.z]);
    m.add(G.round,'#d6ff96',place(side*6.1,8.85,0).toArray(),[.3,.3,.3],[],true,side+2);
    m.beam('#e2c18a',place(side*6.1,8.75,0),place(side*6.1,10.9,0),.08);
    m.add(G.round,'#dfbbd5',place(side*6.1,11,0).toArray(),[.18,.18,.18]);
    // Biscuit turrets and candy-cane sentries form a proper sweet-shop castle.
    m.add(G.box,'#cfaa84',place(side*7,-.5,0).toArray(),[3.8,.8,4],[rotation.x,rotation.y,rotation.z]);
    m.add(G.box,'#e9c88f',place(side*7.2,2.8,-.4).toArray(),[2.2,6,2.7],[rotation.x,rotation.y,rotation.z]);
    for(let j=0;j<3;j++)m.add(G.box,'#f5dfae',place(side*7.2+(j-1)*.76,6.05,.9).toArray(),[.55,.75,.6],[rotation.x,rotation.y,rotation.z]);
    for(let j=0;j<4;j++)m.add(G.box,j%2?'#d59dca':'#ceeba7',place(side*8.5,j*.6+1,2).toArray(),[.2,.6,.2],[rotation.x,rotation.y,rotation.z]);
    const candy=place(side*8.5,4.45,2);m.add(G.pole,'#f2b1cf',candy.toArray(),[1.25,.24,1.25],[diskRotation.x,diskRotation.y,diskRotation.z]);
    m.add(G.ring,'#f8e9b9',place(side*8.5,4.45,2.16).toArray(),[.85,.85,.85],[rotation.x,rotation.y,rotation.z]);
    m.add(G.round,'#d4f1ac',place(side*8.5,4.45,2.25).toArray(),[.44,.44,.18],[],true);
    m.add(G.box,'#a17db9',place(side*7.2,3.7,1.03).toArray(),[1,1.4,.12],[rotation.x,rotation.y,rotation.z]);
    m.add(G.round,'#efdaa2',place(side*7.2,3.8,1.13).toArray(),[.34,.45,.09],[],true);

  }
  let previous:T.Vector3|undefined;
  for(let i=0;i<=20;i++){
    const a=i*Math.PI/20,p=place(-Math.cos(a)*5.7,6.2+Math.sin(a)*3,0);
    if(previous)m.beam('#f0c987',previous,p,.3);
    if(i%2===0)m.add(G.round,i%4?'#bbefa1':'#edb4e0',p.toArray(),[.26,.26,.26],[],true,i*.3);
    previous=p;
  }
  const p=place(0,10.1,0);
  m.add(G.round,'#f6e4b5',p.toArray(),[1.15,1.15,.24],[rotation.x,rotation.y,rotation.z],true);
  for(const side of [-1,1])m.add(G.round,'#745c86',place(side*.34,10.2,.24).toArray(),[.1,.16,.07],[rotation.x,rotation.y,rotation.z]);
  m.add(G.round,'#c790b2',place(0,9.72,.25).toArray(),[.35,.12,.07],[rotation.x,rotation.y,rotation.z]);
}

export function ghostModel(cloth=true) {
  const m=new WorldModel();
  m.add(G.round,'#ebdff5',[0,1.1,0],[.72,.9,.5]);
  if(cloth){m.add(G.cone,'#ebdff5',[0,.5,0],[.9,1.6,.65]);
  for(let i=0;i<5;i++)m.add(G.round,'#ebdff5',[(i-2)*.29,-.08,0],[.23,.22,.4]);}
  for(const side of [-1,1]){
    m.add(G.round,'#514a74',[side*.23,1.2,.44],[.09,.15,.055]);
    m.add(G.round,'#e7abc7',[side*.42,.94,.41],[.12,.07,.04]);
    m.add(G.round,'#ebdff5',[side*.8,.8,0],[.25,.16,.25]);
  }
  m.add(G.round,'#81739c',[0,.83,.48],[.14,.06,.035]);
  return m;
}
export function batModel() {
  const m=new WorldModel();
  const wing=new T.BufferGeometry();
  wing.setAttribute('position',new T.Float32BufferAttribute([0,0,0, -.5,.55,0, -1.3,.3,0, 0,0,0,-1.3,.3,0,-.8,-.1,0, 0,0,0,-.8,-.1,0,-.45,-.27,0],3));
  wing.computeVertexNormals();
  m.add(wing,'#9b87bf',[0,0,0]);m.add(wing,'#9b87bf',[0,0,0],[-1,1,1]);wing.dispose();
  m.add(G.round,'#8075a7',[0,0,0],[.25,.4,.2]);
  for(const x of [-.13,.13])m.add(G.cone,'#a493c4',[x,.4,0],[.11,.34,.08]);
  for(const x of [-.1,.1])m.add(G.round,'#f4dca7',[x,.16,.18],[.045,.055,.025]);
  return m;
}

export function witchHatCenter(section:MiniSection) {
  const radius=section.width*.095;
  return {x:section.width*.68+radius*.2,z:section.hand*radius,radius};
}
export function witchHat(m:WorldModel,section:MiniSection,place:PumpkinPlacement=(...args)=>pumpkin(m,...args)) {
  const {x,z,radius}=witchHatCenter(section),height=section.amplitude+2;
  // Keep the hat inside the coils; the train can always be seen outside it.
  m.add(G.pole,'#b194bd',[x,1.5,z],[radius-.4,.5,radius-.4]);
  m.add(G.cone,'#a387b3',[x,height*.5+1.6,z],[radius-2,height,radius-2]);
  m.add(G.cone,'#b098bf',[x+1.2,height+1,z],[1.1,4,1.1],[0,0,-.8]);
  // Broad cloth panels follow the cone instead of sitting like flat stickers.
  // They read at the normal game scale; the existing small stitches finish seams.
  for(let row=0;row<2;row++)for(let sector=0;sector<4;sector++){
    const positions:number[]=[],a0=sector*Math.PI/2+.12,y0=1.6+height*(.13+row*.4),y1=y0+height*.25;
    const vertex=(a:number,y:number)=>{const r=(radius-2)*(1-(y-1.6)/height)+.035;return [x+Math.sin(a)*r,y,z+Math.cos(a)*r];};
    for(let j=0;j<4;j++){
      const a=a0+j*.18,b=a+.18,p=vertex(a,y0),q=vertex(b,y0),r=vertex(a,y1),u=vertex(b,y1);positions.push(...p,...q,...r,...q,...u,...r);
    }
    const panel=new T.BufferGeometry();panel.setAttribute('position',new T.Float32BufferAttribute(positions,3));panel.computeVertexNormals();
    m.add(panel,(row+sector)%2?'#bc9ec5':'#9986b4',[0,0,0]);panel.dispose();
  }
  // Patchwork seams, stitched stars and an oversize twisted hat-band give the
  // old plain cone the character of a friendly storybook witch's workshop.
  for(let row=0;row<6;row++){
    const y=4+row*height*.115,r=(radius-2)*(1-(y-1.6)/height);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4+row*.3;
      m.add(G.box,row%2?'#e1c49b':'#c2d9aa',[x+Math.sin(a)*(r+.06),y,z+Math.cos(a)*(r+.06)],[.13,.36,.06],[0,a,.4]);
    }
  }
  for(const side of [-1,1]){
    const px=x+side*(radius+3.6),pz=z+radius*.7;
    m.add(G.round,'#564d73',[px,1.3,pz],[1.65,1.3,1.65]);
    m.add(G.pole,'#837191',[px,2.15,pz],[1.58,.16,1.58]);
    m.add(G.pole,'#c3f49c',[px,2.23,pz],[1.35,.09,1.35],[],true);
    for(let j=0;j<3;j++)m.add(G.rock,'#a39b82',[px+Math.sin(j*2.094)*1.2,.2,pz+Math.cos(j*2.094)*1.2],[.5,.3,.5]);
    for(const eye of [-1,1])m.add(G.round,'#e5d6af',[px+eye*.42,1.45,pz+1.5],[.16,.23,.08],[],true);
  }
  m.add(G.pole,'#d59857',[x,3.3,z],[radius-2.25,.9,radius-2.25]);
  m.add(G.box,'#ffd98a',[x,3.3,z+radius-2.17],[1.3,1.15,.1],[],true);
  m.add(G.box,'#8a6592',[x,3.3,z+radius-2.05],[.75,.66,.12]);
  // Arched dormer windows make the hat an inhabited wizard school. They sit
  // on its tapered surface, safely inside the railway's spiral.
  for(let j=0;j<4;j++){
    const a=j*Math.PI/2,y=height*.45+1.6,r=(radius-2)*.55;
    const px=x+Math.sin(a)*(r+.12),pz=z+Math.cos(a)*(r+.12);
    m.add(G.box,'#76578b',[px,y,pz],[1.35,2.2,.35],[0,a,0]);
    m.add(G.round,'#ecd596',[px+Math.sin(a)*.21,y+.55,pz+Math.cos(a)*.21],[.55,.73,.14],[0,a,0],true);
    m.add(G.box,'#ecd596',[px+Math.sin(a)*.21,y-.24,pz+Math.cos(a)*.21],[1.08,.95,.16],[0,a,0],true);
    m.add(G.box,'#a87f9a',[px+Math.sin(a)*.32,y,pz+Math.cos(a)*.32],[.1,1.85,.07],[0,a,0]);
    m.add(G.box,'#a87f9a',[px+Math.sin(a)*.32,y+.1,pz+Math.cos(a)*.32],[1.13,.1,.07],[0,a,0]);
    m.add(G.cone,'#cbafd3',[px,y+1.7,pz],[1.1,1.3,.72],[0,a,0]);
    // Miniature dormer balconies give the flying kittens a real school to orbit.
    const outward=new T.Vector3(Math.sin(a),0,Math.cos(a)),right=new T.Vector3(Math.cos(a),0,-Math.sin(a));
    const balcony=new T.Vector3(px,y-1.25,pz).addScaledVector(outward,.45);
    m.add(G.box,'#d9b990',balcony.toArray(),[1.9,.2,1.05],[0,a,0]);
    for(const side of [-1,1]){
      const post=balcony.clone().addScaledVector(right,side*.82).addScaledVector(outward,.4);post.y+=.4;
      m.add(G.pole,'#bb97ae',post.toArray(),[.06,.8,.06]);
    }
    const rail=balcony.clone().addScaledVector(outward,.4);rail.y+=.75;m.add(G.box,'#e9cfa4',rail.toArray(),[1.78,.09,.09],[0,a,0]);
  }
  m.add(G.round,'#ffe1a2',[x,11,z+(radius-2)*.65],[.8,.95,.09],[],true);
  m.add(G.round,'#a387b3',[x+.35,11.2,z+(radius-2)*.65+.06],[.65,.85,.09]);
  for(let i=0;i<9;i++){
    const y=5+i*1.8,sz=(radius-2)*(1-(y-1.6)/height)+.1;
    m.add(G.round,i%2?'#ecc87a':'#c7b0ef',[x+Math.sin(i*2)*sz*.35,y,z+sz],[.16,.16,.09],[],true,i*.7);
  }
  // A ribbon of amber lanterns spirals down with the railway.
  for(let i=0;i<48;i++){
    const f=section.sample(section.start+section.length*(.25+i*.7/47));
    const p=f.position.clone().addScaledVector(f.right,1.55).addScaledVector(f.up,-.25);
    m.add(G.round,i%3?'#edb067':'#c6a9e6',[p.x-section.origin.x,p.y,p.z-section.origin.z],[.19,.25,.19],[],true,i*.24);
  }
  for(const side of [-1,1])place(x+side*(radius+2),.1,z+radius,1.5);
}
