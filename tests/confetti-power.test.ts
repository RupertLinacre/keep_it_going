import test from 'node:test';
import assert from 'node:assert/strict';
import { Mini } from '../src/games/mini';
import { POWER_DURATION, POWER_ANSWERS, powerPhysics } from '../src/games/ride-powerups';
import { snapshotRide } from '../src/multiplayer/ghost';
import { validRideState } from '../src/multiplayer/protocol';
import type { Host } from '../src/types';
class Headless extends Mini { setup() {} }
const host:Host={difficulty:'normal',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};

test('Confetti Clouds is earned, expires after twenty seconds and replicates without altering ride physics',()=>{
 for(const multiplayer of [false,true]) {
  const g=new Headless(host,42,{remixMode:true,multiplayer}),p=g.powerups!;
  p.activate('confetti',g.physics,g.carriages);
  assert.equal(p.active,'confetti');assert.equal(p.remaining,POWER_DURATION);
  assert.deepEqual(powerPhysics('confetti','normal'),powerPhysics(undefined,'normal'));
  const snapshot=snapshotRide(g,1);assert.ok(validRideState(snapshot));assert.equal(snapshot.power!.active,'confetti');
  p.update(POWER_DURATION-.1,g.track,g.physics,g.carriages);assert.equal(p.active,'confetti');
  p.update(.1,g.track,g.physics,g.carriages);assert.equal(p.active,undefined);
  for(let i=0;i<POWER_ANSWERS-1;i++)p.answered();p.update(3,g.track,g.physics,g.carriages);assert.equal(p.gate,undefined);
  p.answered();p.update(0,g.track,g.physics,g.carriages);assert.ok(p.gate,'Next power requires four successful answers');
 }
});
