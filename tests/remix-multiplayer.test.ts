import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { Mini } from '../src/games/mini.ts';
import { MiniTrack } from '../src/games/mini-track.ts';
import { HeightTrack } from '../src/games/height-track.ts';
import { RACE_POWER_KINDS, powerPhysics } from '../src/games/ride-powerups.ts';
import { snapshotRide, OpponentGhost } from '../src/multiplayer/ghost.ts';
import { validRideState, parseWire, type RideState } from '../src/multiplayer/protocol.ts';
import type { Host } from '../src/types.ts';

class Headless extends Mini { setup() {} }
const host:Host={difficulty:'normal',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
const race=(seed=42)=>new Headless(host,seed,{remixMode:true,multiplayer:true});

test('Remix races share generated geometry despite different simulation pace and lookahead',()=>{
  const a=race(),b=race();assert.ok(!(a.track instanceof HeightTrack));
  assert.ok(a.track.options.generative);assert.equal(a.track.startDistance,b.track.startDistance);
  for(let at=a.track.startDistance;at<5000;at+=83){
    a.track.ensure(at,1400);b.track.ensure(at,300);
    for(const section of b.track.sections){const other=a.track.sections.find(s=>s.id===section.id);if(other)assert.deepEqual(section.frames.map(f=>f.position.toArray()),other.frames.map(f=>f.position.toArray()));}
  }
});

test('race power bags contain only the five permitted effects, reproducibly, and cannot activate track mutations',()=>{
  const sequence=(seed:number)=>{
    const g=race(seed),p=g.powerups!,out:string[]=[];
    for(const forbidden of ['lift','tilt'] as const){p.activate(forbidden,g.physics,g.carriages);assert.equal(p.active,undefined);assert.equal(g.liftingAnswers,false);assert.equal(g.physics.options.worldTilt,0);}
    for(let i=0;i<15;i++){
      p.update(3,g.track,g.physics,g.carriages);assert.ok(p.gate);out.push(p.gate.kind);
      g.physics.distance=p.gate.distance;p.update(0,g.track,g.physics,g.carriages);
      assert.ok(RACE_POWER_KINDS.includes(p.active as typeof RACE_POWER_KINDS[number]));p.update(20,g.track,g.physics,g.carriages);
    }
    assert.deepEqual([...new Set(out.slice(0,5))].sort(),[...RACE_POWER_KINDS].sort());return out;
  };
  assert.deepEqual(sequence(42),sequence(42));assert.notDeepEqual(sequence(42),sequence(18));
  const solo=new Headless(host,42,{remixMode:true});solo.powerups!.activate('lift',solo.physics,solo.carriages);assert.ok(solo.liftingAnswers);assert.ok(solo.track instanceof HeightTrack);
});

test('network snapshots carry eight-box wagons, TNT and stable large splash IDs',()=>{
  const g=race();g.powerups!.activate('cargo',g.physics,g.carriages);
  const f=g.track.sample(g.physics.distance);
  for(let i=0;i<2;i++)g.carriages.explosions.push({position:f.position.clone(),age:0,colorIndex:0,water:true,flood:{rotation:f.rotation.clone(),strength:1.6},particles:Array.from({length:56},()=>({position:f.position.clone(),velocity:new Vector3(),size:.3}))});
  g.carriages.parcels.push({position:f.position.clone(),rotation:new Quaternion(),velocity:new Vector3(),angularVelocity:new Vector3(),age:0,groundedFor:0,bounces:0,dynamite:true});
  const first=snapshotRide(g,1);assert.ok(validRideState(first));assert.equal(first.bodies[1].cargo,8);assert.ok(first.bodies[1].bombs);assert.equal(first.parcels[0].dynamite,true);assert.equal(first.impacts[0].particles.length,56);
  assert.notEqual(first.impacts[0].id,first.impacts[1].id);
  g.carriages.explosions.shift();const second=snapshotRide(g,2);assert.equal(second.impacts[0].id,first.impacts[1].id);
  const bad=structuredClone(first);bad.power!.active='lift' as any;assert.equal(validRideState(bad),false);
  bad.power!.active='tilt' as any;assert.equal(validRideState(bad),false);
  bad.power!.active='cargo';bad.impacts[0].particles.push(bad.impacts[0].particles[0]);assert.equal(validRideState(bad),false);
  assert.equal(parseWire({kind:'prepare',round:{id:'1',seed:42,questionSeed:1,tables:[2],difficulty:'normal',guestDifficulty:'easy',mode:'bad'}}),undefined);
});

test('opponent prediction uses each rider’s power physics and flooded-track resistance',()=>{
  const g=race(),track=g.track;track.ensure(track.startDistance,2000);const pool=track.sections.find(s=>s.kind==='splash')!;
  const distances=[track.startDistance+20,(pool.start+pool.end)/2];
  for(const distance of distances)for(const kind of RACE_POWER_KINDS){
    g.physics.distance=distance;g.physics.velocity=25;g.powerups!.activate(kind,g.physics,g.carriages);
    const s=snapshotRide(g,1);s.distance=distance;s.bodies=s.bodies.slice(0,1);s.bodies[0].rail={distance,speed:25,lift:0,liftSpeed:0,coupled:true};
    const ghost=new OpponentGhost(track),predicted=(ghost as any).predict(s,.12) as RideState;
    const dt=.2*(1-Math.exp(-.12/.2)),options=powerPhysics(kind,'normal');
    const drag=options.drag+.008*Math.min(1,track.waterDepth(distance)/.55);
    const slope=track.slope(distance),gravity=slope>=0?options.uphillGravity:options.downhillGravity;
    const acceleration=options.tailwind-gravity*slope-drag*625-options.rolling;
    assert.ok(Math.abs(predicted.bodies[0].rail!.speed-(25+acceleration*dt))<.3,`${kind} prediction respects rail forces`);
    assert.ok(predicted.power!.remaining<20);
  }
});

test('reverse-gravity parcels rise during bounded opponent prediction while guided water-jump coaches fall',()=>{
  const g=race();g.powerups!.activate('reverse',g.physics,g.carriages);
  const s=snapshotRide(g,1),body=s.bodies[0];body.rail=undefined;body.position=[0,20,0];body.velocity=[0,0,0];
  s.parcels=[{id:'parcel-1',position:[0,20,0],rotation:[0,0,0,1],velocity:[0,0,0],dynamite:true}];
  const predicted=(new OpponentGhost(g.track) as any).predict(s,.15) as RideState;
  assert.ok(predicted.parcels[0].position[1]>20);assert.ok(predicted.bodies[0].position[1]<20);assert.equal(predicted.parcels[0].dynamite,true);
});

test('snapshots remain valid when the binary transport turns explicit undefined values into null',()=>{
  const games=[race(),new Headless(host,42)];
  for(const game of games){
    const packet=snapshotRide(game,1);
    const transported=JSON.parse(JSON.stringify(packet,(_key,value)=>value===undefined?null:value));
    assert.ok(validRideState(transported));
    if(game.powerups){
      game.powerups.activate('wind',game.physics,game.carriages);
      const active=JSON.parse(JSON.stringify(snapshotRide(game,2),(_key,value)=>value===undefined?null:value));
      assert.ok(validRideState(active));
    }
  }
});
