import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createMiniSection } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { MiniPhysics } from '../src/games/mini-physics';
import { createSledMountain, SLED_TUNNEL } from '../src/games/attractions/sled-mountain';
import { penguinRoutes, PenguinHaul, TOW_GAPS, RACE_SECONDS } from '../src/games/sled-penguins';
import { FairgroundLights } from '../src/games/world-lighting';

// Both hands, later laps and race lanes use the actual game factory.
test('sled switchbacks have tangent joins, inward bank, broad turns and separate swept corridors',()=>{
  for(const seed of [1,18,42,73])for(const race of [false,true]){
    const s=createMiniSection('sledswitchbacks',4350,new T.Vector3(10,4,0),20,seededRandom(seed),true,race);
    const first=s.frames[0],last=s.frames.at(-1)!;
    assert.ok(first.tangent.x>.999&&last.tangent.x>.999);
    assert.ok(first.up.y>.999&&last.up.y>.999);
    assert.ok(last.position.distanceTo(new T.Vector3(10+s.width,4,0))<1e-5);
    for(let i=1;i<s.frames.length;i++) {
      const a=s.frames[i-1],b=s.frames[i];
      assert.ok(a.tangent.dot(b.tangent)>.995,'No abrupt heading change');
      assert.ok(a.up.dot(b.up)>.995,'No bank discontinuity');
      assert.ok(b.up.y>.8,'Train remains upright');
    }
    for(const u of [2.5/9,3.5/9,5.5/9,6.5/9]) {
      const f=s.frames[Math.round(s.resolution*u)],curvature=new T.Vector3(f.curvature.x,0,f.curvature.z),lean=new T.Vector3(f.up.x,0,f.up.z);
      assert.ok(lean.dot(curvature)>0,'Bank leans into the turn');
      assert.ok(curvature.length()<.15,'Hairpin radius remains above 6.6 metres');
    }
    // Nonlocal pieces of the rail need more than the 3m passenger envelope.
    for(let i=0;i<s.frames.length;i+=8)for(let j=i+1;j<s.frames.length;j+=8) {
      if(s.distances[j]-s.distances[i]<12)continue;
      assert.ok(s.frames[i].position.distanceTo(s.frames[j].position)>4,'No crossing or overlapping train corridors');
    }
    const physics=new MiniPhysics(s,{initialDistance:s.start,initialSpeed:30,rolling:0,drag:0}),energy=physics.energy;
    for(let i=0;i<6000&&physics.distance<s.end&&!physics.held;i++)physics.update(1/120);
    assert.ok(physics.distance>=s.end,'A gravity-driven train can traverse the descent');
    assert.ok(Math.abs(physics.energy-energy)<energy*.001,'Track conserves mechanical energy');
  }
});

test('sled mountain preserves a clear rail bed and owns stable, bounded animation buffers',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide}),lights=new FairgroundLights();
 const s=createMiniSection('sledswitchbacks',4350,new T.Vector3(0,4,0),20,seededRandom(42),true);
 const piece=createSledMountain(s,material,lights),meshes:T.Mesh[]=[],geometries=new Set<T.BufferGeometry>();
 piece.group.updateMatrixWorld(true);
 piece.group.traverse(o=>{if(o instanceof T.Mesh){meshes.push(o);geometries.add(o.geometry);}});
 const ray=new T.Raycaster();
 // The ray checks the actual baked scenery directly under each rail position.
 for(let i=0;i<s.frames.length;i+=6) {
   const p=s.frames[i].position;
   ray.set(p.clone().add(new T.Vector3(0,.25,0)),new T.Vector3(0,-1,0));
   const hits=ray.intersectObjects(meshes.filter(m=>!(m instanceof T.InstancedMesh)),false);
   if(hits.length)assert.ok(hits[0].point.y<p.y-.35,`Scenery enters the rail bed at frame ${i}`);
 }
 // Check the terrain from above, so a buried train cannot escape the check.
 const land=meshes.filter(m=>m.name==='sled-snow-island');
 for(let i=0;i<s.frames.length;i+=8) {
   const p=s.frames[i].position;
   ray.set(p.clone().add(new T.Vector3(0,50,0)),new T.Vector3(0,-1,0));
   const hits=ray.intersectObjects(land,false);
   if(hits.length)assert.ok(hits[0].point.y<p.y-.35,`Snow buries the train at frame ${i}`);
 }
 // The actual tunnel walls and ceiling provide a generous passenger envelope.
 const bore=meshes.filter(m=>m.name==='sled-stone-tunnel');
 for(let i=1;i<12;i++) {
   const u=SLED_TUNNEL.from+(SLED_TUNNEL.to-SLED_TUNNEL.from)*i/12;
   const f=s.frames[Math.round(s.resolution*u)],p=f.position.clone().addScaledVector(f.up,1);
   for(const side of [-1,1]) {
     ray.set(p,f.right.clone().multiplyScalar(side));const hits=ray.intersectObjects(bore,false);
     assert.ok(hits.length&&hits[0].distance>3.3,'Open tunnel has clear sides');
   }
   ray.set(f.position.clone().addScaledVector(f.up,2.3),f.up);
   const roof=ray.intersectObjects(bore,false);
   assert.ok(roof.length&&roof[0].distance>2.8,'Roof stays clear of the locomotive and cargo');
 }
 const matrices=()=>meshes.filter(m=>m instanceof T.InstancedMesh).map(m=>Array.from((m as T.InstancedMesh).instanceMatrix.array));
 piece.update(1,s.start,false);const moving=matrices();piece.update(2,s.start,false);assert.notDeepEqual(matrices(),moving);
 piece.update(2,s.start,false);const paused=matrices();piece.update(2,s.start,false);assert.deepEqual(matrices(),paused);
 piece.update(0,s.start,true);const reduced=matrices();piece.update(100,s.start,true);assert.deepEqual(matrices(),reduced);
 let disposed=0;for(const g of geometries)g.addEventListener('dispose',()=>disposed++);
 assert.ok(meshes.length<=14);piece.dispose();assert.equal(disposed,geometries.size);material.dispose();lights.dispose();
});


