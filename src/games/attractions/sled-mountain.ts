import * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { PieceAnimation } from '../piece-animation';
import type { FairgroundLights } from '../world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { penguinRoutes, PenguinHaul, PENGUIN_SCALE, TOW_GAPS, RACE_SECONDS } from '../sled-penguins';
import { seededRandom } from '../mini-rail';
import { PieceBuilder, point } from './piece-builder';

const C = { snow:'#f3f2ff', shadow:'#c0cde9', rock:'#889ab4', wood:'#936449', darkWood:'#74513e', red:'#e96350', teal:'#55aeb0', gold:'#ffd385' };
const UP = new T.Vector3(0,1,0);
export const SLED_TUNNEL = { from:8.26/9, to:8.49/9, radius:4, spring:2.7 };

function facets(m:WorldModel,vertices:T.Vector3[],color:string) {
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(p=>p.toArray()),3));g.computeVertexNormals();m.add(g,color,[0,0,0]);g.dispose();
}
function tree(m:WorldModel,x:number,y:number,z:number,size:number) {
  m.add(G.pole,C.darkWood,[x,y+size*.25,z],[.22,size*.5,.22]);
  for(let j=0;j<3;j++) {
    const level=y+size*(.43+j*.22),r=size*(.35-j*.072);
    m.add(G.cone,j%2?'#4e8886':'#3c746f',[x,level,z],[r,size*.55,r]);
    m.add(G.cone,C.snow,[x,level+size*.11,z],[r*.85,size*.42,r*.85]);
  }
}
function chalet(m:WorldModel,x:number,y:number,z:number,size=1) {
  m.add(G.box,C.wood,[x,y+1.7*size,z],[7.2*size,3.4*size,5*size]);
  for(let j=0;j<5;j++)m.add(G.box,'#b37c56',[x,y+(.4+j*.58)*size,z+2.52*size],[7.2*size,.15*size,.08]);
  for(const side of [-1,1]) {
    m.add(G.box,C.red,[x+side*2*size,y+3.85*size,z],[4.7*size,.35*size,6.4*size],[0,0,side*-.48]);
    m.add(G.box,C.snow,[x+side*2*size,y+4.08*size,z],[4.9*size,.4*size,6.6*size],[0,0,side*-.48]);
    m.add(G.box,C.gold,[x+side*2.15*size,y+2*size,z+2.57*size],[1.2*size,1.4*size,.1],[],true);
    m.add(G.box,C.darkWood,[x+side*2.15*size,y+2*size,z+2.65*size],[.11,1.5*size,.1]);
    m.add(G.box,C.darkWood,[x+side*2.15*size,y+2*size,z+2.65*size],[1.3*size,.1,.1]);
  }
  m.add(G.box,'#417f85',[x,y+1.2*size,z+2.58*size],[1.2*size,2.4*size,.1]);
  m.add(G.box,C.rock,[x+2.1*size,y+4.9*size,z-.7*size],[.8*size,2*size,.9*size]);
  m.add(G.box,C.snow,[x+2.1*size,y+6*size,z-.7*size],[1.1*size,.25*size,1.2*size]);
}
function penguin(m:WorldModel,scarf:string,sitting=false) {
  m.add(G.round,'#2e455e',[0,.95,0],[.63,.8,.53]);
  m.add(G.round,'#fff4d9',[0,.93,.43],[.45,.58,.15]);
  m.add(G.round,'#2e455e',[0,1.77,0],[.56,.51,.48]);
  m.add(G.round,'#fff4d9',[0,1.8,.32],[.49,.37,.15]);
  m.add(G.box,scarf,[0,1.4,0],[1.03,.19,.93]);
  m.add(G.box,scarf,[.48,1.12,.35],[.22,.65,.14],[0,0,-.2]);
  for(const side of [-1,1]) {
    m.add(G.round,'#263c53',[side*.61,1.05,0],[.16,.5,.23],[0,0,side*.65]);
    m.add(G.round,C.gold,[side*.24,sitting?.45:.13,sitting?.64:.16],[.26,.13,.38]);
    m.add(G.round,'#1f3349',[side*.17,1.87,.445],[.085,.10,.04]);
  }
  m.add(G.cone,'#f6b557',[0,1.68,.61],[.19,.48,.19],[Math.PI/2,0,0]);
}
function sledModel(color:string) {
  const m=new WorldModel();
  m.add(G.box,color,[0,.24,0],[1.55,.25,2.45]);
  for(let i=0;i<4;i++)m.add(G.box,'#f4c482',[(i-1.5)*.32,.4,0],[.27,.1,1.9]);
  for(const side of [-1,1]) {
    m.beam('#c57b4b',new T.Vector3(side*.69,.08,-1.2),new T.Vector3(side*.69,.08,1.25),.09);
    m.beam('#c57b4b',new T.Vector3(side*.69,.08,1.25),new T.Vector3(side*.69,.45,1.47),.09);
  }
  penguin(m,color,true);
  m.beam(color,new T.Vector3(.45,1.4,-.2),new T.Vector3(.65,1.6,-1.7),.18);
  m.add(G.box,color,[.65,1.6,-1.75],[.36,.12,.6],[.14,0,.1]);
  return m;
}

