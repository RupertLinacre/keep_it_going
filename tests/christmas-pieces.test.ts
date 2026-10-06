import { waterfallBore } from '../src/games/attractions/waterfall-tunnel';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { CHRISTMAS_KINDS,christmasLayout } from '../src/games/christmas-rails';
import {createMiniSection,MiniTrack} from '../src/games/mini-track';
import {createChristmasPiece,tunnelSnowball} from '../src/games/attractions/christmas-pieces';
import {FairgroundLights} from '../src/games/world-lighting';
import {seededRandom} from '../src/games/mini-rail';
import {MiniPhysics} from '../src/games/mini-physics';
import {createSnowGlobeEffects,SNOW_GLOBE_OPENING} from '../src/games/attractions/snow-globe-effects';
import {ChristmasBuilder} from '../src/games/attractions/christmas-builder';
import {WORLDS,adventureAt} from '../src/games/adventure-worlds';

const capture=(group:T.Group)=>{const values:number[]=[];group.traverse(o=>{if(o instanceof T.InstancedMesh)values.push(...o.instanceMatrix.array);else values.push(...o.position.toArray(),...o.rotation.toArray().slice(0,3) as number[],...o.scale.toArray());});return values;};
test('selected Christmas routes are continuous, clear at crossings, traversable and rejoin both race lanes',()=>{
 for(const kind of CHRISTMAS_KINDS.filter(k=>k!=='chimneyhouse'))for(const seed of [1,42,71,812])for(const race of [false,true]){
  const s=createMiniSection(kind,4300,new T.Vector3(20,4,2),20,seededRandom(seed),true,race),first=s.frames[0],last=s.frames.at(-1)!;
  assert.equal(s.kind,kind);assert.ok(first.position.distanceTo(new T.Vector3(20,4,2))<1e-6);
  assert.ok(last.tangent.x>.9999&&last.up.y>.9999);assert.ok(Math.abs(last.position.y-4)<1e-6);
  if(race)assert.ok(Math.abs(last.position.z)<1e-6,'no cumulative lane drift');
  for(let i=1;i<s.frames.length;i++){
   const f=s.frames[i],prev=s.frames[i-1];assert.ok(f.position.toArray().every(Number.isFinite));
   assert.ok(f.tangent.dot(prev.tangent)>.99,`${kind}: smooth tangent`);
   assert.ok(f.up.dot(prev.up)>.98,`${kind}: no coach roll snap`);
   assert.ok(Math.abs(f.up.dot(f.tangent))<1e-6);
  }
  const points=[];for(let d=0;d<s.length;d+=2)points.push({d,p:s.sample(s.start+d).position});
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   if(points[j].d-points[i].d<16)continue;
   assert.ok(points[i].p.distanceTo(points[j].p)>3.5,`${kind}: crossing clearance`);
  }
  const physics=new MiniPhysics(s,{initialDistance:s.start,initialSpeed:50,gravity:9.81,rolling:0,drag:0});
  for(let i=0;i<3600&&physics.distance<s.end&&!physics.held;i++)physics.update(1/120);
  assert.ok(physics.distance>=s.end,kind+' is traversable with ordinary rail physics');
 }
});
test('bow rails form both lobes themselves and the snowball has a genuine bore',()=>{
 const l=christmasLayout('ribbonreel',100,22,1),left=l.curve.points.filter(p=>p.x<40&&p.y>10),right=l.curve.points.filter(p=>p.x>60&&p.y>10);
 assert.ok(left.length>8&&right.length>8);
 const crossings=l.curve.points.filter(p=>Math.abs(p.x-50)<.01&&p.y>12);
 assert.ok(crossings.length>=3);assert.ok(crossings.at(-1)!.z-crossings[0].z>=19);
 const g=tunnelSnowball(7.8,7,5.4,3.6),p=g.getAttribute('position'),index=g.index!;
 for(let i=0;i<index.count;i++)assert.ok(Math.hypot(p.getY(index.getX(i))+7-5.4,p.getZ(index.getX(i)))>=3.6-1e-5);
 g.dispose();
});
test('Christmas animations have fixed buffers, pause cleanly, respect reduced motion and release ownership',()=>{
 const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
 try{for(const kind of CHRISTMAS_KINDS.filter(k=>k!=='chimneyhouse')){
  const s=createMiniSection(kind,4300,new T.Vector3(0,4,0),20,seededRandom(71),true),piece=createChristmasPiece(s,material,lights)!;
  let draws=0,triangles=0,disposed=0;const geometry=new Set<T.BufferGeometry>(),pools=new Map<T.InstancedMesh,number>();
  piece.group.traverse(o=>{assert.ok(!(o instanceof T.Light));if(o instanceof T.Mesh){draws++;geometry.add(o.geometry);triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof T.InstancedMesh?o.count:o.geometry instanceof T.InstancedBufferGeometry?o.geometry.instanceCount:1);assert.ok(!o.castShadow);if(o instanceof T.InstancedMesh)pools.set(o,o.count);}});
  assert.ok(draws<=12&&triangles<(["startree","snowmanscarf","snowglobe"].includes(kind)?40000:30000),`${kind}: ${draws} batches, ${triangles} triangles`);
  for(const g of geometry)g.addEventListener('dispose',()=>disposed++);
  let previous=capture(piece.group),moved=false;
  for(let i=0;i<100;i++){piece.update(i/10,s.start+s.length*i/99,false);const now=capture(piece.group);assert.ok(now.every(Number.isFinite));moved ||= now.some((x,j)=>x!==previous[j]);previous=now;for(const [pool,count]of pools)assert.equal(pool.count,count);}
  assert.ok(moved);piece.update(9.9,s.end,false);assert.deepEqual(capture(piece.group),previous);
  piece.update(0,s.start,true);const still=capture(piece.group);piece.update(1000,s.start,true);assert.deepEqual(capture(piece.group),still);
  const remote=createChristmasPiece(s,material,lights)!;remote.update(12,s.end,false);assert.notDeepEqual(capture(remote.group),still);remote.dispose();
  piece.dispose();assert.equal(disposed,geometry.size);assert.equal(piece.group.children.length,0);
 }}finally{material.dispose();lights.dispose();}
});
test('Christmas director varies the tour, fits its world and preview uses actual gameplay rails',()=>{
 const seen=new Set<string>();
 for(let seed=1;seed<20;seed++){
  const track=new MiniTrack(seed,{generative:true,startWorld:'lapland'});
  for(let at=track.startDistance;at<5401;at+=50){track.ensure(at);for(const s of track.sections){if((CHRISTMAS_KINDS as readonly string[]).includes(s.kind)){seen.add(s.kind);assert.equal(adventureAt(s.start).world.id,s.kind==='frozenwaterfall'?'winterfair':'lapland');assert.ok(s.end<=(s.kind==='frozenwaterfall'?6600:5400)+.001);}}}
 }
 assert.deepEqual([...seen].sort(),[...CHRISTMAS_KINDS].sort());
 assert.deepEqual(WORLDS[4].pieces,CHRISTMAS_KINDS.filter(k=>k!=='frozenwaterfall'));assert.deepEqual(WORLDS[5].pieces,['frozenwaterfall']);
 for(const previewPiece of CHRISTMAS_KINDS){const t=new MiniTrack(42,{generative:true,previewPiece});assert.equal(t.sections.find(s=>s.id===0)?.kind,previewPiece);assert.equal(adventureAt(t.startDistance).world.id,previewPiece==='frozenwaterfall'?'winterfair':'lapland');}
});

