import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHalloweenVariant } from '../src/review/variants/halloween-variants';
import { MiniSection, createMiniSection } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { FairgroundLights } from '../src/games/world-lighting';
import { CrossingPulses } from '../src/review/variants/variant-kit';

test('six Halloween alternatives have bounded render cost, fixed buffers, and clean disposal',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const kind of ['pumpkinhop','pumpkintunnel','witchhat'] as const)for(const option of ['b','c'] as const){
  const s=createMiniSection(kind,100,new T.Vector3(40,4,-12),3,seededRandom(71)),v=createHalloweenVariant(s,option,material,lights)!;
  const geometries=new Set<T.BufferGeometry>(),buffers:Float32Array[]=[],meshes:T.Mesh[]=[];let triangles=0,disposed=0,instanceDisposals=0;
  v.group.traverse(o=>{if(!(o instanceof T.Mesh))return;meshes.push(o);geometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>disposed++);assert.equal(o.castShadow,false);
   triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof T.InstancedMesh?o.count:1);
   if(o instanceof T.InstancedMesh){buffers.push(o.instanceMatrix.array as Float32Array);o.addEventListener('dispose',()=>instanceDisposals++);}
  });
  assert.ok(meshes.length<=7,`${kind} ${option}: ${meshes.length} batches`);assert.ok(triangles<=40000,`${kind} ${option}: ${triangles} triangles`);
  for(let i=0;i<300;i++){v.update(i/30,s.start-12+i*.9,false);for(const m of meshes)if(m instanceof T.InstancedMesh)assert.ok([...m.instanceMatrix.array].every(Number.isFinite));}
  const snapshot=()=>{v.group.updateMatrixWorld(true);return meshes.flatMap(m=>[...m.matrixWorld.elements,...(m instanceof T.InstancedMesh?m.instanceMatrix.array:[])]);};
  v.update(5,s.start+s.length*.6,true);const still=snapshot();v.update(100,s.start+s.length*.6,true);assert.deepEqual(snapshot(),still);
  for(const f of s.frames)f.position.y+=40;
  v.update(100,s.start+s.length*.6,true);assert.deepEqual(snapshot(),still,'Only the owner should apply height-track lifts');
  assert.deepEqual(meshes.filter(m=>m instanceof T.InstancedMesh).map(m=>m.instanceMatrix.array),buffers);
  v.dispose();assert.equal(disposed,geometries.size);assert.equal(instanceDisposals,buffers.length);assert.equal(v.group.children.length,0);
 }
 material.dispose();lights.dispose();
});

test('crossing effects fire once, pause, and reset when the gallery is replayed',()=>{
 const p=new CrossingPulses([20,40]);p.update(0,0);assert.ok(p.age(0,0)<0);
 p.update(1,21);assert.equal(p.age(0,1),0);p.update(2,25);assert.equal(p.age(0,2),1);
 p.update(2,25);assert.equal(p.age(0,2),1);p.update(3,41);assert.equal(p.age(1,3),0);
 p.update(0,0);assert.ok(p.age(0,0)<0);p.update(1,21);assert.equal(p.age(0,1),0);
 const late=new CrossingPulses([20]);late.update(100,25);assert.ok(late.age(0,100)<0,'Loading a passed gate must not invent a burst');
});

test('laundry ghosts rise continuously from the drum instead of teleporting off the clothesline',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkinhop',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'c',material,lights)!;
 const mesh=v.group.getObjectByName('laundry-ghosts') as T.InstancedMesh,matrix=new T.Matrix4();
 const hit=s.start+s.distances[Math.round(s.resolution/6)],position=()=>{mesh.getMatrixAt(0,matrix);return new T.Vector3().setFromMatrixPosition(matrix);};
 v.update(0,hit-.1,false);const before=position();mesh.getMatrixAt(1,matrix);assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(before)>1.2,'Waiting ghosts have separate seats');v.update(.01,hit+.1,false);const justAfter=position();
 assert.ok(before.distanceTo(justAfter)<.1,'The ghost leaves from its resting position in the washing drum');
 v.update(1.3,hit+20,false);const flying=position();assert.ok(flying.y>before.y+2,'Ghost visibly launches upward');
 v.update(4,hit+40,false);const hung=position();assert.ok(hung.y>before.y+3.7,'Ghost settles on the clothesline');
 v.dispose();material.dispose();lights.dispose();
});

