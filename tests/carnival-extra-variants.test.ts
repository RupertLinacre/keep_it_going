import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3, Light } from 'three';
import { createCarnivalExtraVariant } from '../src/review/variants/carnival-extra-variants';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { CarouselMotion } from '../src/games/carousel-motion';
import { carouselCenter, carouselRideRadius } from '../src/games/world-night';
import { at } from '../src/review/variants/variant-kit';

const kinds=['lanternrun','midwayloop','carouselhelix']as const,options=['d','e']as const;
const section=(kind:typeof kinds[number],hand=1,width=62)=>new MiniSection(1,kind,100,new Vector3(80,4,2),kind==='midwayloop'?12:width,kind==='midwayloop'?14:kind==='lanternrun'?7:24,kind==='midwayloop'?hand*2.2:0,hand,2);
type Ride=NonNullable<ReturnType<typeof createCarnivalExtraVariant>>;
function instance(ride:Ride,name:string,index=0) {
  const mesh=ride.group.getObjectByName(name);assert.ok(mesh instanceof InstancedMesh,`${name} is a fixed pool`);
  const matrix=new Matrix4();mesh.getMatrixAt(index,matrix);return matrix;
}
const position=(ride:Ride,name:string,index=0)=>new Vector3().setFromMatrixPosition(instance(ride,name,index));
const size=(ride:Ride,name:string,index=0)=>new Vector3().setFromMatrixScale(instance(ride,name,index)).x;
function withRide(kind:typeof kinds[number],option:typeof options[number],check:(ride:Ride,s:MiniSection)=>void) {
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section(kind),ride=createCarnivalExtraVariant(s,option,material,lights)!;
  try{check(ride,s);}finally{ride.dispose();material.dispose();lights.dispose();}
}
function snapshot(ride:Ride) {
  const result:number[]=[];ride.group.updateMatrixWorld(true);
  ride.group.traverse(o=>{result.push(...o.matrixWorld.elements);if(o instanceof InstancedMesh)result.push(...o.instanceMatrix.array)});return result;
}

test('Carnival D/E keep seven draw batches, finite fixed pools, no lights/shadows, and dispose only their own geometry',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();let materialDisposed=0;
  material.addEventListener('dispose',()=>materialDisposed++);lights.addEventListener('dispose',()=>materialDisposed++);
  for(const kind of kinds)for(const option of options){
    const s=section(kind),ride=createCarnivalExtraVariant(s,option,material,lights)!;
    let draws=0,triangles=0,disposed=0;const geometries=new Set();const buffers:Float32Array[]=[];
    ride.group.traverse(o=>{
      assert.ok(!(o instanceof Light),'An alternative does not introduce scene lights');
      if(!(o instanceof Mesh))return;draws++;
      triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof InstancedMesh?o.count:1);
      assert.equal(o.castShadow,false);assert.ok(o.material===material||o.material===lights);
      geometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>disposed++);
      if(o instanceof InstancedMesh)buffers.push(o.instanceMatrix.array as Float32Array);
    });
    assert.ok(draws<=7,`${kind} ${option}: ${draws} draws`);assert.ok(triangles<=40000,`${kind} ${option}: ${triangles} triangles`);
    console.log(`${kind} ${option}: ${draws} batches, ${triangles} triangles`);
    for(let frame=0;frame<=360;frame++){
      ride.update(frame/30,s.start-12+frame*.8,false);
      ride.group.traverse(o=>{if(o instanceof InstancedMesh){assert.ok(buffers.includes(o.instanceMatrix.array as Float32Array));assert.ok([...o.instanceMatrix.array].every(Number.isFinite));}});
    }
    let after=0;ride.group.traverse(o=>{if(o instanceof Mesh)after++});assert.equal(after,draws);
    ride.dispose();assert.equal(disposed,geometries.size);assert.equal(ride.group.children.length,0);assert.equal(materialDisposed,0);
  }
  material.dispose();lights.dispose();
});

test('popcorn lids clear before a crossing releases their spring; confetti and springs reset on replay',()=>withRide('lanternrun','d',(ride,s)=>{
  const stop=at(s,.08);ride.update(1,stop-1,false);
  const waiting=position(ride,'popcorn-pals').y,lid=instance(ride,'popcorn-kettle-lids');
  assert.ok(new Vector3(0,0,1).transformDirection(lid).y>.98,'The lid is lifted clear before the launch');
  assert.equal(size(ride,'popcorn-confetti'),0);
  ride.update(1.1,stop+1,false);ride.update(2.2,stop+28,false);
  const lifted=position(ride,'popcorn-pals').y;assert.ok(lifted-waiting>2);
  const topCoil=position(ride,'popcorn-spring-coils',6).y;
  assert.ok(topCoil<lifted&&lifted-topCoil<.9,'The expanding spring follows the popcorn body');
  assert.ok(size(ride,'popcorn-confetti')>.4);
  ride.update(7,stop+140,false);assert.equal(size(ride,'popcorn-confetti'),0);assert.equal(position(ride,'popcorn-pals').y,waiting);
  ride.update(0,s.start-12,false);assert.equal(size(ride,'popcorn-confetti'),0);
}));

