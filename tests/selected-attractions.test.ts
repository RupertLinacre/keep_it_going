import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ATTRACTION_RAILS } from '../src/games/attraction-kinds';
import { createAdditionalAttraction } from '../src/games/attractions';
import { createMiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { WORLDS } from '../src/games/adventure-worlds';
import { ELEMENT_NAMES } from '../src/games/mini-progression';
import { seededRandom } from '../src/games/mini-rail';
import { MiniPhysics } from '../src/games/mini-physics';

const kinds=Object.keys(ATTRACTION_RAILS) as (keyof typeof ATTRACTION_RAILS)[];
const capture=(group:T.Group)=>{
 const result:number[]=[];
 group.traverse(o=>{if(o instanceof T.InstancedMesh)result.push(...o.instanceMatrix.array);});
 return result;
};

test('five selected additions retain independent names, seeded rails and multiplayer alignment',()=>{
 for(const kind of kinds)for(const race of [false,true])for(const seed of [1,18,42,73]) {
  const world=WORLDS.find(w=>w.pieces.includes(kind))!;
  assert.ok(world);assert.equal(WORLDS.filter(w=>w.pieces.includes(kind)).length,1);
  const origin=new T.Vector3(20,4,2),section=createMiniSection(kind,world.start+150,origin,20,seededRandom(seed),true,race);
  const original=createMiniSection(ATTRACTION_RAILS[kind],world.start+150,origin,20,seededRandom(seed),true,race);
  assert.equal(section.kind,kind);assert.notEqual(ELEMENT_NAMES[kind],ELEMENT_NAMES[original.kind]);
  assert.deepEqual(section.frames.map(f=>f.position.toArray()),original.frames.map(f=>f.position.toArray()));
  if(race)assert.ok(Math.abs(section.frames.at(-1)!.position.z)<2.3,'No cumulative lane divergence');
  const physics=new MiniPhysics(section,{initialDistance:section.start,initialSpeed:50,gravity:9.81,rolling:0,drag:0});
  for(let i=0;i<2400&&physics.distance<section.end&&!physics.held;i++)physics.update(1/120);
  assert.ok(physics.distance>=section.end,kind+' has a traversable continuous route');
 }
});

test('selected models animate without changing draw budgets, survive pause/lift/mirroring, and dispose ownership once',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 for(const kind of kinds) {
  const world=WORLDS.find(w=>w.pieces.includes(kind))!;
  const section=createMiniSection(kind,world.start+150,new T.Vector3(70,4,-2),1,seededRandom(42),true);
  const piece=createAdditionalAttraction(section,material,lights)!,remote=createAdditionalAttraction(section,material,lights)!;
  const budgets=new Map<T.InstancedMesh,number>(),geometries=new Set<T.BufferGeometry>();let draws=0,triangles=0,disposed=0;
  piece.group.traverse(o=>{
   assert.ok(!(o instanceof T.Light),'Attractions add no real-time lights');
   if(!(o instanceof T.Mesh))return;draws++;geometries.add(o.geometry);
   assert.ok(!o.castShadow);
   if(o instanceof T.InstancedMesh)budgets.set(o,o.count);
   triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof T.InstancedMesh?o.count:1);
  });
  assert.ok(draws<=7&&triangles<20000,`${kind}: ${draws} batches, ${triangles} triangles`);
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed++);
  let moved=false;let previous=capture(piece.group);
  for(let i=0;i<90;i++) {
   piece.update(i/15,section.start+section.length*i/89,false);
   const now=capture(piece.group);assert.ok(now.every(Number.isFinite));moved ||= now.some((x,j)=>Math.abs(x-previous[j])>.0001);previous=now;
   for(const [mesh,count] of budgets)assert.equal(mesh.count,count);
  }
  assert.ok(moved,kind+' responds to the train');
  const before=capture(piece.group);piece.update(89/15,section.end,false);assert.deepEqual(capture(piece.group),before,'Pause freezes the effect');
  assert.notDeepEqual(capture(remote.group),before,'Riders have independent animation buffers');
  for(const frame of section.frames)frame.position.y+=30;
  piece.update(89/15,section.end,false);assert.deepEqual(capture(piece.group),before,'Parent alone applies Sky lift');
  piece.update(0,section.start,true);const still=capture(piece.group);piece.update(1000,section.start,true);assert.deepEqual(capture(piece.group),still,'Reduced motion is steady');
  piece.dispose();assert.equal(disposed,geometries.size);assert.equal(piece.group.children.length,0);remote.dispose();
 }
 material.dispose();lights.dispose();
});
