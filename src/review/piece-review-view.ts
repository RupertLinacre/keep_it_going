import * as T from 'three';
import { AdventureScene } from '../games/adventure-scene';
import { AdventureScene as BeforeScene } from './before/adventure-scene';
import { WORLDS } from '../games/adventure-worlds';
import { MiniTrack, createMiniSection, type MiniKind, type MiniSection } from '../games/mini-track';
import { seededRandom } from '../games/mini-rail';
import { railGeometries } from '../games/mini-mesh';
import { createMiniCar, createMiniFunnel, createMiniParcel, MINI_FUNNEL_OUTLET } from '../games/train-model';
import { TrainSmoke } from '../games/train-smoke';
import { WorldModel, WORLD_SHAPES as G } from '../games/world-models';
import { createVariant } from './variants';
import { carouselCenter,carouselRideRadius } from '../games/world-night';
import type { DesignOption } from './variants/variant-kit';
import type { ReviewKind } from './piece-review-data';
export type ReviewVersion = 'original' | DesignOption;
export interface ReviewScene {
 readonly scene:T.Scene;
 readonly section:{kind:ReviewKind;start:number;end:number;length:number};
 readonly bounds:T.Box3;
 readonly attractionBounds:T.Box3;
 readonly cameraFacing?:T.Vector3;
 update(time:number,distance:number,cutaway:boolean):void;
 destroy():void;
}

/** Only the selected pair of pieces is resident. Both use identical track,
 * train, light and camera settings; the frozen before scene is review-only. */
