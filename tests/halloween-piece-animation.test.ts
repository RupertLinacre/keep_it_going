import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniSection, createMiniSection } from '../src/games/mini-track';
import { createHalloweenPieceAnimation } from '../src/games/halloween-piece-animation';
import { FairgroundLights } from '../src/games/world-lighting';
import { seededRandom } from '../src/games/mini-rail';
import { portalHitDistance } from '../src/games/pumpkin-portal';

test('Halloween interactions use fixed buffers, replay cleanly and release their own geometry',()=>{
 const solid=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const kind of ['pumpkinhop','pumpkintunnel','witchhat'] as const){
  const section=createMiniSection(kind,0,new T.Vector3(0,4,0),0,seededRandom(71));
  const effect=createHalloweenPieceAnimation(section,solid,lights)!;
  const meshes:T.InstancedMesh[]=[];effect.group.traverse(o=>{if(o instanceof T.InstancedMesh)meshes.push(o);});
  assert.equal(meshes.length,3);const arrays=meshes.map(m=>m.instanceMatrix.array);
  const replay=()=>{for(let i=0;i<360;i++)effect.update(i/30,section.start-12+i*.8,false);};
  replay();const state=meshes.map(m=>Array.from(m.instanceMatrix.array));
  replay();assert.deepEqual(meshes.map(m=>Array.from(m.instanceMatrix.array)),state);
  meshes.forEach((mesh,i)=>{assert.equal(mesh.instanceMatrix.array,arrays[i]);assert.ok(mesh.count<=mesh.instanceMatrix.count);assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite));});
  effect.update(1,section.start,false);effect.update(2,section.end,true);const still=meshes.map(m=>Array.from(m.instanceMatrix.array));effect.update(50,section.end,true);assert.deepEqual(meshes.map(m=>Array.from(m.instanceMatrix.array)),still);
  let disposed=0;meshes.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));effect.dispose();assert.equal(disposed,3);
 }
 solid.dispose();lights.dispose();
});


test('pumpkin mallet heads touch the drum skin while handles stay above it',()=>{
 const solid=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const section=createMiniSection('pumpkinhop',0,new T.Vector3(0,4,0),0,seededRandom(71));
 const effect=createHalloweenPieceAnimation(section,solid,lights)!;
 const mesh=effect.group.children[0] as T.InstancedMesh,positions=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');
 const green=new T.Color('#c7f081'),matrix=new T.Matrix4(),vertex=new T.Vector3();
 const bottom=(instance:number,head:boolean)=>{
  mesh.getMatrixAt(instance,matrix);let low=Infinity;
  for(let j=0;j<positions.count;j++){
   const isHead=Math.abs(colors.getX(j)-green.r)<1e-5&&Math.abs(colors.getY(j)-green.g)<1e-5;
   if(isHead===head){vertex.fromBufferAttribute(positions,j).applyMatrix4(matrix);low=Math.min(low,vertex.y);}
  }
  return low;
 };
 for(let crest=0;crest<3;crest++){
  const frame=Math.round(section.resolution*(crest+.5)/3),hit=section.start+section.distances[frame],skin=section.frames[frame].position.y+1.31;
  effect.update(0,hit-.1,false);
  for(let side=0;side<2;side++)assert.ok(bottom(crest*2+side,true)>skin+.18,'Mallet is raised before the train arrives');
  effect.update(.01,hit+.1,false);
  for(let side=0;side<2;side++){
   effect.update(.01+Math.PI/34+side*Math.PI/17,hit+.1,false);
   assert.ok(Math.abs(bottom(crest*2+side,true)-skin)<.03,'Green head reaches the drum surface on the first beat');
   assert.ok(bottom(crest*2+side,false)>skin+.2,'Handle does not pass through the drum');
  }
 }
 effect.dispose();solid.dispose();lights.dispose();
});

test('orbiting broom geometry clears the banked carriage envelope in either-handed smallest hat',()=>{
 const solid=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const hand of [-1,1]){
  const section=new MiniSection(0,'witchhat',0,new T.Vector3(0,4,0),64,27,0,hand);
  const effect=createHalloweenPieceAnimation(section,solid,lights)!,mesh=effect.group.children[0] as T.InstancedMesh;
  const p=mesh.geometry.getAttribute('position'),vertices=new Map<string,T.Vector3>();
  for(let j=0;j<p.count;j++){const v=new T.Vector3().fromBufferAttribute(p,j);vertices.set(v.toArray().join(','),v);}
  const frames=section.frames.filter((f,j)=>j%3===0&&Math.abs(f.position.y-(section.amplitude*.8+2))<4);
  const matrix=new T.Matrix4(),world=new T.Vector3(),delta=new T.Vector3();let clearance=Infinity;
  for(let time=0;time<27;time+=.3){
   effect.update(time,section.start-1,false);
   for(let instance=0;instance<3;instance++){
    mesh.getMatrixAt(instance,matrix);
    for(const v of vertices.values()){
     world.copy(v).applyMatrix4(matrix);
     for(const f of frames){
      delta.copy(world).sub(f.position);
      const up=delta.dot(f.up);
      clearance=Math.min(clearance,Math.hypot(Math.max(0,Math.abs(delta.dot(f.right))-.8),Math.max(0,-up,up-1.8),Math.max(0,Math.abs(delta.dot(f.tangent))-1.05)));
     }
    }
   }
  }
  assert.ok(clearance>.1,`All broom vertices stay outside the carriage envelope: ${clearance}m`);
  effect.dispose();
 }
 solid.dispose();lights.dispose();
});

test('spellbook pages stay attached to broom riders with positive instance transforms',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const section=createMiniSection('witchhat',0,new T.Vector3(0,4,0),0,seededRandom(71)),effect=createHalloweenPieceAnimation(section,material,lights)!;
 const rider=effect.group.children[0] as T.InstancedMesh,pages=effect.group.getObjectByName('halloween-character-details') as T.InstancedMesh;
 const matrix=new T.Matrix4(),book=new T.Matrix4();
 for(let time=0;time<8;time+=.23){
  effect.update(time,section.start+time*24,false);assert.equal(pages.count,6);
  for(let i=0;i<3;i++){
   rider.getMatrixAt(i,matrix);const spine=new T.Vector3(.71,.14,0).applyMatrix4(matrix);
   for(let page=0;page<2;page++){pages.getMatrixAt(i*2+page,book);assert.ok(book.determinant()>0,'Instancing does not support reflected scales');assert.ok(new T.Vector3().setFromMatrixPosition(book).distanceTo(spine)<1e-5);}
  }
 }
 effect.dispose();material.dispose();lights.dispose();
});

test('castle sweets start their burst at their visible lollipop orbit',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 const section=createMiniSection('pumpkintunnel',0,new T.Vector3(0,4,0),0,seededRandom(71)),effect=createHalloweenPieceAnimation(section,material,lights)!;
 const mesh=effect.group.children[0] as T.InstancedMesh,matrix=new T.Matrix4();
 // The portal interaction uses the geometry's exact hit distance.
 const hit=portalHitDistance(section),before:T.Vector3[]=[];
 effect.update(100,hit-.01,false);for(let i=0;i<8;i++){mesh.getMatrixAt(i,matrix);before.push(new T.Vector3().setFromMatrixPosition(matrix));}
 effect.update(100.001,hit+.01,false);for(let i=0;i<8;i++){mesh.getMatrixAt(i,matrix);assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(before[i])<.01,'Candy does not teleport to the centre of the arch');}
 effect.dispose();material.dispose();lights.dispose();
});
