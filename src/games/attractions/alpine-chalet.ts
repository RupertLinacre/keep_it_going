import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import type { MiniSection } from '../mini-track';
import { CHIMNEY } from '../chimney-jump';
import { C, gift, lamp, star } from './christmas-builder';
import type { ChristmasBulb } from './christmas-lights';

const TIMBER='#9f6247',DARK='#563c31',HONEY='#ba7f53',STONE='#b6aa9e';
const SNOW='#fff9ef',SHUTTER='#a53f4a',PINE='#386e5c';
const PITCH=.75,RIDGE=24.8,DEPTH=11.5,OVERHANG=3.5;

/** A thick roof blanket with deep eaves and an open chimney bore. The ridge is
 * deliberately left of the launch shaft: masonry rises from the lower roof
 * slope, rather than poking into a taller ridge or through an opaque panel. */
function roof(x0:number,x1:number,center:number,mouth:number,snow:boolean){
  const lo=x0-OVERHANG,hi=x1+OVERHANG,depth=DEPTH+3;
  const xs=[lo,hi,center,mouth-6.5,mouth+6.5].filter(x=>x>=lo&&x<=hi);
  for(let x=lo+3;x<hi;x+=3)xs.push(x);
  xs.sort((a,b)=>a-b);
  const zs=[-depth,-5.15,0,5.15,depth],positions:number[]=[];
  const base=(x:number)=>RIDGE-Math.abs(x-center)*PITCH;
  const height=(x:number,z:number)=>base(x)+(snow?.92+.08*Math.sin(x*.37+z*.28):0);
  const edges=new Map<string,{a:number[];b:number[];count:number}>();
  const triangle=(a:number[],b:number[],c:number[])=>positions.push(...a,...b,...c);
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
    const x=xs[i-1],xx=xs[i],z=zs[j-1],zz=zs[j];
    if(x>=mouth-6.5-.001&&xx<=mouth+6.5+.001&&z>=-5.15&&zz<=5.15)continue;
    const q=[[x,height(x,z),z],[x,height(x,zz),zz],[xx,height(xx,zz),zz],[xx,height(xx,z),z]];
    triangle(q[0],q[1],q[2]);triangle(q[0],q[2],q[3]);
    for(let k=0;k<4;k++){
      const a=q[k],b=q[(k+1)%4],key=[a[0]+':'+a[2],b[0]+':'+b[2]].sort().join('/');
      const edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});
    }
  }
  if(snow)for(const {a,b,count}of edges.values())if(count===1){
    const aa=[a[0],base(a[0])+.06,a[2]],bb=[b[0],base(b[0])+.06,b[2]];
    triangle(aa,bb,b);triangle(aa,b,a);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();return geometry;
}

/** All architectural detail is baked once into three shared building batches
 * and a snow batch. Windows/garlands use the existing bounded glow/light pools. */
