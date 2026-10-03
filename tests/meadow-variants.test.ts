import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMeadowVariant } from '../src/review/variants/meadow-variants';
import { at } from '../src/review/variants/variant-kit';

const cases=[['sheepbank',74,8],['pondbridge',66,4],['windmillloop',8,10]] as const;
const section=(kind:typeof cases[number][0],width:number,height:number,hand:number)=>new MiniSection(3,kind,90,new T.Vector3(120,4,-9),width,height,kind==='windmillloop'?hand*2.2:0,hand);
const matrices=(group:T.Group)=>{const output:number[]=[];group.traverse(o=>{if(o instanceof T.InstancedMesh)output.push(...o.instanceMatrix.array);});return output;};
const pose=(mesh:T.InstancedMesh,index:number)=>{const m=new T.Matrix4();mesh.getMatrixAt(index,m);return m;};
const location=(m:T.Matrix4)=>new T.Vector3().setFromMatrixPosition(m);

test('trampoline mat meets the sheep feet and percussion mallets strike the keys',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 const sheepSection=section('sheepbank',74,8,1),circus=createMeadowVariant(sheepSection,'b',material,lights)!;
 circus.update(0,sheepSection.start-1,false);circus.update(1,at(sheepSection,.18),false);
 const mats=circus.group.getObjectByName('trampoline-mats') as T.InstancedMesh,sheep=circus.group.getObjectByName('trampoline-sheep') as T.InstancedMesh;
 const depressedCenter=new T.Vector3(0,-1,0).applyMatrix4(pose(mats,0));
 assert.ok(Math.abs(location(pose(sheep,0)).y-depressedCenter.y)<1e-5,'Feet touch the depressed mat at launch');
 const edge=new T.Vector3(2.76,0,0).applyMatrix4(pose(mats,0));
 circus.update(1.42,at(sheepSection,.18),false);
 const nextEdge=new T.Vector3(2.76,0,0).applyMatrix4(pose(mats,0));
 assert.ok(edge.distanceTo(nextEdge)<1e-5,'The rim stays fixed while its centre springs');
 assert.ok(location(pose(sheep,0)).y>edge.y+3,'The first bounce makes a safe, high somersault');
 circus.dispose();
 const pondSection=section('pondbridge',66,4,1),frogs=createMeadowVariant(pondSection,'b',material,lights)!;
 frogs.update(0,pondSection.start-1,false);frogs.update(Math.PI/18,at(pondSection,.76),false);
 const mallets=frogs.group.getObjectByName('frog-batons') as T.InstancedMesh;
 const tip=new T.Vector3(0,1.53,0).applyMatrix4(pose(mallets,1));
 assert.ok(Math.abs(tip.y-1.505)<1e-5,'The first percussion head reaches, but never passes, the key surface');
 frogs.dispose();material.dispose();lights.dispose();
});

test('cuckoo hands use a twelve-to-one ratio and the resting bird stays behind the doors',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('windmillloop',8,10,1),clock=createMeadowVariant(s,'b',material,lights)!;
 const hands=clock.group.getObjectByName('clock-hands') as T.InstancedMesh,bird=clock.group.getObjectByName('cuckoo-bird') as T.InstancedMesh;
 clock.update(0,s.start-1,false);const before=[pose(hands,0),pose(hands,1)];
 const front=new T.Vector3(0,1.02,1.24).applyMatrix4(pose(bird,0));
 assert.ok(front.z<Math.min(0,s.shift)-7.4+1.875,'Closed door fully conceals the beak');
 clock.update(1,s.start-1,false);
 const delta=before.map((m,i)=>{const q=pose(hands,i).multiply(m.clone().invert());return Math.atan2(q.elements[1],q.elements[0]);});
 assert.ok(Math.abs(delta[0]/delta[1]-12)<1e-4);clock.dispose();material.dispose();lights.dispose();
});

