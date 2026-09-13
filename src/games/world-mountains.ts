import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function mountainScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number) {
  const height=17+r()*12;
  m.add(G.cone,'#85929e',[x, height*.45-1, back-19],[22,height,19]);
  m.add(G.cone,'#e5eef0',[x,height*.88-1,back-19],[5.2,height*.25,4.5]);
  const far=23+r()*12;
  m.add(G.cone,'#a7b9c7',[x+19,far*.45-1,back-33],[27,far,24]);
  m.add(G.cone,'#f4f3e7',[x+19,far*.86-1,back-33],[7.5,far*.3,6.7]);
  m.add(G.round,'#a2b4b0',[x,-2,back-1],[18,6,10]);
  for(let i=0;i<8;i++) {
    const px=x-14+r()*28,pz=i<5?back+2+r()*5:front+2+r()*6,h=2.3+r()*2.8;
    m.add(G.pole,'#746f65',[px,h*.3,pz],[.16,h*.6,.16]);
    m.add(G.cone,'#42776d',[px,h*.65,pz],[h*.36,h,h*.36]);
    m.add(G.cone,'#dce9e4',[px,h*1.02,pz],[h*.15,h*.4,h*.15]);
    if(i<4)m.add(G.rock,'#b1b6b4',[px+2,.4,pz+1],[1.3,.8,.9],[0,r()*3,0]);
  }
  // Turquoise alpine pools and snow pockets sit beside, never across, the rails.
  m.add(G.round,'#8aabb1',[x+1,-.05,front+8],[8,.22,3.9]);
  m.add(G.round,'#68c4c9',[x+1,.12,front+8],[7,.08,3.2]);
  for(let i=0;i<5;i++)m.add(G.box,'#c5f0e7',[x-4+i*2,.22,front+7+(i%2)],[1.2,.025,.065]);
  m.add(G.round,'#eef0e3',[x-9,-.15,front+5],[3.2,.32,1.8]);
  if(r()<.45) {
    const bx=x-7,bz=back+3;
    m.add(G.box,'#bb8264',[bx,1.6,bz],[4.4,3.2,3.2]);
    m.add(G.cone,'#f6e7cf',[bx,3.4,bz],[3.5,2.1,3.3],[0,Math.PI/4,0]);
    m.add(G.box,'#ffe6a1',[bx,1.8,bz+1.64],[1.8,1,.07],[],true);
    m.add(G.box,'#765e51',[bx-1.2,1,bz+1.65],[.75,2,.09]);
  }
}

/** A mesh following this particular summit route. The railway sits on its ridge. */
export function mountainRidge(m:WorldModel,section:MiniSection) {
  const vertices:number[]=[], rows:number[][]=[];
  for(let i=0;i<=48;i++) {
    const f=section.frames[Math.round(section.resolution*i/48)];
    const y=Math.max(.2,f.position.y-1.5);
    rows.push([-14,-6,0,3.4,10].flatMap((z,j)=>[f.position.x-section.origin.x,
      [0,y*.65,y,y,0][j],f.position.z-section.origin.z+z]));
  }
  for(let i=0;i<48;i++)for(let j=0;j<4;j++) {
    const a=rows[i].slice(j*3,j*3+3),b=rows[i+1].slice(j*3,j*3+3),c=rows[i].slice((j+1)*3,(j+2)*3),d=rows[i+1].slice((j+1)*3,(j+2)*3);
    vertices.push(...a,...c,...b,...b,...c,...d);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  m.add(geometry,'#96a391',[0,0,0]);geometry.dispose();
  const summit=section.frames[Math.round(section.resolution*.5)].position;
  const x=summit.x-section.origin.x,z=summit.z-section.origin.z-3,y=summit.y;
  m.add(G.pole,'#786956',[x,y+1,z],[.07,3,.07]);
  m.add(G.box,'#f2b653',[x+.6,y+2,z],[1.2,.7,.07]);
}

/** Open camera-facing wall: enter a real roofed tunnel without losing the train. */
export function tunnelModel(material:T.Material,luminous:T.Material,halloween=false) {
  const m=new WorldModel(),rock=halloween?'#776478':'#7b8990',trim=halloween?'#e5a55a':'#d4c9af';
  const radius=4.3, length=15;
  // Back wall and a cutaway roof; the near half stays open to the viewer.
  m.add(G.box,rock,[-4,2.4,0],[1,4.8,length]);
  const shell=new T.CylinderGeometry(radius+.55,radius+.55,length,14,1,true,Math.PI,Math.PI*.5);
  // Cylinder axis becomes the track axis. Only its back/upper arc is filled.
  m.add(shell,rock,[0,1,0],[1,1,1],[Math.PI/2,0,0]);shell.dispose();
  for(const z of [-7.5,-2.5,2.5,7.5]) {
    for(let i=0;i<=10;i++) {
      const a=Math.PI*i/10;
      m.add(G.box,trim,[Math.cos(a)*radius,1+Math.sin(a)*radius,z],[.65,1.1,.5],[0,0,a-Math.PI/2]);
    }
    for(const x of [-4.3,4.3])m.add(G.box,trim,[x,.5,z],[.65,1,.5]);
    m.add(G.pole,'#665e5d',[-2.5,3.6,z],[.055,.8,.055]);
    m.add(G.round,halloween?'#ffad4e':'#ffe8a2',[-2.5,3.05,z],[.25,.4,.25],[],true);
  }
  return m.finish(material,luminous);
}