export function alpineChalet(s:MiniSection){
  const model=new WorldModel(),snow=new WorldModel(),bulbs:ChristmasBulb[]=[];
  const wreath=new T.TorusGeometry(1,.15,4,10);
  const w=s.width,x0=w*.13,x1=w*.38,center=(x0+x1)/2,mouth=w*CHIMNEY.mouth;
  const top=s.origin.y+s.amplitude,pause=s.distanceAtX(s.origin.x+w*CHIMNEY.pause),half=(x1-x0)/2;
  const box=(color:string,x:number,y:number,z:number,dx:number,dy:number,dz:number)=>model.add(G.box,color,[x,y,z],[dx,dy,dz]);
  const beam=(color:string,a:number[],b:number[],r=.15)=>{
    const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from),length=delta.length();
    if(length<.001)return;
    const rotation=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.divideScalar(length)));
    model.add(G.box,color,from.add(to).multiplyScalar(.5).toArray(),[r*2,length,r*2],[rotation.x,rotation.y,rotation.z]);
  };
  const snowBox=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>snow.add(G.box,SNOW,[x,y,z],[dx,dy,dz]);
  const bulb=(x:number,y:number,z:number,index:number,size=.2,halo=.95,stop=pause)=>bulbs.push({
    position:new T.Vector3(x,y,z),stop,color:[C.gold,C.cream,C.pink,C.teal][index%4],size,halo});

  // A masonry ground floor and a real timber upper storey, with railway portals
  // in both side walls. The sleigh and its entry/pause trajectory remain intact.
  for(const z of [-DEPTH,DEPTH]){
    box(STONE,center,2.25,z,x1-x0,4.5,.8);
    box(TIMBER,center,8.7,z,x1-x0,8.4,.75);
    // Broad horizontal logs catch twilight light and make the home read as wood.
    for(let row=0;row<11;row++)box(row%3===0?HONEY:TIMBER,center,4.8+row*.72,z+Math.sign(z)*.45,x1-x0+.55,.56,.25);
    const front=z>0;
    const gable=new T.BufferGeometry();
    const a=[x0,12.7,z],b=[x1,12.7,z],c=[center,RIDGE-.18,z];
    gable.setAttribute('position',new T.Float32BufferAttribute(front?[...a,...b,...c]:[...b,...a,...c],3));
    gable.computeVertexNormals();model.add(gable,TIMBER,[0,0,0]);gable.dispose();
    // Attic boards follow the triangular gable, with darker structural braces.
    for(let i=0;i<17;i++){
      const x=x0+(x1-x0)*(i+.5)/17,h=RIDGE-.3-Math.abs(x-center)*PITCH-12.7;
      if(h>0)box(i%3===0?HONEY:TIMBER,x,12.7+h/2,z+Math.sign(z)*.08,.12,h,.18);
    }
    beam(DARK,[x0,12.8,z+Math.sign(z)*.35],[center,RIDGE-.3,z+Math.sign(z)*.35],.2);
    beam(DARK,[center,RIDGE-.3,z+Math.sign(z)*.35],[x1,12.8,z+Math.sign(z)*.35],.2);
    box(DARK,center,12.75,z+Math.sign(z)*.3,x1-x0,.4,.45);
    box(DARK,center,18.5,z+Math.sign(z)*.3,.42,11.6,.4);
    // Low-poly stone courses are architectural blocks, not round boulder trim.
    for(let row=0;row<3;row++)for(let i=0;i<10;i++){
      const x=x0+(i+.5)*(x1-x0)/10;
      box(['#c7bcb0','#a99d93','#b9b0a8'][(i+row)%3],x,.65+row*1.3,z+Math.sign(z)*.49,(x1-x0)/10-.15,1.15,.2);
    }
  }
  for(const x of [x0,x1]){
    for(const z of [-7.6,7.6])box(STONE,x,2.2,z,.8,4.4,7.8);
    box(TIMBER,x,8.6,0,.8,8.2,DEPTH*2);
    for(let row=0;row<11;row++)box(row%3===0?HONEY:TIMBER,x,4.8+row*.72,0,1,.55,DEPTH*2+.5);
    for(const z of [-DEPTH,DEPTH])box(DARK,x,6.5,z,.75,13,.75);
    // Massive timber lintel and stone jambs surround the side railway opening.
    box(DARK,x,4.6,0,1.1,.65,8.2);
    for(const sign of [-1,1])box('#d0c5b8',x,2,sign*4.1,1.1,4.1,1);
    model.softGlow([x,3.2,0],C.gold,4,.35);
  }

  function window(x:number,y:number,z:number,width:number,height:number,shutters=true){
    const sign=Math.sign(z),face=z+sign*.68;
    box(DARK,x,y,face,width+.6,height+.6,.3);
    model.add(G.box,'#ffd996',[x,y,face+sign*.18],[width,height,.12],[],true);
    model.softGlow([x,y,face+sign*.3],C.gold,width*.9,.5);
    for(const dx of [-width/2,width/2])box(HONEY,x+dx,y,face+sign*.35,.24,height+.3,.28);
    for(const dy of [-height/2,height/2])box(HONEY,x,y+dy,face+sign*.35,width+.3,.24,.28);
    box(DARK,x,y,face+sign*.38,.14,height,.24);
    box(DARK,x,y+.1,face+sign*.38,width,.16,.24);
    if(shutters)for(const side of [-1,1]){
      const sx=x+side*(width/2+.85);
      box(SHUTTER,sx,y,face,.95,height+.4,.26);
      for(let j=0;j<3;j++)box('#d78165',sx,y-height*.33+j*height*.33,face+sign*.2,.83,.13,.12);
      // Alpine diamond carving: twelve triangles, rather than tiny sphere pairs.
      model.add(G.box,'#f4cd92',[sx,y+.3,face+sign*.24],[.3,.3,.05],[0,0,Math.PI/4]);
    }
    snowBox(x,y-height/2-.2,face,width+1,.32,.9);
  }
  // Small domestic windows replace the long showroom frontage. Three upstairs
  // bays, two downstairs, and paired attic windows have legible chalet rhythm.
  for(const sign of [-1,1]){
    const z=sign*DEPTH;
    for(const dx of [-half*.62,0,half*.62])window(center+dx,10.0,z,3.1,3.7);
    for(const dx of [-half*.62,half*.62])window(center+dx,2.8,z,3.4,2.8);
    for(const dx of [-2.35,2.35])window(center+dx,17.35,z,2.1,3.6,false);
    star(model,center,21.5,z+sign*.55,1.1,C.gold,true);
    model.softGlow([center,21.5,z+sign*.7],C.gold,2,.45);
    box(DARK,center,2.7,z+sign*.6,3.8,5.2,.4);
    box(SHUTTER,center,2.7,z+sign*.9,3.1,4.8,.2);
    model.add(G.round,C.gold,[center+.9,2.4,z+sign*1.05],[.14,.14,.1],[],true);
    model.add(wreath,PINE,[center,3.5,z+sign*1.08],[.85,.85,.85]);
    box(C.red,center,2.95,z+sign*1.2,.75,.22,.2);
  }

  // Wraparound Alpine balcony: broad plank deck, carved alternating balusters,
  // projecting braces and snowy top rail. Eaves shade it like a mountain lodge.
  for(const sign of [-1,1]){
    const z=sign*(DEPTH+2.0),edge=sign*(DEPTH+3.5),railY=8.35;
    box(DARK,center,6.3,z,x1-x0+4,.6,4.0);
    snowBox(center,6.68,z,x1-x0+4.1,.24,4.1);
    box(HONEY,center,railY,edge,x1-x0+4,.45,.5);
    snowBox(center,railY+.35,edge,x1-x0+4.1,.36,.65);
    for(let i=0;i<19;i++){
      const x=x0-1.7+(x1-x0+3.4)*i/18;
      box(i%2?HONEY:DARK,x,7.45,edge,.48,1.6,.4);
      if(i%2===0)box(HONEY,x,7.45,edge+sign*.12,.85,.5,.23);
    }
    for(const dx of [-half*.8,0,half*.8])beam(DARK,[center+dx,4.35,sign*DEPTH],[center+dx,6.05,edge],.25);
    // Draped fir garland, red bows and brass bells, not a luminous wall panel.
    for(let i=0;i<19;i++){
      const x=x0-1+(x1-x0+2)*i/18,y=7.8-.7*Math.sin(i/18*Math.PI*3)**2;
      model.add(G.rock,PINE,[x,y,edge+sign*.42],[1.05,.37,.34],[0,0,i*.42]);
      if(sign>0&&i%6===0){
        model.add(G.box,C.red,[x-.28,y+.1,edge+.65],[.55,.4,.22],[0,0,-.3]);
        model.add(G.box,C.red,[x+.28,y+.1,edge+.65],[.55,.4,.22],[0,0,.3]);
        model.add(G.cone,C.gold,[x,y-.6,edge+.55],[.34,.45,.34],[Math.PI,0,0],true);
      }
      if(i%(sign>0?3:6)===0)bulb(x,y-.15,edge+sign*.55,i);
    }
  }
  for(const x of [x0-1.75,x1+1.75]){
    box(DARK,x,6.3,0,3.5,.6,DEPTH*2+4);
    snowBox(x,6.68,0,3.6,.24,DEPTH*2+4);
    box(HONEY,x,8.35,0,.5,.45,DEPTH*2+7);
    snowBox(x,8.7,0,.65,.36,DEPTH*2+7);
    for(let i=0;i<12;i++)box(HONEY,x,7.45,-DEPTH-2.5+(DEPTH*2+5)*i/11,.45,1.6,.4);
  }

  // Deep overhanging gable roof, thick sculpted snow, exposed rafters and ridge
  // fascia. Everything is genuine low-poly geometry, never a photographic card.
  for(const isSnow of [false,true]){
    const g=roof(x0,x1,center,mouth,isSnow);
    (isSnow?snow:model).add(g,isSnow?SNOW:DARK,[0,0,0]);g.dispose();
  }
  const left=x0-OVERHANG,right=x1+OVERHANG,roofY=(x:number)=>RIDGE-Math.abs(x-center)*PITCH;
  for(const sign of [-1,1]){
    const z=sign*(DEPTH+3.15);
    beam(HONEY,[left,roofY(left)-.2,z],[center,RIDGE-.2,z],.27);
    beam(HONEY,[center,RIDGE-.2,z],[right,roofY(right)-.2,z],.27);
    for(const x of [x0+1.5,x1-1.5])beam(DARK,[x,11.5,sign*DEPTH],[x,roofY(x)-.3,z],.32);
    const count=sign>0?17:5;
    for(let i=0;i<count;i++){
      const x=left+(right-left)*i/(count-1),y=roofY(x)-.48;
      bulb(x,y,z+sign*.2,i,.22,1.05);
      if(i){const px=left+(right-left)*(i-1)/(count-1);beam(C.gold,[px,roofY(px)-.42,z],[x,roofY(x)-.42,z],.035);}
    }
    for(let i=0;i<13;i++){
      const x=left+.7+(right-left-1.4)*i/12,len=.6+(i%4)*.3;
      snow.add(G.cone,'#d7f3ff',[x,roofY(x)-len*.5,z],[.23,len,.23],[Math.PI,0,0]);
    }
  }
  // A few sculpted snow pillows break up the large roof planes without a texture
  // or additional translucent layer. Keep clear of the open chimney shaft.
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const x=center+side*(4+i*2.4),z=-9+i*5.7;
    if(x>mouth-7&&x<mouth+7&&Math.abs(z)<6)continue;
    snow.add(G.rock,SNOW,[x,roofY(x)+.92,z],[2.5,.26,1.8],[0,.15*i,-side*Math.atan(PITCH)]);
  }
  for(const x of [left+.3,right-.3])for(let i=0;i<6;i++){
    const z=-DEPTH+2+i*3.7;
    beam(DARK,[x+(x<center?2:-2),roofY(x)+.5,z],[x,roofY(x)-.35,z],.3);
  }

  // The original open launch shaft and sparkle origin stay in exactly the same
  // location. Its lower walls sit outside the chalet's right-hand roof slope.
  const outerX=5.7,outerZ=4.4;
  for(const side of [-1,1]){
    box('#c2ae94',mouth+side*outerX,top/2,0,1.6,top,outerZ*2);
    box('#d8c5a8',mouth,top/2,side*outerZ,outerX*2,top,1.5);
    // Stone footings anchor the exposed flue to the ground, never a floating box.
    box(STONE,mouth+side*outerX,3,0,1.7,6,outerZ*2);
    box(STONE,mouth,3,side*outerZ,outerX*2,6,1.6);
    box('#dfcdbb',mouth+side*outerX,top-.15,0,2,.6,outerZ*2+1.5);
    box('#dfcdbb',mouth,top-.15,side*outerZ,outerX*2+2,.6,2);
    snowBox(mouth+side*outerX,top+.25,0,2.25,.55,outerZ*2+1.65);
    snowBox(mouth,top+.25,side*outerZ,outerX*2+2.25,.55,2.15);
    for(let row=0;row<4;row++)box('#efe1c9',mouth,11.4+(top-11.6)*row/4,side*(outerZ+.77),outerX*2,.16,.15);
  }
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;bulb(mouth+Math.cos(a)*5.2,top+.9,Math.sin(a)*4.2,i,.3,1.6,s.takeoff);
  }

  // Snow-banked front steps, little firs and gifts make this unmistakably a
  // family home. Ground glow and snow piles are small, bounded shared geometry.
  for(let i=0;i<4;i++){
    const y=.9-i*.22,z=DEPTH+1.4+i*1.1;
    box(STONE,center,y/2,z,4.8,y,1.25);snowBox(center,y+.12,z,5,.24,1.35);
  }
  for(const sign of [-1,1]){
    const x=center+sign*(half+3),z=DEPTH+5.0;
    box(DARK,x,.55,z,2.3,1.1,2.3);
    for(let j=0;j<3;j++){
      model.add(G.cone,PINE,[x,1.6+j*1.2,z],[3.2-j*.7,2.6,3.2-j*.7]);
      snow.add(G.cone,SNOW,[x,2.0+j*1.2,z],[2.3-j*.6,1.5,2.3-j*.6]);
    }
    star(model,x,5.1,z,.45);
    gift(model,x+sign*1.6,.1,z+.3,.9,sign>0?C.red:C.teal);
    lamp(model,x-sign*2.4,0,z+1.7,1.05);
    for(let i=0;i<3;i++)snow.add(G.rock,SNOW,[x+sign*(i-1)*2,.3,z-1.5],[2.3,.5,1.1],[0,i*.4,0]);
  }
  // Skis and a small firewood stack beside the sheltered front door are quiet,
  // unmistakable mountain-home details: only a handful of baked primitives.
  for(const side of [-1,1]){
    model.add(G.box,side>0?SHUTTER:HONEY,[center-4+side*.32,2.05,DEPTH+1.25],[.4,3.7,.18],[0,0,side*.11]);
    model.add(G.box,C.cream,[center-4+side*.32,2.15,DEPTH+1.4],[.42,.14,.1]);
  }
  for(let i=0;i<5;i++){
    const x=center+4+(i%3)*.7,y=.4+Math.floor(i/3)*.65,z=DEPTH+1.1;
    model.add(G.pole,DARK,[x,y,z],[.3,1.5,.3],[Math.PI/2,0,0]);
    model.add(G.pole,HONEY,[x,y,z+.78],[.26,.05,.26],[Math.PI/2,0,0]);
  }
  snowBox(center+4.65,1.21,DEPTH+1.1,2.2,.22,1.7);
  model.softGlow([center,.08,DEPTH+3],C.gold,8,.3,true);
  wreath.dispose();
  return {model,snow,bulbs};
}