export class PieceReviewScene implements ReviewScene {
 readonly scene=new T.Scene();
 readonly section:MiniSection;
 readonly track=new MiniTrack(71,{generative:true});
 readonly attraction:AdventureScene|BeforeScene;
 readonly bounds=new T.Box3();
 readonly attractionBounds=new T.Box3();
 private ground:T.Mesh;
 private staticGroup=new T.Group();
 private train:T.InstancedMesh[]=[];
 private materials:T.Material[]=[];
 private dummy=new T.Object3D();
 private funnel:T.Group;
 private smoke=new TrainSmoke();
 private lastTime=0;
 private smokeEmitter=new T.Vector3();
 private smokeDirection=new T.Vector3();
 private smokeVelocity=new T.Vector3();
 constructor(kind:MiniKind,version:ReviewVersion,km=0){
  const world=WORLDS.find(w=>w.pieces.includes(kind))!;
  this.scene.background=new T.Color(world.sky);
  this.scene.add(new T.HemisphereLight(world.ambient,'#687288',2.4));
  const sun=new T.DirectionalLight(world.light,3-world.darkness*1.6);sun.position.set(-30,80,60);this.scene.add(sun);
  this.section=createMiniSection(kind,km*1000,new T.Vector3(0,4,0),km?20:0,seededRandom(71));
  this.track.sections.splice(0,this.track.sections.length,this.section);
  this.scene.add(this.staticGroup);
  const material=(color:string)=>{const m=new T.MeshStandardMaterial({color,roughness:.85,flatShading:true});this.materials.push(m);return m;};
  this.funnel=createMiniFunnel((geometry,color)=>new T.Mesh(geometry,material(color)));
  this.scene.add(this.funnel,this.smoke.group);
  const rail=material(world.rail),ties=material('#cfbc98'),solid=new T.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true});this.materials.push(solid);
  const bed=new T.Group();bed.position.copy(this.section.origin);this.staticGroup.add(bed);
  for(const geometry of railGeometries(this.section,this.section.start,this.section.end))bed.add(new T.Mesh(geometry,rail));
  const count=Math.ceil(this.section.length/.75),sleepers=new T.InstancedMesh(new T.BoxGeometry(1.55,.13,.18).translate(0,-.14,0),ties,count);
  for(let i=0;i<count;i++){
   const f=this.section.sample(this.section.start+this.section.length*i/count);this.dummy.position.copy(f.position);this.dummy.quaternion.copy(f.rotation);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();sleepers.setMatrixAt(i,this.dummy.matrix);
  }
  this.staticGroup.add(sleepers);
  const supports=new WorldModel();
  for(let d=this.section.start;d<this.section.end;d+=8){const f=this.section.sample(d);if(f.up.y>.15)supports.beam('#a5b6ad',new T.Vector3(f.position.x,0,f.position.z),f.position.clone().addScaledVector(f.up,-.25),.13);}
  // Short common entry/exit stubs let each coach leave the demo cleanly. It
  // must not keep sailing through empty space while the attraction coasts.
  for(const [distance,sign] of [[this.section.start,-1],[this.section.end,1]]){
   const f=this.section.sample(distance),end=f.position.clone().addScaledVector(f.tangent,sign*4);
   for(const side of [-1,1])supports.beam(world.rail,f.position.clone().addScaledVector(f.right,side*.55),end.clone().addScaledVector(f.right,side*.55),.075);
   const rotation=new T.Euler().setFromQuaternion(f.rotation);
   for(let d=.6;d<4;d+=.75){const p=f.position.clone().addScaledVector(f.tangent,d*sign).addScaledVector(f.up,-.14);supports.add(G.box,'#cfbc98',p.toArray(),[1.55,.13,.18],[rotation.x,rotation.y,rotation.z]);}
  }
  this.staticGroup.add(supports.finish(solid,solid,false));
  for(const open of [false,true]){
   const source=createMiniCar('#dcdf9c',open);if(open)for(const z of [-.43,.43]){const parcel=createMiniParcel();parcel.position.set(0,.69,z);parcel.scale.setScalar(.8);source.add(parcel);}
   source.updateMatrixWorld(true);const model=new WorldModel(),geometries=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();
   source.traverse(o=>{if(o instanceof T.Mesh){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);model.add(geometry,'#'+(o.material as T.MeshStandardMaterial).color.getHexString(),[0,0,0]);geometry.dispose();geometries.add(o.geometry);mats.add(o.material as T.Material);}});
   geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
   const merged=model.finish(solid,solid,false).children[0] as T.Mesh;
   const mesh=new T.InstancedMesh(merged.geometry,solid,3);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;this.train.push(mesh);this.scene.add(mesh);
  }
  this.attraction=version==='original'?new BeforeScene(this.scene,{attractionsOnly:true,world}):new AdventureScene(this.scene,{attractionsOnly:true,world,
   ...(version==='a'?{}:{pieceFactory:(s,m,l)=>createVariant(s,version,m,l)})});
  this.attraction.render(this.track,this.section.start-12,0,0,0);
  this.scene.updateMatrixWorld(true);
  this.attractionBounds.setFromObject(this.attraction.group);
  if(kind==='carouselhelix'){
   // Decorative bulbs follow the long exit rail. They must not stop Closer
   // look from actually framing the palace, tea party or planetary decks.
   const rotor=this.attraction.group.getObjectByName('carousel-rotor');
   if(rotor)this.attractionBounds.setFromObject(rotor).expandByScalar(1.2);
   else{
    const center=carouselCenter(this.section),r=carouselRideRadius(this.section)+2;
    this.attractionBounds.set(new T.Vector3(center.x-r,0,center.z-r),new T.Vector3(center.x+r,this.section.origin.y+this.section.amplitude*.84+8,center.z+r));
   }
  }
  // Some attractions have a deliberate launch above their resting silhouette.
  // Reserve that space once, so the camera does not crop or chase the rocket.
  let headroom=0;this.attraction.group.traverse(o=>{headroom=Math.max(headroom,Number(o.userData.reviewHeadroom)||0);});
  this.attractionBounds.max.y+=headroom;
  this.bounds.setFromObject(this.staticGroup).union(this.attractionBounds);
  const center=this.bounds.getCenter(new T.Vector3()),size=this.bounds.getSize(new T.Vector3());
  this.ground=new T.Mesh(new T.BoxGeometry(size.x+16,.65,size.z+16),material(world.ground));this.ground.position.set(center.x,-.4,center.z);this.staticGroup.add(this.ground);
 }
 update(time:number,distance:number,cutaway:boolean){
  if(time<this.lastTime){this.smoke.reset();this.lastTime=0;}
  const dt=Math.max(0,time-this.lastTime);this.lastTime=time;
  const s=this.section;this.attraction.setTunnelCutaway(cutaway);this.attraction.render(this.track,distance,0,0,time);
  this.train.forEach(mesh=>mesh.count=0);
  this.funnel.visible=false;
  for(let i=0;i<6;i++){
   const d=distance-i*2.4;if(d<s.start-4||d>s.end+4)continue;
   const at=T.MathUtils.clamp(d,s.start,s.end),f=s.sample(at);f.position.addScaledVector(f.tangent,d-at);
   const mesh=this.train[i%2];this.dummy.position.copy(f.position);this.dummy.quaternion.copy(f.rotation);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
   if(i===0){
    this.funnel.visible=true;this.funnel.position.copy(f.position);this.funnel.quaternion.copy(f.rotation);
    this.smokeEmitter.copy(MINI_FUNNEL_OUTLET).applyQuaternion(f.rotation).add(f.position);
    this.smokeDirection.set(0,1,0).applyQuaternion(f.rotation);this.smokeVelocity.copy(f.tangent).multiplyScalar(24);
   }
  }
  this.smoke.update(dt,this.funnel.visible?this.smokeEmitter:null,this.smokeDirection,24,'normal',this.smokeVelocity);
  this.train.forEach(mesh=>{mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;});
 }
 destroy(){
  this.attraction.destroy();
  this.smoke.dispose();this.funnel.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  this.staticGroup.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.InstancedMesh)o.dispose();});
  this.train.forEach(m=>{m.geometry.dispose();m.dispose();});this.materials.forEach(m=>m.dispose());this.scene.clear();
 }
}
