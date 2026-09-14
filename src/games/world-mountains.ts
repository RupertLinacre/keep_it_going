import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function mountainScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number) {
  const height=17+r()*12;
  m.add(G.cone,'#85929e',[x, height*.45-1, back-25],[22,height,19]);
  m.add(G.cone,'#e5eef0',[x,height*.88-1,back-25],[5.2,height*.25,4.5]);
  const far=23+r()*12;
  m.add(G.cone,'#a7b9c7',[x+19,far*.45-1,back-38],[27,far,24]);
  m.add(G.cone,'#f4f3e7',[x+19,far*.86-1,back-38],[7.5,far*.3,6.7]);
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
  // A little summit lookout and a friendly mountain goat on the outer ledge.
  m.add(G.box,'#e5d2ae',[x-3,y-.5,z],[4,.22,2.4]);
  m.add(G.round,'#d9ccb0',[x-3,y+.4,z],[.85,.52,.45]);
  m.add(G.round,'#e8dec4',[x-2.25,y+.75,z],[.32,.42,.32]);
  for(const dx of [-3.5,-2.5])for(const dz of [-.28,.28])m.add(G.pole,'#7c766d',[x+dx,y-.15,z+dz],[.07,.7,.07]);
  for(const dz of [-.2,.2])m.add(G.cone,'#8e8478',[x-2.3,y+1.3,z+dz],[.08,.7,.08],[0,0,.25]);
  m.add(G.round,'#514f53',[x-2.07,y+.87,z+.28],[.05,.055,.03]);
  for(let i=0;i<6;i++)m.add(G.rock,'#e2e8dc',[x-7+i*2,y-1.6,z-1.5],[1.8,.2,1.1]);
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
  // Jewel-like crystals make the cutaway a discovery, not just a grey tube.
  for(let i=0;i<9;i++) {
    const z=-6+i*1.5,h=.7+(i%3)*.45;
    m.add(G.cone,i%2?'#83d6dc':'#baa9e4',[-3.2,h/2,z],[.33,h,.33],[0,0,(i%3-1)*.2],true);
    if(i%2===0)m.add(G.cone,'#cbe6e4',[-2.8,.3,z+.3],[.19,.6,.19],[0,0,-.2],true);
  }
  return m.finish(material,luminous);
}

/** A high timber trestle, with a river and waterfall far below the coaches. */
export function ravineBridge(m: WorldModel, section: MiniSection) {
  const center = section.frames[Math.round(section.resolution * .5)].position.clone();
  center.x -= section.origin.x; center.z -= section.origin.z;
  m.add(G.round, '#649fa6', [center.x, -.1, center.z], [19, .3, 20]);
  m.add(G.round, '#64c2cf', [center.x, .12, center.z], [16, .1, 18]);
  for (const side of [-1, 1]) {
    const at = .5 + side * .32, p = section.frames[Math.round(section.resolution * at)].position;
    const x = p.x - section.origin.x, z = p.z - section.origin.z, h = p.y - 1;
    m.add(G.rock, '#8f9d9f', [x, h * .4, z - 2], [11, h * .58, 11]);
    m.add(G.round, '#b0bcb0', [x, h * .82, z - 3], [8, h * .12, 6]);
  }
  let previous: T.Vector3[] | undefined;
  for (let i = 0; i <= 24; i++) {
    const f = section.sample(section.start + section.length * i / 24), p = f.position.clone();
    p.x -= section.origin.x; p.z -= section.origin.z;
    const ends = [-1, 1].map(side => p.clone().addScaledVector(f.right, side * 2.1).add(new T.Vector3(0, -.6, 0)));
    m.beam('#d8b380', ends[0], ends[1], .23);
    for (let j = 0; j < 2; j++) {
      const q = ends[j];
      if (i % 2 === 0) m.beam('#9e8062', new T.Vector3(q.x, .3, q.z), q, .22);
      if (previous) {
        m.beam('#ba9770', previous[j], q, .2);
        m.beam('#b39473', previous[j].clone().add(new T.Vector3(0, -3.5, 0)), q, .16);
        m.beam('#b39473', previous[j], q.clone().add(new T.Vector3(0, -3.5, 0)), .16);
        m.beam('#e2c99d', previous[j].clone().add(new T.Vector3(0, 1.6, 0)), q.clone().add(new T.Vector3(0, 1.6, 0)), .07);
      }
      m.beam('#d8bd91', q, q.clone().add(new T.Vector3(0, 1.8, 0)), .075);
    }
    previous = ends;
  }
  const fx = center.x + 3, fz = center.z - 10, h = center.y * .8;
  m.add(G.rock, '#84979f', [fx, h * .4, fz - 5.5], [7, h * .68, 5]);
  m.add(G.box, '#81cfd5', [fx, h / 2, fz], [3.3, h, .28], [], true);
  for (const dx of [-1.05, 0, .95]) m.add(G.box, '#ceefed', [fx + dx, h / 2, fz + .2], [.16, h, .1], [], true);
  m.add(G.round, '#a3dce0', [fx, .14, fz + 1.2], [4.5, .13, 3]);
  for (let i = 0; i < 10; i++) m.add(G.round, '#d9efed', [fx + Math.sin(i * 2.4) * 2, .25, fz + 1 + Math.cos(i * 2.4)], [.65, .15, .5], [], true);
}
