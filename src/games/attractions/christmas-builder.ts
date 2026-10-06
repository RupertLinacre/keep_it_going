import * as T from 'three';
import { PieceBuilder, CrossingPulses } from './piece-builder';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { winterGlowMaterial } from '../winter-atmosphere';
import type { FairgroundLights } from '../world-lighting';
import type { MiniSection } from '../mini-track';

export const C={gold:'#ffd17d',cream:'#fff0bd',red:'#b94358',green:'#286d68',snow:'#dce7ff',wood:'#956252',dark:'#344665',teal:'#82e8d7',pink:'#ffaacb'};
export class ChristmasBuilder extends PieceBuilder {
  private glow=winterGlowMaterial();
  private ownedMaterials:T.Material[]=[];
  constructor(material:T.Material,lights:FairgroundLights){
    super(material,lights);this.glow.uniforms.twinkleTime=lights.clock;
    this.glow.vertexShader='uniform float twinkleTime;\n'+this.glow.vertexShader;
    this.glow.vertexShader=this.glow.vertexShader.replace('power=glowStrength;',
      'power=glowStrength*(.78+.22*pow(max(0.,sin(twinkleTime*1.3+dot(position,vec3(.37,.61,.23)))),8.));');
  }
  festive(m:WorldModel){return this.batch(m,this.group,false,this.glow);}
  effect(geometry:T.BufferGeometry,material:T.Material){this.ownedMaterials.push(material);return this.own(new T.Mesh(geometry,material));}
  /** A luminous coloured wash on snow follows the train without scene lights. */
  litSnow(model:WorldModel,train:{value:T.Vector3},strength:{value:number}) {
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.9});
    material.onBeforeCompile=shader=>{
      shader.uniforms.snowTrain=train;shader.uniforms.snowStrength=strength;
      shader.vertexShader='varying vec3 snowPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsnowPosition=transformed;');
      shader.fragmentShader='uniform vec3 snowTrain;uniform float snowStrength;varying vec3 snowPosition;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 delta=snowPosition-snowTrain;
        float arrival=exp(-dot(delta,delta)/88.)*snowStrength;
        vec3 festive=mix(vec3(.2,.85,.8),vec3(1.,.3,.45),.5+.5*sin(snowPosition.y*.35));
        totalEmissiveRadiance+=festive*arrival*.9;`);
    };
    material.customProgramCacheKey=()=> 'christmas-lit-snow-v2';
    const source=model.finish(material,material,false);
    for(const child of [...source.children])if(child instanceof T.Mesh)this.effect(child.geometry,material);
  }
  override dispose(){super.dispose();this.glow.dispose();for(const m of this.ownedMaterials)m.dispose();}
}
export const sparkleGeometry=new T.BufferGeometry();
const starVertices:number[]=[];
for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,b=a+Math.PI/5,r=i%2?.45:1,q=(i+1)%2?.45:1;starVertices.push(0,0,.12,Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(b)*q,Math.sin(b)*q,0,0,0,-.12,Math.cos(b)*q,Math.sin(b)*q,0,Math.cos(a)*r,Math.sin(a)*r,0);}
sparkleGeometry.setAttribute("position",new T.Float32BufferAttribute(starVertices,3));sparkleGeometry.computeVertexNormals();
const starShape=new T.Shape();
for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.45:1,x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}
starShape.closePath();
const starGeometry=new T.ExtrudeGeometry(starShape,{depth:.14,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.04,bevelThickness:.05});
/** The same star silhouette everywhere, with enough depth to catch blue-hour light. */
export function star(m:WorldModel,x:number,y:number,z:number,size:number,color=C.gold,glow=true,rz=0,phase=-1){m.add(starGeometry,color,[x,y,z],[size,size,size],[0,0,rz],glow,phase);}
export function gift(m:WorldModel,x:number,y:number,z:number,size:number,color=C.red){
  m.add(G.box,color,[x,y+size*.5,z],[size,size,size]);
  for(const side of [-1,1])m.add(G.box,C.gold,[x+side*size*.505,y+size*.5,z],[.05,size,size*.14]);
  m.add(G.box,C.gold,[x,y+size*.5,z+size*.505],[size*.14,size,.05]);
  m.add(G.box,C.gold,[x,y+size*1.01,z],[size,.04,size*.14]);
  for(const sign of [-1,1])m.add(G.rock,C.gold,[x+sign*size*.18,y+size*1.09,z],[size*.21,size*.12,size*.1],[0,0,sign*.3],true);
}
export function lamp(m:WorldModel,x:number,y:number,z:number,size=1){
  m.add(G.pole,C.wood,[x,y+size*1.4,z],[size*.12,size*2.8,size*.12]);
  m.add(G.box,C.dark,[x,y+size*2.9,z],[size*.8,size*.12,size*.8]);
  m.add(G.box,C.cream,[x,y+size*3.35,z],[size*.55,size*.75,size*.55],[],true);
  m.add(G.cone,C.gold,[x,y+size*3.96,z],[size*.65,size*.5,size*.65]);
  m.softGlow([x,y+size*3.35,z],C.gold,size*2.1,.7);
  m.softGlow([x,.05,z],C.gold,size*3.1,.3,true);
}
export function chalet(m:WorldModel,x:number,y:number,z:number,size:number){
  m.add(G.box,C.wood,[x,y+size*1.2,z],[size*3,size*2.4,size*2.5]);
  for(const sign of [-1,1]){
    m.add(G.box,C.red,[x+sign*size*.8,y+size*2.85,z],[size*2.1,size*.2,size*3.1],[0,0,sign*-.61]);
    m.add(G.box,C.snow,[x+sign*size*.82,y+size*2.97,z],[size*2.1,size*.14,size*3.12],[0,0,sign*-.61]);
    m.add(G.box,C.cream,[x+sign*size*.83,y+size*1.5,z+size*1.27],[size*.55,size*.68,.04],[],true);
    m.softGlow([x+sign*size*.83,y+size*1.5,z+size*1.3],C.gold,size*1.2,.65);
    m.add(G.box,C.wood,[x+sign*size*.83,y+size*1.5,z+size*1.32],[.08,size*.75,.07]);
  }
  m.add(G.box,C.dark,[x,y+size*.65,z+size*1.27],[size*.55,size*1.3,.06]);
  m.add(G.round,C.green,[x,y+size*1.95,z+size*1.28],[size*.29,size*.29,.05]);
  m.add(G.box,C.red,[x+size*.6,y+size*3.36,z-size*.4],[size*.35,size*.75,size*.35]);
  m.add(G.box,C.snow,[x+size*.6,y+size*3.77,z-size*.4],[size*.42,size*.1,size*.42]);
}
export function garland(m:WorldModel,points:T.Vector3[],spacing=2.8){
  for(let i=1;i<points.length;i++)m.beam(C.gold,points[i-1],points[i],.05);
  for(let i=0;i<points.length;i+=Math.max(1,Math.round(spacing))){const p=points[i];m.add(G.rock,C.cream,[p.x,p.y-.2,p.z],[.15,.18,.15],[],true,i*.31);m.softGlow([p.x,p.y-.2,p.z],C.gold,.65,.4);}
}
export function nearest(s:MiniSection,p:T.Vector3){
  let best=Infinity,index=0;
  for(let i=0;i<s.frames.length;i++){const f=s.frames[i].position,delta=(f.x-s.origin.x-p.x)**2+(f.y-s.origin.y-p.y)**2+(f.z-s.origin.z-p.z)**2;if(delta<best){best=delta;index=i;}}
  return s.start+s.distances[index];
}
/** Sixteen sparkles per trigger, one reused draw. No objects are born in update. */
export function sparkles(v:ChristmasBuilder,s:MiniSection,anchors:T.Vector3[],snow=false){
  const m=new WorldModel();m.add(sparkleGeometry,snow?C.snow:C.gold,[0,0,0],[1,1,1],[],true);const pool=v.pool(m,48);
  pool[0].name=snow?'globe-snow-sparkles':'christmas-passage-sparkles';
  const pulses=new CrossingPulses(anchors.map(p=>nearest(s,p)));
  return (time:number,distance:number,reduced:boolean)=>{
    pulses.update(time,distance);
    for(let i=0;i<48;i++){
      const k=Math.floor(i/16)%anchors.length,j=i%16,age=pulses.age(k,time),a=j*2.3999,base=anchors[k];
      const live=!reduced&&age>=0&&age<2.4,t=live?age:0;
      const r=.8+t*(1.1+(j%4)*.22);
      v.place(pool,i,base.x+Math.cos(a)*r,base.y+s.origin.y+1.2+t*(2+j%3*.45)-t*t*1.3,
        base.z+Math.sin(a)*r,live?(.11+j%3*.025)*(1-t/2.4):.001,0,a,(reduced?0:time)*.8+j);
    }
  };
}
export function railLights(m:WorldModel,s:MiniSection){
  const right=new T.Vector3();
  for(let d=s.start+2;d<s.end-2;d+=4.2){
    const f=s.sample(d);right.copy(f.right).multiplyScalar(1.15);
    for(const sign of [-1,1]){
      const x=f.position.x-s.origin.x+right.x*sign,y=f.position.y-.1+right.y*sign,z=f.position.z-s.origin.z+right.z*sign;
      m.add(G.rock,C.cream,[x,y,z],[.12,.14,.12],[],true,d*.13);
      // Sparse glow quads avoid overlapping hundreds of large billboards.
      if(Math.floor((d-s.start)/4.2)%3===0)m.softGlow([x,y,z],C.gold,.7,.4);
    }
  }
}
