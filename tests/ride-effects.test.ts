import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3, Scene } from 'three';
import { gravityRoll, jumpRoll, rollFrame } from '../src/games/ride-roll';
import { createMiniSection, MiniTrack } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { crossedNightCrests, loopCrests, LoopFireworks } from '../src/games/loop-fireworks';
import { MiniPhysics } from '../src/games/mini-physics';
import { railGeometries, refreshRails } from '../src/games/mini-mesh';
import { Mini } from '../src/games/mini';
import type { Host } from '../src/types';
import { snapshotRide, OpponentGhost } from '../src/multiplayer/ghost';
const section=(kind:Parameters<typeof createMiniSection>[0],at=2000)=>createMiniSection(kind,at,new Vector3(100,4,2),20,seededRandom(42));

test('gravity flip rolls frames by half a turn without moving the centreline or changing tangents',()=>{
  for(const kind of ['loop','hill','corkscrew'] as const) {
    const s=section(kind);
    for(const f of s.frames.filter((_,i)=>i%100===0)) {
      const at=s.start+s.distances[s.frames.indexOf(f)],base=s.sample(at),rolled=rollFrame(s.sample(at),gravityRoll('reverse',2,18));
      assert.ok(rolled.position.distanceTo(base.position)<1e-10);
      assert.ok(rolled.tangent.dot(base.tangent)>.9999);
      assert.ok(rolled.up.dot(base.up)<-.9999);
      assert.ok(new Vector3(0,1,0).applyQuaternion(rolled.rotation).dot(rolled.up)>.9999);
    }
  }
  assert.equal(gravityRoll('reverse',0,20),0);
  assert.equal(gravityRoll('reverse',20,0),0);
  assert.equal(gravityRoll('wind',2,18),0);
  assert.ok(Math.abs(gravityRoll('reverse',.6,19.4)-Math.PI/2)<1e-10);
});
test('jump roll starts and finishes upright, with a full inverted midpoint',()=>{
  assert.equal(jumpRoll(10,10,30),0);
  assert.equal(jumpRoll(20,10,30),Math.PI);
  assert.equal(jumpRoll(30,10,30),2*Math.PI);
  assert.equal(jumpRoll(50,10,30),2*Math.PI);
  const s=section('jump',0);
  const rail=Object.assign(s,{jumpAt:(at:number)=>at>=s.takeoff?s:undefined});
  const p=new MiniPhysics(rail,{initialDistance:s.takeoff-.01,initialSpeed:35});
  p.update(1/120);assert.ok(p.flight);
  const t=.25,initial=p.flight!.position.clone(),velocity=p.flight!.velocity.clone();
  for(let i=0;i<30;i++)p.update(1/120);
  assert.ok(p.flight);
  assert.ok(Math.abs(p.flight!.position.y-(initial.y+velocity.y*t-9.81*t*t/2))<1e-8,'spin must not change ballistics');
  const frame=p.sample(p.distance);
  assert.ok(Math.abs(frame.right.dot(frame.up))<1e-8);
  assert.ok(frame.tangent.dot(p.flight!.velocity.clone().normalize())>.999);
});
test('night fireworks trigger only on crossed loop crests, not hills, daylight, or teleports',()=>{
  const night=section('midwayloop'),day=section('loop',100),hill=section('hill');
  const track={sections:[day,night,hill]} as MiniTrack;
  const peak=loopCrests(night)[0];assert.ok(peak>night.start&&peak<night.end);
  assert.equal(crossedNightCrests(track,peak-1,peak+1).length,1);
  assert.equal(crossedNightCrests(track,peak+1,peak+2).length,0);
  assert.equal(crossedNightCrests(track,undefined,peak+1).length,0);
  assert.equal(crossedNightCrests(track,peak-200,peak+1).length,0);
  assert.equal(crossedNightCrests(track,loopCrests(day)[0]-1,loopCrests(day)[0]+1).length,0);
  assert.equal(loopCrests(hill).length,0);
  const nested=section('interlockingloops');assert.ok(loopCrests(nested).length>=2);
});
test('fireworks expire, stay bounded, and respect reduced motion for both riders',()=>{
  const s=section('midwayloop'),at=loopCrests(s)[0],track={sections:[s]} as MiniTrack,fx=new LoopFireworks(new Scene());
  fx.update(track,at-1,0,100,10,at-1);
  fx.update(track,at+1,.1,100,10,at+1);
  assert.equal(fx.bursts.length,4);
  fx.update(track,at+2,.5,100,10,at+2);
  assert.ok(fx.geometry.drawRange.count>0&&fx.geometry.drawRange.count<=6*72*3);
  fx.update(track,at+2,4,100,10,at+2);
  assert.equal(fx.bursts.length,0);assert.equal(fx.geometry.drawRange.count,0);
  fx.update(track,at-1,5,100,10,undefined,undefined,true);
  fx.update(track,at+1,6,100,10,undefined,undefined,true);
  assert.equal(fx.bursts.length,0);fx.destroy();
});
test('rail shader axes stay aligned after raised geometry refresh',()=>{
  const s=section('loop'),rails=railGeometries(s,s.start,s.end);
  refreshRails(s,s.start,s.end,rails);
  for(const geometry of rails) {
    const centers=geometry.getAttribute('railCenter'),axes=geometry.getAttribute('railAxis');
    const ring=14,segments=centers.count/7-1,f=s.sample(s.start+s.length*ring/segments);
    assert.ok(new Vector3().fromBufferAttribute(centers,ring*7).distanceTo(f.position.clone().sub(s.origin))<1e-4);
    assert.ok(new Vector3().fromBufferAttribute(axes,ring*7).dot(f.tangent)>.99999);geometry.dispose();
  }
});
test('multiplayer prediction preserves the opponents inverted coach orientation',()=>{
  class Headless extends Mini {setup(){}}
  const host:Host={difficulty:'normal',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
  const g=new Headless(host,42,{remixMode:true,multiplayer:true});
  g.powerups!.activate('reverse',g.physics,g.carriages);g.powerups!.age=2;g.powerups!.remaining=18;
  const ghost=new OpponentGhost();ghost.configure(g.track,'normal');
  const state=snapshotRide(g,1);ghost.push({...state,time:2},2000);ghost.push({...state,seq:2,time:2.1,power:{...state.power!,age:2.1,remaining:17.9}},2100);
  const shown=ghost.sample(2350)!;const body=shown.bodies[0],base=g.track.sample(body.rail!.distance);
  assert.ok(new Vector3(0,1,0).applyQuaternion(new Quaternion(...body.rotation)).dot(base.up)<-.999);
});
