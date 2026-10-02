import test from 'node:test';
import assert from 'node:assert/strict';
import { StrengthTowerMotion } from '../src/games/strength-tower-motion';
function ride(fps:number,answers=false){const m=new StrengthTowerMotion();let tick=0;while(m.phase!=='done'&&tick<fps*60){if(answers&&tick%fps===0)m.answer();m.update(1/fps);tick++;}return m;}
test('a tower stall celebrates and returns through the exit without ending a ride',()=>{const m=ride(60);assert.equal(m.phase,'done');assert.ok(m.peak>20&&m.peak<110);assert.ok(m.exitSpeed>=28);});
test('answers raise the peak; descent answers bank exit speed',()=>{const normal=ride(60),boosted=ride(60,true);assert.ok(boosted.peak>normal.peak);assert.ok(boosted.peak>normal.peak);assert.equal(boosted.exitSpeed,46);});
test('tower peak remains stable across frame rates',()=>{assert.ok(Math.abs(ride(30).peak-ride(144).peak)<.4);for(const fps of [20,30,60,144]){const m=ride(fps,true);assert.equal(m.phase,'done');assert.ok(m.peak>0);}});
test('answering at the peak cannot restart the climb or trap the train',()=>{const m=new StrengthTowerMotion();while(m.phase!=='celebrate')m.update(1/60);const peak=m.peak;for(let i=0;i<1200;i++){m.answer();m.update(1/60);}assert.equal(m.phase,'done');assert.equal(m.peak,peak);});

test('height is uncapped and successive answers give diminishing climbing boosts',()=>{
 const m=new StrengthTowerMotion();const start=m.speed;m.answer();const first=m.speed-start;const before=m.speed;m.answer();assert.ok(m.speed-before<first);
 for(let i=0;i<1200;i++){if(i%6===0)m.answer();m.update(1/60);}
 assert.ok(m.peak>110);assert.equal(m.phase,'climb');
});
