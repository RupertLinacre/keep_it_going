import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneryFlight } from '../src/games/scenery-flight';

function advance(body:SceneryFlight,seconds:number,gravity:number,hz=60){for(let i=0;i<seconds*hz;i++)body.update(1/hz,gravity)}
test('scenery stays grounded normally, rises under negative gravity and settles afterwards',()=>{
 const body=new SceneryFlight(2);advance(body,2,9.81);assert.equal(body.height,0);
 advance(body,2,-19.62);assert.ok(body.height>8 && body.velocity>0);
 advance(body,18,-19.62);assert.ok(body.height>16 && body.height<30);
 advance(body,10,9.81);assert.equal(body.height,0);assert.equal(body.velocity,0);
});
test('scenery flight is staggered, frame-rate stable, pause-safe and bounded during repeated flips',()=>{
 const a=new SceneryFlight(0),b=new SceneryFlight(2);advance(a,.25,-19.62);advance(b,.25,-19.62);
 assert.notEqual(a.height,b.height);
 const before=a.height;a.update(0,-19.62);assert.equal(a.height,before);
 const low=new SceneryFlight(1),high=new SceneryFlight(1);advance(low,4,-19.62,30);advance(high,4,-19.62,120);
 assert.ok(Math.abs(low.height-high.height)<.02);
 for(let i=0;i<100;i++){advance(a,.4,i%2?-19.62:29.43);assert.ok(Number.isFinite(a.height)&&a.height>=0&&a.height<30)}
});
test('each rider has independent flying sheep, pumpkins and ghosts, without moving their scenery anchors',async()=>{
 const {Scene}=await import('three'),{AdventureScene}=await import('../src/games/adventure-scene'),{MiniTrack}=await import('../src/games/mini-track');
 for(const distance of [250,3150]){
  const track=new MiniTrack(42,{generative:true});track.ensure(distance,350);
  const view=new AdventureScene(new Scene());
  for(let i=0;i<=180;i++)view.render(track,distance,0,35,i/60,distance,-19.62,9.81);
  const actors=[...view.tiles.values()].flatMap(t=>t.actors).filter(a=>a.flights);
  for(const kind of distance<900?['sheep']:['pumpkin','ghost']){
   const group=actors.filter(a=>a.kind===kind);assert.ok(group.length,kind);
   assert.ok(group.some(a=>a.flights![0].height>10),kind+' rises');
   assert.ok(group.every(a=>a.flights![1].height===0),kind+' stays down for the opponent');
  }
  const actor=actors[0],base=[actor.x,actor.y,actor.z],height=actor.flights![0].height;
  view.render(track,distance,250,35,3,distance,-19.62,9.81);
  assert.deepEqual([actor.x,actor.y,actor.z],base);assert.equal(actor.flights![0].height,height);
  for(let i=1;i<=600;i++)view.render(track,distance,250,35,3+i/60,distance,9.81,9.81);
  assert.ok(actors.every(a=>a.flights![0].height===0));view.destroy();
 }
});
