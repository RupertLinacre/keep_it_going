import { HeightTrack } from '../src/games/height-track';
import { snapshotRide } from '../src/multiplayer/ghost';
import { MiniCarriages } from '../src/games/mini-carriages';
import type { Mini } from '../src/games/mini';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniTrack } from '../src/games/mini-track';
import { MiniPhysics } from '../src/games/mini-physics';
import { CHIMNEY } from '../src/games/chimney-jump';
import { createChristmasPiece } from '../src/games/attractions/christmas-pieces';
import { FairgroundLights } from '../src/games/world-lighting';

function ride(speed:number) {
 const track=new MiniTrack(42,{generative:true,previewPiece:'chimneyhouse'}),s=track.sections.find(s=>s.kind==='chimneyhouse')!;
 const pause=s.distanceAtX(s.origin.x+s.width*CHIMNEY.pause);
 const physics=new MiniPhysics(track,{initialDistance:pause-.5,initialSpeed:speed,drag:0,rolling:0});
 return {track,s,pause,physics};
}
test('chimney waits inside, launches once, and every entry speed gives a safe, progressively higher flight',()=>{
 let previous=0;
 for(const speed of [8,20,35,55]){
  const {track,s,pause,physics:p}=ride(speed);
  for(let i=0;i<500&&!p.chimneyPause;i++)p.update(1/120);
  assert.ok(p.chimneyPause);assert.ok(Math.abs(p.distance-pause)<1e-6);
  const start=p.time;
  for(let i=0;i<50;i++){p.update(1/120);assert.equal(p.distance,pause);assert.ok(!p.held&&!p.flight);}
  for(let i=0;i<100&&!p.flight;i++)p.update(1/120);
  assert.ok(p.flight);assert.ok(p.time-start>=CHIMNEY.delay-1/120);
  assert.ok(p.flight.position.distanceTo(s.sample(s.takeoff).position)<.01);
  let peak=p.flight.position.y;
  for(let i=0;i<3600&&p.flight&&!p.crashed;i++){track.ensure(p.distance,400);p.update(1/120);peak=Math.max(peak,p.sample(p.distance).position.y);}
  assert.ok(!p.crashed,`safe landing at ${speed} m/s`);assert.equal(p.jumps,1);
  assert.ok(peak>previous+2,`more entry speed means more height: ${peak} > ${previous}`);previous=peak;
  const tail=p.sample(p.distance-8);assert.ok(tail.position.toArray().every(Number.isFinite));
 }
});
test('a correct-answer boost during the delivery pause adds launch energy; relocation cancels the pause',()=>{
 const {physics:p}=ride(20);
 for(let i=0;i<500&&!p.chimneyPause;i++)p.update(1/120);
 const before=p.velocity;p.impulse();assert.ok(p.velocity>before);
 p.relocate(p.distance-20,10);assert.ok(!p.chimneyPause&&!p.flight);
});
test('the chimney has an actual empty rail gap and smooth, upright entrance/exit frames',()=>{
 const {s}=ride(30);
 for(let d=s.start;d<s.end;d+=.2){
  const f=s.sample(d);assert.ok(f.position.toArray().every(Number.isFinite));
  if(d>s.takeoff+.1&&f.position.x<s.landingX-.1)assert.equal(s.hasRail(d),false);
 }
 for(const d of [s.start,s.end]){const f=s.sample(d);assert.ok(f.tangent.x>.999&&f.up.y>.999);}
});
test('house sparks use a fixed batch, launch once, freeze on pause and release their geometry/materials',()=>{
 const {s}=ride(30),material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 const piece=createChristmasPiece(s,material,lights)!,burst=piece.group.getObjectByName('chimney-magic-starburst') as T.Mesh;
 const shader=burst.material as T.ShaderMaterial;
 assert.equal((burst.geometry as T.InstancedBufferGeometry).instanceCount,320);
 piece.update(0,s.start,false);piece.update(1,s.takeoff-.1,false);assert.equal(burst.visible,false);
 piece.update(2,s.takeoff+.1,false);assert.equal(burst.visible,true);assert.equal(shader.uniforms.age.value,0);
 piece.update(2.5,s.takeoff+10,false);const age=shader.uniforms.age.value;
 piece.update(2.5,s.takeoff+10,false);assert.equal(shader.uniforms.age.value,age);
 piece.update(6,s.end,false);assert.equal(burst.visible,false);
 piece.update(0,s.start,false);assert.equal(burst.visible,false);
 let draws=0,triangles=0;piece.group.traverse(o=>{assert.ok(!(o instanceof T.Light));if(o instanceof T.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o.geometry instanceof T.InstancedBufferGeometry?o.geometry.instanceCount:1);}});
 assert.ok(draws<=8&&triangles<15000,`${draws} draws, ${triangles} triangles`);
 let disposed=0;burst.geometry.addEventListener('dispose',()=>disposed++);shader.addEventListener('dispose',()=>disposed++);
 piece.dispose();assert.equal(disposed,2);material.dispose();lights.dispose();
});


test('ten sleighs remain coupled by physical spacing from the lip through the entire descent',()=>{
 for(const speed of [8,18,45,55]){
  const {physics:p,track}=ride(speed);
  for(let i=0;i<3000&&!p.flight;i++)p.update(1/120);
  for(let i=0;i<2400&&p.flight;i++){
   track.ensure(p.distance,400);p.update(1/120);
   for(let j=1;j<10;j++){
    const a=p.sample(p.distance-(j-1)*2.4),b=p.sample(p.distance-j*2.4);
    assert.ok(a.position.distanceTo(b.position)<2.48,`${speed}m/s coach ${j} spacing is ${a.position.distanceTo(b.position)}`);
   }
  }
 }
});


test('opponent snapshots hold still during the delivery wait without predicting into the house',()=>{
 const {track,physics}=ride(30);
 for(let i=0;i<1000&&!physics.chimneyPause;i++)physics.update(1/120);
 const carriages=new MiniCarriages(track,9.81);carriages.sample=d=>physics.sample(d);
 const state=snapshotRide({physics,track,carriages,correct:0,elapsed:physics.time,ended:false} as unknown as Mini,1);
 assert.equal(state.speed,0);assert.equal(state.ended,false);
 for(const body of state.bodies){assert.equal(body.velocity,undefined);assert.equal(body.rail,undefined);}
});


test('chimney launches from its lifted mouth and still lands with directional gravity powers',()=>{
 for(const options of [{gravity:9.81},{gravity:-9.81,uphillGravity:-19.62,downhillGravity:9.81},{gravity:9.81,uphillGravity:9.81,downhillGravity:29.43}]){
  const track=new HeightTrack(42,{generative:true,previewPiece:'chimneyhouse'}),s=track.sections.find(s=>s.kind==='chimneyhouse')!;
  const pause=s.distanceAtX(s.origin.x+s.width*CHIMNEY.pause);
  track.raise(pause);track.advance(1);
  const p=new MiniPhysics(track,{initialDistance:pause-.5,initialSpeed:25,rolling:0,drag:0,...options});
  for(let i=0;i<3000&&!p.flight;i++)p.update(1/120);
  assert.ok(p.flight);assert.ok(p.flight.position.distanceTo(s.sample(s.takeoff).position)<.01);
  for(let i=0;i<3600&&p.flight&&!p.crashed;i++){track.ensure(p.distance,400);p.update(1/120);}
  assert.ok(!p.crashed);assert.equal(p.jumps,1);
 }
});
