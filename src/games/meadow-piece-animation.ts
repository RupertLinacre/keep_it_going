import * as T from 'three';
import type { MiniSection } from './mini-track';
import type { PieceAnimation } from './piece-animation';
import type { FairgroundLights } from './world-lighting';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import { pondWaterwheel } from './world-meadow';

const TAU=Math.PI*2;
/** A route-distance envelope: fast trains, reverse scrubbing and pause all get
 * the same response, without timers, particle spawning or retained arrivals. */
export function meadowArrival(distance:number,at:number,reach=18) {
  const t=T.MathUtils.clamp(1-Math.abs(distance-at)/reach,0,1);return t*t*(3-2*t);
}
const colors=['#efb381','#91c6bb','#e8c778','#d4b3cd'];

function flowerModel() {
  const m=new WorldModel();
  m.add(G.pole,'#779b65',[0,.84,0],[.07,1.68,.07]);
  for(const side of [-1,1])m.add(G.rock,'#8baa6b',[side*.27,.72,0],[.36,.13,.14],[0,0,side*.48]);
  for(let i=0;i<8;i++) {
    const a=i*TAU/8;m.add(G.rock,i%2?'#fff0c5':'#f5d88b',[Math.sin(a)*.47,1.8+Math.cos(a)*.47,0],[.28,.3,.14],[0,0,-a]);
  }
  m.add(G.round,'#e9b664',[0,1.8,.06],[.4,.4,.18]);
  for(const side of [-1,1]) {
    m.add(G.rock,'#655953',[side*.13,1.87,.23],[.047,.063,.024]);
    m.add(G.rock,'#e39b78',[side*.23,1.72,.208],[.07,.047,.023]);
  }
  m.add(G.rock,'#fff2c6',[0,1.66,.233],[.09,.045,.018]);return m;
}
function butterflyModel() {
  const m=new WorldModel();
  for(const side of [-1,1]) {
    m.add(G.rock,'#d7a3bf',[side*.22,.08,0],[.25,.32,.07],[0,0,-side*.3]);
    m.add(G.rock,'#f7d496',[side*.19,-.21,0],[.2,.18,.06]);
    m.add(G.rock,'#fce2b1',[side*.26,.16,.063],[.1,.13,.026]);
  }
  m.add(G.rock,'#8e785e',[0,-.02,.025],[.053,.34,.055]);return m;
}
function waterwheelModel() {
  const m=new WorldModel();
  for(const z of [-.3,.3]) {
    m.add(G.ring,'#b79264',[0,0,z],[1.83,1.83,1.83]);
    m.add(G.ring,'#e4c88c',[0,0,z],[1.55,1.55,1.55]);
  }
  for(let i=0;i<10;i++) {
    const a=i*TAU/10;
    m.add(G.box,'#af895d',[Math.sin(a)*.83,Math.cos(a)*.83,0],[.11,1.75,.44],[0,0,-a]);
    m.add(G.box,colors[i%4],[Math.sin(a)*1.74,Math.cos(a)*1.74,0],[.67,.16,.83],[0,0,-a]);
  }
  m.add(G.round,'#ebce8a',[0,0,.42],[.28,.28,.12]);return m;
}
function boatModel() {
  const m=new WorldModel();
  m.add(G.round,'#d6a776',[0,.1,0],[1.15,.29,.48]);
  m.add(G.round,'#79aead',[0,.27,0],[1.02,.12,.39]);
  m.add(G.pole,'#d0b082',[0,1.05,0],[.04,1.7,.04]);
  const sail=new T.BufferGeometry();
  sail.setAttribute('position',new T.Float32BufferAttribute([.07,.65,0,.07,1.83,0,.85,.65,0,.85,.65,0,.07,1.83,0,.07,.65,0],3));sail.computeVertexNormals();
  m.add(sail,'#fff0ca',[0,0,0]);m.add(sail,'#eda887',[-.13,.2,0],[-.66,.7,1]);sail.dispose();
  m.add(G.round,'#efc971',[0,1.94,0],[.09,.09,.09]);return m;
}
function rippleModel() {
  const m=new WorldModel(),ring=new T.TorusGeometry(1,.032,3,20);
  m.add(ring,'#c7e5d3',[0,0,0],[1,.55,1],[Math.PI/2,0,0]);ring.dispose();return m;
}
function gearModel() {
  const m=new WorldModel();
  m.add(G.ring,'#c49761',[0,0,0],[.9,.9,.9]);m.add(G.ring,'#e0ba77',[0,0,.08],[.67,.67,.67]);
  for(let i=0;i<12;i++) {
    const a=i*TAU/12;m.add(G.box,'#d4aa6a',[Math.sin(a)*.9,Math.cos(a)*.9,0],[.23,.26,.21],[0,0,-a]);
  }
  for(let i=0;i<5;i++)m.add(G.box,'#b28b5d',[0,0,0],[.07,1.6,.13],[0,0,i*Math.PI/5]);
  m.add(G.round,'#efe0ac',[0,0,.12],[.16,.16,.08]);return m;
}
function pinwheelModel() {
  const m=new WorldModel();
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2;m.add(G.rock,colors[i],[Math.sin(a)*.36,Math.cos(a)*.36,0],[.31,.45,.065],[0,0,-a-.3]);
  }
  m.add(G.round,'#f7e6b2',[0,0,.07],[.16,.16,.1]);return m;
}
function grainModel() {
  const m=new WorldModel();m.add(G.rock,'#edc76a',[0,0,0],[.065,.12,.045]);return m;
}

/** Every section owns at most three fixed instanced draws; shared materials
 * remain owned by AdventureScene. Update uses only cached section-local sites. */
