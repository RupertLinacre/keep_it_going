import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createCarnivalVariant } from '../src/review/variants/carnival-variants';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { CarouselMotion } from '../src/games/carousel-motion';
import { carouselCenter, carouselRideRadius } from '../src/games/world-night';
import { at } from '../src/review/variants/variant-kit';

const kinds=['lanternrun','midwayloop','carouselhelix']as const,options=['b','c']as const;
const section=(kind:typeof kinds[number],hand=1,width=62)=>new MiniSection(1,kind,100,new Vector3(80,4,2),kind==='midwayloop'?12:width,kind==='midwayloop'?14:kind==='lanternrun'?7:24,kind==='midwayloop'?hand*2.2:0,hand,2);

function instance(animation:NonNullable<ReturnType<typeof createCarnivalVariant>>,name:string,index=0) {
  const mesh=animation.group.getObjectByName(name);
  assert.ok(mesh instanceof InstancedMesh,`${name} is a fixed instance pool`);
  const matrix=new Matrix4();mesh.getMatrixAt(index,matrix);return matrix;
}
const size=(matrix:Matrix4)=>new Vector3().setFromMatrixScale(matrix).x;

test('rocket countdown selects one lamp, launches on crossing, and clears flame on replay',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section('lanternrun');
  const ride=createCarnivalVariant(s,'b',material,lights)!,stop=at(s,.09);
  for(const [i,gap]of [20,7,1].entries()) {
    ride.update(i+1,stop-gap,false);
    for(let j=0;j<3;j++)assert.equal(size(instance(ride,'launch-countdown',j))>1,j===i);
  }
  assert.equal(size(instance(ride,'rocket-flames')),0);
  ride.update(4,stop+1,false);ride.update(5,stop+25,false);
  assert.ok(size(instance(ride,'rocket-flames'))>.5,'A crossing creates visible thrust');
  ride.update(0,s.start-12,false);assert.equal(size(instance(ride,'rocket-flames')),0);
  ride.dispose();material.dispose();lights.dispose();
});

test('clam lids close over their pearls and open toward the approaching train',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section('lanternrun');
  const ride=createCarnivalVariant(s,'c',material,lights)!,stop=at(s,.035);
  ride.update(1,stop-40,false);const closed=instance(ride,'pearl-clam-lids');
  ride.update(2,stop,false);const open=instance(ride,'pearl-clam-lids');
  // The lid extends along local +Y from a hinge behind the pearl. Closing must
  // rotate that vector forward (+Z), and opening must lift it almost upright.
  const closedTip=new Vector3(0,1.2,0).transformDirection(closed),openTip=new Vector3(0,1.2,0).transformDirection(open);
  assert.ok(closedTip.z>.9&&closedTip.y<.3);
  assert.ok(openTip.y>.98&&openTip.z<.15);
  ride.update(3,stop+40,false);assert.ok(Math.abs(instance(ride,'pearl-clam-lids').elements[6]-closed.elements[6])<1e-6);
  ride.dispose();material.dispose();lights.dispose();
});

test('pinball impact rays burst briefly while the keyboard plays only nearby keys',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section('midwayloop');
  const pinball=createCarnivalVariant(s,'b',material,lights)!,stop=at(s,.22);
  pinball.update(1,stop-1,false);assert.equal(size(instance(pinball,'pinball-display-and-rays',21)),0);
  pinball.update(1.1,stop+1,false);pinball.update(1.2,stop+3,false);
  assert.ok(size(instance(pinball,'pinball-display-and-rays',21))>.4);
  pinball.update(3,stop+40,false);assert.equal(size(instance(pinball,'pinball-display-and-rays',21)),0);
  pinball.dispose();
  const piano=createCarnivalVariant(s,'c',material,lights)!;
  piano.update(1,s.start-12,false);const resting=instance(piano,'piano-keyboard',10).elements[13];
  piano.update(2,s.start+s.length*10.5/20,false);
  assert.ok(resting-instance(piano,'piano-keyboard',10).elements[13]>.1,'The key beneath the train progress is pressed');
  assert.ok(instance(piano,'piano-keyboard',0).elements[13]>resting-.001,'Distant keys remain raised');
  const keyTop=new Vector3(0,.08,0).applyMatrix4(instance(piano,'piano-keyboard',10));
  assert.ok(keyTop.y>2.23,'Pressed ivory remains visible above the music-box case');
  piano.dispose();material.dispose();lights.dispose();
});