test('coach roof clears the solid Christmas scenery, including snowman arms and the tunnel wall',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights(),triangle=new T.Triangle(),nearest=new T.Vector3();
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 try{for(const seed of [1,42,71,812])for(const kind of CHRISTMAS_KINDS.filter(k=>k!=='chimneyhouse')){
  const s=createMiniSection(kind,4300,new T.Vector3(0,4,0),20,seededRandom(seed),true),piece=createChristmasPiece(s,material,lights)!;
  piece.group.updateMatrixWorld(true);const meshes:T.Mesh[]=[];
  piece.group.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh)&&!(o.material instanceof T.ShaderMaterial))meshes.push(o);});
  for(let d=0;d<s.length;d+=1.5){
   const frame=s.sample(s.start+d),roof=frame.position.clone().addScaledVector(frame.up,1.1);
   for(const mesh of meshes){const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
    for(let i=0;i<(index?.count??p.count);i+=3){
     a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
     b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);
     c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
     if(Math.max(a.x,b.x,c.x)<roof.x-1||Math.min(a.x,b.x,c.x)>roof.x+1||Math.max(a.y,b.y,c.y)<roof.y-1||Math.min(a.y,b.y,c.y)>roof.y+1||Math.max(a.z,b.z,c.z)<roof.z-1||Math.min(a.z,b.z,c.z)>roof.z+1)continue;
     triangle.set(a,b,c).closestPointToPoint(roof,nearest);
     assert.ok(roof.distanceTo(nearest)>.8,kind+' must not clip scenery at '+d+'m');
    }
   }
  }piece.dispose();
 }}finally{material.dispose();lights.dispose();}
});


