import { Vector3 } from 'three';
import type { MiniSection } from './mini-track';
import { WorldModel, WORLD_SHAPES as G } from './world-models';

// A continuous two-strand cable climbs the near face of the tunnel mountain.
// Distances are metres, including the round turnarounds at both stations.
const bottom=new Vector3(14,5,-11),top=new Vector3(0,25,4);
const along=top.clone().sub(bottom),length=along.length();along.normalize();
const across=new Vector3().crossVectors(along,new Vector3(0,1,0)).normalize();
const radius=1.3,turn=Math.PI*radius;
export const MOUNTAIN_CABLE_LENGTH=2*(length+turn);
export function mountainCablePoint(travel:number) {
  let d=((travel%MOUNTAIN_CABLE_LENGTH)+MOUNTAIN_CABLE_LENGTH)%MOUNTAIN_CABLE_LENGTH;
  if(d<=length)return bottom.clone().addScaledVector(along,d).addScaledVector(across,radius);
  d-=length;
  if(d<=turn)return top.clone().addScaledVector(across,radius*Math.cos(d/radius)).addScaledVector(along,radius*Math.sin(d/radius));
  d-=turn;
  if(d<=length)return top.clone().addScaledVector(along,-d).addScaledVector(across,-radius);
  d-=length;
  return bottom.clone().addScaledVector(across,-radius*Math.cos(d/radius)).addScaledVector(along,-radius*Math.sin(d/radius));
}
export function tunnelCableTravel(section:MiniSection,distance:number) {
  return Math.max(0,Math.min(28,distance-section.start-section.length/2+14));
}
export function mountainGondolaPosition(section:MiniSection,distance:number,phase:number) {
  const f=section.sample(section.start+section.length/2);
  const p=mountainCablePoint(tunnelCableTravel(section,distance)+phase*MOUNTAIN_CABLE_LENGTH);
  p.y-=2.2;return p.applyQuaternion(f.rotation).add(f.position);
}
export function mountainRopeway(m:WorldModel) {
  // Snowy summit and a small timber lift station above the rock ridge.
  m.add(G.rock,'#b3c1c5',[0,20.2,4],[3.8,3.2,3.8]);
  m.add(G.rock,'#f1f0df',[0,22.7,4],[3.8,.65,3.8]);
  for(const [p,ground]of [[bottom,0],[top,22.7]] as const){
    m.add(G.box,'#ad7858',[p.x,ground+.7,p.z],[4.2,1.4,3.7]);
    m.add(G.box,'#ffe4a6',[p.x,ground+1.45,p.z+1.9],[2.9,.6,.1],[],true);
    m.add(G.cone,'#e8eedf',[p.x,ground+2.5,p.z],[3.6,1.7,3.2],[0,Math.PI/4,0]);
    for(const side of [-1,1])m.beam('#65858e',new Vector3(p.x+side*2,ground,p.z),new Vector3(p.x+side*2,p.y+.2,p.z),.13);
    m.beam('#b3c6bd',new Vector3(p.x-2,p.y+.2,p.z),new Vector3(p.x+2,p.y+.2,p.z),.18);
  }
  for(const u of [.25,.58]){
    const p=bottom.clone().lerp(top,u);
    m.beam('#7393a0',new Vector3(p.x,0,p.z),p,.17);
    m.beam('#bad2cd',p.clone().addScaledVector(across,-2),p.clone().addScaledVector(across,2),.15);
  }
  let previous=mountainCablePoint(0);
  for(let i=1;i<=120;i++){
    const p=mountainCablePoint(i/120*MOUNTAIN_CABLE_LENGTH);m.beam('#465f70',previous,p,.055);previous=p;
  }
  m.add(G.pole,'#8f9da5',[0,27.5,4],[.09,3, .09]);
  m.add(G.box,'#eeaa67',[.7,28.3,4],[1.4,.7,.05]);
}
