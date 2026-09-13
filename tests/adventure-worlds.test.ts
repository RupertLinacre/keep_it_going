import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { adventureAt, WORLD_LAP, WORLDS } from '../src/games/adventure-worlds';
import { MiniTrack, createMiniSection } from '../src/games/mini-track';
import { MiniPhysics } from '../src/games/mini-physics';
import { seededRandom } from '../src/games/mini-rail';

test('the four worlds advance by distance, repeat as a new adventure and retain their order',()=>{
 assert.deepEqual(WORLDS.map(w=>w.id),['meadow','mountain','night','halloween']);
 for(const [i,w]of WORLDS.entries()) {
  assert.equal(adventureAt(w.start).index,i);assert.equal(adventureAt(w.end-.001).index,i);
  assert.equal(adventureAt(w.start+WORLD_LAP).stage,4+i);
 }
 assert.equal(adventureAt(-200).world.id,'meadow');
});
test('the director introduces each world signature at its next section and bounds late track sizes',()=>{
 for(const seed of [1,42,73,812]) {
  const track=new MiniTrack(seed,{generative:true}),seen=new Set<number>();
  let lastWorld=0;
  for(let at=0;at<13000;at+=180){
   track.ensure(at);
   for(const section of track.sections){
    if(seen.has(section.id))continue;seen.add(section.id);
    const stage=adventureAt(section.start);
    if(stage.stage!==lastWorld&&stage.index>0)assert.equal(section.kind,stage.world.challenges[0]);
    lastWorld=stage.stage;
    assert.ok(section.turns<=4);assert.ok(section.frames.every(f=>Number.isFinite(f.position.y)));
    if(section.start>700)assert.ok(section.amplitude<=stage.world.maxHeight+.001,section.kind);
   }
  }
 }
});
test('world-specific rails join upright, preserve energy and contain no discontinuous frames',()=>{
 for(const kind of ['mountainpass','tunnel','lanternrun','pumpkinhop'] as const)for(const seed of [1,42,73]){
  const s=createMiniSection(kind,1200,new Vector3(0,4,0),20,seededRandom(seed),true);
  const first=s.frames[0],last=s.frames.at(-1)!;
  assert.ok(first.position.distanceTo(new Vector3(0,4,0))<1e-6);
  assert.ok(Math.abs(last.position.y-4)<1e-6&&last.tangent.x>.9999&&last.up.y>.9999);
  for(let i=1;i<s.frames.length;i++){
   const a=s.frames[i-1],b=s.frames[i];
   assert.ok(a.tangent.dot(b.tangent)>.99,`${kind} tangent`);
   assert.ok(Math.abs(b.up.dot(b.tangent))<1e-6);assert.ok(b.position.y>.1);
  }
  const p=new MiniPhysics(s,{initialDistance:s.start,initialSpeed:50,drag:0,rolling:0}),energy=p.energy;
  while(p.distance<s.end&&!p.held)p.update(1/120);
  assert.ok(!p.held);assert.ok(Math.abs(p.energy-energy)/energy<.001,`${kind} energy`);
 }
});
