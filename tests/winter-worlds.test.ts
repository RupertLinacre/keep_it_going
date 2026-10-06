import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Scene } from 'three';
import { adventureAt, WORLDS, WORLD_LAP } from '../src/games/adventure-worlds';
import { MiniTrack } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { WorldModel } from '../src/games/world-models';
import { laplandScenery, winterFairScenery } from '../src/games/background-winter';
import { AdventureScene } from '../src/games/adventure-scene';
import { WinterAtmosphere, winterGlowMaterial, winterGroundBack } from '../src/games/winter-atmosphere';
import { MINI_TRAIL_DISTANCE } from '../src/games/mini-config';

test('winter worlds follow the original four; Lapland has selected attractions and the fair introduces its waterfall and sleds',()=>{
  assert.equal(WORLD_LAP,6600);
  for(const world of WORLDS.slice(4)) {
    assert.equal(world.pieces.length,world.id==='lapland'?5:2);
    assert.ok(world.challenges.length>=(world.id==='lapland'?5:6));
    assert.equal(adventureAt(world.start).world.id,world.id);
    const track=new MiniTrack(42,{generative:true,startWorld:world.id});
    assert.ok(track.startDistance>world.start&&track.startDistance<world.start+MINI_TRAIL_DISTANCE+120);
    assert.equal(adventureAt(track.sectionAt(track.startDistance).start).world.id,world.id);
    track.ensure(track.startDistance,800);
    assert.ok(track.sections.every(s=>!WORLDS.slice(0,4).some(w=>w.pieces.includes(s.kind))), 'no borrowed Christmas-specific attraction');
    track.ensure(world.end+1);
    assert.equal(adventureAt(track.sectionAt(world.end+1).start).world.id,world.id==='lapland'?'winterfair':'meadow');
    const race=new MiniTrack(42,{generative:true,multiplayer:true,startWorld:world.id});
    assert.equal(race.startDistance,new MiniTrack(42,{generative:true,multiplayer:true}).startDistance,'solo preview cannot alter a race start');
  }
});

test('winter scenery has bounded opaque batches, finite geometry and a clear rail corridor',()=>{
  const material=new MeshBasicMaterial(),glow=new MeshBasicMaterial();
  try {
    for(const kind of ['lapland','winterfair'] as const)for(let variant=0;variant<3;variant++)for(let seed=1;seed<=16;seed++) {
      const m=new WorldModel(true),actors:any[]=[];
      if(kind==='lapland')laplandScenery(m,16,-22,9,seededRandom(seed),variant);
      else winterFairScenery(m,a=>actors.push(a),16,-22,9,seededRandom(seed),variant);
      const group=m.finish(material,glow);let triangles=0;
      assert.ok(group.children.length<=4,'solid/glow, front/back batches only');
      for(const child of group.children) {
        const mesh=child as Mesh,p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');triangles+=p.count/3;
        for(let i=0;i<p.count;i++) {
          assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
          assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.99,'no degenerate facets');
          assert.ok(mesh.userData.front?p.getZ(i)>4:p.getZ(i)<-4,'scenery does not cross race aisle');
          assert.ok(p.getZ(i)>=-84&&p.getZ(i)<=49,'existing terrain envelope');
        }
        mesh.geometry.dispose();
      }
      assert.ok(triangles<2400,`${kind} variant ${variant}: ${triangles} triangles`);
      assert.equal(actors.length,kind==='winterfair'?3:0);
    }
  }finally{material.dispose();glow.dispose();}
});

test('skating uses one fixed instance buffer, freezes on pause, and respects reduced motion',()=>{
  const track=new MiniTrack(42,{generative:true,startWorld:'winterfair'}),scene=new Scene(),view=new AdventureScene(scene);
  try {
    const at=track.startDistance+100;track.ensure(at);
    view.render(track,at,0,35,1,at-20);
    const skaters=(view as any).skaters as InstancedMesh;
    assert.ok(skaters.count>0&&skaters.count<=192);
    const a=Array.from(skaters.instanceMatrix.array);
    view.render(track,at,0,35,2,at-20);const b=Array.from(skaters.instanceMatrix.array);assert.notDeepEqual(a,b);
    view.render(track,at,0,35,2,at-20);assert.deepEqual(Array.from(skaters.instanceMatrix.array),b);
    (view as any).reducedMotion={matches:true};view.render(track,at,0,35,3,at-20);const still=Array.from(skaters.instanceMatrix.array);
    view.render(track,at,0,35,70,at-20);assert.deepEqual(Array.from(skaters.instanceMatrix.array),still);
    view.destroy();assert.equal(scene.children.length,0);
  }finally{if(view.group.parent)view.destroy();}
});