test('dragon wings hinge at their fixed shoulders while reels and segmented tails respond to the train',()=>withRide('lanternrun','e',(ride,s)=>{
  const stop=at(s,.08);ride.update(1,stop-60,false);
  const wing=instance(ride,'dragon-kite-wings'),head=position(ride,'dragon-kite-heads'),reel=instance(ride,'dragon-kite-reels');
  ride.update(1,stop,false);const open=instance(ride,'dragon-kite-wings');
  assert.ok(position(ride,'dragon-kite-wings').distanceTo(new Vector3().setFromMatrixPosition(wing))<1e-6);
  assert.ok(new Vector3(1,0,0).transformDirection(wing).distanceTo(new Vector3(1,0,0).transformDirection(open))>.4);
  assert.deepEqual(position(ride,'dragon-kite-heads').toArray(),head.toArray());
  ride.update(1,stop-10,false);assert.notDeepEqual(instance(ride,'dragon-kite-reels').elements,reel.elements);
  ride.update(2,stop,false);const tail=position(ride,'dragon-kite-tail',6);
  ride.update(2.5,stop,false);assert.ok(position(ride,'dragon-kite-tail',6).distanceTo(tail)>.3);
}));

test('balancing seals keep their flippers attached throughout a juggling routine',()=>withRide('midwayloop','d',(ride,s)=>{
  for(const fraction of [.1,.3,.57,.78]){
    ride.update(fraction*5,at(s,fraction),false);
    for(let i=0;i<2;i++)for(let side=0;side<2;side++){
      const expected=new Vector3(side?.9:-.9,1.5,.18).applyMatrix4(instance(ride,'circus-balancing-seals',i));
      assert.ok(expected.distanceTo(position(ride,'circus-seal-flippers',i*2+side))<1e-5);
    }
    for(let i=0;i<6;i++)assert.ok(position(ride,'circus-juggling-balls',i).y>7.4,'Juggling stays above the seal hats');
  }
}));

test('gumball doors open before release, the sweet lands in the bowl, and replay clears the dispenser',()=>withRide('midwayloop','e',(ride,s)=>{
  const stop=at(s,.3);ride.update(1,stop-1,false);assert.equal(size(ride,'gumball-dispensed-sweets'),0);
  ride.update(1.1,stop+1,false);const released=position(ride,'gumball-dispensed-sweets');
  ride.update(1.3,stop+6,false);
  assert.ok(Math.abs(instance(ride,'gumball-dispenser-door').elements[6])>.98);
  assert.ok(position(ride,'gumball-dispensed-sweets').distanceTo(released)<1e-5,'The sweet waits while the door clears');
  ride.update(4.6,stop+85,false);const landed=position(ride,'gumball-dispensed-sweets');
  assert.ok(Math.abs(landed.y-1.42)<.02&&Math.abs(landed.x-released.x)<.02,'The sweet finishes inside the waiting bowl');
  ride.update(0,s.start-12,false);assert.equal(size(ride,'gumball-dispensed-sweets'),0);
}));

test('both D/E carousels exactly follow either helix, coast with diminishing speed, and reset',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const option of options)for(const hand of [-1,1]){
    const s=section('carouselhelix',hand),ride=createCarnivalExtraVariant(s,option,material,lights)!,rotor=ride.group.getObjectByName('carousel-rotor')!,expected=new CarouselMotion(s);
    expected.update(0,s.start-12);
    for(let frame=1;frame<=240;frame++){
      const time=frame/30,distance=s.start-12+time*24;
      ride.update(time,distance,false);assert.equal(rotor.rotation.y,expected.update(time,distance));
    }
    const start=rotor.rotation.y;ride.update(8.2,s.end+100,false);const first=rotor.rotation.y-start;
    ride.update(8.4,s.end+104,false);const second=rotor.rotation.y-start-first;
    assert.ok(Math.abs(first)>.0001&&Math.abs(second)<Math.abs(first),'The carousel visibly coasts and slows after the train');
    ride.update(0,s.start-12,false);assert.equal(rotor.rotation.y,expected.update(0,s.start-12));
    ride.update(1,s.start+10,true);assert.equal(rotor.rotation.y,0);ride.dispose();
  }
  material.dispose();lights.dispose();
});

