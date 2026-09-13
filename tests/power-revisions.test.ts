import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniPhysics, railAcceleration } from '../src/games/mini-physics';
import { Mini } from '../src/games/mini';
import { HeightTrack } from '../src/games/height-track';
import { skyLiftBoostEnergy } from '../src/games/height-guide';
import { powerPhysics } from '../src/games/ride-powerups';
import { weatherPoint, weatherRock } from '../src/games/powerup-weather';
import type { Host } from '../src/types';

class Headless extends Mini { setup() {} }
const host:Host={difficulty:'normal',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
test('gravity powers use the requested force in each rail direction and restore normal gravity',()=>{
  for(const [kind,up,down]of [['heavy',9.81,29.43],['reverse',-19.62,9.81],[undefined,9.81,9.81]] as const){
    const options={...powerPhysics(kind,'normal'),drag:0,rolling:0};
    for(const slope of [-1,-.4,0,.4,1]){
      const track={slope:()=>slope,waterDepth:()=>0} as any;
      assert.ok(Math.abs(railAcceleration(track,0,20,options)+(slope>=0?up:down)*slope)<1e-9);
    }
  }
  const game=new Headless(host,42,{remixMode:true});
  game.powerups!.activate('reverse',game.physics,game.carriages);
  game.powerups!.finish(game.physics,game.carriages);
  assert.equal(game.physics.options.uphillGravity,9.81);assert.equal(game.physics.options.downhillGravity,9.81);
});
test('Sky lift rescues a struggling climb, preserves height work, and never exceeds a normal boost',()=>{
  const game=new Headless(host,42,{remixMode:true}),track=game.track as HeightTrack;
  track.ensure(track.startDistance,1500);
  let at=track.startDistance;
  while(at<track.end && track.slope(at)<.3)at+=1;
  assert.ok(at<track.end);
  game.physics.distance=at;game.physics.velocity=2;game.powerups!.activate('lift',game.physics,game.carriages);
  const amount=skyLiftBoostEnergy(track,game.physics);assert.ok(amount>0&&amount<=300);
  for(const digit of String(game.a*game.b))game.key(digit);
  assert.ok(game.physics.velocity>2);assert.ok(game.physics.velocity<=Math.sqrt(4+600));
  assert.equal(track.lifts.length,1);assert.equal(track.lifts[0].target,30);
  game.physics.velocity=1000;assert.equal(skyLiftBoostEnergy(track,game.physics),0);
  game.physics.distance=track.startDistance;assert.ok(track.slope(game.physics.distance)<0);
  game.physics.velocity=2;assert.equal(skyLiftBoostEnergy(track,game.physics),0);
});
test('Sky lift supplies a partial boost when that is enough for the next crest',()=>{
  const track=new HeightTrack(42),hill=track.sections.find(s=>s.kind==='skyhill')!;
  const physics=new MiniPhysics(track,{initialDistance:hill.start+hill.length*.3,initialSpeed:2});
  // Find the edge of the coasting envelope without changing the track.
  let low=0,high=200;
  for(let i=0;i<40;i++){physics.velocity=(low+high)/2;if(skyLiftBoostEnergy(track,physics)>0)low=physics.velocity;else high=physics.velocity;}
  physics.velocity=Math.sqrt(high*high-40);
  const energy=skyLiftBoostEnergy(track,physics);assert.ok(Math.abs(energy-20)<.001);
});
test('weather and rocks stay at world coordinates while the camera and train pass them',()=>{
  for(const kind of ['reverse','heavy','wind','ice','cargo','lift'] as const){
    const a={x:10,y:10,z:10},b={x:11,y:11,z:11};
    const before=Array.from({length:120},(_,i)=>weatherPoint(i,42,kind,5,a));
    assert.deepEqual(before,Array.from({length:120},(_,i)=>weatherPoint(i,42,kind,5,b)));
    const after=Array.from({length:120},(_,i)=>weatherPoint(i,42,kind,5,{x:21,y:10,z:10}));
    const shared=after.filter(p=>before.some(q=>p.id===q.id));assert.equal(shared.length,96);
    for(const p of shared)assert.deepEqual(p,before.find(q=>p.id===q.id));
    assert.deepEqual(weatherRock(3,42,kind,5,a),weatherRock(3,42,kind,5,b));
    assert.notDeepEqual(weatherPoint(0,42,kind,5,a),weatherPoint(0,42,kind,5.1,a));
  }
});

test('Heavy metal jumps use 1g while rising and 3g while falling; gravity flip keeps its landing guide',()=>{
  const track=new HeightTrack(42);track.ensure(track.startDistance,3000);
  const jump=track.sections.find(s=>s.kind==='jump')!;assert.ok(jump);
  for(const [kind,vy,gravity]of [['heavy',10,9.81],['heavy',-10,29.43],['reverse',10,9.81]] as const){
    const physics=new MiniPhysics(track,{...powerPhysics(kind,'normal'),initialSpeed:25});
    (physics as any).startJump(jump);
    physics.flight!.position.y=100;physics.flight!.velocity.set(10,vy,0);
    physics.update(1/120);
    assert.ok(Math.abs(physics.flight!.velocity.y-(vy-gravity/120))<1e-9);
  }
});