test('cuckoo doors finish opening before the bird moves through them',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('windmillloop',8,10,1),clock=createMeadowVariant(s,'b',material,lights)!;
 const bird=clock.group.getObjectByName('cuckoo-bird') as T.InstancedMesh,doors=clock.group.getObjectByName('cuckoo-doors') as T.InstancedMesh;
 clock.update(0,s.start-1,false);clock.update(1,at(s,.43),false);
 const resting=location(pose(bird,0)).z;
 for(const age of [.1,.3,.36,.5,.7,1,2.8,3,3.12,3.3,3.7]){
  clock.update(1+age,at(s,.43),false);
  if(location(pose(bird,0)).z>resting+.01)assert.ok(Math.abs(pose(doors,0).elements[0]-Math.cos(1.55))<1e-5,'Both hinges stay fully open during emergence and retraction');
 }
 clock.dispose();material.dispose();lights.dispose();
});

test('honey tables hold an open jar under each pouring stream and stop pouring while indexing',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('windmillloop',8,10,1),factory=createMeadowVariant(s,'c',material,lights)!;
 const jars=factory.group.getObjectByName('indexed-honey-jars') as T.InstancedMesh,drops=factory.group.getObjectByName('honey-streams') as T.InstancedMesh,fills=factory.group.getObjectByName('honey-fill-levels') as T.InstancedMesh;
 for(let step=0;step<5;step++){
  factory.update((step+.3)/.24,s.start,false);
  for(let i=0;i<drops.count;i++){
   const p=location(pose(drops,i));let nearest=Infinity;
   for(let j=0;j<jars.count;j++){const jar=location(pose(jars,j));nearest=Math.min(nearest,Math.hypot(jar.x-p.x,jar.z-p.z));}
   assert.ok(nearest<1e-5,'Each active stream is centred over a stationary jar');
  }
  factory.update((step+.82)/.24,s.start,false);
  for(let i=0;i<drops.count;i++)assert.ok(new T.Vector3().setFromMatrixScale(pose(drops,i)).x<.002,'No pouring while jars move');
 }
 factory.update(.71/.24,s.start,false);const full=location(pose(fills,0)).y;
 factory.update(1.05/.24,s.start,false);
 assert.ok(Math.abs(location(pose(fills,0)).y-full)<1e-5,'A newly filled jar stays full when leaving the tap');
 factory.dispose();material.dispose();lights.dispose();
});

test('duck wings stay attached and bend outwards around the duck local hinge',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('pondbridge',66,4,1),bath=createMeadowVariant(s,'c',material,lights)!;
 const ducks=bath.group.getObjectByName('bath-ducks') as T.InstancedMesh,wings=bath.group.getObjectByName('bath-wings') as T.InstancedMesh;
 for(const time of [0,1.3,4.8,11]){
  bath.update(time,s.start+s.length*.5,false);
  for(let i=0;i<4;i++)for(let j=0;j<2;j++){
   const body=pose(ducks,i),wing=pose(wings,i*2+j),side=j?1:-1;
   const attached=new T.Vector3(-.12,1,side*.68).applyMatrix4(body);
   assert.ok(attached.distanceTo(location(wing))<1e-5,'Wing roots must follow both duck yaw and roll');
   const relative=body.clone().invert().multiply(wing),axis=new T.Vector3(1,0,0).transformDirection(relative);
   assert.ok(axis.x>.99999,'Flap rotates about the duck local X hinge');
   assert.ok(new T.Vector3(0,-.22,0).transformDirection(relative).z*side>=-1e-6,'Wings open away from the body, never into it');
  }
 }
 bath.dispose();material.dispose();lights.dispose();
});

