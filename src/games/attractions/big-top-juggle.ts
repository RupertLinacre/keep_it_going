import * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { PieceAnimation } from '../piece-animation';
import type { FairgroundLights } from '../world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { PieceBuilder, at, arrival, type InstancePool } from './piece-builder';
import { star } from '../world-night';

const CREAM='#fff0cb',INK='#463955',GOLD='#ffd691',COLORS=['#f29ebb','#91dcd4','#bfacf0','#ffc68c'];

const name=(pool:InstancePool,value:string)=>{for(const mesh of pool)mesh.name=value;return pool;};

function face(m:WorldModel,x:number,y:number,z:number,s=1) {
  for(const side of [-1,1]){
    m.add(G.rock,INK,[x+side*.28*s,y+.13*s,z],[.07*s,.105*s,.055*s]);
    m.add(G.rock,'#ee9eb7',[x+side*.48*s,y-.12*s,z-.02],[.13*s,.07*s,.04*s]);
  }
  m.add(G.rock,INK,[x,y-.2*s,z],[.14*s,.07*s,.045*s]);
}

function tint(pool:InstancePool,count:number,offset=0) {
  const palette=COLORS.map(c=>new T.Color(c));
  for(const mesh of pool)for(let i=0;i<count;i++)mesh.setColorAt(i,palette[(i+offset)%palette.length]);
}

function loopBounds(s:MiniSection) {
  const xs=s.frames.map(f=>f.position.x-s.origin.x),zs=s.frames.map(f=>f.position.z-s.origin.z),ys=s.frames.map(f=>f.position.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.max(...ys);
  return {left,right,top,cx:(left+right)/2,cy:(s.origin.y+top)/2,back:Math.min(...zs)-5.6,width:right-left};
}

function circusJuggle(s:MiniSection,b:PieceBuilder) {
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

export function createBigTopJuggle(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation {
 const piece=new PieceBuilder(material,lights);circusJuggle(section,piece);
 piece.update(0,section.start-12,false);return piece;
}