test('monster paws and dancing puppets stay clear of the train corridor in both directions',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const hand of [-1,1])for(const option of ['b','c'] as const){
  const s=new MiniSection(0,'pumpkintunnel',0,new T.Vector3(0,4,0),52,1.1,0,hand);
  const v=createHalloweenVariant(s,option,material,lights)!,world=new T.Vector3(),delta=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4();
  const frames=s.frames.filter(f=>Math.abs(f.position.x-s.sample(s.start+s.length/2).position.x)<18);
  for(const time of [0,1,1.25,1.6,2]){
   v.update(time,s.start+s.length/2+(time-1)*22,false);v.group.updateMatrixWorld(true);
   v.group.traverse(o=>{
    if(!(o instanceof T.Mesh))return;const positions=o.geometry.getAttribute('position');
    for(let i=0;i<(o instanceof T.InstancedMesh?o.count:1);i++){
     if(o instanceof T.InstancedMesh){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);}else matrix.copy(o.matrixWorld);
     for(let j=0;j<positions.count;j++){
      world.fromBufferAttribute(positions,j).applyMatrix4(matrix);
      for(const f of frames){
       delta.copy(world).sub(f.position);const up=delta.dot(f.up);
       assert.ok(!(up>.1&&up<2.2&&Math.abs(delta.dot(f.right))<.8&&Math.abs(delta.dot(f.tangent))<1.1),`${option} animation must leave room for the carriage`);
      }
     }
    }
   });
  }
  v.dispose();
 }
 material.dispose();lights.dispose();
});


test('moonflower petals unfold radially around each crown',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('witchhat',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'c',material,lights)!;
 const mesh=v.group.getObjectByName('moonflower-petals') as T.InstancedMesh,matrix=new T.Matrix4();
 v.update(1,s.start+s.distances[Math.round(s.resolution*.48)],false);
 for(let j=0;j<6;j++){
  mesh.getMatrixAt(10+j,matrix);const axis=new T.Vector3(0,1,0).transformDirection(matrix),a=j*Math.PI/3;
  const horizontal=new T.Vector3(axis.x,0,axis.z).normalize(),radial=new T.Vector3(Math.sin(a),0,Math.cos(a));
  assert.ok(horizontal.dot(radial)>.999,'Each petal opens away from the stem, not in one shared direction');
  assert.ok(Math.hypot(axis.x,axis.z)>.5,'The approaching train opens the crown visibly');
 }
 v.dispose();material.dispose();lights.dispose();
});

test('washer doors open before launch and stay clear while ghosts dry',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkinhop',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'c',material,lights)!;
 const doors=v.group.getObjectByName('laundry-door-hinges') as T.InstancedMesh,matrix=new T.Matrix4();
 const hit=s.start+s.distances[Math.round(s.resolution/6)];
 v.update(0,hit-50,false);doors.getMatrixAt(0,matrix);const closed=new T.Vector3(1,0,0).transformDirection(matrix),hinge=new T.Vector3().setFromMatrixPosition(matrix);
 v.update(1,hit-.1,false);doors.getMatrixAt(0,matrix);const open=new T.Vector3(1,0,0).transformDirection(matrix);
 assert.ok(closed.dot(open)<0,'Door has already opened past 90 degrees before the ghost leaves');
 assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(hinge)<1e-6,'Hinge stays bolted to the washer');
 v.update(1.1,hit+.1,false);v.update(5,hit+60,false);doors.getMatrixAt(0,matrix);assert.ok(open.dot(new T.Vector3(1,0,0).transformDirection(matrix))>.999);
 v.dispose();material.dispose();lights.dispose();
});

test('marionette strings remain attached to moving wrists and feet',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkintunnel',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'c',material,lights)!;
 const strings=v.group.getObjectByName('puppet-control-strings') as T.InstancedMesh,arms=v.group.getObjectByName('puppet-arms') as T.InstancedMesh,legs=v.group.getObjectByName('puppet-legs') as T.InstancedMesh;
 const matrix=new T.Matrix4(),limbMatrix=new T.Matrix4();
 for(let time=0;time<3;time+=.13){
  v.update(time,s.start+s.length/2+(time-1)*15,false);
  for(let puppet=0;puppet<3;puppet++)for(let side=0;side<2;side++)for(let limb=0;limb<2;limb++){
   strings.getMatrixAt(puppet*4+side*2+limb,matrix);(limb?legs:arms).getMatrixAt(puppet*2+side,limbMatrix);
   const tip=new T.Vector3(0,.5,0).applyMatrix4(matrix),joint=new T.Vector3(0,limb?-.84:-.87,0).applyMatrix4(limbMatrix);
   assert.ok(tip.distanceTo(joint)<1e-5,'String endpoint moves with its limb instead of hanging in space');
  }
 }
 v.dispose();material.dispose();lights.dispose();
});

test('dancing marionette boots land on top of their platforms without clipping',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkintunnel',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'c',material,lights)!;
 const legs=v.group.getObjectByName('puppet-legs') as T.InstancedMesh,matrix=new T.Matrix4(),point=new T.Vector3();
 for(let t=0;t<6;t+=.08){
  v.update(t,s.start+s.length/2,false);
  for(let i=0;i<3;i++)for(let j=0;j<2;j++){
   legs.getMatrixAt(i*2+j,matrix);
   for(const x of [-.19,.19])for(const y of [-1.05,-.83])for(const z of [-.14,.46]){
    point.set(x,y,z).applyMatrix4(matrix);assert.ok(point.y>=(i===1?6.31:1.11)-1e-5,'The entire shoe clears its supporting platform');
   }
  }
 }
 v.dispose();material.dispose();lights.dispose();
});

