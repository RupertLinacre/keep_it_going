import test from 'node:test';
import assert from 'node:assert/strict';
import { StrengthTowerMotion } from '../src/games/strength-tower-motion';
import { MiniPhysics } from '../src/games/mini-physics';
import { rideResistance } from '../src/difficulty';
import { towerFrame } from '../src/games/strength-tower-rail';
import { Vector3 } from 'three';
function ride(fps:number,answers=false){const m=new StrengthTowerMotion();let tick=0;while(m.phase!=='done'&&tick<fps*60){if(answers&&tick%fps===0)m.answer();m.update(1/fps);tick++;}return m;}
test('a tower stall celebrates and returns through the exit without ending a ride',()=>{const m=ride(60);assert.equal(m.phase,'done');assert.ok(m.peak>20&&m.peak<110);assert.ok(m.exitSpeed>0);});
test('answers raise the peak; descent answers bank exit speed',()=>{const normal=ride(60),boosted=ride(60,true);assert.ok(boosted.peak>normal.peak);assert.ok(boosted.exitSpeed>normal.exitSpeed);assert.equal(boosted.banked,18);});
test('tower peak remains stable across frame rates',()=>{assert.ok(Math.abs(ride(30).peak-ride(144).peak)<.4);for(const fps of [20,30,60,144]){const m=ride(fps,true);assert.equal(m.phase,'done');assert.ok(m.peak>0);}});
test('answering at the peak cannot restart the climb or trap the train',()=>{const m=new StrengthTowerMotion();while(m.phase!=='celebrate')m.update(1/60);const peak=m.peak;for(let i=0;i<1200;i++){m.answer();m.update(1/60);}assert.equal(m.phase,'done');assert.equal(m.peak,peak);});

test('height is uncapped and successive answers give diminishing climbing boosts',()=>{
 const m=new StrengthTowerMotion();const start=m.speed;m.answer();const first=m.speed-start;const before=m.speed;m.answer();assert.ok(m.speed-before<first);
 for(let i=0;i<1200;i++){if(i%6===0)m.answer();m.update(1/60);}
 assert.ok(m.peak>110);assert.equal(m.phase,'climb');
});

function highDrop(physics={}) {
 const m=new StrengthTowerMotion(26,48,87.5,{physics});
 m.phase='celebrate';m.height=m.peak=1000;m.time=2.8;m.update(1/120);
 return m;
}
test('vertical descent matches ordinary rail physics at each difficulty and is not capped at 36m/s',()=>{
 const rail={sample:(s:number)=>towerFrame(new Vector3(0,-s,0),new Vector3(0,-1,0)),slope:()=>-1,height:(s:number)=>-s};
 for(const level of ['very-easy','normal','very-hard'] as const){
  const options=rideResistance(level),m=highDrop(options),normal=new MiniPhysics(rail,{...options,initialSpeed:0,initialDistance:0});
  for(let i=0;i<480;i++){m.update(1/60);normal.update(1/60);}
  assert.ok(Math.abs(m.speed-normal.velocity)<1e-8);
  assert.ok(Math.abs(1000-m.height-normal.distance)<1e-8);
  assert.ok(m.speed>36);
 }
});
test('without resistance the descending train obeys free-fall energy instead of a scripted speed',()=>{
 const m=highDrop({drag:0,rolling:0});
 for(let i=0;i<600;i++)m.update(1/120);
 assert.ok(Math.abs(m.speed-9.81*5)<1e-8);
 assert.ok(Math.abs((1000-m.height)-.5*9.81*25)<1e-8);
});
test('a higher climb produces a faster return through the same junction',()=>{
 const descend=(peak:number)=>{const m=highDrop();m.height=m.peak=peak;m.phase='celebrate';m.time=2.8;m.update(1/120);for(let i=0;i<120*60&&m.phase!=='done';i++)m.update(1/120);assert.equal(m.phase,'done');return m.exitSpeed;};
 assert.ok(descend(300)>descend(60)+10);
});
test('answers on the exit still boost even after the saved descent bonus is full',()=>{
 const m=highDrop();m.banked=18;
 for(let i=0;i<120*60&&m.phase!=='exit';i++)m.update(1/120);
 assert.equal(m.phase,'exit');
 const before=m.speed;m.answer();assert.ok(m.speed>before);
});
