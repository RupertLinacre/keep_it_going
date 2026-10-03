import * as T from 'three';
import type { MiniSection } from '../mini-track';
import type { FairgroundLights } from '../world-lighting';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { PieceBuilder, CrossingPulses, at } from './piece-builder';

const TAU=Math.PI*2,clamp=T.MathUtils.clamp;

const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};

const pulse=(age:number,duration=5)=>age>=0&&age<duration?smooth(age/.65)*(1-smooth((age-duration+1)/1)):0;

function disk(m:WorldModel,color:string,x:number,y:number,z:number,rx:number,rz:number){
 const a:number[]=[];for(let i=0;i<40;i++){const p=i*TAU/40,q=(i+1)*TAU/40;a.push(x,y,z,x+Math.cos(q)*rx,y,z+Math.sin(q)*rz,x+Math.cos(p)*rx,y,z+Math.sin(p)*rz);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.computeVertexNormals();m.add(g,color,[0,0,0]);g.dispose();
}

function eyes(m:WorldModel,x:number,y:number,z:number,size=1){for(const side of [-1,1]){m.add(G.round,'#fff4d8',[x+side*.39*size,y,z],[.24*size,.29*size,.12*size]);m.add(G.round,'#515a5a',[x+side*.39*size,y,z+.105*size],[.095*size,.145*size,.055*size]);}m.add(G.round,'#bf7f7b',[x,y-.38*size,z],[.28*size,.08*size,.075*size]);}

function finish(v:PieceBuilder,s:MiniSection){v.update(0,s.start-100,true);return v;}

export function createPancakeMill(s:MiniSection,material:T.Material,lights:FairgroundLights){
 const v=new PieceBuilder(material,lights),m=new WorldModel(),x=s.span*.5,z=Math.min(0,s.shift)-11,cy=s.origin.y+s.amplitude*.84;
 disk(m,'#cad797',x,.08,z,16,9);m.add(G.box,'#e9b08e',[x,cy*.4,z],[13,cy*.8,5]);m.add(G.box,'#f2d8a5',[x,cy*.8,z],[14,.45,5.8]);for(const side of [-1,1]){m.add(G.box,'#91b8ae',[x+side*4.55,cy*.4,z+2.56],[2.5,cy*.61,.12]);for(let j=0;j<3;j++)m.add(G.box,'#d8ddbc',[x+side*4.55,2+j*1.5,z+2.68],[2.1,.4,.05]);}m.add(G.round,'#f0c79d',[x,cy+2,z],[3.5,3.45,2]);eyes(m,x,cy+2.45,z+1.8,2.2);m.add(G.round,'#e9aa92',[x,cy+1.75,z+2.1],[.58,.44,.43]);m.add(G.box,'#fff0cf',[x,cy+5,z],[6.8,1.2,3.6]);for(const dx of [-2.6,0,2.6])m.add(G.round,'#fff4dc',[x+dx,cy+6.45,z],[2.2,2.35,2]);for(const side of [-1,1]){m.add(G.rock,'#a8c1b8',[x+side*.65,cy-1.6,z+2.07],[.8,.48,.17],[0,0,-side*.25]);m.add(G.round,'#dbc982',[x,cy-1.6,z+2.25],[.26,.26,.14]);}
 const pan=new WorldModel();pan.add(G.pole,'#a0aaa4',[0,0,0],[2.8,.35,2.8]);pan.add(G.pole,'#d1d4b7',[0,.2,0],[2.58,.07,2.58]);pan.add(G.box,'#b18d64',[-3.6,.08,0],[3,.23,.6]);for(const side of [-1,1])m.add(G.box,'#c6a577',[x+side*8,2,z+3.4],[.5,4,4]);
 const cake=new WorldModel();cake.add(G.pole,'#d6a16c',[0,0,0],[2.15,.33,2.15]);cake.add(G.pole,'#f2cb88',[0,.18,0],[2.03,.08,2.03]);cake.add(G.box,'#f7df8b',[0,.38,0],[.8,.22,.8],[0,.3,0]);for(let j=0;j<5;j++)cake.add(G.round,'#c08d6c',[Math.sin(j*TAU/5)*1.2,.24,Math.cos(j*TAU/5)*1.2],[.26,.04,.26]);
 const spatula=new WorldModel();spatula.add(G.box,'#ad956e',[0,2.35,0],[.22,4.7,.24]);spatula.add(G.box,'#afbab0',[0,5.2,0],[1.6,1.2,.2]);for(const dx of [-.44,0,.44])spatula.add(G.box,'#dce1c9',[dx,5.2,.12],[.13,.85,.04]);spatula.add(G.round,'#edd7ac',[0,1.2,0],[.55,.65,.47]);
 const plates=new WorldModel();for(let j=0;j<3;j++){plates.add(G.pole,'#f3dfb3',[0,j*.45,0],[2.6,.16,2.6]);plates.add(G.pole,'#d9b67c',[0,j*.45+.22,0],[2.1,.27,2.1]);}
 const bellows=new WorldModel();bellows.add(G.round,'#e9ad98',[0,0,0],[.7,.62,.34]);
 const pans=v.pool(pan,2),cakes=v.pool(cake,2),hands=v.pool(spatula,2),stacks=v.pool(plates,2),cheeks=v.pool(bellows,2),pulses=new CrossingPulses([at(s,.28),at(s,.67)]);pans[0].name='pancake-flipping-pans';cakes[0].name='flying-pancakes';hands[0].name='chef-spatulas';stacks[0].name='pancake-plates';v.batch(m);
 v.animate((time,distance,reduced)=>{pulses.update(time,distance);for(let i=0;i<2;i++){const side=i?1:-1,age=pulses.age(i,time),active=!reduced&&age>=0&&age<5,launch=active?clamp((age-.5)/1.8,0,1):0,flip=launch>0&&launch<1,panX=x+side*8,panY=4.3,kick=active?.27*Math.sin(clamp(age/.8,0,1)*Math.PI):0;v.place(pans,i,panX,panY,z+3.4,1,0,0,side*kick);v.place(stacks,i,x+side*12,.2,z+3.4,1);const settling=launch===1?1-smooth((age-3.7)/.7):1,restore=active&&age>4.4?smooth((age-4.4)/.6):1,scale=active&&age>=3.7&&age<4.4?Math.max(.001,settling):restore;v.place(cakes,i,active&&age<4.4?T.MathUtils.lerp(panX,x+side*12,launch):panX,active&&age<4.4?T.MathUtils.lerp(panY+.43,1.8,launch)+Math.sin(Math.PI*launch)*8:panY+.43,z+3.4,scale,0,0,flip?side*TAU*smooth(launch):0);v.place(hands,i,x+side*3.4,cy-.3,z+2.5,1,0,0,-side*(.7+(active?.3*Math.sin(age*3):0)));v.place(cheeks,i,x+side*2.28,cy+1.4,z+1.8,1+(reduced?0:pulse(age,4)*.45));}});return finish(v,s);
}

/** Extra gallery designs deliberately leave production world construction alone. */
