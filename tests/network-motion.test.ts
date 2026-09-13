import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { OpponentGhost, snapshotRide } from "../src/multiplayer/ghost.ts";
import { groundBounds, RaceSpacing } from "../src/games/mini-world.ts";
import { MiniTrack } from "../src/games/mini-track.ts";
import { Mini } from "../src/games/mini.ts";
import type { Host } from "../src/types.ts";
import type { RideState } from "../src/multiplayer/protocol.ts";

const snapshot = (time: number, seq: number): RideState => ({
  time, seq, distance: time * 30, speed: 30, correct: 0, ended: false,
  bodies: [{ id: "coach-0", color: 0, cargo: 0, cargoAge: 1, position: [time*30,4,0], rotation: [0,0,0,1], velocity: [30,0,0] }],
  parcels: [], links: [], impacts: [],
});

test("opponent motion stays at display rate under jitter, bursts and out-of-order delivery", () => {
  const ghost = new OpponentGhost();
  const packets = Array.from({length:120}, (_,i) => ({ state: snapshot(i/12,i), at: i*1000/12 + [35,100,50,140,40,110][i%6] })).sort((a,b)=>a.at-b.at);
  let delivered=0, previous=0; const steps:number[]=[];
  for(let f=0;f<600;f++) {
    const now=f*1000/60;
    while(delivered<packets.length && packets[delivered].at<=now) { const p=packets[delivered++]; ghost.push(p.state,p.at); }
    const x=ghost.sample(now)?.bodies[0].position[0];
    if(x===undefined)continue;
    if(f>120)steps.push(x-previous);
    previous=x;
  }
  const min=Math.min(...steps),max=Math.max(...steps);
  assert.ok(min>.4 && max<.6, `30 m/s should move ~0.5 m each display frame, got ${min}…${max}`);
});

test("prediction is bounded, a stop is authoritative and pause freezes presentation", () => {
  const ghost = new OpponentGhost();
  ghost.push(snapshot(0,0),0); ghost.push(snapshot(.1,1),100);
  for(let f=0;f<300;f++)ghost.sample(f*1000/60);
  assert.ok(ghost.sample(5000)!.bodies[0].position[0] <= 9.0001, "Never project more than 200ms ahead");
  ghost.push({...snapshot(5,2), speed:0, ended:true},5000);
  for(let f=300;f<380;f++)ghost.sample(f*1000/60);
  assert.ok(Math.abs(ghost.sample(6400)!.bodies[0].position[0]-150)<1e-4);
  ghost.setPaused(true,6400);
  const paused=ghost.sample(6400);
  assert.deepEqual(ghost.sample(30000),paused);
});

test("remote coaches use the curved rail between network samples, including inversions", () => {
  const track=new MiniTrack(42), loop=track.sections.find(s=>s.kind==='loop')!;
  const ghost=new OpponentGhost(track);
  const begin=loop.start+loop.length*.3;
  for(let i=0;i<10;i++) {
    const s=snapshot(i/12,i),distance=begin+i*2;
    const frame=track.sample(distance);
    s.distance=distance;s.speed=24;
    s.bodies[0]={...s.bodies[0],position:frame.position.toArray(),rotation:frame.rotation.toArray(),rail:{distance,speed:24,lift:1,liftSpeed:0,coupled:true}};
    ghost.push(s,i*1000/12);
  }
  for(let f=30;f<42;f++) {
    const b=ghost.sample(f*1000/60)!.bodies[0];
    const expected=track.sample(b.rail!.distance).position.add(new Vector3(0,b.rail!.lift,0));
    assert.ok(new Vector3(...b.position).distanceTo(expected)<1e-8);
  }
});

test("parcel identities survive removal of another flying object", () => {
  class Headless extends Mini { setup() {} }
  const host:Host={difficulty:'normal',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
  const game=new Headless(host,42);
  game.carriages.coaches[1].cargo=4;
  for(let f=0;f<5000 && game.carriages.parcels.length<2;f++) {
    if(f%100===0)game.physics.impulse();
    game.update(1/60);
  }
  assert.ok(game.carriages.parcels.length>=2);
  const before=snapshotRide(game,1).parcels;
  game.carriages.parcels.shift();
  const after=snapshotRide(game,2).parcels;
  assert.equal(after[0].id,before[1].id);
});

test("ground covers large elements and both lanes, while spacing never snaps inward", () => {
  for(const seed of [1,18,42]) {
    const track=new MiniTrack(seed),spacing=new RaceSpacing();
    let previous=spacing.update(track,1/60);
    for(let distance=track.startDistance;distance<16000;distance+=100) {
      track.ensure(distance);
      const offset=spacing.update(track,1/60);
      assert.ok(offset>=previous);
      // Every expansion is eased rather than applied as a layout jump.
      assert.ok(offset-previous<=6/60+1e-8, "Spacing moves by at most 10 cm per display frame");
      previous=offset;
      const earth=groundBounds(track,offset,track.sample(distance).position,120,2);
      for(const section of track.sections) for(const frame of section.frames.filter((_,i)=>i%60===0)) for(const mirror of [1,-1]) {
        const p=new Vector3(frame.position.x,0,(frame.position.z+offset)*mirror);
        assert.ok(p.x>=earth.min.x && p.x<=earth.max.x && p.z>=earth.min.z && p.z<=earth.max.z);
      }
    }
  }
});

test("multiple render consumers cannot wind the opponent clock backwards", () => {
  const a=new OpponentGhost(),b=new OpponentGhost();
  for(let frame=0;frame<300;frame++) {
    const now=frame*1000/60;
    if(frame%5===0){const s=snapshot(now/1000,frame);a.push(s,now);b.push(s,now);}
    const expected=a.sample(now);
    b.sample(now); b.sample(now-.5);
    assert.deepEqual(b.sample(now),expected);
  }
});

test("race lookahead opens a clear aisle before fast riders reach giant elements", () => {
  for(const seed of [1,18,42]) {
    const track=new MiniTrack(seed),spacing=new RaceSpacing();
    for(let distance=track.startDistance;distance<20000;distance+=3) {
      // 100 m/s with the same fourteen-second planning horizon as the game.
      track.ensure(distance,1400);
      const offset=spacing.update(track,.03);
      for(const ahead of [0,60]) assert.ok(track.sample(distance+ahead).position.z+offset>=7,
        `Seed ${seed}: clear aisle at ${distance+ahead} m`);
    }
  }
});
