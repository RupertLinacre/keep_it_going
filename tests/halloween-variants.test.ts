import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createHalloweenVariant } from '../src/review/variants/halloween-variants';
import { createMiniSection } from '../src/games/mini-track';
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
