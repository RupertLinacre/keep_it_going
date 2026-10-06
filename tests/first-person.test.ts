import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { TrainChaseCameraRig, firstPersonBlend, firstPersonProjection, FIRST_PERSON_FOV } from '../src/games/first-person-camera';
import { createMiniSection } from '../src/games/mini-track';
import { POWER_DURATION,powerPhysics } from '../src/games/ride-powerups';
import { validRideState } from '../src/multiplayer/protocol';
import { snapshotRide } from '../src/multiplayer/ghost';
import { Mini } from '../src/games/mini';
import type { Host } from '../src/types';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const host:Host={difficulty:'easy',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
class Headless extends Mini { setup() {} }

test('train chase is a timed camera-only power, including in multiplayer snapshots',()=>{
 const g=new Headless(host,42,{remixMode:true,multiplayer:true,christmas:false});
 g.powerups!.activate('firstperson',g.physics,g.carriages);
 assert.deepEqual(powerPhysics('firstperson','easy'),powerPhysics(undefined,'easy'));
 const snapshot=snapshotRide(g,1);assert.ok(validRideState(snapshot));assert.equal(snapshot.power!.active,'firstperson');
 g.powerups!.update(20,g.track,g.physics,g.carriages);assert.equal(g.powerups!.active,undefined);
 const demo=new Headless(host,42,{remixMode:true,firstPersonDemo:true,christmas:false});
 assert.equal(demo.powerups!.active,'firstperson');assert.equal(demo.powerups!.remaining,POWER_DURATION);
});

test('boarding and leaving ease continuously and are independent of speed or device size',()=>{
 const blend=(age:number)=>firstPersonBlend({active:'firstperson',age,remaining:20-age});
 near(blend(0),0);near(blend(1.8),1);near(blend(18.2),1);near(blend(20),0);
 near(blend(.9),.5);near(blend(19.1),.5);
 assert.equal(firstPersonBlend({active:'wind',age:10,remaining:10}),0);
});

test('the hybrid lens matches the original view at zero and a perspective camera at one',()=>{
 for(const aspect of [.46,1.7,3]){
  const ortho=new T.OrthographicCamera(-20*aspect,20*aspect,20,-20,.12,420);
  const perspective=new T.PerspectiveCamera(FIRST_PERSON_FOV,aspect,.12,420);
  for(const [blend,expected] of [[0,ortho],[1,perspective]] as const){
   const matrix=firstPersonProjection(new T.Matrix4(),blend,40,aspect,60,.12,420);
   for(const p of [new T.Vector3(1,2,-10),new T.Vector3(-3,4,-30),new T.Vector3(0,0,-.12),new T.Vector3(0,0,-420)]){
    const a=p.clone().applyMatrix4(matrix),b=p.clone().applyMatrix4(expected.projectionMatrix);
    near(a.x,b.x);near(a.y,b.y);near(a.z,b.z);
   }
  }
  for(let blend=0;blend<=1;blend+=.05){
   const matrix=firstPersonProjection(new T.Matrix4(),blend,40,aspect,60,.12,420);
   assert.ok(matrix.clone().invert().elements.every(Number.isFinite));
   near(new T.Vector3(0,0,-.12).applyMatrix4(matrix).z,-1);
   near(new T.Vector3(0,0,-420).applyMatrix4(matrix).z,1);
  }
 }
});

test('the chase eye stays above the railway behind the whole train through bends and loops',()=>{
 const rig=new TrainChaseCameraRig();
 for(const kind of ['hill','verticalhill','loop','corkscrew','ascendinghelix','noninvertingloop','chimneyhouse'] as const){
  const s=createMiniSection(kind,0,new T.Vector3(10000,4,0),0,()=>.5);
  for(let i=0;i<=100;i++){
   const distance=s.length*i/100, f=s.sample(distance),behind=s.sample(Math.max(0,distance-30));
   rig.update(f,behind,1/60);
   assert.ok(rig.eye.toArray().every(Number.isFinite));assert.ok(rig.orientation.toArray().every(Number.isFinite));
   near(rig.eye.y-behind.position.y,8);near(rig.eye.x,behind.position.x);near(rig.eye.z,behind.position.z);
   near(rig.orientation.length(),1);
  }
 }
});
