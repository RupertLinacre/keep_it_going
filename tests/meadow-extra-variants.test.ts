import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMeadowExtraVariant } from '../src/review/variants/meadow-extra-variants';
import { at } from '../src/review/variants/variant-kit';
const cases=[['sheepbank',74,8],['pondbridge',66,4],['windmillloop',8,10]] as const;
const make=(kind:typeof cases[number][0],hand=1)=>{const c=cases.find(c=>c[0]===kind)!;return new MiniSection(3,kind,90,new T.Vector3(120,4,-9),c[1],c[2],kind==='windmillloop'?hand*2.2:0,hand);};
const mesh=(g:T.Group,name:string)=>{const m=g.getObjectByName(name);assert.ok(m instanceof T.InstancedMesh,name);return m;};
const pose=(m:T.InstancedMesh,i=0)=>{const matrix=new T.Matrix4();m.getMatrixAt(i,matrix);return matrix;};
const position=(m:T.Matrix4)=>new T.Vector3().setFromMatrixPosition(m);
const matrices=(g:T.Group)=>{const a:number[]=[];g.traverse(o=>{if(o instanceof T.InstancedMesh)a.push(...o.instanceMatrix.array);});return a;};
const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();

test('all six extras use bounded instance pools, keep tracks immutable, and dispose only their own resources',()=>{
 let materialDisposals=0;const onDispose=()=>materialDisposals++;material.addEventListener('dispose',onDispose);
 for(const [kind]of cases)for(const option of ['d','e'] as const){const s=make(kind),frames=s.frames.map(f=>f.position.toArray()),show=createMeadowExtraVariant(s,option,material,lights)!;let draws=0,triangles=0,disposed=0;const geometries=new Set<T.BufferGeometry>(),pools:T.InstancedMesh[]=[];
 show.group.traverse(o=>{assert.equal(o instanceof T.Light,false,'Scenes add no lights');if(o instanceof T.Mesh){draws++;triangles+=o.geometry.getAttribute('position').count/3*(o instanceof T.InstancedMesh?o.count:1);assert.equal(o.castShadow,false);geometries.add(o.geometry);}if(o instanceof T.InstancedMesh)pools.push(o);});assert.ok(draws<=7,`${kind} ${option}: ${draws} draws`);assert.ok(triangles<=40000,`${kind} ${option}: ${triangles} triangles`);
 const storage=pools.map(m=>m.instanceMatrix.array),counts=pools.map(m=>m.count);for(let frame=0;frame<480;frame++)show.update(frame/30,s.start-12+frame*s.length/240,false);pools.forEach((p,i)=>{assert.equal(p.instanceMatrix.array,storage[i]);assert.equal(p.count,counts[i]);assert.ok(Array.from(p.instanceMatrix.array).every(Number.isFinite));});assert.deepEqual(s.frames.map(f=>f.position.toArray()),frames);
 geometries.forEach(g=>g.addEventListener('dispose',()=>disposed++));show.dispose();assert.equal(disposed,geometries.size);assert.equal(show.group.children.length,0);assert.equal(materialDisposals,0);
 }material.removeEventListener('dispose',onDispose);
});

test('extras pause exactly, replay deterministically, and have no reduced-motion time drift or later height ownership',()=>{
 for(const [kind]of cases)for(const option of ['d','e'] as const)for(const hand of [-1,1]){const s=make(kind,hand),show=createMeadowExtraVariant(s,option,material,lights)!;const replay=()=>{for(let i=0;i<=100;i++)show.update(i/30,s.start-12+i*s.length/100,false);};replay();const first=matrices(show.group);replay();assert.deepEqual(matrices(show.group),first);show.update(100/30,s.end-12,false);assert.deepEqual(matrices(show.group),first);show.update(0,s.start+s.length*.5,true);const still=matrices(show.group);show.update(100,s.start+s.length*.5,true);assert.deepEqual(matrices(show.group),still);for(const f of s.frames)f.position.y+=40;show.update(100,s.start+s.length*.5,true);assert.deepEqual(matrices(show.group),still);show.dispose();}
});