test('all six meadow alternatives stay within fixed render budgets and dispose only their own geometry',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();let materialDisposed=0;
 material.addEventListener('dispose',()=>materialDisposed++);
 for(const [kind,width,height]of cases)for(const option of ['b','c'] as const){
  const s=section(kind,width,height,1),animation=createMeadowVariant(s,option,material,lights)!;
  assert.ok(animation);let calls=0,triangles=0,disposed=0;const geometries=new Set<T.BufferGeometry>(),pools:T.InstancedMesh[]=[];
  animation.group.traverse(o=>{
   if(o instanceof T.Mesh){calls++;triangles+=o.geometry.getAttribute('position').count/3*(o instanceof T.InstancedMesh?o.count:1);geometries.add(o.geometry);assert.equal(o.castShadow,false);}
   if(o instanceof T.InstancedMesh)pools.push(o);
  });
  assert.ok(calls<=7,`${kind} ${option}: ${calls} calls`);assert.ok(triangles<=40000,`${kind} ${option}: ${triangles} triangles`);
  const storage=pools.map(p=>p.instanceMatrix.array),counts=pools.map(p=>p.count);
  animation.update(0,s.start-12,false);
  pools.forEach(p=>assert.ok(Array.from(p.instanceMatrix.array).every(Number.isFinite),'Before the first trigger every prop must have a finite pose'));
  for(let i=0;i<90;i++)animation.update(i/30,s.start-12+i*1.2,false);
  pools.forEach((p,i)=>{assert.equal(p.instanceMatrix.array,storage[i]);assert.equal(p.count,counts[i]);assert.ok(Array.from(p.instanceMatrix.array).every(Number.isFinite));});
  geometries.forEach(g=>g.addEventListener('dispose',()=>disposed++));animation.dispose();
  assert.equal(disposed,geometries.size);assert.equal(animation.group.children.length,0);assert.equal(materialDisposed,0);
 }
 material.dispose();lights.dispose();
});

test('meadow variants freeze on pause, reproduce replay and respect reduced motion and height ownership',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const [kind,width,height]of cases)for(const option of ['b','c'] as const)for(const hand of [-1,1]){
  const s=section(kind,width,height,hand),animation=createMeadowVariant(s,option,material,lights)!;
  const replay=()=>{for(let i=0;i<=120;i++)animation.update(i/30,s.start-12+i*s.length/120,false);};
  replay();const once=matrices(animation.group);replay();assert.deepEqual(matrices(animation.group),once);
  animation.update(4,s.end-12,false);assert.deepEqual(matrices(animation.group),once,'Paused inputs keep every prop fixed');
  animation.update(0,s.start+s.length*.48,true);const reduced=matrices(animation.group);
  animation.update(99,s.start+s.length*.48,true);assert.deepEqual(matrices(animation.group),reduced,'Reduced motion has no time-driven motion');
  for(const f of s.frames)f.position.y+=40;
  animation.update(99,s.start+s.length*.48,true);assert.deepEqual(matrices(animation.group),reduced,'The parent alone applies later track lift');
  animation.dispose();
 }
 material.dispose();lights.dispose();
});

test('the six scenes are distinct mechanisms, with route-responsive instance transforms',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const [kind,width,height]of cases){
  const s=section(kind,width,height,1),a=createMeadowVariant(s,'b',material,lights)!,b=createMeadowVariant(s,'c',material,lights)!;
  assert.notDeepEqual(matrices(a.group),matrices(b.group),'B and C must not be the same composition');
  for(const animation of [a,b]){
   animation.update(0,s.start-10,false);const before=matrices(animation.group);
   for(let i=1;i<=80;i++)animation.update(i/40,s.start-10+i*s.length*.65/80,false);
   assert.notDeepEqual(matrices(animation.group),before,'Passing train animates the mechanism');animation.dispose();
  }
 }
 const plain=new MiniSection(0,'hill',0,new T.Vector3(0,4,0),50,8,0,1);
 assert.equal(createMeadowVariant(plain,'b',material,lights),undefined);material.dispose();lights.dispose();
});


test('quacking duck beaks stay hinged while opening away from the fixed upper beak',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('pondbridge',66,4,1),bath=createMeadowVariant(s,'c',material,lights)!;
 const ducks=bath.group.getObjectByName('bath-ducks') as T.InstancedMesh,jaws=bath.group.getObjectByName('duck-quacking-jaws') as T.InstancedMesh;
 for(const time of [0,.17,.43,1.6,4.3]){
  bath.update(time,s.start+s.length*.5,false);
  for(let i=0;i<4;i++){
   const body=pose(ducks,i),jaw=pose(jaws,i),expected=new T.Vector3(.95,1.34,0).applyMatrix4(body);
   assert.ok(expected.distanceTo(location(jaw))<1e-5);
   const relative=body.clone().invert().multiply(jaw),tip=new T.Vector3(.9,0,.05).applyMatrix4(relative);
   assert.ok(tip.y<=1.34001,'The lower beak opens downwards, not through the upper beak');
  }
 }
 bath.dispose();material.dispose();lights.dispose();
});