/** The tunnel is an open, swept stone vault around the production rails.
 * Both portals and the interior follow the sampled track tangent and grade. */
function tunnel(m:WorldModel,s:MiniSection) {
  const {from,to,radius:r,spring}=SLED_TUNNEL,outer=r+1.55;
  const frame=(u:number)=>s.frames[Math.round(s.resolution*u)];
  const cross=(u:number,angle:number,radius:number)=>{
    const f=frame(u);return point(s,u).addScaledVector(f.right,Math.sin(angle)*radius).addScaledVector(f.up,spring+Math.cos(angle)*radius);
  };
  const inner:T.Vector3[]=[],cover:T.Vector3[]=[];
  for(let j=0;j<12;j++)for(let i=0;i<12;i++) {
    const u=from+(to-from)*j/12,v=from+(to-from)*(j+1)/12,a=-Math.PI/2+i*Math.PI/12,c=a+Math.PI/12;
    const p=cross(u,a,r),q=cross(v,a,r),x=cross(u,c,r),y=cross(v,c,r);
    inner.push(p,x,q,q,x,y);
    const A=cross(u,a,outer),B=cross(v,a,outer),D=cross(u,c,outer),E=cross(v,c,outer);
    cover.push(A,B,D,B,E,D);
  }
  for(const vertices of [inner,cover])for(let i=0;i<vertices.length;i+=3)[vertices[i+1],vertices[i+2]]=[vertices[i+2],vertices[i+1]];
  facets(m,inner,'#40516a');facets(m,cover,C.snow);
  for(const u of [from,to]) {
    for(let i=0;i<13;i++) {
      const a=-Math.PI/2+i*Math.PI/13,c=a+Math.PI/13-.018;
      const p=cross(u,a,r),q=cross(u,c,r),x=cross(u,a,r+1.15),y=cross(u,c,r+1.15);
      facets(m,[p,q,x,q,y,x,p,x,q,q,x,y],i%3===0?'#9facc1':'#8295ad');
    }
  }
  // Swept wall panels meet exactly, avoiding cracks between graded blocks.
  for(let j=0;j<12;j++)for(const side of [-1,1]) {
    const u=from+(to-from)*j/12,v=from+(to-from)*(j+1)/12;
    for(const radius of [r,outer]) {
      const a=point(s,u).addScaledVector(frame(u).right,side*radius),c=point(s,v).addScaledVector(frame(v).right,side*radius);
      const low=a.clone().addScaledVector(frame(u).up,-1.3),nextLow=c.clone().addScaledVector(frame(v).up,-1.3);
      const top=a.clone().addScaledVector(frame(u).up,spring),nextTop=c.clone().addScaledVector(frame(v).up,spring);
      const vertices=[low,top,nextLow,top,nextTop,nextLow];
      const normal=top.clone().sub(low).cross(nextLow.clone().sub(low));
      const wanted=frame(u).right.clone().multiplyScalar(side*(radius===r?-1:1));
      if(normal.dot(wanted)<0)for(let i=0;i<vertices.length;i+=3)[vertices[i+1],vertices[i+2]]=[vertices[i+2],vertices[i+1]];
      facets(m,vertices,radius===r?'#40516a':'#a2b4cd');
    }
  }
  for(const u of [from+.006,to-.006]) {
    const p=point(s,u).addScaledVector(frame(u).up,5.9);
    m.beam(C.darkWood,p,p.clone().addScaledVector(frame(u).up,.8),.08);
    m.add(G.round,C.gold,p.toArray(),[.35,.6,.35],[],true);
  }
}

