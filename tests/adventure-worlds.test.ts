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

test('tunnels are guaranteed near mountain and pumpkin entrances across seeds',()=>{
 for(const seed of [1,18,42,73,812]){
  const track=new MiniTrack(seed,{generative:true}),sections=[];
  const seen=new Set<number>();
  for(let at=0;at<4800;at+=100){track.ensure(at);for(const s of track.sections)if(!seen.has(s.id)){seen.add(s.id);sections.push(s)}}
  for(const index of [1,3]){
   const first=sections.findIndex(s=>adventureAt(s.start).index===index);
   assert.equal(sections[first+1].kind,'station');assert.equal(sections[first+2].kind,'tunnel');
   assert.equal(adventureAt(sections[first+2].start).index,index);
  }
 }
});

test('late adventures unlock more elements without squeezing hills into thin needles',()=>{
 const track=new MiniTrack(42,{generative:true}),encores=new Set<string>();
 for(let at=4200;at<25000;at+=150){
  track.ensure(at);
  for(const s of track.sections){
   encores.add(s.kind);
   if(s.kind==='verticalhill')assert.ok(s.width>10&&s.amplitude<=40);
  }
 }
 for(const kind of ['nestedloop','verticalhill','tophat'])assert.ok(encores.has(kind),kind);
});

test('scenery prunes old tiles, bounds actors and disposes shared race geometry exactly once',async()=>{
 const {AdventureScene}=await import('../src/games/adventure-scene');
 const {Scene,Mesh,InstancedMesh}=await import('three');
 const scene=new Scene(),view=new AdventureScene(scene),track=new MiniTrack(42,{generative:true});
 const geometries=new Map<any,number>();
 const observe=()=>view.group.traverse(o=>{
  if(o instanceof Mesh&&!geometries.has(o.geometry)){
   geometries.set(o.geometry,0);o.geometry.addEventListener('dispose',()=>geometries.set(o.geometry,geometries.get(o.geometry)!+1));
  }
 });
 observe();
 for(let at=0;at<9000;at+=200){
  track.ensure(at);view.render(track,at,Math.floor(track.sample(at).position.x/25)*25,35,at/30);observe();
  assert.ok(view.tiles.size<=track.sections.length&&view.tiles.size<28);
  assert.ok(view.group.children.length<=view.tiles.size*5+7);
  view.group.traverse(o=>{if(o instanceof InstancedMesh)assert.ok(o.count<=192)});
 }
 assert.ok([...geometries.values()].filter(n=>n===1).length>30,'Previous scenery was retired during the ride');
 view.destroy();assert.equal(scene.children.length,0);assert.equal(view.tiles.size,0);
 assert.ok([...geometries.values()].every(n=>n===1),'Owned/shared geometry released exactly once');
});
