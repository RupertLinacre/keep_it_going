import * as T from 'three';
import { createMiniCar, createMiniFunnel, createMiniParcel, MINI_FUNNEL_OUTLET } from '../games/train-model';
import { TrainSmoke, type SmokeVariant } from '../games/train-smoke';
import { mergeStaticMeshes } from '../games/mini-mesh';
import type { ReviewVersion, ReviewScene } from './piece-review-view';

export const SMOKE_REVIEW_DURATION=25;
const RADIUS=6.7, SPEED=Math.PI*2*RADIUS*4/SMOKE_REVIEW_DURATION;
const UP=new T.Vector3(0,1,0),CLOSEUP_SIZE=new T.Vector3(11,7,11);
export function smokeReviewVariant(time:number,version:ReviewVersion):SmokeVariant{
 return version==='original'||time<2||time>=22?'normal':version;
}
export function smokeReviewPhase(time:number){
 return time<2?'Normal smoke · power-up next':time<22?`Power-up · ${Math.ceil(22-time)} seconds left`:'Back to normal smoke';
}

/** A small moving-train scene, independent of the special-track registry. */
export class SmokeReviewScene implements ReviewScene {
 readonly scene=new T.Scene();
 readonly section={kind:'smoke' as const,start:0,end:SPEED*SMOKE_REVIEW_DURATION,length:SPEED*SMOKE_REVIEW_DURATION};
 readonly bounds=new T.Box3(new T.Vector3(-8.3,0,-8.3),new T.Vector3(8.3,6.8,8.3));
 readonly attractionBounds=new T.Box3();
 readonly followTarget=new T.Vector3();
 readonly cameraFacing=new T.Vector3(-.25,.64,1);
 private staticGroup=new T.Group();
 private train:T.Group[]=[];
 private smoke=new TrainSmoke();
 private materials=new Map<string,T.MeshStandardMaterial>();
 private lastTime=0;
 private emitter=new T.Vector3();
 private velocity=new T.Vector3();
 private tangent=new T.Vector3();
 private right=new T.Vector3();
 private forwardAxis=new T.Vector3();
 private rotation=new T.Matrix4();

