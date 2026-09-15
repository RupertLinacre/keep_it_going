import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, rideResistance } from '../src/difficulty';
import { railAcceleration, MiniPhysics } from '../src/games/mini-physics';
import { powerPhysics } from '../src/games/ride-powerups';
import type { MiniRail } from '../src/games/mini-track';
const rail = (slope: number): MiniRail => ({ slope: () => slope, height: s => 10000 + slope*s, sample: () => { throw Error('Not needed'); } });
const options = (level: typeof DIFFICULTIES[number]) => ({...rideResistance(level), gravity:9.81, tailwind:0});

test('slow trains retain old resistance at every difficulty, with the same 20 m/s balance point', () => {
  for (const level of DIFFICULTIES) {
    const o = options(level), multiplier = o.drag/.0016;
    for (const v of [0,.01,.1,1,2,4,8,20]) {
      const old = multiplier*(.004*v*v+.06*Math.tanh(v*5));
      assert.ok(Math.abs(railAcceleration(rail(0),0,v,o)+old)<1e-10);
    }
  }
});
test('resistance stays continuous, positive and increasing through the transition', () => {
  let previous=0;
  for(let v=0;v<=70;v+=.01) {
    const resistance=-railAcceleration(rail(0),0,v,options('normal'));
    assert.ok(resistance>=previous-1e-10);
    assert.ok(resistance-previous < .01);
    previous=resistance;
  }
});
test('fast verticals accelerate more and converge to the higher terminal speed', () => {
  const o=options('normal');
  assert.ok(Math.abs(railAcceleration(rail(-1),0,40,o)-6.23)<1e-9);
  const p=new MiniPhysics(rail(-1),{...o,initialSpeed:20,initialDistance:0});
  for(let i=0;i<1200;i++)p.update(.1);
  assert.ok(Math.abs(p.velocity-Math.sqrt((9.81-1.02)/.0016))<.01);
});
test('Ice glide reduces all resistance by 75%, including the low-speed protection', () => {
  for(const level of DIFFICULTIES) for(const v of [2,8,14,20,40]) {
    const normal=railAcceleration(rail(0),0,v,powerPhysics(undefined,level));
    const ice=railAcceleration(rail(0),0,v,powerPhysics('ice',level));
    assert.ok(Math.abs(ice-normal*.25)<1e-10);
  }
});