test('trampoline sheep squash and stretch without changing volume or slipping through the bed',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('sheepbank',74,8,1),show=createMeadowVariant(s,'b',material,lights)!;
 const sheep=show.group.getObjectByName('trampoline-sheep') as T.InstancedMesh,mats=show.group.getObjectByName('trampoline-mats') as T.InstancedMesh;
 show.update(0,s.start-1,false);show.update(1,at(s,.18),false);
 const launch=pose(sheep,0),center=new T.Vector3(0,-1,0).applyMatrix4(pose(mats,0));
 assert.ok(Math.abs(location(launch).y-center.y)<1e-5);
 const scales=[];
 for(const age of [0,.12,.36,.6,.88,1.75,2.62]){
  show.update(1+age,at(s,.18),false);const m=pose(sheep,0),scale=new T.Vector3().setFromMatrixScale(m);scales.push(scale.y);
  assert.ok(Math.abs(scale.x*scale.y*scale.z-1.08**3)<1e-5);
  assert.ok(location(m).y>=new T.Vector3(0,-1,0).applyMatrix4(pose(mats,0)).y-1e-5);
 }
 assert.ok(Math.max(...scales)-Math.min(...scales)>.2,'The bounce has a visible elastic silhouette');
 show.dispose();material.dispose();lights.dispose();
});

test('the frog conductor wand stays in its moving hand throughout its croak',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('pondbridge',66,4,1),show=createMeadowVariant(s,'b',material,lights)!;
 const frogs=show.group.getObjectByName('orchestra-frogs') as T.InstancedMesh,batons=show.group.getObjectByName('frog-batons') as T.InstancedMesh;
 show.update(0,s.start-1,false);show.update(1,at(s,.5),false);
 for(const age of [0,.2,.55,1,2.5,4]){
  show.update(1+age,at(s,.5),false);
  const hand=new T.Vector3(-.83,1.22,.89).applyMatrix4(pose(frogs,1));
  assert.ok(hand.distanceTo(location(pose(batons,0)))<1e-5,'Swaying or hopping cannot detach the baton from the hand');
 }
 show.dispose();material.dispose();lights.dispose();
});

test('nectar couriers reach hive and sunflower heights with wings attached while banking',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('windmillloop',8,10,1),show=createMeadowVariant(s,'c',material,lights)!;
 const bees=show.group.getObjectByName('honey-delivery-bees') as T.InstancedMesh,wings=show.group.getObjectByName('delivery-bee-wings') as T.InstancedMesh;
 let lowest=Infinity,highest=-Infinity;
 for(let frame=0;frame<=120;frame++){
  show.update(frame/2,s.start,false);
  for(let i=0;i<5;i++){
   const body=pose(bees,i),position=location(body);lowest=Math.min(lowest,position.y);highest=Math.max(highest,position.y);
   for(let j=0;j<2;j++){
    const expected=new T.Vector3(-.13,.25,(j?1:-1)*.31).applyMatrix4(body);
    assert.ok(expected.distanceTo(location(pose(wings,i*2+j)))<1e-5,'Wing roots remain attached through direction changes');
   }
  }
 }
 assert.ok(lowest<5.1&&lowest>=4.999,'Delivery descends to the hive roof without collision');
 assert.ok(highest>s.origin.y+s.amplitude+1.8,'Bees return to the flower crown');
 let previous:T.Quaternion[]=[];
 for(let frame=0;frame<=1200;frame++){
  show.update(frame/20,s.start,false);
  const rotations=Array.from({length:5},(_,i)=>new T.Quaternion().setFromRotationMatrix(pose(bees,i).scale(new T.Vector3(1/.95,1/.95,1/.95))));
  if(previous.length)rotations.forEach((q,i)=>assert.ok(q.angleTo(previous[i])<.1,'Banking couriers never snap their heading at turnarounds'));
  previous=rotations;
 }
 show.dispose();material.dispose();lights.dispose();
});