export function createMeadowPieceAnimation(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation|undefined {
  if(!['sheepbank','pondbridge','windmillloop'].includes(section.kind))return undefined;
  const group=new T.Group(),meshes:T.InstancedMesh[]=[];
  group.name=`meadow-${section.kind}-interaction`;
  const dummy=new T.Object3D();
  const batch=(model:WorldModel,count:number)=>{
    const source=model.finish(material,lights,false).children[0] as T.Mesh;
    const mesh=new T.InstancedMesh(source.geometry,material,count);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);meshes.push(mesh);group.add(mesh);return mesh;
  };
  const put=(mesh:T.InstancedMesh,index:number,x:number,y:number,z:number,rx=0,ry=0,rz=0,s=1,sx=s,sy=s,sz=s)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  };
  let update:(time:number,distance:number,reduced:boolean)=>void;
  if(section.kind==='sheepbank') {
    const flowers=batch(flowerModel(),12),butterflies=batch(butterflyModel(),8);
    const sites=Array.from({length:12},(_,i)=>{
      const at=section.start+section.length*(.09+i*.075),p=section.sample(at).position,side=i%2?1:-1;
      return {at,x:p.x-section.origin.x,y:.22,z:p.z-section.origin.z+side*8.8,side};
    });
    update=(time,distance,reduced)=>{
      for(let i=0;i<sites.length;i++) {
        const p=sites[i],greet=meadowArrival(distance,p.at,20),s=.8+(i%3)*.12;
        put(flowers,i,p.x,p.y,p.z,0,0,reduced?0:Math.sin(time*4.2+i*.65)*(.035+greet*.26),s);
      }
      for(let i=0;i<8;i++) {
        const p=sites[i+2],greet=meadowArrival(distance,p.at,22),t=reduced?i:time*.7+i*1.7;
        put(butterflies,i,p.x+Math.sin(t)*.65,2.3+Math.cos(t*1.5)*.25+(reduced?0:greet*.85),p.z+.7+Math.cos(t)*.4,0,Math.sin(t)*.3,Math.sin(t*2)*.2,.68,.68*(reduced?1:.55+Math.abs(Math.sin(time*7+i))*.45),.68,.68);
      }
    };
  } else if(section.kind==='pondbridge') {
    const wheel=batch(waterwheelModel(),1),boats=batch(boatModel(),3),ripples=batch(rippleModel(),9);
    const w=pondWaterwheel(section),z=section.hand*4;
    const mid=section.start+section.length*.5;
    const sites=[{x:section.span*.3,z:z-6.4,phase:0},{x:section.span*.62,z:z-8,phase:2.1},{x:section.span*.64,z:z+7,phase:4.2}];
    update=(time,distance,reduced)=>{
      const greeting=meadowArrival(distance,mid,section.length*.65),travel=T.MathUtils.clamp(distance-section.start,0,section.length+22);
      put(wheel,0,w.x,w.y,w.z,0,0,reduced?0:-time*.12-travel*.075);
      for(let i=0;i<3;i++) {
        const p=sites[i],a=reduced?p.phase:time*.18+p.phase+travel*.035;
        const bx=p.x+Math.cos(a)*(1.1+greeting*.55),bz=p.z+Math.sin(a)*.7;
        put(boats,i,bx,.37+(reduced?0:Math.sin(time*1.5+i)*.035),bz,0,-a*.32,reduced?0:Math.sin(time*1.5+i)*.025,.88);
        for(let j=0;j<3;j++) {
          const progress=reduced?(j+1)/4:((time*.34+j/3+i*.14)%1),size=.45+progress*.95;
          put(ripples,i*3+j,bx-.55-j*.26,.275+j*.003,bz,0,0,0,1,size,Math.max(.04,(1-progress)*.25),size*.68);
        }
      }
    };
  } else {
    const gears=batch(gearModel(),3),pinwheels=batch(pinwheelModel(),5),grain=batch(grainModel(),14);
    const x=section.width*.5,rotorZ=Math.min(0,section.shift)-2.8,size=section.amplitude*.22,z=rotorZ-3.4-.65-size*.045;
    const at=section.start+section.length*.5;
    // Decorative gear teeth all sit below the existing rotor's swept volume.
    const sites=[{x:x-1.25,y:3.55,z:rotorZ-1.52,s:.91},{x:x+.25,y:3.75,z:rotorZ-1.53,s:.61},{x:x+1.36,y:3.33,z:rotorZ-1.48,s:.75}];
    update=(time,distance,reduced)=>{
      const greeting=meadowArrival(distance,at,section.length*.6),travel=T.MathUtils.clamp(distance-section.start,0,section.length+24);
      const angle=reduced?0:time*.2+travel*.075;
      for(let i=0;i<sites.length;i++) {const p=sites[i];put(gears,i,p.x,p.y,p.z,0,0,(i%2?-1:1)*angle/p.s,p.s);}
      for(let i=0;i<5;i++) {
        const side=i%2?-1:1,px=x+side*(4+Math.floor(i/2)*.85),pz=z+1.25,py=2.1+(i%2)*.2;
        put(pinwheels,i,px,py,pz,0,0,reduced?i*.4:angle*1.7+i*.4,.66);
      }
      for(let i=0;i<14;i++) {
        const t=reduced?(i+.5)/14:((time*.48+i/14)%1),side=i%2?-1:1;
        put(grain,i,x+side*(4+(i%3)*.14)+Math.sin(i*2.4)*t*.6,1.52+Math.sin(Math.PI*t)*(.2+greeting*.75),z+1.45+Math.cos(i*2.4)*t*.3,0,t*4,t*3,reduced?.001:.45+greeting*.55);
      }
    };
  }
  const animation:PieceAnimation={group,update(time,distance,reduced){update(time,distance,reduced);for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;},dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.dispose();}group.clear();}};
  animation.update(0,section.start-100,true);return animation;
}