export function createSledMountain(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation {
  const b=new PieceBuilder(material,lights),m=new WorldModel(),w=section.width,h=section.amplitude,hand=section.hand;
  const routes=penguinRoutes(section),sledRuns=routes.paths;
  const haul=new PenguinHaul(section.start+routes.summit);
  const towPath=Array.from({length:25},(_,i)=>routes.tow(routes.summit*i/24).position);
  const snowPaths=sledRuns.flatMap(run=>Array.from({length:61},(_,i)=>run.getPoint(i/60)));
  const summit=point(section,2/9),lodge=new T.Vector3(summit.x-8,summit.y-1,summit.z-10*hand);
  const rail=Array.from({length:481},(_,i)=>point(section,i/480));
  // A faceted snow island, rather than a stack of flat shelves. Nearby rails
  // carve a generous bed; the bridge deck occupies the gap above the snow.
  const nx=28,nz=24,grid:T.Vector3[][]=[];
  const terrain=(x:number,z:number)=>{
    const xn=x/w,zn=z/w*hand;
    const across=Math.max(0,1-((xn-.53)/.5)**2)**.38;
    const profile=zn<-.24?Math.max(0,.92*(1-((zn+.24)/.23)**2)):
      zn<.08?.92-(zn+.24)*1.85:Math.max(0,.328*(1-(zn-.08)/.26));
    let y=.35+h*profile*across;
    const knoll=((x-lodge.x)/14)**2+((z-lodge.z)/12)**2;
    y=Math.max(y,lodge.y*Math.max(0,1-knoll)**.65);
    for(const p of snowPaths) {
      const d=Math.hypot(p.x-x,p.z-z);
      if(d<4)y=T.MathUtils.lerp(y,p.y-.1,T.MathUtils.smoothstep(4-d,0,2.5));
    }
    for(const p of rail) {
      const d=Math.hypot(p.x-x,p.z-z);
      if(d<7)y=T.MathUtils.lerp(y,Math.min(y,p.y-3.8),T.MathUtils.smoothstep(7-d,0,3.5));
    }
    return Math.max(.25,y);
  };
  for(let j=0;j<=nz;j++) {
    const row:T.Vector3[]=[];
    for(let i=0;i<=nx;i++) {
      const jitter=i>0&&i<nx&&j>0&&j<nz;
      const x=w*(-.07+i/nx*1.20)+(jitter?Math.sin(i*5.3+j*2.9)*w/nx*.27:0);
      const z=w*(-.55+j/nz*.99)*hand+(jitter?Math.cos(i*2.7+j*4.1)*w/nz*.23:0);
      row.push(new T.Vector3(x,terrain(x,z),z));
    }
    grid.push(row);
  }
  const land=new WorldModel();
  const surfaces=new Map<string,T.Vector3[]>();
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++) {
    const a=grid[j][i],c=grid[j+1][i],d=grid[j][i+1],e=grid[j+1][i+1];
    if(Math.max(a.y,c.y,d.y,e.y)<.5)continue;
    for(const verts of [[a,c,d],[d,c,e]]) {
      const normal=verts[1].clone().sub(verts[0]).cross(verts[2].clone().sub(verts[0]));
      if(normal.y<0)verts.reverse();
      const steep=Math.abs(normal.normalize().y)<.48;
      const color=steep?['#adbfdf','#bbc9e5','#ccd5ec'][(i+j)%3]:[C.snow,'#e7e9fc','#f8f4ff'][(i*3+j)%3];
      const list=surfaces.get(color)??[];list.push(...verts);surfaces.set(color,list);
    }
  }
  for(const [color,verts]of surfaces)facets(land,verts,color);
  b.batch(land).traverse(o=>{if(o instanceof T.Mesh)o.name="sled-snow-island";});
  // Surrounding frozen water with pale polygonal reflections.
  m.add(G.box,'#55a8dd',[w*.5,-.6,-w*.06*hand],[w*1.22,.45,w*1.04]);
  for(let i=0;i<42;i++) {
    const x=w*(-.065+(i*17%43)/43*1.13),z=w*(-.54+(i*13%41)/41*.98)*hand;
    if(terrain(x,z)>1)continue;
    m.add(G.rock,i%3===0?'#a9d8ef':'#91c7e5',[x,-.35,z],[3.8,.045,2.3],[0,i*.7,0]);
  }
  for(let i=0;i<11;i++) {
    const x=w*(-.02+(i*7%11)/11*1.12),z=w*(i%2?-.51:.39)*hand;
    m.add(G.rock,'#83c3e6',[x,-.2,z],[3.7,.9,2.8],[0,i*.4,0]);
    m.add(G.rock,C.snow,[x,.45,z],[3.65,.35,2.7],[0,i*.4,0]);
    if(i%3===0)tree(m,x,.6,z,3.6);
  }
  // Timber deck, trestles and fences share the actual rail frames.
  for(let i=0;i<180;i++) {
    const u=i/180,v=(i+1)/180;
    if(u>SLED_TUNNEL.from&&u<SLED_TUNNEL.to)continue;
    const f=section.frames[Math.round(section.resolution*u)],g=section.frames[Math.round(section.resolution*v)],p=point(section,u),q=point(section,v);
    const ends=[-1,1].map(side=>p.clone().addScaledVector(f.right,side*1.6).addScaledVector(f.up,-.6));
    const next=[-1,1].map(side=>q.clone().addScaledVector(g.right,side*1.6).addScaledVector(g.up,-.6));
    m.beam('#c59263',ends[0],ends[1],.17);
    for(let side=0;side<2;side++) {
      m.beam(C.wood,ends[side],next[side],.26);
      if(i%2===0) {
        const bulb=ends[side].clone().addScaledVector(f.up,.48);
        m.add(G.round,'#ffcf7a',bulb.toArray(),[.12,.12,.12],[],true);
      }
      const top=ends[side].clone().addScaledVector(f.up,1.9),end=next[side].clone().addScaledVector(g.up,1.9);
      m.beam(C.red,top,end,.07);
      if(i%3===0)m.beam(C.wood,ends[side],top,.1);
      if(i%9===0) {
        const lamp=top.clone().addScaledVector(f.up,.8);
        m.beam(C.wood,top,lamp,.12);m.add(G.round,C.gold,lamp.toArray(),[.5,.72,.5],[],true);
        m.add(G.cone,'#d4a56b',lamp.clone().addScaledVector(f.up,.65).toArray(),[.48,.28,.48]);
      }
    }
  }
  // Even arc-length spacing avoids impossible long timber spans on the
  // straight traverses and excessively crowded bents inside tight bends.
  for(let d=section.start+2;d<section.end;d+=7.5) {
    const tunnelFrom=section.start+section.distances[Math.round(section.resolution*SLED_TUNNEL.from)];
    const tunnelTo=section.start+section.distances[Math.round(section.resolution*SLED_TUNNEL.to)];
    if(d>tunnelFrom&&d<tunnelTo)continue;
    const f=section.sample(d),p=f.position.clone().sub(new T.Vector3(section.origin.x,0,section.origin.z));
    const underpass=snowPaths.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<4.5&&q.y<p.y-3);
    const tops=[-1,1].map(side=>p.clone().addScaledVector(f.right,side*1.6).addScaledVector(f.up,underpass?-1.1:-.75));
    const feet=tops.map((top,index)=>{const foot=top.clone().addScaledVector(f.right,underpass?(index===0?-4.2:4.2):0);foot.y=Math.min(terrain(foot.x,foot.z),top.y-1);return foot;});
    for(let side=0;side<2;side++) {
      m.beam(C.darkWood,feet[side],tops[side],.3);
      m.add(G.rock,C.snow,feet[side].toArray(),[.62,.3,.62]);
      if(!underpass)m.beam('#b17e52',feet[side].clone().lerp(tops[side],.3),tops[1-side].clone().addScaledVector(f.up,-.7),.14);
    }
    m.beam(C.wood,tops[0],tops[1],underpass?.5:.22);
  }
  const bore=new WorldModel();tunnel(bore,section);
  b.batch(bore).traverse(o=>{if(o instanceof T.Mesh)o.name="sled-stone-tunnel";});
  for(const u of [SLED_TUNNEL.from,SLED_TUNNEL.to]) {
    const f=section.frames[Math.round(section.resolution*u)],p=point(section,u);
    for(const side of [-1,1]) {
      const q=p.clone().addScaledVector(f.right,side*6.8);
      m.add(G.rock,'#dbe2f5',[q.x,p.y+1,q.z],[2.7,4.6,3.4],[0,u*3,0]);
      m.add(G.rock,C.snow,[q.x,p.y+4.1,q.z],[3.1,1.2,3.6]);
    }
  }
  // Chalet on a snowy summit knoll outside the swept railway envelope.
  m.add(G.rock,'#dbe2f4',[lodge.x,lodge.y*.48,lodge.z],[10,lodge.y*.53,8]);
  m.add(G.rock,C.snow,[lodge.x,lodge.y-.6,lodge.z],[10,1.8,8]);
  chalet(m,lodge.x,lodge.y,lodge.z,1.5);
  m.add(G.box,C.wood,[lodge.x,lodge.y-.25,lodge.z+4.5*hand],[13,.5,4]);
  for(const side of [-1,1]) {
    const z=lodge.z+side*6;
    for(const dx of [-6,-3,0,3,6])m.beam(C.darkWood,new T.Vector3(lodge.x+dx,lodge.y,z),new T.Vector3(lodge.x+dx,lodge.y+1.8,z),.13);
    m.beam(C.wood,new T.Vector3(lodge.x-6,lodge.y+1.5,z),new T.Vector3(lodge.x+6,lodge.y+1.5,z),.12);
  }
  m.beam(C.darkWood,new T.Vector3(lodge.x+8,lodge.y,lodge.z),new T.Vector3(lodge.x+8,lodge.y+9,lodge.z),.13);
  facets(m,[new T.Vector3(lodge.x+8,lodge.y+8.9,lodge.z),new T.Vector3(lodge.x+8,lodge.y+6.9,lodge.z),new T.Vector3(lodge.x+13,lodge.y+8.5,lodge.z)],C.teal);
  facets(m,[new T.Vector3(lodge.x+8,lodge.y+8.9,lodge.z),new T.Vector3(lodge.x+13,lodge.y+8.5,lodge.z),new T.Vector3(lodge.x+8,lodge.y+6.9,lodge.z)],C.teal);
  const random=seededRandom(71+section.id);
  for(let i=0;i<48;i++) {
    const x=w*(.04+random()*.95),z=w*(-.4+random()*.72)*hand,y=terrain(x,z);
    if(rail.some(p=>Math.hypot(p.x-x,p.z-z)<5.5)||snowPaths.some(p=>Math.hypot(p.x-x,p.z-z)<5)||towPath.some(p=>Math.hypot(p.x-x,p.z-z)<3.5)||Math.hypot(x-lodge.x,z-lodge.z)<10||Math.hypot(x-point(section,SLED_TUNNEL.from).x,z-point(section,SLED_TUNNEL.from).z)<8)continue;
    tree(m,x,y,z,4.7+(i*3%5)*.65);
  }
  for(let ring=0;ring<2;ring++)for(let i=0;i<48;i++) {
    const a=i*Math.PI*2/48,c=(i+1)*Math.PI*2/48,r=ring?8:5;
    m.beam('#dff0ff',new T.Vector3(w*.16+Math.cos(a)*r,-.33,w*.33*hand+Math.sin(a)*r*.38),new T.Vector3(w*.16+Math.cos(c)*r,-.33,w*.33*hand+Math.sin(c)*r*.38),.04);
  }
  b.batch(m);
  // Three dedicated snow runs keep sledding penguins off the coaster rails.
  const slides=new WorldModel();
  for(const run of sledRuns)for(let i=0;i<24;i++) {
    const a=run.getPoint(i/24),c=run.getPoint((i+1)/24);
    const ar=run.getTangent(i/24).cross(UP).normalize(),cr=run.getTangent((i+1)/24).cross(UP).normalize();
    const A=a.clone().addScaledVector(ar,-1.8).addScaledVector(UP,.14),B=a.clone().addScaledVector(ar,1.8).addScaledVector(UP,.14);
    const D=c.clone().addScaledVector(cr,-1.8).addScaledVector(UP,.14),E=c.clone().addScaledVector(cr,1.8).addScaledVector(UP,.14);
    facets(slides,[A,B,D,B,E,D],'#f9f6ff');
    for(const side of [-1,1])slides.beam('#cadcf5',a.clone().addScaledVector(ar,side*1.8).addScaledVector(UP,.3),c.clone().addScaledVector(cr,side*1.8).addScaledVector(UP,.3),.15);
  }
  for(let i=0;i<60;i++) {
    const from=-24+(routes.summit+24)*i/60,to=-24+(routes.summit+24)*(i+1)/60;
    const a=routes.tow(from),c=routes.tow(to),ar=a.tangent.clone().cross(UP).normalize(),cr=c.tangent.clone().cross(UP).normalize();
    const A=a.position.clone().addScaledVector(ar,-1.8).addScaledVector(UP,.14),B=a.position.clone().addScaledVector(ar,1.8).addScaledVector(UP,.14);
    const D=c.position.clone().addScaledVector(cr,-1.8).addScaledVector(UP,.14),E=c.position.clone().addScaledVector(cr,1.8).addScaledVector(UP,.14);
    facets(slides,[A,B,D,B,E,D],'#d9e9fb');
    for(const side of [-1,1])slides.beam(C.wood,a.position.clone().addScaledVector(ar,side*1.5).addScaledVector(UP,-.12),c.position.clone().addScaledVector(cr,side*1.5).addScaledVector(UP,-.12),.12);
    if(i%4===0)for(const side of [-1,1]) {
      const top=a.position.clone().addScaledVector(ar,side*1.3).addScaledVector(UP,-.2),foot=top.clone();foot.y=Math.min(terrain(foot.x,foot.z),top.y-1);
      slides.beam(C.darkWood,foot,top,.17);
    }
  }
  // Summit launch gate and colour-matched route pennants.
  const launch=routes.tow(routes.summit),across=launch.tangent.clone().cross(UP).normalize();
  for(const side of [-1,1]) {
    const foot=launch.position.clone().addScaledVector(across,side*2.6);
    slides.beam(C.darkWood,foot,foot.clone().addScaledVector(UP,4.5),.18);
    slides.add(G.round,C.gold,foot.clone().addScaledVector(UP,4.6).toArray(),[.28,.4,.28],[],true);
  }
  slides.beam(C.red,launch.position.clone().addScaledVector(across,-2.6).addScaledVector(UP,4.1),launch.position.clone().addScaledVector(across,2.6).addScaledVector(UP,4.1),.2);
  sledRuns.forEach((run,index)=>{
    const finish=run.getPoint(1),right=run.getTangent(1).cross(UP).normalize();
    slides.add(G.round,C.snow,finish.clone().addScaledVector(UP,-.17).toArray(),[4,.2,4]);
    for(const side of [-1,1]) {
      const foot=finish.clone().addScaledVector(right,side*2.8);
      slides.beam(C.wood,foot,foot.clone().addScaledVector(UP,2.4),.1);
      for(let x=0;x<3;x++)for(let y=0;y<2;y++)slides.add(G.box,(x+y)%2?'#36536b':C.snow,foot.clone().add(new T.Vector3(.18+x*.3,2.2+y*.25,0)).toArray(),[.3,.25,.07]);
    }
    for(const u of [.28,.55,.82]) {
      const p=run.getPoint(u),side=run.getTangent(u).cross(UP).normalize();p.addScaledVector(side,2.5);
      slides.beam(C.darkWood,p,p.clone().addScaledVector(UP,1.7),.07);
      slides.add(G.box,[C.red,'#53b9d3','#f1bd54'][index],p.clone().add(new T.Vector3(.45,1.45,0)).toArray(),[.9,.42,.08]);
    }
  });
  b.batch(slides);
  const sleds=[C.red,'#53b9d3','#f1bd54'].map(color=>b.pool(sledModel(color),1));
  const cableModel=new WorldModel();cableModel.add(G.pole,'#efb452',[0,0,0],[1,1,1]);const cables=b.pool(cableModel,3);
  const skater=new WorldModel();penguin(skater,'#78a96c');const skaters=b.pool(skater,3);
  const steam=new WorldModel();steam.add(G.round,'#f5f3ff',[0,0,0],[.8,.8,.8]);const smoke=b.pool(steam,5);
  const snow=new WorldModel();snow.add(G.rock,'#f9fcff',[0,0,0],[.16,.16,.16],[],true);const flakes=b.pool(snow,51);
  const pose=new T.Object3D();pose.rotation.order='YXZ';
  b.animate((time,distance,reduced)=>{
    haul.update(time,distance);
    const phases:string[]=[];
    const clock=reduced?0:time;
    for(let i=0;i<5;i++) {
      const age=(clock*.65+i)%5;
      b.place(smoke,i,lodge.x+3.15+age*.55,lodge.y+9+age*1.05,lodge.z-1.05+Math.sin(age)*.45,.6+age*.2);
    }
    sledRuns.forEach((run,i)=>{
      const state=haul.sample(i,time,distance-section.start,reduced);phases.push(state.phase);
      const towing=state.phase==='waiting'||state.phase==='towing';
      const f=towing?routes.tow(Math.max(-TOW_GAPS[i],distance-section.start-TOW_GAPS[i])):{position:run.getPoint(state.progress),tangent:run.getTangent(state.progress)};
      const p=f.position,tangent=f.tangent;
      pose.position.copy(p).add(new T.Vector3(0,.16,0));pose.scale.setScalar(PENGUIN_SCALE);
      pose.rotation.set(-Math.asin(tangent.y),Math.atan2(tangent.x,tangent.z),towing||reduced?0:Math.sin(state.progress*Math.PI*4+i)*.14);pose.updateMatrix();
      for(const mesh of sleds[i]){mesh.name='penguin-sled-'+i;mesh.setMatrixAt(0,pose.matrix);}
      const lead=routes.rail(Math.min(distance-section.start,routes.summit+24));
      const attach=lead.position.clone().addScaledVector(lead.tangent.clone().cross(UP).normalize(),1.1*section.hand).addScaledVector(UP,.65);
      if(i>0&&haul.sample(i-1,time,distance-section.start,reduced).phase==='towing'){const previous=routes.tow(Math.max(-TOW_GAPS[i-1],distance-section.start-TOW_GAPS[i-1]));attach.copy(previous.position).addScaledVector(previous.tangent,-2.3).addScaledVector(UP,.38);}
      const nose=p.clone().addScaledVector(tangent,2.2).addScaledVector(UP,.38),delta=nose.clone().sub(attach);
      const visible=towing&&distance>section.start+2;
      pose.position.copy(attach).add(nose).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(UP,delta.clone().normalize());pose.scale.set(visible?.12:0,visible?delta.length():0,visible?.12:0);pose.updateMatrix();
      for(const mesh of cables)mesh.setMatrixAt(i,pose.matrix);
      for(let j=0;j<6;j++) {
        const q=p.clone().addScaledVector(tangent,-.9-j*.65).add(new T.Vector3(Math.sin(clock*5+j)*(.3+j*.13),.25+j*.19,Math.cos(clock*4+j)*(.3+j*.13)));
        b.place(flakes,24+i*6+j,q.x,q.y,q.z,reduced||(state.phase!=='racing'&&!(state.phase==='landed'&&state.age<RACE_SECONDS[i]+.65))?0:(1.4-j*.12)*(state.phase==='landed'?Math.max(0,1-(state.age-RACE_SECONDS[i])/.65):1));
      }
      for(let j=0;j<3;j++) {
        const age=state.age,launch=routes.tow(routes.summit).position;
        const angle=j*Math.PI*2/3+i;
        b.place(flakes,42+i*3+j,launch.x+Math.cos(angle)*age*3,launch.y+.7+age*2,launch.z+Math.sin(angle)*age*3,reduced||state.phase!=='racing'||age>.7?0:2.5*(1-age/.7));
      }
    });
    b.group.userData.penguinPhases=phases;
    for(let i=0;i<3;i++) {
      const a=clock*.15+i*Math.PI*2/3;
      b.place(skaters,i,w*.16+Math.cos(a)*6,-.37,w*.33*hand+Math.sin(a)*2.5,1.5,0,Math.atan2(-Math.sin(a)*6,Math.cos(a)*2.5),reduced?0:Math.sin(clock*3+i)*.07);
    }
    for(let i=0;i<24;i++)b.place(flakes,i,w*(.1+(i*13%23)/23*.8),2+((i*3.7-clock*1.2)%(h+7)+(h+7))%(h+7),w*(-.32+(i*7%23)/23*.56)*hand,reduced?0:.6,0,clock*.3+i,0);
  });
  b.update(0,section.start-32,false);return b;
}
