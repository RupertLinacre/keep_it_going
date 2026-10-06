import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { ChristmasBuilder, C } from './christmas-builder';

type Position = [number, number, number];
/** Each rib has a projecting ridge, broad triangular faces and a broken tip. */
export function iceRibbon(m:WorldModel,position:number[],width:number,length:number,depth:number,hand:number){
 const a:Position=[-width*.5,0,0],b:Position=[width*.5,0,0],c:Position=[0,-length*.43,depth],d:Position=[-width*.39,-length,depth*.15],e:Position=[width*.33,-length*.94,depth*.08];
 const faces=[{p:[a,c,b],color:'#c7f3f8'},{p:[a,d,c],color:'#78c7e2'},{p:[b,c,e],color:'#ace6f1'},{p:[c,d,e],color:'#e0f9fa'}];
 for(const face of faces){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(face.p.flat(),3));g.computeVertexNormals();m.add(g,face.color,position,[1,1,hand]);g.dispose();}
}
/** Warm brass lanterns with visible frames, peaked caps and wall light pools. */
export function hangingLantern(m:WorldModel,p:number[],size=1){
 const [x,y,z]=p;
 m.beam('#76584e',new T.Vector3(x,y+size*1.65,z),new T.Vector3(x,y+size*.8,z),.045*size);
 m.add(G.box,'#fff0ac',[x,y,z],[.5*size,.85*size,.5*size],[],true);
 for(const dx of [-1,1])for(const dz of [-1,1])m.add(G.box,'#a4784e',[x+dx*.29*size,y,z+dz*.29*size],[.065*size,size,.065*size]);
 for(const sign of [-1,1])m.add(G.box,'#956843',[x,y+sign*.51*size,z],[.74*size,.12*size,.74*size]);
 m.add(G.cone,'#d5a561',[x,y+.74*size,z],[.52*size,.42*size,.52*size]);
 m.softGlow([x,y,z],C.gold,size*2.6,.8);
}
/** Fixed, single-draw surface glints: tiny four-point flares with independent
 * phase, no spawned particles, bloom or real-time reflection pass. */
export function iceGlitter(v:ChristmasBuilder,anchors:T.Vector3[]){
 const positions:number[]=[],uvs:number[]=[],phases:number[]=[];
 for(let i=0;i<anchors.length;i++){
  const p=anchors[i],size=.16+(i%5)*.045;
  for(const [u,w] of [[-1,-1],[1,-1],[-1,1],[1,-1],[1,1],[-1,1]]){positions.push(p.x+u*size,p.y+w*size,p.z);uvs.push(u,w);phases.push(i*2.3999);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('phase',new T.Float32BufferAttribute(phases,1));
 const time={value:0};
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time},
 vertexShader:'attribute float phase;varying vec2 vUv;varying float vPhase;void main(){vUv=uv;vPhase=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform float time;varying vec2 vUv;varying float vPhase;
 void main(){vec2 p=abs(vUv);float core=exp(-dot(p,p)*32.);float rays=pow(max(0.,1.-min(p.x,p.y)*8.),3.)*pow(max(0.,1.-max(p.x,p.y)),2.);
 float twinkle=pow(.5+.5*sin(time*1.7+vPhase),12.);float alpha=(core+rays*.8)*(.1+twinkle*.9);if(alpha<.012)discard;gl_FragColor=vec4(vec3(.72,.92,1.),alpha);}`});
 const mesh=v.effect(g,material);mesh.name='waterfall-surface-glitter';mesh.renderOrder=3;
 return(timeValue:number,reduced:boolean)=>{time.value=reduced?0:timeValue;};
}