test('penguins wait for the train, release in order, and finish quickly',()=>{
  const haul=new PenguinHaul(100);
  haul.update(0,0);haul.update(40,80);
  assert.deepEqual([0,1,2].map(i=>haul.sample(i,40,80).phase),['towing','towing','towing']);
  haul.update(40.1,108);
  assert.deepEqual([0,1,2].map(i=>haul.sample(i,40.1,108).phase),['racing','towing','towing']);
  haul.update(40.2,114);haul.update(40.3,120);
  const releases=[...haul.released];haul.update(41,150);
  assert.deepEqual(haul.released,releases,'Each cable releases once');
  assert.ok(releases[0]<releases[1]&&releases[1]<releases[2]);
  haul.update(45.2,160);
  assert.ok([0,1,2].every(i=>haul.sample(i,45.2,160).phase==='landed'));
});

test('summit release timing is consistent at 30, 60 and 120 frames per second',()=>{
  const snapshots=[30,60,120].map(fps=>{
    const haul=new PenguinHaul(100);
    for(let frame=0;frame<=fps*4;frame++)haul.update(frame/fps,frame/fps*40);
    return haul.released;
  });
  for(const times of snapshots)times.forEach((t,i)=>assert.ok(Math.abs(t-(100+TOW_GAPS[i])/40)<1e-8));
});

test('late creation, rewind, replay and reduced motion have finite, stable states',()=>{
  const haul=new PenguinHaul(100);haul.update(20,200);
  assert.ok(haul.released.every(Number.isFinite));
  assert.equal(haul.sample(0,20,200).progress,0);
  assert.equal(haul.sample(0,20,200,true).progress,1);
  haul.update(0,0);assert.equal(haul.released.length,0);
  haul.update(1,108);const stopped=haul.sample(0,1,108);
  haul.update(1,108);assert.deepEqual(haul.sample(0,1,108),stopped);
  haul.update(1+RACE_SECONDS[0],108);assert.equal(haul.sample(0,1+RACE_SECONDS[0],108).phase,'landed');
  haul.update(7,20);assert.equal(haul.sample(0,7,20).phase,'towing');
});

test('ski routes join the tow ledge and stay below separated coaster corridors',()=>{
  for(const seed of [1,18,42,73]) {
    const s=createMiniSection('sledswitchbacks',0,new T.Vector3(),20,seededRandom(seed),true);
    const routes=penguinRoutes(s);
    for(const run of routes.paths) {
      assert.ok(run.getPoint(0).distanceTo(routes.tow(routes.summit).position)<1e-8);
      assert.ok(run.getTangent(0).dot(routes.tow(routes.summit).tangent)>.999);
      let height=Infinity;
      for(let i=0;i<=160;i++) {
        const p=run.getPoint(i/160),t=run.getTangent(i/160);
        assert.ok(p.y<=height+.01,'Run descends smoothly');height=p.y;
        const up=new T.Vector3(0,1,0).addScaledVector(t,-t.y).normalize();
        const centre=p.clone().addScaledVector(up,2.2);
        for(let j=0;j<s.frames.length;j+=8)assert.ok(centre.distanceTo(s.frames[j].position)>2.5,`Rider envelope clears the rails: seed ${seed}, route ${routes.paths.indexOf(run)}, u ${i/160}, rail ${j}, gap ${centre.distanceTo(s.frames[j].position)}`);
      }
      for(let i=1;i<run.curves.length;i++)assert.ok(run.curves[i-1].getTangent(1).dot(run.curves[i].getTangent(0))>.999,'No abrupt steering at joins');
      assert.ok(Math.abs(run.getTangent(1).y)<.001,'Flat braking area');
    }
  }
});
