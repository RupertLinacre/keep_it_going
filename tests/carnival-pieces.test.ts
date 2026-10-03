import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { MiniSection } from '../src/games/mini-track';
import { carouselCenter, carouselRideRadius, carouselRotation, carouselClimb, lanternDistance, lanternParade, marqueeLoop } from '../src/games/world-night';
import { CarouselMotion } from '../src/games/carousel-motion';
import { createCarnivalPieceAnimation } from '../src/games/carnival-piece-animation';
import { FairgroundLights } from '../src/games/world-lighting';
import { WorldModel } from '../src/games/world-models';

const section=(hand=1,width=62)=>new MiniSection(1,'carouselhelix',100,new Vector3(80,4,2),width,24,0,hand,2);
const delta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

test('three-storey carousel follows both handed spirals exactly, then coasts with decaying velocity',()=>{
  for(const hand of [-1,1]) {
    const s=section(hand),motion=new CarouselMotion(s),speed=24;
    let time=0,distance=motion.first-1,lastAngle=0;
    motion.update(time,distance);
    while(distance<motion.last-.8) {
      time+=1/60;distance+=speed/60;
      const angle=motion.update(time,distance);
      if(distance>motion.first+.8) {
        assert.ok(Math.abs(delta(angle,carouselRotation(s,distance)))<1e-9);
        assert.ok(delta(angle,lastAngle)*hand<0,'Ride turns in the same direction as the train');
        const expected=delta(carouselRotation(s,distance),carouselRotation(s,distance-speed/60));
        assert.ok(Math.abs(delta(angle,lastAngle)-expected)<1e-9,'Angular displacement exactly follows the train, even through angle wrapping');
      }
      lastAngle=angle;
    }
    motion.update(time+.1,motion.last+1);
    const exitAngle=motion.angle,exitSpeed=motion.speed;
    assert.ok(Math.abs(exitSpeed)>.1);
    motion.update(time+1.1,motion.last+25);
    assert.ok((motion.angle-exitAngle)*exitSpeed>0);
    assert.ok(Math.abs(motion.speed)<Math.abs(exitSpeed));
    const pauseAngle=motion.angle;
    motion.update(time+1.1,motion.last+25);assert.equal(motion.angle,pauseAngle);
    motion.update(time+10.1,motion.last+240);assert.ok(Math.abs(motion.speed)<.01);
    motion.update(0,motion.first-2);assert.equal(motion.speed,0);
    motion.update(.1,motion.first+1,true);assert.equal(motion.angle,0);assert.equal(motion.speed,0);
  }
});

test('carousel drag is independent of rendering frame rate and replays reset angular momentum',()=>{
  const s=section(),a=new CarouselMotion(s),b=new CarouselMotion(s);
  for(const motion of [a,b]) {
    motion.update(0,motion.last-1);motion.update(.1,motion.last);motion.update(.2,motion.last+1);
  }
  a.update(2.2,a.last+21);
  for(let i=1;i<=120;i++)b.update(.2+i/60,b.last+1+i/6);
  assert.ok(Math.abs(a.angle-b.angle)<1e-10);assert.ok(Math.abs(a.speed-b.speed)<1e-10);
  a.update(2.3,a.first-1);assert.equal(a.speed,0);
});

test('carousel geometry is bounded inside its drifting spiral for every generated width',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const width of [57,62,65])for(const hand of [-1,1]) {
    const s=section(hand,width),c=carouselCenter(s),radius=carouselRideRadius(s),animation=createCarnivalPieceAnimation(s,material,lights)!;
    for(let i=Math.round(s.resolution*.1);i<=Math.round(s.resolution*.78);i++) {
      const f=s.frames[i];
      assert.ok(Math.hypot(f.position.x-s.origin.x-c.x,f.position.z-s.origin.z-c.z)-radius>=1.8-1e-9);
    }
    animation.update(3,s.start+s.length*.4,false);animation.group.updateMatrixWorld(true);
    const point=new Vector3(),instance=new Matrix4();let maxRadius=0;
    animation.group.traverse(object=>{
      if(!(object instanceof Mesh))return;
      const p=object.geometry.getAttribute('position'),count=object instanceof InstancedMesh?object.count:1;
      for(let j=0;j<count;j++) {
        if(object instanceof InstancedMesh)object.getMatrixAt(j,instance);else instance.identity();
        for(let k=0;k<p.count;k++) {
          point.fromBufferAttribute(p,k).applyMatrix4(instance).applyMatrix4(object.matrixWorld);
          maxRadius=Math.max(maxRadius,Math.hypot(point.x-c.x,point.z-c.z));
        }
      }
    });
    assert.ok(maxRadius<radius+.08,'Roof, horses and railings all remain inside the clearance envelope');
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('carnival effects have fixed draw-call and instance budgets, shared materials, and release their geometry',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  const cases=[['carouselhelix',4,60,carouselClimb],['lanternrun',3,28,lanternParade],['midwayloop',2,24,marqueeLoop]] as const;
  for(const [kind,drawCalls,instances,decorate]of cases) {
    const s=new MiniSection(1,kind,0,new Vector3(0,4,0),kind==='midwayloop'?12:62,kind==='midwayloop'?14:24,0,1,2);
    const animation=createCarnivalPieceAnimation(s,material,lights)!;
    let meshes=0,count=0,disposed=0,triangles=0;const geometries=new Set();
    animation.group.traverse(object=>{
      if(!(object instanceof Mesh))return;meshes++;
      if(object instanceof InstancedMesh)count+=object.count;
      triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object instanceof InstancedMesh?object.count:1);
      assert.ok(object.material===material||object.material===lights);
      geometries.add(object.geometry);object.geometry.addEventListener('dispose',()=>disposed++);
    });
    assert.equal(meshes,drawCalls);assert.equal(count,instances);
    for(let i=0;i<300;i++)animation.update(i/60,s.start+i*.4,false);
    let after=0;animation.group.traverse(object=>{if(object instanceof Mesh)after++});assert.equal(after,meshes);
    animation.dispose();assert.equal(disposed,geometries.size);assert.equal(animation.group.children.length,0);
    const model=new WorldModel();decorate(model,s);const group=model.finish(material,lights);
    assert.ok(group.children.length<=3,'Static detail stays in the existing solid, light and halo batches');
    for(const child of group.children){const geometry=(child as Mesh).geometry;triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;geometry.dispose();}
    assert.ok(triangles<30000,'The full static and moving attraction has a bounded triangle budget');
  }
  material.dispose();lights.dispose();
});

