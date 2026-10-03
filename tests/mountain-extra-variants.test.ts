import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { MiniSection, type MiniKind } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMountainExtraVariant } from '../src/review/variants/mountain-extra-variants';
import { at } from '../src/review/variants/variant-kit';
const kinds=['mountainpass','tunnel','ravinebridge'] as const;
function section(kind: MiniKind){return new MiniSection(4,kind,600,new Vector3(73,4,-20),kind==='tunnel'?52:90,kind==='tunnel'?1.1:22,0,1);}
function fixture(kind:MiniKind, option:'d'|'e') {
 const s=section(kind),m=new MeshStandardMaterial({vertexColors:true}),l=new FairgroundLights(),d=createMountainExtraVariant(s,option,m,l)!;
 const meshes:Mesh[]=[];d.group.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
 return {s,m,l,d,meshes,dispose(){d.dispose();m.dispose();l.dispose();}};
}
const matrices=(f:ReturnType<typeof fixture>)=>f.meshes.filter((m):m is InstancedMesh=>m instanceof InstancedMesh).map(m=>Array.from(m.instanceMatrix.array));
function matrix(f:ReturnType<typeof fixture>,name:string,index=0){const result=new Matrix4();(f.d.group.getObjectByName(name) as InstancedMesh).getMatrixAt(index,result);return result;}

