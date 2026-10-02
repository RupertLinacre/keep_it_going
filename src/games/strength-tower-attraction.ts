import * as T from 'three';
import { StrengthTowerModel } from './strength-tower-model';
import { towerJunctionModel } from './strength-tower-rail';
import { FairgroundLights } from './world-lighting';
import type { StrengthTower } from './strength-tower';

/** A normal scene child: same camera, ground, renderer and light rig as the ride. */
export class StrengthTowerAttraction {
  readonly group=new T.Group();
  private model=new StrengthTowerModel();
  private solid=new T.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true});
  private glow=new FairgroundLights();
  private junction=towerJunctionModel().finish(this.solid,this.glow);
  private particles:T.InstancedMesh;
  private bits:{p:T.Vector3;v:T.Vector3;life:number;size:number;confetti:boolean}[]=[];
  private dummy=new T.Object3D();
  private lastTime=0;
  private marker=0;
  private exitRise=0;
  private lever=new T.Mesh(new T.BoxGeometry(.12,1.6,.12),new T.MeshStandardMaterial({color:"#e4c89d",roughness:.8}));
  private celebrated=false;
  private geometry=new T.BoxGeometry(1,1,.15);
  private material=new T.MeshBasicMaterial({color:'#ffffff'});
  constructor(){
    this.group.add(this.junction,this.model.group);
    this.lever.position.set(53,1.1,-13);this.group.add(this.lever);
    this.particles=new T.InstancedMesh(this.geometry,this.material,240);this.particles.frustumCulled=false;this.particles.count=0;
    this.group.add(this.particles);
  }
  setExitRise(rise:number){
    if(Math.abs(rise-this.exitRise)<.001)return;
    this.exitRise=rise;this.junction.removeFromParent();this.junction.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
    this.junction=towerJunctionModel(rise).finish(this.solid,this.glow);this.group.add(this.junction);
  }
  update(time:number,engine:T.Vector3,tower?:StrengthTower,remoteHeight=0){
    const dt=Math.min(.05,Math.max(0,time-this.lastTime));this.lastTime=time;
    const height=tower?.motion.height??remoteHeight,peak=tower?.motion.peak??height;
    this.lever.rotation.z=T.MathUtils.damp(this.lever.rotation.z,tower&&(tower.motion.phase==="descend"||tower.motion.phase==="exit")?.5:-.5,5,dt);
    this.model.update(height,peak,time,engine);this.glow.clock.value=time;
    this.group.updateWorldMatrix(true,false);this.glow.trains.value[0].copy(engine).applyMatrix4(this.group.matrixWorld);
    if(tower?.motion.phase==='climb'&&height>=this.marker+8){
      this.marker=Math.floor(height/8)*8;
      for(const side of [-1,1])this.burst(new T.Vector3(50+side*5.5,8+height,-13.4),side,false);
    }
    if(tower?.motion.phase==='celebrate'&&!this.celebrated){this.celebrated=true;this.burst(new T.Vector3(50,8+height,-10),0,true);}
    if(!tower){this.marker=0;this.celebrated=false;}
    let count=0;
    this.bits=this.bits.filter(p=>p.life>0);
    for(const bit of this.bits){
      bit.life-=dt;bit.v.y-=(bit.confetti?4:9)*dt;bit.p.addScaledVector(bit.v,dt);
      this.dummy.position.copy(bit.p);this.dummy.rotation.set(bit.confetti?time*2:0,bit.confetti?time:0,bit.confetti?time+count:Math.atan2(-bit.v.x,bit.v.y));
      const fade=Math.min(1,bit.life*2);this.dummy.scale.set(bit.size*fade,bit.size*(bit.confetti?2.8:5)*fade,1);this.dummy.updateMatrix();
      this.particles.setMatrixAt(count,this.dummy.matrix);this.particles.setColorAt(count,new T.Color(['#ffc876','#ed97c6','#9cdfd4','#b8a3f5'][count%4]));count++;
    }
    this.particles.count=count;this.particles.visible=count>0;
    if(count){this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;}
  }
  private burst(p:T.Vector3,side:number,confetti:boolean){
    for(let i=0;i<(confetti?130:26)&&this.bits.length<240;i++)this.bits.push({p:p.clone(),v:new T.Vector3(side?side*(3+Math.random()*8):(Math.random()-.5)*16,4+Math.random()*10,Math.random()*4),life:confetti?3.5:1.2+Math.random()*.4,size:confetti?.15:.12,confetti});
  }
  destroy(){this.lever.geometry.dispose();(this.lever.material as T.Material).dispose();this.model.destroy();this.junction.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.solid.dispose();this.glow.dispose();this.geometry.dispose();this.material.dispose();this.particles.dispose();this.group.removeFromParent();}
}