test('cached carnival placements do not double-apply a later height-track lift',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const kind of ['lanternrun','midwayloop','carouselhelix']as const) {
    const s=new MiniSection(1,kind,0,new Vector3(0,4,0),62,24,0,1,2);
    const animation=createCarnivalPieceAnimation(s,material,lights)!;
    const capture=()=>{
      const result:number[]=[];animation.group.updateMatrixWorld(true);
      animation.group.traverse(object=>{if(object instanceof InstancedMesh)result.push(...object.instanceMatrix.array);result.push(...object.matrixWorld.elements)});
      return result;
    };
    animation.update(1,s.start+s.length*.35,false);const before=capture();
    for(const frame of s.frames)frame.position.y+=15;
    animation.update(1,s.start+s.length*.35,false);assert.deepEqual(capture(),before);
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('original carnival characters greet the train while preserving their resting poses',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),matrix=new Matrix4();
  for(const kind of ['lanternrun','midwayloop','carouselhelix']as const) {
    const s=new MiniSection(1,kind,100,new Vector3(80,4,2),kind==='midwayloop'?12:62,kind==='midwayloop'?14:24,0,1,2);
    const ride=createCarnivalPieceAnimation(s,material,lights)!;
    let actors:InstancedMesh|undefined;ride.group.traverse(o=>{if(o instanceof InstancedMesh&&!actors)actors=o});
    assert.ok(actors);
    const stop=kind==='lanternrun'?lanternDistance(s,0):kind==='midwayloop'?s.start+s.length*.08:s.start+s.distances[Math.round(s.resolution*.2)];
    const i=kind==='midwayloop'?6:0;
    ride.update(1,stop,true);actors.getMatrixAt(i,matrix);const resting=matrix.clone();
    ride.update(1,stop,false);actors.getMatrixAt(i,matrix);
    if(kind==='carouselhelix')assert.ok(matrix.elements[1]>0,'The unicorn lifts its forward-facing head in its greeting');
    else assert.ok(new Vector3().setFromMatrixScale(matrix).x>new Vector3().setFromMatrixScale(resting).x,'Lanterns and cheer stars grow as the train passes');
    if(kind==='lanternrun')assert.ok(matrix.elements[13]-resting.elements[13]>.65,'The lantern rises above its rainbow arch');
    ride.dispose();
  }
  material.dispose();lights.dispose();
});

test('galloping legs and butterfly wings stay joined to their moving parent bodies',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),body=new Matrix4(),limb=new Matrix4();
  for(const kind of ['carouselhelix','lanternrun']as const) {
    const s=new MiniSection(1,kind,100,new Vector3(80,4,2),62,24,0,1,2),ride=createCarnivalPieceAnimation(s,material,lights)!;
    const bodies=ride.group.getObjectByName(kind==='carouselhelix'?'greeting-unicorns':'lantern-creatures') as InstancedMesh;
    const limbs=ride.group.getObjectByName(kind==='carouselhelix'?'galloping-unicorn-legs':'lantern-butterfly-wings') as InstancedMesh;
    let firstRotation:number|undefined,changed=false;
    for(let frame=0;frame<60;frame++) {
      ride.update(frame/15,s.start+frame*.9,false);bodies.getMatrixAt(0,body);limbs.getMatrixAt(0,limb);limb.premultiply(body.invert());
      const expected=kind==='carouselhelix'?[.52,-.22,-.23]:[.54,0,-.28],actual=new Vector3().setFromMatrixPosition(limb);
      assert.ok(actual.distanceTo(new Vector3(...expected))<1e-5,'Articulated parts must stay at their shoulders/hips throughout the bounce');
      const rotation=kind==='carouselhelix'?limb.elements[1]:limb.elements[2];
      if(firstRotation===undefined)firstRotation=rotation;else if(Math.abs(firstRotation-rotation)>.01)changed=true;
    }
    assert.ok(changed,'The limb articulates independently, rather than simply bobbing with its body');ride.dispose();
  }
  material.dispose();lights.dispose();
});
