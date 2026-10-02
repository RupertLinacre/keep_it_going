import { Vector3 } from 'three';
import type { MiniSection } from './mini-track';
import { WorldModel, WORLD_SHAPES as G } from './world-models';

// A continuous two-strand cable climbs the near face of the tunnel mountain.
// Distances are metres, including the round turnarounds at both stations.
export const MOUNTAIN_CABLE_STATIONS = [[14,5,-11],[0,27.4,4]] as const;
const bottom=new Vector3(...MOUNTAIN_CABLE_STATIONS[0]),top=new Vector3(...MOUNTAIN_CABLE_STATIONS[1]);
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
export function mountainGondolaPosition(section:MiniSection,distance:number,phase:number,time=0) {
  const f=section.sample(section.start+section.length/2);
  const p=mountainCablePoint(tunnelCableTravel(section,distance)+time*.85+phase*MOUNTAIN_CABLE_LENGTH);
  p.y-=2.2;return p.applyQuaternion(f.rotation).add(f.position);
}
export function mountainRopeway(m:WorldModel) {
  // Snowy summit and a small timber lift station above the rock ridge.
  m.add(G.rock,'#b3c1c5',[2,20.2,4],[6.5,3.2,4.5]);
  m.add(G.rock,'#f1f0df',[2,22.7,4],[6.5,.65,4.8]);
  for(const [p,ground]of [[bottom,0],[top,22.7]] as const){
    const hx=p.x+4.6;
    // The chalet sits beside the boarding loop, leaving both moving cabins clear.
    // Warm little alpine chalets, with an open boarding deck below the cable.
    m.add(G.box,'#b78866',[p.x+2.1,ground+.22,p.z],[9.4,.44,4.5]);
    m.add(G.box,'#e4bd85',[hx,ground+1.25,p.z-.4],[3.8,1.6,2.7]);
    for(const side of [-1,1]){
      m.add(G.box,'#824f3d',[hx+side*1.65,ground+1.3,p.z+1],[.2,2,.2]);
      m.add(G.box,'#668692',[hx+side*.9,ground+1.45,p.z+.98],[1.1,.85,.08]);
      m.add(G.box,'#ffe7a4',[hx+side*.9,ground+1.45,p.z+1.035],[.8,.6,.04],[],true);
      m.add(G.box,'#d8b780',[hx+side*.9,ground+1.45,p.z+1.07],[.08,.68,.04]);
      m.add(G.box,'#745746',[hx+side*1.15,ground+2.55,p.z],[2.7,.23,4.7],[0,0,-side*.42]);
      m.add(G.box,'#f2f0df',[hx+side*1.15,ground+2.7,p.z],[2.8,.16,4.75],[0,0,-side*.42]);
      m.beam('#65858e',new Vector3(p.x+side*2.2,ground,p.z),new Vector3(p.x+side*2.2,p.y+.2,p.z),.13);
    }
    m.add(G.box,'#645d54',[hx,ground+1.08,p.z+1.01],[.72,1.3,.09]);
    m.add(G.round,'#f5c572',[hx+.2,ground+1,p.z+1.08],[.07,.07,.06],[],true);
    // Boarding rail, flower boxes, chimney and a clock make the stations readable.
    for(const x of [-2.3,-1.3,1.3,2.3])m.add(G.box,'#e9d3a2',[hx+x,ground+.7,p.z+2],[.12,1,.12]);
    m.add(G.box,'#e4d0a4',[hx,ground+1.15,p.z+2],[4.7,.1,.13]);
    m.add(G.box,'#9a6951',[hx+1.25,ground+3.15,p.z-.65],[.55,1.2,.65]);
    m.add(G.box,'#ede6d0',[hx+1.25,ground+3.8,p.z-.65],[.76,.18,.84]);
    m.add(G.round,'#f1e7c0',[hx,ground+2.2,p.z+2.41],[.42,.42,.08]);
    m.add(G.box,'#526773',[hx,ground+2.3,p.z+2.5],[.06,.24,.025]);
    m.add(G.box,'#526773',[hx+.11,ground+2.2,p.z+2.5],[.24,.06,.025]);
    m.beam('#b3c6bd',new Vector3(p.x-2.2,p.y+.2,p.z),new Vector3(p.x+2.2,p.y+.2,p.z),.18);
    for(const x of [-1.2,1.2]){
      m.add(G.box,'#8c6550',[hx+x,ground+.7,p.z+1.7],[1,.32,.35]);
      for(let j=0;j<3;j++)m.add(G.round,j%2?'#e78b88':'#edcf76',[hx+x+(j-1)*.26,ground+.96,p.z+1.7],[.16,.17,.15]);
    }
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
  m.add(G.pole,'#8f9da5',[-3,26.5,4],[.09,4, .09]);
  m.add(G.box,'#eeaa67',[-2.3,28,4],[1.4,.7,.05]);
  m.add(G.box,'#f4e4b9',[-2.3,28,4.035],[.12,.7,.025]);
}
