import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMeadowVariant } from '../src/review/variants/meadow-variants';

const cases=[['sheepbank',74,8],['pondbridge',66,4],['windmillloop',8,10]] as const;
const section=(kind:typeof cases[number][0],width:number,height:number,hand:number)=>new MiniSection(3,kind,90,new T.Vector3(120,4,-9),width,height,kind==='windmillloop'?hand*2.2:0,hand);
const matrices=(group:T.Group)=>{const output:number[]=[];group.traverse(o=>{if(o instanceof T.InstancedMesh)output.push(...o.instanceMatrix.array);});return output;};

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
