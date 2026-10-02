import * as T from 'three';
import { AdventureScene } from '../games/adventure-scene';
import { AdventureScene as BeforeScene } from './before/adventure-scene';
import { WORLDS } from '../games/adventure-worlds';
import { MiniTrack, createMiniSection, type MiniKind, type MiniSection } from '../games/mini-track';
import { seededRandom } from '../games/mini-rail';
import { railGeometries } from '../games/mini-mesh';
import { createMiniCar, createMiniParcel } from '../games/train-model';
import { WorldModel, WORLD_SHAPES as G } from '../games/world-models';

/** Only the selected pair of pieces is resident. Both use identical track,
 * train, light and camera settings; the frozen before scene is review-only. */
export class PieceReviewScene {
 readonly scene=new T.Scene();
 readonly section:MiniSection;
 readonly track=new MiniTrack(71,{generative:true});
 readonly attraction:AdventureScene|BeforeScene;
 readonly bounds=new T.Box3();
 private ground:T.Mesh;
 private staticGroup=new T.Group();
 private train:T.InstancedMesh[]=[];
 private materials:T.Material[]=[];
 private dummy=new T.Object3D();
 constructor(kind:MiniKind,before:boolean,km=0){
  const world=WORLDS.find(w=>w.pieces.includes(kind))!;
  this.scene.background=new T.Color(world.sky);
  this.scene.add(new T.HemisphereLight(world.ambient,'#687288',2.4));
  const sun=new T.DirectionalLight(world.light,3-world.darkness*1.6);sun.position.set(-30,80,60);this.scene.add(sun);
  this.section=createMiniSection(kind,km*1000,new T.Vector3(0,4,0),km?20:0,seededRandom(71));
  this.track.sections.splice(0,this.track.sections.length,this.section);
  this.scene.add(this.staticGroup);
  const material=(color:string)=>{const m=new T.MeshStandardMaterial({color,roughness:.85,flatShading:true});this.materials.push(m);return m;};
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
  this.staticGroup.add(supports.finish(solid,solid,false));
  for(const open of [false,true]){
   const source=createMiniCar('#dcdf9c',open);if(open)for(const z of [-.43,.43]){const parcel=createMiniParcel();parcel.position.set(0,.69,z);parcel.scale.setScalar(.8);source.add(parcel);}
   source.updateMatrixWorld(true);const model=new WorldModel(),geometries=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();
   source.traverse(o=>{if(o instanceof T.Mesh){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);model.add(geometry,'#'+(o.material as T.MeshStandardMaterial).color.getHexString(),[0,0,0]);geometry.dispose();geometries.add(o.geometry);mats.add(o.material as T.Material);}});
   geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
   const merged=model.finish(solid,solid,false).children[0] as T.Mesh;
   const mesh=new T.InstancedMesh(merged.geometry,solid,3);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;this.train.push(mesh);this.scene.add(mesh);
  }
  this.attraction=before?new BeforeScene(this.scene,{attractionsOnly:true,world}):new AdventureScene(this.scene,{attractionsOnly:true,world});
  this.attraction.render(this.track,this.section.start-12,0,0,0);
  this.scene.updateMatrixWorld(true);
  this.bounds.setFromObject(this.staticGroup).union(new T.Box3().setFromObject(this.attraction.group));
  const center=this.bounds.getCenter(new T.Vector3()),size=this.bounds.getSize(new T.Vector3());
  this.ground=new T.Mesh(new T.BoxGeometry(size.x+16,.65,size.z+16),material(world.ground));this.ground.position.set(center.x,-.4,center.z);this.staticGroup.add(this.ground);
 }
 update(time:number,distance:number,cutaway:boolean){
  const s=this.section;this.attraction.setTunnelCutaway(cutaway);this.attraction.render(this.track,distance,0,0,time);
  this.train.forEach(mesh=>mesh.count=0);
  for(let i=0;i<6;i++){
   const d=distance-i*2.4,at=T.MathUtils.clamp(d,s.start,s.end),f=s.sample(at);f.position.addScaledVector(f.tangent,d-at);
   const mesh=this.train[i%2];this.dummy.position.copy(f.position);this.dummy.quaternion.copy(f.rotation);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
  }
  this.train.forEach(mesh=>{mesh.visible=distance<s.end+55;mesh.instanceMatrix.needsUpdate=true;});
 }
 destroy(){
  this.attraction.destroy();
  this.staticGroup.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.InstancedMesh)o.dispose();});
  this.train.forEach(m=>{m.geometry.dispose();m.dispose();});this.materials.forEach(m=>m.dispose());this.scene.clear();
 }
}