test('refined Christmas rails have broad bends, gradual roll and inward banks on sustained turns',()=>{
 for(const kind of ['startree','snowmanscarf','snowglobe'] as const)for(const seed of [1,42,71,812]){
  const s=createMiniSection(kind,4300,new T.Vector3(0,4,0),20,seededRandom(seed),true);
  for(let d=2;d<s.length-2;d+=.5){
   const a=s.sample(s.start+d-.1),f=s.sample(s.start+d),b=s.sample(s.start+d+.1),bend=b.tangent.clone().sub(a.tangent).divideScalar(.2);
   assert.ok(bend.length()<1/7,kind+' must not hide a tight hook between smooth samples');
   assert.ok(Math.acos(T.MathUtils.clamp(a.up.dot(b.up),-1,1))/.2<.21,kind+' bank changes gradually in metres');
   const before=s.sample(s.start+d-1.5).curvature,after=s.sample(s.start+d+1.5).curvature;
   // Bank is deliberately eased through an S bend: test sustained turns,
   // allowing a brief smooth lag when lateral curvature changes direction.
   const right=f.tangent.clone().cross(new T.Vector3(0,1,0)).normalize();
   if(Math.abs(bend.dot(right))>.025&&before.dot(right)*after.dot(right)>.0005&&before.dot(right)*bend.dot(right)>.0005){
    const lateral=right.clone().multiplyScalar(bend.dot(right));assert.ok(f.up.dot(lateral)>-.001,kind+' leans into a sustained turn');
   }
  }
 }
});