test('each carousel level greets the train without moving the other decks',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const option of options)for(let level=0;level<3;level++) {
    const s=section('carouselhelix'),ride=createCarnivalVariant(s,option,material,lights)!;
    const pool=option==='b'?'toasting-teacups':'greeting-saucers',stop=at(s,[.2,.42,.65][level]);
    ride.update(1,stop,false);const greeting=instance(ride,pool,level*4).elements[13];
    const otherLevel=(level+1)%3,otherGreeting=instance(ride,pool,otherLevel*4).elements[13];
    ride.update(1,stop,true);const resting=instance(ride,pool,level*4).elements[13];
    assert.ok(greeting-resting>(option==='b'?.28:.64));
    assert.ok(Math.abs(otherGreeting-instance(ride,pool,otherLevel*4).elements[13])<.2,'The other level keeps its small idle bob');
    if(option==='b') {
      ride.update(2,at(s,.7),false);assert.ok(ride.group.getObjectByName('pouring-teapot')!.rotation.z<-.15);
      ride.update(3,s.end+100,false);assert.ok(Math.abs(ride.group.getObjectByName('pouring-teapot')!.rotation.z)<.001);
    }
    ride.dispose();
  }
  material.dispose();lights.dispose();
});

test('all six carnival alternatives have fixed small render budgets, finite instances and owned geometry',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const kind of kinds)for(const option of options) {
    const s=section(kind),animation=createCarnivalVariant(s,option,material,lights)!;
    let draws=0,triangles=0,disposed=0;const geometries=new Set();
    animation.group.traverse(o=>{
      if(!(o instanceof Mesh))return;draws++;
      triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof InstancedMesh?o.count:1);
      assert.ok(o.material===material||o.material===lights);assert.equal(o.castShadow,false);
      geometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>disposed++);
    });
    assert.ok(draws<=7,`${kind} ${option}: ${draws} draws`);assert.ok(triangles<=40000,`${kind} ${option}: ${triangles} triangles`);
    for(let frame=0;frame<=240;frame++) {
      animation.update(frame/30,s.start-12+frame*.8,false);
      animation.group.traverse(o=>{if(o instanceof InstancedMesh)assert.ok([...o.instanceMatrix.array].every(Number.isFinite),`${kind} ${option} has finite instance transforms before and after its trigger`)});
    }
    let after=0;animation.group.traverse(o=>{if(o instanceof Mesh)after++});assert.equal(after,draws);
    animation.dispose();assert.equal(disposed,geometries.size);assert.equal(animation.group.children.length,0);
  }
  material.dispose();lights.dispose();
});