test('frog stoppers somersault back to the same bottle seats',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkinhop',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'b',material,lights)!;
 const mesh=v.group.getObjectByName('potion-frog-stoppers') as T.InstancedMesh,matrix=new T.Matrix4(),first=new T.Matrix4();
 const hit=s.start+s.distances[Math.round(s.resolution/6)];
 v.update(0,hit-.1,false);mesh.getMatrixAt(0,first);v.update(.01,hit+.1,false);v.update(1.085,hit+10,false);mesh.getMatrixAt(0,matrix);
 assert.ok(new T.Vector3(0,1,0).transformDirection(matrix).y<-.999,'The frog turns fully upside down in midair');
 assert.ok(matrix.elements[13]>first.elements[13]+4,'The stopper makes a readable hop');
 v.update(2.6,hit+20,false);mesh.getMatrixAt(0,matrix);
 matrix.elements.forEach((n,i)=>assert.ok(Math.abs(n-first.elements[i])<1e-5,'Stopper returns upright to its original seat'));
 v.dispose();material.dispose();lights.dispose();
});

test('potion pipes and gauges leave both frog launch shafts clear',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkinhop',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'b',material,lights)!;
 const frogs=v.group.getObjectByName('potion-frog-stoppers') as T.InstancedMesh,body=v.group.getObjectByName('potion-laboratory-body')!,matrix=new T.Matrix4(),point=new T.Vector3();
 v.update(0,s.start,false);body.updateMatrixWorld(true);
 for(let i=0;i<6;i++){
  frogs.getMatrixAt(i,matrix);const seat=new T.Vector3().setFromMatrixPosition(matrix);
  body.traverse(o=>{if(!(o instanceof T.Mesh))return;const positions=o.geometry.getAttribute('position');
   for(let j=0;j<positions.count;j++){
    point.fromBufferAttribute(positions,j).applyMatrix4(o.matrixWorld).sub(seat);
    assert.ok(!(Math.abs(point.x)<.8&&Math.abs(point.z)<1.45&&point.y>.6&&point.y<7),'Overhead plumbing must not obstruct a somersaulting frog');
   }
  });
 }
 v.dispose();material.dispose();lights.dispose();
});

test('laundry sheet skirts remain attached to their ghosts while fluttering',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkinhop',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'c',material,lights)!;
 const ghosts=v.group.getObjectByName('laundry-ghosts') as T.InstancedMesh,cloth=v.group.getObjectByName('laundry-fluttering-sheets') as T.InstancedMesh,matrix=new T.Matrix4(),sheet=new T.Matrix4();
 const hit=s.start+s.distances[Math.round(s.resolution/6)];v.update(0,hit-.1,false);v.update(.01,hit+.1,false);
 for(let t=.1;t<6;t+=.17){
  v.update(t,hit+t*15,false);
  for(let i=0;i<6;i++){ghosts.getMatrixAt(i,matrix);cloth.getMatrixAt(i,sheet);const shoulder=new T.Vector3(0,1.3,0).applyMatrix4(matrix),hinge=new T.Vector3().setFromMatrixPosition(sheet);assert.ok(shoulder.distanceTo(hinge)<1e-5);assert.ok(sheet.determinant()>0);}
 }
 v.dispose();material.dispose();lights.dispose();
});

test('monster wink lids close from a fixed eyebrow without moving their top edge',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const s=createMiniSection('pumpkintunnel',0,new T.Vector3(0,4,0),0,seededRandom(71)),v=createHalloweenVariant(s,'b',material,lights)!;
 const lids=v.group.getObjectByName('monster-winking-lids') as T.InstancedMesh,matrix=new T.Matrix4(),hit=s.start+s.length/2;
 v.update(0,hit-.1,false);v.update(.01,hit+.1,false);
 for(const t of [.36,.4,.46,.53,.61]){v.update(t,hit+8,false);lids.getMatrixAt(0,matrix);const top=new T.Vector3(0,1.19,0).applyMatrix4(matrix);assert.ok(Math.abs(top.y-3.39)<.016,'Upper edge stays fixed at the brow');}
 v.update(.46,hit+8,false); // Replay consistently through the crossing for the fully shut pose.
 v.update(0,hit-.1,false);v.update(.01,hit+.1,false);v.update(.46,hit+8,false);lids.getMatrixAt(0,matrix);
 assert.ok(new T.Vector3(0,-1.19,0).applyMatrix4(matrix).y<1.02,'Closed lid covers the bottom of the eye');
 v.dispose();material.dispose();lights.dispose();
});