test('glass globe follows the actual rail crossings, keeps snowfall bounded and freezes shader motion',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 try{for(const seed of [1,42,71,812])for(const race of [false,true]){
  const s=createMiniSection('snowglobe',4300,new T.Vector3(0,4,0),20,seededRandom(seed),true,race),l=christmasLayout('snowglobe',s.width,s.amplitude,s.hand),builder=new ChristmasBuilder(material,lights);
  const effect=createSnowGlobeEffects(builder,s,l.center,l.radius,s.origin.y+s.amplitude+7);
  assert.ok(effect.portals.length>=4&&effect.portals.length<=8);
  // Any carriage roof close to the glass must have a genuine rail opening.
  for(let d=s.start;d<s.end;d+=.3){const f=s.sample(d),roof=f.position.clone().sub(new T.Vector3(s.origin.x,0,s.origin.z)).addScaledVector(f.up,1.1);
   if(Math.abs(roof.distanceTo(effect.center)-effect.radius)<.8)assert.ok(effect.portals.some(p=>p.distanceTo(roof)<SNOW_GLOBE_OPENING),'coach clears glass at '+(d-s.start));
  }
  effect.update(1,1,false);effect.update(2,1,false);assert.ok(effect.agitation.value>0&&effect.spin.value>0);
  const state=[effect.clock.value,effect.agitation.value,effect.spin.value];effect.update(2,1,false);assert.deepEqual([effect.clock.value,effect.agitation.value,effect.spin.value],state);
  effect.update(10,1,true);const still=[effect.clock.value,effect.agitation.value,effect.spin.value];effect.update(20,1,true);assert.deepEqual([effect.clock.value,effect.agitation.value,effect.spin.value],still);
  let vertices=0,materials=0,disposed=0;builder.group.traverse(o=>{if(o instanceof T.Mesh){vertices+=o.geometry.getAttribute('position').count;materials++;(o.material as T.Material).addEventListener('dispose',()=>disposed++);assert.ok(!o.castShadow);assert.equal((o.material as T.Material).depthWrite,false);}});
  assert.equal(materials,3);assert.ok(vertices<8000);builder.dispose();assert.equal(disposed,3);
 }}finally{material.dispose();lights.dispose();}
});

test('waterfall ice glints freeze on pause and reduced motion and release their material',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 const s=createMiniSection('frozenwaterfall',5500,new T.Vector3(0,4,0),20,seededRandom(42),true);
 const piece=createChristmasPiece(s,material,lights)!;
 try{
  const glitter=piece.group.getObjectByName('waterfall-surface-glitter') as T.Mesh;
  const shader=glitter.material as T.ShaderMaterial;
  assert.ok(glitter.geometry.getAttribute('position').count<2000);
  piece.update(3,s.start+50,false);assert.equal(shader.uniforms.time.value,3);
  piece.update(3,s.start+50,false);assert.equal(shader.uniforms.time.value,3);
  piece.update(100,s.start+50,true);assert.equal(shader.uniforms.time.value,0);
  let disposed=0;shader.addEventListener('dispose',()=>disposed++);piece.dispose();assert.equal(disposed,1);
 }finally{material.dispose();lights.dispose();}
});


test('waterfall enters behind the summit chalet, descends inside rock and exits forward',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 try{for(const seed of [1,42,71,812]){
  const s=createMiniSection('frozenwaterfall',5500,new T.Vector3(0,4,0),20,seededRandom(seed),true),b=waterfallBore(s);
  const entry=s.sample(b.entry),exit=s.sample(b.exit);
  assert.ok(entry.position.y-s.origin.y>s.amplitude*.95);
  assert.ok(entry.position.z-s.origin.z<9,'entry is behind the house');
  assert.ok(exit.position.y-s.origin.y<6&&exit.position.z-s.origin.z>33,'low front mouth');
  assert.ok(exit.tangent.z>.95,'train emerges towards the player');
  assert.ok(b.exit-b.entry>30&&b.exit<s.end-40);
  const piece=createChristmasPiece(s,material,lights)!;piece.group.updateMatrixWorld(true);
  const mountain=piece.group.getObjectByName('waterfall-hollow-mountain')!;
  const view=new T.Vector3(8,17,38).normalize();
  for(const fraction of [.25,.45,.6]){
   const f=s.sample(b.entry+(b.exit-b.entry)*fraction),roof=f.position.clone().addScaledVector(f.up,1.1);
   const ray=new T.Raycaster(roof.clone().addScaledVector(view,60),view.clone().negate(),0,58);
   assert.ok(ray.intersectObject(mountain,true).length>0,'mountain encloses the descending railway at '+fraction);
  }piece.dispose();
 }}finally{material.dispose();lights.dispose();}
});