test('both new carousel architectures inherit exact train motion, continue coasting, and reset for replay',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const option of options)for(const hand of [-1,1]) {
    const s=section('carouselhelix',hand),animation=createCarnivalVariant(s,option,material,lights)!,rotor=animation.group.getObjectByName('carousel-rotor')!;
    const expected=new CarouselMotion(s);expected.update(0,s.start-12);
    for(let frame=1;frame<=300;frame++) {
      const time=frame/30,distance=s.start-12+time*24;
      animation.update(time,distance,false);assert.equal(rotor.rotation.y,expected.update(time,distance));
    }
    const before=rotor.rotation.y;animation.update(10.2,s.end+100,false);assert.notEqual(rotor.rotation.y,before);
    animation.update(0,s.start-12,false);assert.equal(rotor.rotation.y,expected.update(0,s.start-12));
    animation.update(.5,s.start+12,true);assert.equal(rotor.rotation.y,0);
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('teacups, planetary rings and saucers fit inside the verified spiral clearance at every generated size',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),point=new Vector3(),instance=new Matrix4();
  for(const option of options)for(const width of [57,62,65])for(const hand of [-1,1]) {
    const s=section('carouselhelix',hand,width),c=carouselCenter(s),radius=carouselRideRadius(s),animation=createCarnivalVariant(s,option,material,lights)!;
    for(const time of [0,1.8,3.7,7,10]) {
      animation.update(time,s.start-12+time*24,false);animation.group.updateMatrixWorld(true);
      let farthest=0;
      animation.group.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const p=object.geometry.getAttribute('position'),count=object instanceof InstancedMesh?object.count:1;
        for(let j=0;j<count;j++) {
          if(object instanceof InstancedMesh)object.getMatrixAt(j,instance);else instance.identity();
          for(let k=0;k<p.count;k++) {
            point.fromBufferAttribute(p,k).applyMatrix4(instance).applyMatrix4(object.matrixWorld);
            farthest=Math.max(farthest,Math.hypot(point.x-c.x,point.z-c.z));
          }
        }
      });
      assert.ok(farthest<=radius+.08,`${option}, ${width}, ${hand}: spinning extent ${farthest} exceeds ${radius}`);
    }
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('all alternatives cache their placements against height lifts and hold still under reduced motion',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  const snapshot=(animation:NonNullable<ReturnType<typeof createCarnivalVariant>>)=>{
    const result:number[]=[];animation.group.updateMatrixWorld(true);
    animation.group.traverse(o=>{result.push(...o.matrixWorld.elements);if(o instanceof InstancedMesh)result.push(...o.instanceMatrix.array)});return result;
  };
  for(const kind of kinds)for(const option of options) {
    const s=section(kind),animation=createCarnivalVariant(s,option,material,lights)!;
    animation.update(2,s.start+s.length*.4,true);const before=snapshot(animation);
    for(const frame of s.frames)frame.position.y+=15;
    animation.update(8,s.start+s.length*.4,true);assert.deepEqual(snapshot(animation),before,`${kind} ${option} stays still and never double-applies track lift`);
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('launchpads, jellyfish, arcade props and the enlarged fairy stay outside the rail corridor',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),p=new Vector3(),matrix=new Matrix4();
  for(const kind of ['lanternrun','midwayloop']as const)for(const option of options)for(const hand of [-1,1]) {
    const s=section(kind,hand),animation=createCarnivalVariant(s,option,material,lights)!;
    const rail=s.frames.filter((_,i)=>i%4===0).map(f=>[f.position.x-s.origin.x,f.position.y,f.position.z-s.origin.z]);
    for(const time of [0,2.5,5]) {
      animation.update(time,s.start-12+time*24,false);animation.group.updateMatrixWorld(true);
      let nearest=Infinity;
      animation.group.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const positions=object.geometry.getAttribute('position'),count=object instanceof InstancedMesh?object.count:1;
        for(let i=0;i<count;i++) {
          if(object instanceof InstancedMesh)object.getMatrixAt(i,matrix);else matrix.identity();
          for(let j=0;j<positions.count;j+=3) {
            p.fromBufferAttribute(positions,j).applyMatrix4(matrix).applyMatrix4(object.matrixWorld);
            for(const [x,y,z]of rail)nearest=Math.min(nearest,(p.x-x)**2+(p.y-y)**2+(p.z-z)**2);
          }
        }
      });
      assert.ok(nearest>1.5**2,`${kind} ${option}, hand ${hand}, ${time}s: prop entered rail corridor at ${Math.sqrt(nearest)}m`);
    }
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('rocket gantries release before lift-off and close after the rocket lands',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section('lanternrun'),ride=createCarnivalVariant(s,'b',material,lights)!,stop=at(s,.09);
  ride.update(0,stop-30,false);const resting=instance(ride,'launch-gantry-arms').clone();
  ride.update(1,stop-1,false);const released=instance(ride,'launch-gantry-arms').clone();
  assert.ok(Math.abs(released.elements[1])>.6,'The arm swings out of the rocket envelope before ignition');
  assert.equal(size(instance(ride,'rocket-flames')),0);
  ride.update(1.1,stop+1,false);ride.update(3,stop+40,false);
  assert.ok(Math.abs(instance(ride,'launch-gantry-arms').elements[1])>.6);
  ride.update(8,stop+160,false);assert.deepEqual(instance(ride,'launch-gantry-arms').elements,resting.elements);
  ride.dispose();material.dispose();lights.dispose();
});

test('the pinball physically touches each reacting bumper at its trigger',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section('midwayloop'),ride=createCarnivalVariant(s,'b',material,lights)!;
  for(const [i,t]of [.22,.5,.78].entries()){
    ride.update(i+1,at(s,t),false);
    const ball=new Vector3().setFromMatrixPosition(instance(ride,'pinball-ball')),cap=new Vector3().setFromMatrixPosition(instance(ride,'pinball-kitten-bumpers',i));
    assert.ok(ball.distanceTo(cap)>2.15&&ball.distanceTo(cap)<2.55,'The ball meets the rim of the cat bumper instead of passing elsewhere on the board');
  }
  ride.dispose();material.dispose();lights.dispose();
});

test('teapot droplets originate at its rotating spout and stop after the greeting',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),s=section('carouselhelix'),ride=createCarnivalVariant(s,'b',material,lights)!;
  ride.update(10,at(s,.7),false);
  const pot=ride.group.getObjectByName('pouring-teapot')!,scale=carouselRideRadius(s)/3.15,lip=new Vector3(2.55*scale,1.15*scale,0).applyMatrix4(pot.matrix);
  const droplet=new Vector3().setFromMatrixPosition(instance(ride,'teapot-steam-and-pour',10));
  assert.ok(lip.distanceTo(droplet)<1e-5,'The pour moves with the spout rather than floating beside a tilting pot');
  assert.ok(size(instance(ride,'teapot-steam-and-pour',10))>.2);
  ride.update(20,s.end+200,false);assert.ok(size(instance(ride,'teapot-steam-and-pour',10))<.001);
  ride.dispose();material.dispose();lights.dispose();
});
