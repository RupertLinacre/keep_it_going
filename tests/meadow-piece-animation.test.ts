import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMeadowPieceAnimation } from '../src/games/meadow-piece-animation';

const pose=(mesh:T.InstancedMesh,index:number)=>{const m=new T.Matrix4();mesh.getMatrixAt(index,m);return m;};
const origin=(m:T.Matrix4)=>new T.Vector3().setFromMatrixPosition(m);
const setup=(kind:'pondbridge'|'windmillloop')=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 const section=new MiniSection(2,kind,90,new T.Vector3(80,4,-12),kind==='pondbridge'?66:8,kind==='pondbridge'?4:10,0,1);
 const animation=createMeadowPieceAnimation(section,material,lights)!;
 return {section,animation,dispose(){animation.dispose();material.dispose();lights.dispose();}};
};

test('duck captain boats point along their paths and every wake trails the stern',()=>{
 const {section:s,animation:a,dispose}=setup('pondbridge');
 const boats=a.group.getObjectByName('captain-boats') as T.InstancedMesh,wakes=a.group.getObjectByName('boat-wakes') as T.InstancedMesh;
 for(const time of [0,2,7,13,24]){
  a.update(time,s.start+s.length*.45,false);
  const initial=Array.from({length:3},(_,i)=>pose(boats,i));
  for(let i=0;i<3;i++){
   const forward=new T.Vector3(1,0,0).transformDirection(initial[i]);forward.y=0;forward.normalize();
   for(let j=0;j<3;j++)assert.ok(origin(pose(wakes,i*3+j)).sub(origin(initial[i])).dot(forward)<-.8,'Wake must stay behind its own boat');
  }
  a.update(time+.001,s.start+s.length*.45,false);
  initial.forEach((m,i)=>{
   const tangent=origin(pose(boats,i)).sub(origin(m));tangent.y=0;tangent.normalize();
   const heading=new T.Vector3(1,0,0).transformDirection(m);heading.y=0;heading.normalize();
   assert.ok(tangent.dot(heading)>.999,'Hull follows the ellipse tangent throughout its orbit');
  });
 }
 dispose();
});

test('mill gears share a tooth pitch, counter-rotate, and flour stays on the conveyor',()=>{
 const {section:s,animation:a,dispose}=setup('windmillloop');
 const gears=a.group.getObjectByName('meshing-gears') as T.InstancedMesh,bags=a.group.getObjectByName('flour-conveyor') as T.InstancedMesh;
 a.update(0,s.start,false);const initial=Array.from({length:3},(_,i)=>pose(gears,i));
 assert.ok(Math.abs(origin(initial[1]).distanceTo(origin(initial[0]))-1.8)<1e-5);
 assert.ok(Math.abs(origin(initial[2]).distanceTo(origin(initial[1]))-1.8)<1e-5);
 for(const time of [1,3,9]){
  a.update(time,s.start,false);
  const angles=initial.map((m,i)=>{const q=pose(gears,i).multiply(m.clone().invert());return Math.atan2(q.elements[1],q.elements[0]);});
  assert.ok(Math.abs(angles[0]+angles[1])<1e-5);assert.ok(Math.abs(angles[1]+angles[2])<1e-5);
  for(let i=0;i<bags.count;i++){
   const p=origin(pose(bags,i));assert.ok(Math.abs(p.y-1.24)<1e-5);
   assert.ok(Math.abs((p.x-s.width*.5)/3.15)**2+Math.abs((p.z+3.3)/.47)**2<1.00001);
  }
 }
 dispose();
});


test('boat paddle wheels stay attached to their hulls throughout steering and rocking',()=>{
 const {section:s,animation:a,dispose}=setup('pondbridge');
 const boats=a.group.getObjectByName('captain-boats') as T.InstancedMesh,paddles=a.group.getObjectByName('boat-paddles') as T.InstancedMesh;
 for(const time of [0,.5,3,11,21]){
  a.update(time,s.start+s.length*.5,false);
  for(let i=0;i<3;i++)for(let j=0;j<2;j++){
   const expected=new T.Vector3(-.28,.13,(j?1:-1)*.54).applyMatrix4(pose(boats,i));
   assert.ok(expected.distanceTo(origin(pose(paddles,i*2+j)))<1e-5);
  }
 }
 dispose();
});
