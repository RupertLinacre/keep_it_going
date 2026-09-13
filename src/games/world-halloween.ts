import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function pumpkin(m:WorldModel,x:number,y:number,z:number,size:number,color='#ed984c') {
  for(let i=0;i<7;i++) {
    const a=i*Math.PI*2/7;
    m.add(G.round,color,[x+Math.sin(a)*size*.32,y+size*.65,z+Math.cos(a)*size*.32],[size*.58,size*.67,size*.58]);
  }
  m.add(G.pole,'#76834d',[x,y+size*1.4,z],[size*.12,size*.5,size*.12],[.1,0,-.22]);
  for(const side of [-1,1])m.add(G.cone,'#ffe5a0',[x+side*size*.31,y+size*.85,z+size*.82],[size*.15,size*.28,size*.07],[],true);
  for(let i=0;i<5;i++)m.add(G.box,'#ffdf8e',[x+(i-2)*size*.13,y+size*(.37+.035*(i-2)**2),z+size*.86],[size*.14,size*.09,size*.055],[],true);
}
export function halloweenScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number) {
  m.add(G.round,'#65566e',[x,-2,back-13],[24,10+r()*5,15]);
  m.add(G.round,'#574860',[x+12,-2,back-33],[27,16+r()*7,20]);
  for(let i=0;i<6;i++)pumpkin(m,x-13+r()*26,.1,front+1+r()*8,.65+r()*.75,i%2?'#e7a44f':'#d98852');
  for(let i=0;i<4;i++) {
    const tx=x-13+i*8,tz=back+2, lean=(r()-.5)*.3;
    m.add(G.pole,'#827386',[tx,2.8,tz],[.27,5.6,.27],[0,0,lean]);
    for(const side of [-1,1]) {
      m.add(G.box,'#827386',[tx+side*.95,4.2,tz],[.2,2.6,.2],[0,0,side*-.75]);
      m.add(G.box,'#827386',[tx+side*1.9,5,tz],[1.3,.16,.16]);
    }
    m.add(G.round,'#b298c5',[tx,5.4,tz],[.13,.13,.13],[],true);
  }
  // A crooked storybook cottage with a welcoming, glowing front door.
  if(r()<.42) {
    const hx=x-5,hz=back+3;
    m.add(G.box,'#9480a1',[hx,2.4,hz],[4.8,4.8,3.6],[0,0,.08]);
    m.add(G.cone,'#615276',[hx-.4,5.8,hz],[4,3.8,3.8],[0,Math.PI/4,-.16]);
    m.add(G.box,'#ffe0a1',[hx,1.3,hz+1.9],[1.1,2.6,.08],[],true);
    for(const dx of [-1.5,1.5]){
      m.add(G.box,'#f3c591',[hx+dx,3.1,hz+1.9],[.85,1.15,.08],[],true);
      m.add(G.box,'#6c5b79',[hx+dx,3.1,hz+1.95],[.09,1.2,.09]);
    }
    m.add(G.pole,'#aa91ae',[hx+1.1,6.2,hz-.5],[.35,2.6,.35],[0,0,-.14]);
    pumpkin(m,hx+2.8,.1,hz+2.1,1);
  }
  // Candy-coloured fence lanterns make the darkness inviting.
  for(let i=0;i<5;i++) {
    const px=x-13+i*6,pz=front+10;
    m.add(G.pole,'#b1a0b8',[px,.85,pz],[.1,1.7,.1]);
    m.add(G.round,i%2?'#d3b4ef':'#ffbb64',[px,1.8,pz],[.23,.32,.23],[],true);
    if(i<4)m.add(G.box,'#a18aab',[px+3,.9,pz],[6,.1,.1]);
  }
}

export function pumpkinHops(m:WorldModel,section:MiniSection) {
  for(let i=0;i<3;i++) {
    const f=section.sample(section.start+section.length*(.18+i*.3));
    const x=f.position.x-section.origin.x,z=f.position.z-section.origin.z-5;
    pumpkin(m,x,0,z,2.3+i*.25);
    m.add(G.pole,'#a99a78',[x-2,1.5,z+1],[.1,3,.1]);
    m.add(G.box,'#f6cd7a',[x-1.6,2.5,z+1],[1.5,.75,.12]);
  }
}

export function pumpkinTunnel(material:T.Material,luminous:T.Material) {
  const m=new WorldModel();
  for(const z of [-4.5,4.5]) for(let i=0;i<=12;i++){
    const a=i*Math.PI/12;
    m.add(G.round,i%2?'#d88a49':'#eaa04f',[Math.cos(a)*4.8,Math.sin(a)*4.8+.6,z],[1.1,1.15,1.2]);
  }
  // Back roof and vines leave the near wall open, like the mountain cutaway.
  for(let i=0;i<7;i++) {
    const z=-4.5+i*1.5;
    m.add(G.round,'#df984e',[-3.3,4.2,z],[1.8,1.4,1.4]);
  }
  m.add(G.pole,'#83a574',[-.6,7.1,0],[.5,3,.5],[0,0,-.2]);
  m.add(G.round,'#88a874',[1,6.4,0],[1.4,.15,.6],[0,0,.3]);
  for(const z of [-1.5,1.5]) m.add(G.cone,'#ffe8a1',[3.4,5.1,z],[.1,.8,.6],[0,Math.PI/2,0],true);
  return m.finish(material,luminous);
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
