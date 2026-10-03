import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createMiniSection } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { FairgroundLights } from '../src/games/world-lighting';
import { createHalloweenExtraVariant } from '../src/review/variants/halloween-extra-variants';
import { at } from '../src/review/variants/variant-kit';

const section=(kind:'pumpkinhop'|'pumpkintunnel'|'witchhat',km=0)=>createMiniSection(kind,km*1000,new T.Vector3(17,4,-9),km?20:0,seededRandom(71));
const pose=(m:T.InstancedMesh,i=0)=>{const a=new T.Matrix4();m.getMatrixAt(i,a);return a;};
const location=(m:T.Matrix4)=>new T.Vector3().setFromMatrixPosition(m);
test('all six new Halloween designs keep fixed geometry, finite poses, reduced motion and disposal budgets',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 for(const kind of ['pumpkinhop','pumpkintunnel','witchhat'] as const)for(const option of ['d','e'] as const)for(const km of [0,4]){
  const s=section(kind,km),v=createHalloweenExtraVariant(s,option,material,lights)!;
  const meshes:T.Mesh[]=[],pools:T.InstancedMesh[]=[],geometries=new Set<T.BufferGeometry>();let tris=0,disposed=0;
  v.group.traverse(o=>{if(!(o instanceof T.Mesh))return;meshes.push(o);geometries.add(o.geometry);assert.equal(o.castShadow,false);tris+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof T.InstancedMesh?o.count:1);if(o instanceof T.InstancedMesh)pools.push(o);});
  assert.ok(meshes.length<=7,`${kind}${option}: ${meshes.length} draws`);assert.ok(tris<=40000,`${kind}${option}: ${tris} triangles`);
  const buffers=pools.map(m=>m.instanceMatrix.array);const state=()=>pools.flatMap(m=>Array.from(m.instanceMatrix.array));
  for(let i=0;i<200;i++){v.update(i*.08,s.start-12+i*s.length/175,false);assert.ok(state().every(Number.isFinite),`${kind}${option} matrices`);}
  v.update(5,at(s,.5),true);const still=state();v.update(100,at(s,.5),true);assert.deepEqual(state(),still,`${kind}${option} reduced motion`);
  v.update(0,s.start-12,false);const start=state();v.update(3,at(s,.6),false);v.update(0,s.start-12,false);assert.deepEqual(state(),start,`${kind}${option} replay`);
  for(let i=0;i<pools.length;i++)assert.equal(pools[i].instanceMatrix.array,buffers[i]);
  for(const g of geometries)g.addEventListener('dispose',()=>disposed++);v.dispose();assert.equal(disposed,geometries.size);assert.equal(v.group.children.length,0);
 }
 material.dispose();lights.dispose();
});

test('book leaves turn overhead and leave a clear passage throughout the page turn',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('pumpkintunnel'),v=createHalloweenExtraVariant(s,'d',material,lights)!;
 const pages=v.group.getObjectByName('library-turning-pages') as T.InstancedMesh;
 for(let j=0;j<60;j++){v.update(j*.1,s.start+s.length/2-25+j,false);for(let i=0;i<3;i++){const m=pose(pages,i);for(const x of [0,6.2])for(const y of [-.04,.04])assert.ok(new T.Vector3(x,y,0).applyMatrix4(m).y>8.9,'Page bottom stays above the railway opening');}}
 v.dispose();material.dispose();lights.dispose();
});

test('fossil jaw hinge follows its laughing head instead of drifting away',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('pumpkintunnel'),v=createHalloweenExtraVariant(s,'e',material,lights)!;
 const head=v.group.getObjectByName('fossil-head') as T.InstancedMesh,jaw=v.group.getObjectByName('fossil-jaw') as T.InstancedMesh;
 for(let j=0;j<40;j++){v.update(j*.13,s.start+s.length/2+j-20,false);const hinge=new T.Vector3(0,-.8,.15).applyMatrix4(pose(head));assert.ok(hinge.distanceTo(location(pose(jaw)))<1e-5);}
 v.dispose();material.dispose();lights.dispose();
});

test('hotel passenger stays on its lift and only emerges after the shutters open',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('witchhat'),v=createHalloweenExtraVariant(s,'d',material,lights)!;
 const lift=v.group.getObjectByName('hotel-lift') as T.InstancedMesh,passenger=v.group.getObjectByName('hotel-lift-guest') as T.InstancedMesh,shutters=v.group.getObjectByName('hotel-shutters') as T.InstancedMesh,guests=v.group.getObjectByName('hotel-window-guests') as T.InstancedMesh;
 v.update(0,s.start-100,false);const resting=location(pose(guests));
 const leftEdge=new T.Vector3(.42,0,0).applyMatrix4(pose(shutters,0)),rightEdge=new T.Vector3(.42,0,0).applyMatrix4(pose(shutters,1));assert.ok(leftEdge.distanceTo(rightEdge)<1e-5,'Closed door leaves meet without overlapping');
 for(let j=0;j<100;j++){v.update(j*.1,s.start+s.length*j/100,false);const cabin=location(pose(lift)),rider=location(pose(passenger));assert.ok(Math.abs(rider.x-cabin.x)<1e-5&&Math.abs(rider.y-cabin.y-.72)<1e-5&&Math.abs(rider.z-cabin.z)<1e-5);
  assert.ok(new T.Vector3(0,-.7,0).applyMatrix4(pose(passenger)).y>cabin.y+.1,'The passenger clears the lift floor');
  if(location(pose(guests)).z>resting.z+.04){const door=new T.Vector3(1,0,0).transformDirection(pose(shutters));assert.ok(door.x<.01,'Shutters are fully open before a guest leans out');}}
 v.dispose();material.dispose();lights.dispose();
});

test('silk spider feet reach the web they pluck',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('witchhat'),v=createHalloweenExtraVariant(s,'e',material,lights)!;
 const legs=v.group.getObjectByName('silk-spider-legs') as T.InstancedMesh,r=Math.max(2.4,s.width*.095-2.7);
 v.update(0,s.start,true);
 for(let i=0;i<8;i++){const foot=new T.Vector3(r*.52,-2.2,0).applyMatrix4(pose(legs,i));assert.ok(Math.abs(foot.y-(2+(s.amplitude+2)*.54))<1e-5,'Resting feet touch the upper silk tier');}
 v.dispose();material.dispose();lights.dispose();
});

test('spring spiders take off, settle back on their web and retain attached leg roots',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),s=section('pumpkinhop'),v=createHalloweenExtraVariant(s,'e',material,lights)!;
 const bodies=v.group.getObjectByName('spring-spiders') as T.InstancedMesh,legs=v.group.getObjectByName('spring-spider-legs') as T.InstancedMesh,webs=v.group.getObjectByName('spring-webs') as T.InstancedMesh,stop=at(s,1/6);
 v.update(0,stop-.01,false);v.update(.01,stop+.01,false);v.update(.55,stop+20,false);assert.ok(location(pose(bodies)).y-location(pose(webs)).y>3,'Spider makes a readable bounce');
 for(let j=0;j<8;j++){const side=j<4?1:-1,anchor=new T.Vector3(side*.45,0,(j%4-1.5)*.45).applyMatrix4(pose(bodies));assert.ok(anchor.distanceTo(location(pose(legs,j)))<1e-5);}
 v.update(4,stop+60,false);assert.ok(Math.abs(location(pose(bodies)).y-location(pose(webs)).y-1.78)<1e-5,'Resting feet reach the web');v.dispose();material.dispose();lights.dispose();
});
