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
  // Sewn panels bulge like a real toy sail, with a large cream/coral stripe.
  // The double-sided triangles are baked into the existing boat draw.
  for(let row=0;row<4;row++) {
    const vertices:number[]=[],v0=row/4,v1=(row+1)/4;
    const sailPoint=(u:number,v:number)=>[.08+u*(.94-v*.9),.64+v*1.26,Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.24];
    for(let col=0;col<3;col++) {
      const a=sailPoint(col/3,v0),b=sailPoint((col+1)/3,v0),c=sailPoint(col/3,v1),d=sailPoint((col+1)/3,v1);
      vertices.push(...a,...b,...c,...b,...d,...c,...c,...b,...a,...c,...d,...b);
    }
    const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute(vertices,3));sail.computeVertexNormals();
    m.add(sail,row===1?'#e69b83':'#fff0ca',[0,0,0]);sail.dispose();
  }
  m.beam('#b49165',new T.Vector3(.08,.64,0),new T.Vector3(1.02,.64,0),.035);
  // Broad twin runners keep the tiny captain's vessel looking buoyant.
  for(const side of [-1,1])m.add(G.round,'#8bbdb4',[.06,.14,side*.44],[1.04,.18,.17]);
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
  for(const side of [-1,1])m.add(G.rock,'#706d59',[side*.07,.55,.325],[.023,.026,.013]);
  m.add(G.rock,'#fff0cb',[0,.41,.328],[.045,.025,.015]);
  m.add(G.pole,'#f5d997',[0,.46,.32],[.105,.025,.105],[Math.PI/2,0,0]);return m;
}

/** Every section owns at most four fixed instanced draws; shared materials
 * remain owned by AdventureScene. Update uses only cached section-local sites. */
export function createMeadowPieceAnimation(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation|undefined {
  if(!['pondbridge','windmillloop'].includes(section.kind))return undefined;
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
  if(section.kind==='pondbridge') {
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
        const bob=reduced?0:Math.sin(time*1.5+i)*(.035+greeting*.055),roll=reduced?0:Math.sin(time*1.5+i)*(.025+greeting*.055);
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
        const underPress=Math.pow(Math.max(0,Math.cos(a*2)),32),tap=Math.pow(Math.max(0,Math.cos(angle*.55*6)),18);
        const squash=reduced?1:1-underPress*tap*.18;
        put(bags,i,x+Math.sin(a)*3.15,1.24,rotorZ-.5+Math.cos(a)*.47,0,-a,0,.88,.88/Math.sqrt(squash),.88*squash,.88/Math.sqrt(squash));
      }
      for(let j=0;j<2;j++){
        // Presses meet only bags centred beneath them, with a quick soft tap.
        const phase=(reduced?0:angle*.55)*6,hit=Math.pow(Math.max(0,Math.cos(phase)),18);
        put(presses,j,x,2.45-hit*.47,rotorZ-.5+(j?-1:1)*.47,0,0,0,.85);
      }
    };
  }
  const animation:PieceAnimation={group,update(time,distance,reduced){update(time,distance,reduced);for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;},dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.dispose();}group.clear();}};
  animation.update(0,section.start-100,true);return animation;
}