test('six extra mountain designs stay within budgets and release owned fixed buffers only',()=>{
 for(const kind of kinds)for(const option of ['d','e'] as const){
  const f=fixture(kind,option),{d,meshes,m,l,s}=f;
  const triangles=meshes.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3*(m instanceof InstancedMesh?m.count:1),0);
  assert.ok(meshes.length<=7,`${kind}-${option}: ${meshes.length} batches`);assert.ok(triangles<=40000,`${kind}-${option}: ${triangles} triangles`);
  console.log(`${kind}-${option}: ${meshes.length} batches, ${triangles} triangles`);
  const buffers=meshes.map(m=>m instanceof InstancedMesh?m.instanceMatrix.array:m.geometry.getAttribute('position').array);
  for(let i=0;i<360;i++)d.update(i/60,s.start-20+i,false);
  meshes.forEach((m,i)=>{assert.equal(m instanceof InstancedMesh?m.instanceMatrix.array:m.geometry.getAttribute('position').array,buffers[i]);assert.ok(Array.from(buffers[i]).every(Number.isFinite));assert.equal(m.castShadow,false);assert.ok(m.geometry.getAttribute('color'));});
  let geometries=0,instances=0,materials=0;
  meshes.forEach(m=>{m.geometry.addEventListener('dispose',()=>geometries++);if(m instanceof InstancedMesh)m.addEventListener('dispose',()=>instances++);});m.addEventListener('dispose',()=>materials++);l.addEventListener('dispose',()=>materials++);
  d.dispose();assert.equal(geometries,meshes.length);assert.equal(instances,meshes.filter(m=>m instanceof InstancedMesh).length);assert.equal(materials,0);assert.equal(d.group.children.length,0);m.dispose();l.dispose();
 }
});
test('extra mountain interactions replay exactly, freeze fully for reduced motion, and cache section heights',()=>{
 for(const kind of kinds)for(const option of ['d','e'] as const){const f=fixture(kind,option),{d,s}=f;
  d.update(2,at(s,.5),false);const near=matrices(f);d.update(12,s.end+100,false);d.update(2,at(s,.5),false);assert.deepEqual(matrices(f),near);
  d.update(2,s.start-90,false);assert.notDeepEqual(matrices(f),near,`${kind}-${option} responds to train`);
  d.update(0,s.start,true);const still=matrices(f);d.update(25,s.end,true);assert.deepEqual(matrices(f),still,`${kind}-${option} reduced motion`);
  d.update(2,at(s,.5),false);s.frames.forEach(f=>f.position.y+=40);d.update(2,at(s,.5),false);assert.deepEqual(matrices(f),near);f.dispose();
 }
});
test('mountain bridges and work terraces preserve the full train envelope',()=>{
 for(const kind of ['mountainpass','ravinebridge'] as const)for(const option of ['d','e'] as const){const f=fixture(kind,option);f.d.group.updateMatrixWorld(true);
  for(let i=2;i<39;i++)for(const side of [-.85,0,.85]){const frame=f.s.frames[Math.round(f.s.resolution*i/40)],p=frame.position.clone().addScaledVector(frame.right,side);p.x-=f.s.origin.x;p.z-=f.s.origin.z;p.y+=.15;const hits=new Raycaster(p,new Vector3(0,1,0),0,2.8).intersectObject(f.d.group,true);assert.equal(hits.length,0,`${kind}-${option} sample ${i}, side ${side}`);}
  f.dispose();
 }
});
test('snail and accordion have enclosed bores with useful independently reversible cutaways',()=>{
 for(const option of ['d','e'] as const){const f=fixture('tunnel',option);f.d.group.updateMatrixWorld(true);const local=f.d.group.children[0];
  const ray=(p:number[],d:number[])=>new Raycaster(new Vector3(...p).applyMatrix4(local.matrixWorld),new Vector3(...d).transformDirection(local.matrixWorld),0,40).intersectObject(f.d.group,true);
  for(const sign of [-1,1])for(const x of [-1,0,1])for(const y of [.2,1.2,2.2])assert.equal(ray([x,y,sign*17],[0,0,-sign]).length,0,`${option} clear bore`);
  for(const direction of [[0,1,0],[-1,0,0],[1,0,0]]){const hits=ray([0,.6,0],direction);assert.ok(hits.length&&hits[0].distance<3.3,`${option} enclosed`);}
  const cover=f.d.group.getObjectByName('extra-tunnel-cutaway')!;f.d.group.userData.cutaway=true;f.d.update(1,at(f.s,.5),false);assert.equal(cover.visible,false);f.d.group.userData.cutaway=false;f.d.update(1,at(f.s,.5),false);assert.equal(cover.visible,true);f.dispose();
 }
});
test('otters remain exactly attached to the counterbalancing seesaw seats',()=>{
 const f=fixture('ravinebridge','d');for(const time of [0,.3,1,2,8]){f.d.update(time,at(f.s,.5),false);const plank=matrix(f,'otter-balanced-seesaw').invert();for(let j=0;j<2;j++){const relative=matrix(f,'otter-seesaw-riders',j).premultiply(plank);assert.ok(new Vector3().setFromMatrixPosition(relative).distanceTo(new Vector3(j?8.5:-8.5,1,0))<1e-4);}}f.dispose();
});
test('storks keep socks hooked to taut fishing lines through the full lifting arc',()=>{
 const f=fixture('ravinebridge','e');for(const fraction of [.1,.29,.5,.7,.9]){f.d.update(2,at(f.s,fraction),false);for(let j=0;j<2;j++){const rod=matrix(f,'stork-hinged-fishing-rods',j),line=matrix(f,'stork-taut-fishing-lines',j),sock=matrix(f,'stork-caught-striped-socks',j);assert.ok(new Vector3(7,1.8,0).applyMatrix4(rod).distanceTo(new Vector3().setFromMatrixPosition(line))<1e-4);assert.ok(new Vector3(0,-1,0).applyMatrix4(line).distanceTo(new Vector3().setFromMatrixPosition(sock))<1e-4);}}
 f.d.update(1,f.s.start-100,false);assert.ok(Math.abs(new Vector3().setFromMatrixPosition(matrix(f,'stork-caught-striped-socks')).y-3.5)<.001);f.d.update(1,at(f.s,.29),false);assert.ok(new Vector3().setFromMatrixPosition(matrix(f,'stork-caught-striped-socks')).y>10);f.dispose();
});
test('yeti paws track crank handles and the arm reaches its shoulder without a gap',()=>{
 const f=fixture('mountainpass','e');for(const time of [0,1,2,5]){f.d.update(time,at(f.s,.53),false);for(let j=0;j<3;j++){const crank=matrix(f,'yeti-ice-crusher-cranks',j),paw=matrix(f,'yeti-cranking-paws',j),arm=matrix(f,'yeti-connected-arms',j);const hand=new Vector3().setFromMatrixPosition(paw);assert.ok(hand.distanceTo(new Vector3(1.4,0,.55).applyMatrix4(crank))<1e-4);assert.ok(hand.distanceTo(new Vector3(0,-1,0).applyMatrix4(arm))<1e-4);}}f.dispose();
});
test('accordion end plates stay attached to the last moving fold',()=>{
 const f=fixture('tunnel','e');for(const time of [0,.4,1,2,7]){f.d.update(time,at(f.s,.5),false);for(let j=0;j<2;j++){const folds=matrix(f,'accordion-compressing-bellows',j),plate=matrix(f,'accordion-moving-endplates',j);assert.ok(new Vector3(0,0,8.4).applyMatrix4(folds).distanceTo(new Vector3().setFromMatrixPosition(plate))<1e-4);}}f.dispose();
});
