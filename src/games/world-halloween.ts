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
export function halloweenScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number,place:PumpkinPlacement=(...args)=>pumpkin(m,...args)) {
  halloweenLandscape(m,x,back,front,r,place);
}

export function pumpkinHops(m:WorldModel,section:MiniSection,place:PumpkinPlacement=(...args)=>pumpkin(m,...args)) {
  for(let i=0;i<3;i++) {
    const f=section.frames[Math.round(section.resolution*(i+.5)/3)];
    const x=f.position.x-section.origin.x,z=f.position.z-section.origin.z-5;
    place(x,0,z,2.3+i*.25);
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

export function ghostModel() {
  const m=new WorldModel();
  m.add(G.round,'#ebdff5',[0,1.1,0],[.72,.9,.5]);
  m.add(G.cone,'#ebdff5',[0,.5,0],[.9,1.6,.65]);
  for(let i=0;i<5;i++)m.add(G.round,'#ebdff5',[(i-2)*.29,-.08,0],[.23,.22,.4]);
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
  m.add(G.pole,'#d59857',[x,3.3,z],[radius-2.25,.9,radius-2.25]);
  m.add(G.box,'#ffd98a',[x,3.3,z+radius-2.17],[1.3,1.15,.1],[],true);
  m.add(G.box,'#8a6592',[x,3.3,z+radius-2.05],[.75,.66,.12]);
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