 constructor(private version:ReviewVersion){
  this.scene.background=new T.Color('#e7eee3');
  this.scene.add(new T.HemisphereLight('#fff6dd','#759a8b',2.7));
  const sun=new T.DirectionalLight('#fff0cf',3);sun.position.set(-12,24,14);this.scene.add(sun);
  this.scene.add(this.staticGroup,this.smoke.group);
  const mesh=(geometry:T.BufferGeometry,color:string)=>{
   let material=this.materials.get(color);
   if(!material){material=new T.MeshStandardMaterial({color,roughness:.85});this.materials.set(color,material);}
   return new T.Mesh(geometry,material);
  };
  const add=(geometry:T.BufferGeometry,color:string,x:number,y:number,z:number)=>{
   const item=mesh(geometry,color);item.position.set(x,y,z);this.staticGroup.add(item);return item;
  };
  add(new T.CylinderGeometry(14,14,.5,80),'#afc692',0,-.25,0);
  add(new T.CylinderGeometry(5.5,5.5,.05,64),'#bdd49e',0,.015,0);
  // A quiet circular garden keeps the complete train and its drifting plume in view.
  for(const r of [RADIUS-.54,RADIUS+.54]){
   const points=Array.from({length:97},(_,i)=>new T.Vector3(Math.sin(i/96*Math.PI*2)*r,.39,Math.cos(i/96*Math.PI*2)*r));
   add(new T.TubeGeometry(new T.CatmullRomCurve3(points,true),128,.06,6,true),'#67797a',0,0,0);
  }
  const sleeper=new T.BoxGeometry(1.62,.12,.2);
  for(let i=0;i<64;i++){
   const a=i/64*Math.PI*2;
   const tie=add(sleeper,'#ddc69b',Math.sin(a)*RADIUS,.25,Math.cos(a)*RADIUS);tie.rotation.y=a+Math.PI/2;
  }
  // Small flowerbeds and distant pennants lend a fairground feel without a ride.
  for(const [x,z,r] of [[-2.7,-1.5,.95],[2.8,-2.5,.75],[1.1,2.6,.65]]){
   add(new T.CylinderGeometry(r,r,.08,20),'#a0bb83',x,.08,z);
   for(let i=0;i<7;i++){
    const a=i*2.4,fx=x+Math.cos(a)*r*.65,fz=z+Math.sin(a)*r*.65;
    add(new T.CylinderGeometry(.024,.028,.34,5),'#698b67',fx,.28,fz);
    const flower=add(new T.SphereGeometry(.13,7,5),['#f4d285','#f3a8a0','#f5eed0'][i%3],fx,.48,fz);flower.scale.y=.5;
   }
  }
  for(const x of [-5.5,0,5.5]){
   add(new T.CylinderGeometry(.055,.07,2.2,6),'#8e9f82',x,1.1,-9.2);
   add(new T.SphereGeometry(.1,8,6),'#eac67d',x,2.24,-9.2);
  }
  for(let side=0;side<2;side++){
   const linePoints=Array.from({length:17},(_,i)=>new T.Vector3(-5.5+side*5.5+i/16*5.5,2.18-Math.sin(i/16*Math.PI)*.35,-9.2));
   add(new T.TubeGeometry(new T.CatmullRomCurve3(linePoints),24,.016,4,false),'#eee3bd',0,0,0);
   for(let i=0;i<7;i++){
    const t=(i+.5)/7,x=-5.5+side*5.5+t*5.5,y=2.18-Math.sin(t*Math.PI)*.35;
    const flag=new T.Shape();flag.moveTo(-.19,0);flag.lineTo(.19,0);flag.lineTo(0,-.35);flag.closePath();
    const pennant=add(new T.ShapeGeometry(flag),['#dd9a8c','#e3c279','#9fbbc0'][i%3],x,y,-9.19);
    (pennant.material as T.MeshStandardMaterial).side=T.DoubleSide;
   }
  }
  for(let i=0;i<3;i++){
   const coach=createMiniCar(['#e5ef93','#e9b3a6','#a8c8d0'][i],i>0,mesh);
   if(i===0)coach.add(createMiniFunnel(mesh));
   else for(const z of [-.43,.43]){const parcel=createMiniParcel(mesh);parcel.position.set(0,.68,z);parcel.scale.setScalar(.8);coach.add(parcel);}
   mergeStaticMeshes(coach);
   this.train.push(coach);this.scene.add(coach);
  }
  mergeStaticMeshes(this.staticGroup);
  this.update(0,0,false);
 }

 reviewState(){return {variant:smokeReviewVariant(this.lastTime,this.version),activeCount:this.smoke.activeCount,position:this.train[0].position.toArray()};}

 update(time:number,_distance:number,_cutaway:boolean){
  if(time<this.lastTime){this.smoke.reset();this.lastTime=0;}
  const dt=Math.max(0,time-this.lastTime);this.lastTime=time;
  for(let i=0;i<this.train.length;i++){
   const a=(time*SPEED-i*2.5)/RADIUS-.9;
   const coach=this.train[i];coach.position.set(Math.sin(a)*RADIUS,.43,Math.cos(a)*RADIUS);
   this.tangent.set(Math.cos(a),0,-Math.sin(a));this.right.set(-this.tangent.z,0,this.tangent.x);this.forwardAxis.copy(this.tangent).negate();
   this.rotation.makeBasis(this.right,UP,this.forwardAxis);coach.quaternion.setFromRotationMatrix(this.rotation);
   if(i===0){
    this.emitter.copy(MINI_FUNNEL_OUTLET).applyQuaternion(coach.quaternion).add(coach.position);
    this.velocity.copy(this.tangent).multiplyScalar(SPEED);
    this.followTarget.copy(coach.position).addScaledVector(this.tangent,-2.8);this.followTarget.y+=2;
    this.attractionBounds.setFromCenterAndSize(this.followTarget,CLOSEUP_SIZE);
   }
  }
  this.smoke.update(dt,this.emitter,UP,SPEED,smokeReviewVariant(time,this.version),this.velocity);
 }

 destroy(){
  this.smoke.dispose();
  const geometries=new Set<T.BufferGeometry>();
  for(const group of [this.staticGroup,...this.train])group.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});
  geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.scene.clear();
 }
}
