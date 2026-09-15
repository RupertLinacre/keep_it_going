import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Mini } from '../src/games/mini';
import { MiniTrack, MiniSection } from '../src/games/mini-track';
import { HeightTrack } from '../src/games/height-track';
import { RaceSpacing, sectionBounds } from '../src/games/mini-world';
import { snapshotRide, OpponentGhost } from '../src/multiplayer/ghost';
import { validRideState } from '../src/multiplayer/protocol';
import { iceDeployment, ICICLES } from '../src/games/ice-icicles';
import type { Host } from '../src/types';
class Headless extends Mini { setup() {} }
const host:Host={difficulty:'easy',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
const game=(race=true)=>new Headless(host,42,{remixMode:true,multiplayer:race,tables:[7]});
const answer=(g:Mini)=>{for(const digit of String(g.a*g.b))g.key(digit)};

test('four new correct answers earn each gate, including the first; wrong entries and old answers do not count',()=>{
 for(const multiplayer of [false,true]){
  const g=game(multiplayer),p=g.powerups!;
  const update=(dt=0)=>p.update(dt,g.track,g.physics,g.carriages);
  update(100);assert.equal(p.gate,undefined);
  g.key('1');g.key('Enter');g.key('Escape');assert.equal(p.answers,0);
  for(let i=0;i<3;i++){answer(g);update();assert.equal(p.gate,undefined)}
  answer(g);update();assert.ok(p.gate);assert.equal(p.answers,4);
  g.physics.distance=p.gate.distance;update();assert.ok(p.active);assert.equal(p.answers,0);
  for(let i=0;i<3;i++)answer(g);
  update(20);update(3);assert.equal(p.gate,undefined,'Three answers cannot earn a later gate');
  answer(g);update();assert.ok(p.gate);
  g.physics.distance=p.gate.distance;update();assert.equal(p.answers,0);
  for(let i=0;i<6;i++)answer(g);
  update(10);assert.equal(p.gate,undefined,'An earned gate waits for the existing effect to expire');
  update(10);update(3);assert.ok(p.gate);g.physics.distance=p.gate.distance;update();
  update(20);update(3);assert.equal(p.gate,undefined,'Extra answers do not carry across collections');
 }
});

test('race courses exclude pretzel knots, return to the centre line, and keep the mirrored aisle clear',()=>{
 for(const seed of [1,18,42,73]){
  const t=new MiniTrack(seed,{generative:true,multiplayer:true}),spacing=new RaceSpacing();
  for(let at=t.startDistance;at<18000;at+=50){
   t.ensure(at,1400);const offset=spacing.update(t,.5);
   for(const s of t.sections){
    assert.notEqual(s.kind,'pretzelknot');
    assert.ok(Math.abs(s.frames.at(-1)!.position.z)<=2.20001,'Every section rejoins the usual race line');
    if(s.kind==='cobraroll')assert.ok(sectionBounds(s).max.z<24);
   }
   assert.ok(t.sample(at).position.z+offset>=6.5);
  }
 }
});

test('a wide old section cannot leave race tracks permanently spread apart',()=>{
 const track=new MiniTrack(42),spacing=new RaceSpacing();
 track.sections.splice(0,track.sections.length,new MiniSection(4,'station',0,new Vector3(0,4,-60),80,0,0,1));
 const wide=spacing.update(track,1/60);assert.ok(wide>65);
 track.sections.splice(0,1,new MiniSection(5,'station',80,new Vector3(80,4,0),80,0,0,1));
 let previous=wide;
 for(let i=0;i<2400;i++){const next=spacing.update(track,1/60);assert.ok(previous-next<=2/60+1e-8);previous=next;}
 assert.ok(Math.abs(spacing.offset-14)<.01);
});

test('Sky lift is independent for both racers and snapshots place every coach on its own raised rail',()=>{
 const a=game(),b=game(),remote=new OpponentGhost(b.track);
 assert.notEqual(remote.track,b.track);
 a.powerups!.activate('lift',a.physics,a.carriages);
 answer(a);answer(a);
 const own=a.track as HeightTrack,other=b.track as HeightTrack;
 own.advance(.5);a.elapsed=.5;
 assert.equal(own.elevation(a.physics.distance),30);assert.equal(other.elevation(b.physics.distance),0);
 const s=snapshotRide(a,1);assert.ok(validRideState(s));remote.push(s,500);const shown=remote.sample(500)!;
 const track=remote.track as HeightTrack;
 assert.equal(track.elevation(s.distance),30);assert.equal(other.elevation(s.distance),0);
 for(const body of shown.bodies){assert.ok(body.rail);const f=track.sample(body.rail.distance);f.position.y+=body.rail.lift;assert.ok(f.position.distanceTo(new Vector3(...body.position))<.01)}
 own.advance(.5);a.elapsed=1;remote.push(snapshotRide(a,2),1000);remote.sample(1300);
 assert.ok(track.elevation(s.distance)>=30);assert.equal(other.elevation(s.distance),0);
 remote.setPaused(true,1300);const height=track.elevation(s.distance);remote.sample(5000);assert.equal(track.elevation(s.distance),height);
});

test('remote lift replay preserves geometry through new sections and retains older raised rail behind a leading racer',()=>{
 const source=new HeightTrack(18,{generative:true,multiplayer:true});source.ensure(0,6000);
 const target=source.sections.find(s=>s.start>4600)!;
 source.raise(target.start+1);source.advance(1);
 const state=source.snapshot();
 const remote=new HeightTrack(18,{generative:true,multiplayer:true});remote.receive(state);
 remote.ensure(4000,2000);remote.receive(state);
 for(const at of [target.start-40,target.start+2,target.end,target.end+40])assert.ok(Math.abs(source.height(at)-remote.height(at))<.001);
 remote.receive({since:target.end+100,advancing:false,lifts:[]});
 assert.equal(remote.elevation(target.start+2),30,'Keep a leading rider’s historical lift while it is still visible');
 for(let i=1;i<remote.sections.length;i++){
  const a=remote.sections[i-1],b=remote.sections[i];assert.ok(a.sample(a.end).position.distanceTo(b.sample(b.start).position)<.001);
 }
});

test('invalid lift payloads are rejected and ice deployment is bounded to the active effect',()=>{
 const g=game();g.powerups!.activate('lift',g.physics,g.carriages);answer(g);(g.track as HeightTrack).advance(.3);
 const s=snapshotRide(g,1);assert.ok(validRideState(s));
 for(const mutate of [(p:any)=>p.heights.lifts[0].target=NaN,(p:any)=>p.heights.lifts[0].age=2,
  (p:any)=>p.heights.lifts.push(p.heights.lifts[0]),(p:any)=>p.power.answers=5]){
  const packet=structuredClone(s);mutate(packet);assert.equal(validRideState(packet),false);
 }
 assert.equal(iceDeployment(),0);assert.equal(iceDeployment({active:'lift',age:1,remaining:20}),0);
 assert.equal(iceDeployment({active:'ice',age:0,remaining:20}),0);
 assert.equal(iceDeployment({active:'ice',age:1,remaining:19}),1);
 assert.equal(iceDeployment({active:'ice',age:20,remaining:0}),0);
 assert.ok(ICICLES.every(i=>i.length>.25&&i.length<.8));
});

test('moving Sky lift playback remains smooth through delayed packets and repeated answers',()=>{
 const a=game(),b=game(),ghost=new OpponentGhost(b.track),track=a.track as HeightTrack;
 a.powerups!.activate('lift',a.physics,a.carriages);
 let previous:number|undefined,seq=0;const packets:{at:number,state:ReturnType<typeof snapshotRide>}[]=[];
 for(let frame=0;frame<420;frame++){
  const time=frame/60;
  if(frame%90===0&&frame<300)answer(a);
  track.advance(1/60);a.elapsed=time;
  if(frame%5===0)packets.push({at:time*1000+80+(seq%3)*25,state:snapshotRide(a,++seq)});
  for(let i=0;i<packets.length;)if(packets[i].at<=time*1000){const p=packets.splice(i,1)[0];ghost.push(p.state,p.at)}else i++;
  const state=ghost.sample(time*1000);if(!state)continue;
  const body=state.bodies[0],remote=ghost.track as HeightTrack;
  assert.ok(Math.abs(body.position[1]-remote.height(body.rail!.distance)-body.rail!.lift)<.001);
  if(previous!==undefined)assert.ok(Math.abs(body.position[1]-previous)<1.5,'No packet-sized height jump');
  previous=body.position[1];
 }
 assert.equal((b.track as HeightTrack).elevation(b.physics.distance),0);
 assert.ok((ghost.track as HeightTrack).elevation(a.physics.distance)>119);
});