test('winter atmosphere eases transitions, uses no lights and owns only a two-triangle sky',()=>{
  const scene=new Scene(),sky=new WinterAtmosphere(scene),lapland=WORLDS[4],fair=WORLDS[5];
  try {
    sky.update(lapland,(sky.material.uniforms.sky.value),0,1.6);assert.equal(sky.mesh.visible,false);
    sky.update(lapland,sky.material.uniforms.sky.value,1/60,1.6);
    const weight=sky.material.uniforms.weight.value;assert.ok(weight>0&&weight<.1);
    sky.update(fair,sky.material.uniforms.sky.value,1/60,1.6);assert.ok(sky.material.uniforms.dawn.value>0&&sky.material.uniforms.dawn.value<.1);
    assert.equal(sky.mesh.geometry.index!.count/3,2);
    assert.equal(sky.material.depthWrite,false);assert.equal(sky.material.transparent,false,'sky must precede opaque train/terrain');assert.ok(scene.children.every(o=>!(o as any).isLight));
    for(let i=0;i<300;i++)sky.update(WORLDS[0],sky.material.uniforms.sky.value,1/60,1.6);
    assert.equal(sky.mesh.visible,false);
  }finally{sky.destroy();assert.equal(scene.children.length,0);}
});


test('winter glows share two bounded lane batches, with depth-tested halos and no extra lights',()=>{
  const solid=new MeshBasicMaterial(),luminous=new MeshBasicMaterial(),glow=winterGlowMaterial();
  try {
    for(const kind of ['lapland','winterfair'] as const)for(let variant=0;variant<3;variant++) {
      const m=new WorldModel(true);
      if(kind==='lapland')laplandScenery(m,16,-22,9,seededRandom(42),variant);
      else winterFairScenery(m,()=>{},16,-22,9,seededRandom(42),variant);
      const group=m.finish(solid,luminous,true,glow),halos=group.children.filter(c=>c.userData.winterGlow) as Mesh[];
      assert.ok(halos.length>=1&&halos.length<=2,'at most one glow draw per front/back lane batch');
      let count=0;
      for(const mesh of halos) {
        const p=mesh.geometry.getAttribute('position'),offset=mesh.geometry.getAttribute('glowOffset');count+=p.count/6;
        assert.ok(mesh.userData.front?p.getZ(0)>4:p.getZ(0)<-4);
        assert.equal(p.count%6,0);
        assert.ok(Array.from(offset.array).every(Number.isFinite));
        for(let i=0;i<offset.count;i++)assert.ok(Math.max(Math.abs(offset.getX(i)),Math.abs(offset.getY(i)))<=5);
      }
      assert.ok(count>=8&&count<56,`${kind}: bounded local light count ${count}`);
      group.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose();});
    }
    assert.equal(glow.depthWrite,false);assert.equal(glow.depthTest,true);assert.equal(glow.toneMapped,false);
  }finally{solid.dispose();luminous.dispose();glow.dispose();}
});


test('illustrated sky only shortens distant board drawing and bounds warm scene lights',()=>{
  const scene=new Scene(),sky=new WinterAtmosphere(scene),ground=new MeshStandardMaterial();
  try {
    sky.attachGround(ground);
    const shader:any={uniforms:{},vertexShader:'',fragmentShader:'#include <clipping_planes_fragment>'};
    ground.onBeforeCompile(shader,undefined as any);
    assert.equal(shader.uniforms.winterBack,sky.material.uniforms.back);
    assert.ok(shader.fragmentShader.includes('winterGroundZ<'));
    assert.ok(!shader.fragmentShader.includes('vViewPosition.z'),'raising the camera cannot cut near ground');
    assert.equal(sky.material.depthWrite,false,'the sky never occludes a distant train or cabin');
  }finally{ground.dispose();sky.destroy();}
  const track=new MiniTrack(42,{generative:true,startWorld:'lapland'}),view=new AdventureScene(scene);
  try {
    const at=track.startDistance+100;track.ensure(at);view.render(track,at,0,0,1);view.render(track,at,0,0,2);
    const lamps=(view as any).winterLamps;
    assert.equal(lamps.length,2);assert.ok(lamps.every((lamp:any)=>!lamp.castShadow&&lamp.distance<=14));
    assert.ok(lamps.some((lamp:any)=>lamp.intensity>0));
    assert.ok(lamps.every((lamp:any)=>lamp.position.toArray().every(Number.isFinite)));
  }finally{view.destroy();assert.equal(scene.children.length,0);}
});


test('winter horizon stays behind every scenery tile and mirrored race lane',()=>{
  for(const kind of ['lapland','winterfair'] as const)for(const lane of [0,14,35]) {
    const track=new MiniTrack(42,{generative:true,startWorld:kind}),scene=new Scene(),view=new AdventureScene(scene);
    try {
      const at=track.startDistance+250;track.ensure(at);view.render(track,at,0,lane,1,at-15);
      const back=winterGroundBack(track,lane);
      for(const tile of view.tiles.values())for(const child of tile.root.children) {
        const mesh=child as Mesh,positions=mesh.geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++)assert.ok(positions.getZ(i)+mesh.position.z+tile.root.position.z>back,
          `${kind} lane ${lane}: scenery always has ground under it`);
      }
      // All possible foreground ground is protected, even below a tall loop.
      for(const z of [0,10,50,120])assert.ok(z>back);
    }finally{view.destroy();}
  }
});