test('seesaw sheep stay planted on their boards and launch apples into the basket',()=>{
 const s=make('sheepbank'),show=createMeadowExtraVariant(s,'d',material,lights)!,boards=mesh(show.group,'orchard-seesaws'),sheep=mesh(show.group,'orchard-riding-sheep'),apples=mesh(show.group,'orchard-flying-apples');show.update(0,s.start-1,false);show.update(1,at(s,.18),false);let high=0;
 for(const age of [0,.2,.65,1,1.4,2.2,3]){show.update(1+age,at(s,.18),false);assert.ok(position(pose(sheep)).distanceTo(new T.Vector3(-3.75,.2,0).applyMatrix4(pose(boards)))<1e-5);high=Math.max(high,position(pose(apples)).y);}
 assert.ok(high>8,'Harvest has a broad readable apple arc');const landing=position(pose(apples));assert.ok(Math.abs(landing.y-2.16)<1e-5);assert.ok(Math.abs(landing.x-(position(pose(boards)).x+7.5))<1e-5);show.dispose();
});

test('airship hoist rope ends on its parcel and baskets stay on their sheep',()=>{
 const s=make('sheepbank'),show=createMeadowExtraVariant(s,'e',material,lights)!,ships=mesh(show.group,'postal-sheep-airships'),baskets=mesh(show.group,'airship-baskets'),parcels=mesh(show.group,'airship-parcels'),ropes=mesh(show.group,'airship-hoist-ropes');show.update(0,s.start-1,false);show.update(1,at(s,.17),false);let low=Infinity;
 for(const age of [0,.3,.7,1.5,4,5.5,7]){show.update(1+age,at(s,.17),false);for(let i=0;i<3;i++){assert.ok(position(pose(ships,i)).distanceTo(position(pose(baskets,i)))<1e-5);const end=new T.Vector3(0,-1,0).applyMatrix4(pose(ropes,i)),top=new T.Vector3(0,.91,0).applyMatrix4(pose(parcels,i));assert.ok(end.distanceTo(top)<1e-5);low=Math.min(low,position(pose(parcels,i)).y);}}assert.ok(low<2);show.dispose();
});

test('turtle paddles, picnic decks and ducks remain attached during the rowing stroke',()=>{
 const s=make('pondbridge'),show=createMeadowExtraVariant(s,'d',material,lights)!,bodies=mesh(show.group,'picnic-turtles'),paddles=mesh(show.group,'turtle-paddles'),decks=mesh(show.group,'turtle-picnic-decks'),ducks=mesh(show.group,'turtle-duck-guests');show.update(0,s.start-1,false);show.update(1,at(s,.3),false);
 for(const age of [0,.2,.6,1.3,3,5]){show.update(1+age,at(s,.3),false);for(let i=0;i<2;i++){assert.ok(position(pose(decks,i)).distanceTo(position(pose(bodies,i)))<1e-5);for(let j=0;j<4;j++)assert.ok(position(pose(paddles,i*4+j)).distanceTo(new T.Vector3((j<2?1:-1)*2,.65,(j%2?1:-1)*1.85).applyMatrix4(pose(bodies,i)))<1e-5);for(let j=0;j<2;j++)assert.ok(position(pose(ducks,i*2+j)).distanceTo(new T.Vector3((j?1:-1)*1.05,3.3,.6).applyMatrix4(pose(bodies,i)))<1e-5);}}
 show.dispose();
});

