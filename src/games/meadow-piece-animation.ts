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
  for(let i=0;i<8;i++) {
    const a=i*TAU/8;m.add(G.rock,i%2?'#fff0c5':'#f5d88b',[Math.sin(a)*.47,1.8+Math.cos(a)*.47,0],[.28,.3,.14],[0,0,-a]);
  }
  m.add(G.round,'#e9b664',[0,1.8,.06],[.4,.4,.18]);
  for(const side of [-1,1]) {
    m.add(G.rock,'#655953',[side*.13,1.87,.23],[.047,.063,.024]);
    m.add(G.rock,'#e39b78',[side*.23,1.72,.208],[.07,.047,.023]);
  }
  m.add(G.rock,'#fff2c6',[0,1.66,.233],[.09,.045,.018]);
  // Rounded leaf shoes and little petal freckles help the face read at speed.
  for(const side of [-1,1]){m.add(G.rock,'#9bb879',[side*.13,.06,.1],[.21,.1,.15]);m.add(G.rock,'#c78f72',[side*.18,1.74,.235],[.02,.018,.016]);}return m;
}
function flowerArmModel() {
  const m=new WorldModel();
  m.beam('#86a36b',new T.Vector3(),new T.Vector3(.54,.18,0),.055);
  m.add(G.rock,'#94b47b',[.48,.23,0],[.37,.16,.12],[0,0,.45]);
  m.add(G.rock,'#b7cb8e',[.67,.37,.02],[.18,.23,.08],[0,0,-.3]);return m;
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
  m.add(G.round,'#efc971',[0,1.94,0],[.09,.09,.09]);
  // A small duck captain makes the craft read as a toy boat from either bank.
  m.add(G.round,'#f2d38a',[-.62,.51,0],[.28,.25,.23]);
  m.add(G.round,'#ffe1a0',[-.48,.8,0],[.21,.23,.2]);
  m.add(G.round,'#dda974',[-.24,.77,0],[.17,.06,.12]);
  m.add(G.pole,'#efedce',[-.48,1,0],[.24,.1,.24]);
  m.add(G.ring,'#eaa68b',[-.15,.24,.405],[.21,.21,.21]);
  for(const z of [-.3,.3])m.beam('#edcc97',new T.Vector3(-.85,.36,z),new T.Vector3(.7,.36,z),.025);
  m.add(G.box,'#79aead',[-.41,.97,.16],[.2,.055,.13]);
  for(const side of [-1,1])m.add(G.rock,'#605e59',[-.39,.85,side*.16],[.04,.052,.035]);return m;
}
function paddleModel() {
  const m=new WorldModel();m.add(G.ring,'#d9ae7b',[0,0,0],[.32,.32,.32]);
  for(let i=0;i<6;i++){const a=i*TAU/6;m.add(G.box,i%2?'#88b9b0':'#edc88a',[Math.sin(a)*.29,Math.cos(a)*.29,0],[.23,.11,.28],[0,0,-a]);}
  m.add(G.round,'#f2ddaa',[0,0,.2],[.1,.1,.08]);return m;
}
function packingPressModel() {
  const m=new WorldModel();m.add(G.box,'#aebea6',[0,.28,0],[.84,.56,.6]);m.add(G.box,'#d7bd88',[0,0,0],[1.05,.09,.77]);
  m.add(G.pole,'#a98a66',[0,.74,0],[.08,.65,.08]);m.add(G.round,'#f0d599',[0,.43,.33],[.18,.18,.08]);return m;
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
function flourBagModel() {
  const m=new WorldModel();m.add(G.round,'#f3e3b7',[0,.43,0],[.39,.48,.31]);
  m.add(G.round,'#bb9b6e',[0,.87,0],[.19,.08,.16]);
  m.add(G.box,'#93b6a7',[0,.46,.295],[.36,.34,.035]);
  m.add(G.pole,'#f5d997',[0,.46,.32],[.105,.025,.105],[Math.PI/2,0,0]);return m;
}

/** Every section owns at most four fixed instanced draws; shared materials
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
    const flowers=batch(flowerModel(),12),butterflies=batch(butterflyModel(),8),arms=batch(flowerArmModel(),24);
    flowers.name="waving-flowers";arms.name="flower-arms";
    const sites=Array.from({length:12},(_,i)=>{
      const at=section.start+section.length*(.09+i*.075),p=section.sample(at).position,side=i%2?1:-1;
      return {at,x:p.x-section.origin.x,y:.22,z:p.z-section.origin.z+side*8.8,side};
    });
    update=(time,distance,reduced)=>{
      for(let i=0;i<sites.length;i++) {
        const p=sites[i],greet=meadowArrival(distance,p.at,20),s=1.4+(i%3)*.18;
        const bow=reduced?0:greet*Math.sin(time*4+i*.5)*.1;
        const tilt=reduced?0:Math.sin(time*3.2+i*.65)*(.025+greet*.13)+bow;
        const stretch=reduced?1:1+greet*.12*(.5+.5*Math.sin(time*4+i*.5));
        put(flowers,i,p.x,p.y,p.z,0,0,tilt,s,s/Math.sqrt(stretch),s*stretch,s);

        for(let j=0;j<2;j++) {
          const side=j?1:-1,wave=reduced?.12:.12+greet*(.5+.35*Math.sin(time*5+i+j));
          put(arms,i*2+j,p.x-Math.sin(tilt)*.8*s*stretch,p.y+Math.cos(tilt)*.8*s*stretch,p.z+.03,0,j?0:Math.PI,side*tilt+wave,s);
        }
      }
      for(let i=0;i<8;i++) {
        const p=sites[i+2],greet=meadowArrival(distance,p.at,22),t=reduced?i:time*.7+i*1.7;
        put(butterflies,i,p.x+Math.sin(t)*.65,2.3+Math.cos(t*1.5)*.25+(reduced?0:greet*.85),p.z+.7+Math.cos(t)*.4,0,Math.sin(t)*.3,Math.sin(t*2)*.2,.68,.68*(reduced?1:.55+Math.abs(Math.sin(time*7+i))*.45),.68,.68);
      }
    };
  } else if(section.kind==='pondbridge') {
    const wheel=batch(waterwheelModel(),1),boats=batch(boatModel(),3),ripples=batch(rippleModel(),9),paddles=batch(paddleModel(),6);
    paddles.name="boat-paddles";
    wheel.name="pond-waterwheel";boats.name="captain-boats";ripples.name="boat-wakes";
    const w=pondWaterwheel(section),z=section.hand*4;
    const mid=section.start+section.length*.5;
    const sites=[{x:section.span*.3,z:z-6.4,phase:0},{x:section.span*.62,z:z-8,phase:2.1},{x:section.span*.64,z:z+7,phase:4.2}];
    update=(time,distance,reduced)=>{
      const greeting=meadowArrival(distance,mid,section.length*.65),travel=T.MathUtils.clamp(distance-section.start,0,section.length+22);
      put(wheel,0,w.x,w.y,w.z,0,0,reduced?0:-time*.12-travel*.075);
      for(let i=0;i<3;i++) {
        const p=sites[i],a=reduced?p.phase:time*.18+p.phase+travel*.035;
        const radius=1.1+greeting*.55,bx=p.x+Math.cos(a)*radius,bz=p.z+Math.sin(a)*.7;
        // The hull's bow is +X; yaw follows the ellipse tangent, not its phase.
        const heading=Math.atan2(-.7*Math.cos(a),-radius*Math.sin(a));
        const bob=reduced?0:Math.sin(time*1.5+i)*.035,roll=reduced?0:Math.sin(time*1.5+i)*.025;
        put(boats,i,bx,.37+bob,bz,0,heading,roll,1.65);
        for(let j=0;j<2;j++){
          const side=j?1:-1,lx=(-.28*Math.cos(roll)-.13*Math.sin(roll))*1.65,ly=(-.28*Math.sin(roll)+.13*Math.cos(roll))*1.65,lz=side*.54*1.65;
          put(paddles,i*2+j,bx+lx*Math.cos(heading)+lz*Math.sin(heading),.37+bob+ly,bz-lx*Math.sin(heading)+lz*Math.cos(heading),0,heading,roll+(reduced?0:-time*2.5-travel*.6),1.65);
        }
        for(let j=0;j<3;j++) {
          const progress=reduced?(j+1)/4:((time*.34+j/3+i*.14)%1),size=.45+progress*.95;
          put(ripples,i*3+j,bx-Math.cos(heading)*(1.4+progress*1.3),.275+j*.003,bz+Math.sin(heading)*(1.4+progress*1.3),0,heading,0,1,size,Math.max(.04,(1-progress)*.25),size*.68);
        }
      }
    };
  } else {
    const gears=batch(gearModel(),3),pinwheels=batch(pinwheelModel(),5),bags=batch(flourBagModel(),6),presses=batch(packingPressModel(),2);
    presses.name="flour-packing-presses";
    gears.name="meshing-gears";bags.name="flour-conveyor";
    const x=section.width*.5,rotorZ=Math.min(0,section.shift)-2.8,size=section.amplitude*.22,z=rotorZ-3.4-.65-size*.045;
    // Decorative gear teeth all sit below the existing rotor's swept volume.
    const sites=[-1.8,0,1.8].map(dx=>({x:x+dx,y:3.9,z:rotorZ-1.52}));
    update=(time,distance,reduced)=>{
      const travel=T.MathUtils.clamp(distance-section.start,0,section.length+24);
      const angle=reduced?0:time*.2+travel*.075;
      for(let i=0;i<sites.length;i++) {const p=sites[i];put(gears,i,p.x,p.y,p.z,0,0,(i%2?-1:1)*angle+(i%2?Math.PI/12:0));}
      for(let i=0;i<5;i++) {
        const side=i%2?-1:1,px=x+side*(4+Math.floor(i/2)*.85),pz=z+1.25,py=2.1+(i%2)*.2;
        put(pinwheels,i,px,py,pz,0,0,reduced?i*.4:angle*1.7+i*.4,.66);
      }
      for(let i=0;i<6;i++) {
        const a=(reduced?0:angle*.55)+i*TAU/6;
        put(bags,i,x+Math.sin(a)*3.15,1.24,rotorZ-.5+Math.cos(a)*.47,0,-a,0,.88);
      }
      for(let j=0;j<2;j++){
        // Presses meet only bags centred beneath them, with a quick soft tap.
        const phase=(reduced?0:angle*.55)*6,hit=Math.pow(Math.max(0,Math.cos(phase)),18);
        put(presses,j,x,2.45-hit*.33,rotorZ-.5+(j?-1:1)*.47,0,0,0,.85);
      }
    };
  }
  const animation:PieceAnimation={group,update(time,distance,reduced){update(time,distance,reduced);for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;},dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.dispose();}group.clear();}};
  animation.update(0,section.start-100,true);return animation;
}
