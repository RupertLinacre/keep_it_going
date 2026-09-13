import { WorldModel, WORLD_SHAPES as G } from './world-models';
import type { MiniSection } from './mini-track';

export function nightScenery(m:WorldModel,x:number,back:number,front:number,r:()=>number) {
  m.add(G.round,'#394660',[x,-2,back-13],[23,8+r()*7,15]);
  m.add(G.round,'#28364e',[x+10,-3,back-32],[28,15+r()*8,18]);
  // Pools reflect a ribbon of lantern colours.
  m.add(G.round,'#284969',[x,-.06,front+8],[11,.25,4]);
  for(let i=0;i<12;i++)m.add(G.box,i%2?'#b8a7f2':'#7bdbc8',[x-8+i*1.4,.18,front+6+r()*4],[.5+r(),.025,.06],[],true);
  for(let i=0;i<20;i++){
    const sx=x-17+r()*34,sy=8+r()*21,sz=back-5-r()*16;
    m.add(G.round,i%4?'#97bad8':'#ffe8b8',[sx,sy,sz],[.065,.065,.065],[],true);
    if(i%7===0){
      m.add(G.box,'#d9f4e7',[sx,sy,sz],[.5,.05,.05],[],true);
      m.add(G.box,'#d9f4e7',[sx,sy,sz],[.05,.5,.05],[],true);
    }
  }
  // Mushroom lamps: warm tops, mint stems, a patch of soft light underneath.
  for(let i=0;i<6;i++){
    const lx=x-12+r()*24,lz=front+r()*6,h=.8+r();
    m.add(G.pole,'#82aaad',[lx,h*.5,lz],[.12,h,.12]);
    m.add(G.round,i%2?'#f5b98e':'#ab9ee4',[lx,h,lz],[.7,.35,.7],[],true);
    m.add(G.round,'#547275',[lx,.05,lz],[1.7,.055,1.4]);
  }
  // A tiny striped fairground pavilion.
  if(r()<.55){
    const px=x+8,pz=back+2;
    m.add(G.pole,'#736789',[px,2,pz],[.2,4,.2]);
    m.add(G.cone,'#b57caf',[px,3.7,pz],[3.4,2.5,3.4]);
    for(const dx of [-2.4,2.4])for(const dz of [-1.7,1.7])m.add(G.pole,'#edc5ac',[px+dx,1.5,pz+dz],[.095,3,.095]);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;m.add(G.round,i%2?'#ffd994':'#8fe9d6',[px+Math.sin(a)*3.3,2.55,pz+Math.cos(a)*3.3],[.16,.16,.16],[],true)}
    m.add(G.round,'#e7d597',[px,5.2,pz],[.35,.5,.35],[],true);
  }
  for(let i=0;i<5;i++){
    const tx=x-15+i*7,tz=back+3;
    m.add(G.pole,'#41627b',[tx,2,tz],[.19,4,.19]);
    m.add(G.round,'#526c85',[tx,4.3,tz],[1.6,2.1,1.6]);
    m.add(G.round,'#8be0d0',[tx+.55,4.5,tz+1.3],[.11,.11,.11],[],true);
    m.add(G.round,'#e3b9de',[tx-.4,5.1,tz+1.2],[.11,.11,.11],[],true);
  }
}

export function lanternParade(m:WorldModel,section:MiniSection) {
  for(let i=0;i<7;i++) {
    const f=section.sample(section.start+section.length*(.08+i*.14));
    for(const side of [-1,1]){
      const p=f.position.clone().addScaledVector(f.right,side*2.7);
      const x=p.x-section.origin.x,z=p.z-section.origin.z,h=p.y+3;
      m.add(G.pole,'#71829b',[x,h/2,z],[.1,h,.1]);
      m.add(G.round,i%2?'#ffcf91':'#99e9db',[x,h+.45,z],[.42,.7,.42],[],true);
      m.add(G.box,'#797b9c',[x,h+1.1,z],[.5,.12,.5]);
    }
  }
}