test('watering streams remain attached to moving spouts and flowers open radially',()=>{
 const s=make('pondbridge'),show=createMeadowExtraVariant(s,'e',material,lights)!,cans=mesh(show.group,'waltzing-watering-cans'),streams=mesh(show.group,'can-to-lily-streams'),flowers=mesh(show.group,'watered-lily-faces'),petals=mesh(show.group,'watered-lily-petals');show.update(0,s.start-1,false);show.update(1,at(s,.2),false);
 for(const age of [.2,.7,2,5]){show.update(1+age,at(s,.2),false);const spout=new T.Vector3(4.03,1.81,0).applyMatrix4(pose(cans)),source=new T.Vector3(0,-.5,0).applyMatrix4(pose(streams));assert.ok(spout.distanceTo(source)<1e-5,'Water starts at the moving spout');const target=new T.Vector3(0,.5,0).applyMatrix4(pose(streams));assert.ok(Math.abs(target.y-1.2)<1e-5);}
 show.update(6,at(s,.2),false);const center=position(pose(flowers));const tips=Array.from({length:8},(_,i)=>new T.Vector3(0,2,0).applyMatrix4(pose(petals,i)).sub(center));assert.ok(tips.some(p=>p.x>1.5)&&tips.some(p=>p.x< -1.5)&&tips.some(p=>p.z>1.5)&&tips.some(p=>p.z< -1.5),'Petals fan out in every direction');show.dispose();
});

test('mouse parachute baskets follow seeds and pancakes fully flip before landing on plates',()=>{
 const s=make('windmillloop'),show=createMeadowExtraVariant(s,'d',material,lights)!,seeds=mesh(show.group,'dandelion-parachutes'),mice=mesh(show.group,'dandelion-mouse-passengers');show.update(0,s.start-1,false);show.update(1,at(s,.38),false);for(const age of [0,.3,2,4,6,8,10]){show.update(1+age,at(s,.38),false);for(let i=0;i<6;i++)assert.ok(position(pose(mice,i)).distanceTo(new T.Vector3(0,-1.2,0).applyMatrix4(pose(seeds,i)))<1e-5);if(age===8){for(let i=0;i<12;i++)assert.ok(Math.abs(position(pose(seeds,i)).y-(i<6?3:1.95))<1e-5,'Every seed reaches its own pot before resetting');}}show.dispose();
 const mill=createMeadowExtraVariant(s,'e',material,lights)!,cakes=mesh(mill.group,'flying-pancakes'),pans=mesh(mill.group,'pancake-flipping-pans');mill.update(0,s.start-1,false);mill.update(1,at(s,.28),false);const start=position(pose(cakes));mill.update(2.4,at(s,.28),false);assert.ok(position(pose(cakes)).y>start.y+5);assert.ok(pose(cakes).elements[0]<-.99,'Halfway pancake is upside down');mill.update(3.3,at(s,.28),false);assert.ok(Math.abs(position(pose(cakes)).y-1.8)<1e-5);assert.ok(pose(cakes).elements[0]>.99);assert.ok(Math.abs(position(pose(cakes)).x-position(pose(pans)).x)>3.9);mill.dispose();
});

test('only the three Meadow special pieces receive extra designs',()=>{const plain=new MiniSection(0,'hill',0,new T.Vector3(0,4,0),60,8,0,1);assert.equal(createMeadowExtraVariant(plain,'d',material,lights),undefined);});

test('every moving actor remains outside the carriage corridor in either handed track',()=>{
 const box=new T.Box3();
 for(const [kind]of cases)for(const option of ['d','e'] as const)for(const hand of [-1,1]){const s=make(kind,hand),show=createMeadowExtraVariant(s,option,material,lights)!,low=Math.min(...s.frames.map(f=>f.position.z-s.origin.z))-2,high=Math.max(...s.frames.map(f=>f.position.z-s.origin.z))+2,pools:T.InstancedMesh[]=[];show.group.traverse(o=>{if(o instanceof T.InstancedMesh){o.geometry.computeBoundingBox();pools.push(o);}});for(let frame=0;frame<=80;frame++){show.update(frame/8,s.start-12+frame*s.length/35,false);for(const pool of pools)for(let i=0;i<pool.count;i++){box.copy(pool.geometry.boundingBox!).applyMatrix4(pose(pool,i));assert.ok(box.max.z<low||box.min.z>high,`${kind} ${option} ${pool.name} ${i} must keep a two-metre clear corridor`);}}show.dispose();}
});