test('crab claws and bee wings follow their moving bodies, while only the arriving deck rises',()=>{
  for(const option of options)withRide('carouselhelix',option,(ride,s)=>{
    const body=option==='d'?'octopus-crab-gondolas':'honeybee-gondolas',limb=option==='d'?'octopus-crab-claws':'honeybee-attached-wings';
    for(let level=0;level<3;level++){
      const stop=at(s,[.2,.42,.65][level]);ride.update(2,stop,true);const rest=position(ride,body,level*4).y;
      ride.update(3,stop,false);assert.ok(position(ride,body,level*4).y-rest>(option==='d'?.25:.6));
      for(let i=0;i<12;i++)for(let side=0;side<2;side++){
        const shoulder=option==='d'?new Vector3(side?.58:-.58,.3,.3):new Vector3(side?.28:-.28,.69,-.06);
        shoulder.applyMatrix4(instance(ride,body,i));assert.ok(shoulder.distanceTo(position(ride,limb,i*2+side))<1e-5);
      }
      const other=((level+1)%3)*4;const otherY=position(ride,body,other).y;ride.update(3,stop,true);
      assert.ok(Math.abs(position(ride,body,other).y-otherY)<.01,'Other decks remain settled');
    }
  });
});

test('both D/E carousel silhouettes stay inside the spiral clearance at generated sizes',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),p=new Vector3(),matrix=new Matrix4();
  for(const option of options)for(const width of [57,62,65])for(const hand of [-1,1]){
    const s=section('carouselhelix',hand,width),c=carouselCenter(s),radius=carouselRideRadius(s),ride=createCarnivalExtraVariant(s,option,material,lights)!;
    for(const time of [0,1.8,3.7,7,10]){
      ride.update(time,s.start-12+time*24,false);ride.group.updateMatrixWorld(true);let farthest=0;
      ride.group.traverse(o=>{
        if(!(o instanceof Mesh))return;const positions=o.geometry.getAttribute('position'),count=o instanceof InstancedMesh?o.count:1;
        for(let i=0;i<count;i++){
          if(o instanceof InstancedMesh)o.getMatrixAt(i,matrix);else matrix.identity();
          for(let j=0;j<positions.count;j++){
            p.fromBufferAttribute(positions,j).applyMatrix4(matrix).applyMatrix4(o.matrixWorld);
            farthest=Math.max(farthest,Math.hypot(p.x-c.x,p.z-c.z));
          }
        }
      });
      assert.ok(farthest<=radius+.08,`${option}/${width}/${hand}/${time}: ${farthest}m exceeds clearance ${radius}m`);
    }
    ride.dispose();
  }
  material.dispose();lights.dispose();
});

test('Carnival D/E freeze reduced motion, cache height placement and support deterministic replay',()=>{
  for(const kind of kinds)for(const option of options)withRide(kind,option,(ride,s)=>{
    ride.update(2,s.start+s.length*.4,true);const before=snapshot(ride);
    for(const frame of s.frames)frame.position.y+=15;
    ride.update(8,s.start+s.length*.4,true);assert.deepEqual(snapshot(ride),before);
    for(const frame of s.frames)frame.position.y-=15;
    const play=()=>{for(let i=0;i<=180;i++)ride.update(i/30,s.start-12+i*.8,false);return snapshot(ride);};
    const first=play(),second=play();assert.deepEqual(second,first,`${kind} ${option}: replay must reproduce every matrix`);
  });
});

test('D/E parade and midway props leave the railway corridor clear in both directions',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),p=new Vector3(),matrix=new Matrix4();
  for(const kind of ['lanternrun','midwayloop']as const)for(const option of options)for(const hand of [-1,1]){
    const s=section(kind,hand),ride=createCarnivalExtraVariant(s,option,material,lights)!,rail=s.frames.filter((_,i)=>i%4===0).map(f=>[f.position.x-s.origin.x,f.position.y,f.position.z-s.origin.z]);
    for(const time of [0,1,2.5,5]){
      ride.update(time,s.start-12+time*24,false);ride.group.updateMatrixWorld(true);let nearest=Infinity,culprit='';
      ride.group.traverse(o=>{
        if(!(o instanceof Mesh))return;const positions=o.geometry.getAttribute('position'),count=o instanceof InstancedMesh?o.count:1;
        for(let i=0;i<count;i++){
          if(o instanceof InstancedMesh)o.getMatrixAt(i,matrix);else matrix.identity();
          if(o instanceof InstancedMesh&&new Vector3().setFromMatrixScale(matrix).x<.001)continue;
          for(let j=0;j<positions.count;j+=3){
            p.fromBufferAttribute(positions,j).applyMatrix4(matrix).applyMatrix4(o.matrixWorld);
            for(const [x,y,z]of rail){const d=(p.x-x)**2+(p.y-y)**2+(p.z-z)**2;if(d<nearest){nearest=d;culprit=o.name;}}
          }
        }
      });
      assert.ok(nearest>1.5**2,`${kind}/${option}/${hand}/${time}: ${culprit} entered the rail corridor at ${Math.sqrt(nearest)}m`);
    }
    ride.dispose();
  }
  material.dispose();lights.dispose();
});
