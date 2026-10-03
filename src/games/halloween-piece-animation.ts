import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import { witchHatCenter } from './world-halloween';
import type { PieceAnimationFactory, PieceAnimation } from './piece-animation';
import type { MiniSection } from './mini-track';
import { portalHitDistance } from './pumpkin-portal';

/** Candy, drumsticks and flying broomsticks use two small fixed batches. */
class HalloweenPieceAnimation implements PieceAnimation {
  readonly group=new T.Group();
  private dummy=new T.Object3D();
  private mesh:T.InstancedMesh;
  private spark:T.InstancedMesh;
  private glow=new T.MeshBasicMaterial({vertexColors:true});
  private triggers:number[]=[];
  private fired:number[]=[];
  private previous=-Infinity;
  private lastTime=-1;
  private positions:T.Vector3[]=[];
  private portalCenter:T.Vector3;
  private portalRotation:T.Quaternion;
  constructor(private section:MiniSection,material:T.Material){
    const portalFrame=section.sample(section.start+section.length/2);
    this.portalCenter=portalFrame.position.clone();this.portalRotation=portalFrame.rotation.clone();
    this.portalCenter.x-=section.origin.x;this.portalCenter.z-=section.origin.z;
    const model=new WorldModel();
    if(section.kind==='witchhat'){
      model.add(G.pole,'#ddbb7f',[0,0,0],[.08,3.1,.08],[0,0,Math.PI/2]);
      for(let i=0;i<6;i++)model.add(G.cone,i%2?'#eabd70':'#ce9863',[-1.45,(i-2.5)*.1,0],[.12,1,.14],[0,0,Math.PI/2+.07*(i-2.5)]);
      model.add(G.round,'#d6c5f0',[.2,.3,0],[.45,.37,.34]);
      for(const s of [-1,1]){
        model.add(G.cone,'#d6c5f0',[.32,.67,s*.19],[.14,.35,.12]);
        model.add(G.round,'#564566',[.53,.37,s*.21],[.045,.07,.07]);
      }
      model.add(G.cone,'#8c6ea9',[.1,.78,0],[.38,.65,.37],[0,0,.3]);
      model.add(G.pole,'#e7c488',[.1,.64,0],[.32,.08,.32]);
      for(const side of [-1,1]){
        model.add(G.round,'#ecaccb',[.48,.29,side*.23],[.07,.07,.08]);
        model.add(G.round,'#d6c5f0',[.32,.06,side*.27],[.16,.13,.12]);
      }
      // A curled kitten tail and a ribbon make the flying silhouette readable.
      let tail=new T.Vector3(-.2,.28,0);
      for(let j=1;j<5;j++){const a=j*.5,p=new T.Vector3(-.2-Math.sin(a)*.38,.28+j*.11,0);model.beam('#d6c5f0',tail,p,.065);tail=p;}
      model.add(G.box,'#ecaccb',[-.46,.31,.01],[.32,.15,.24],[0,0,-.3]);
      this.triggers=[section.start+section.length*.38];
    }else if(section.kind==='pumpkinhop'){
      model.add(G.pole,'#e4bc91',[0,0,0],[.09,2.2,.09]);
      model.add(G.round,'#c7f081',[0,-1.1,0],[.43,.38,.43]);
      for(let j=0;j<4;j++)model.add(G.pole,j%2?'#f5dc9e':'#be83bc',[0,.12+j*.25,0],[.12,.12,.12]);
      for(let i=0;i<3;i++){
        const f=section.frames[Math.round(section.resolution*(i+.5)/3)];
        this.positions.push(new T.Vector3(f.position.x-section.origin.x,f.position.y+.1,f.position.z-section.origin.z));
        this.triggers.push(section.start+section.distances[Math.round(section.resolution*(i+.5)/3)]);
      }
    }else{
      // Little wrapped sweets tumble out of the pumpkin candy arch.
      model.add(G.rock,'#c7f081',[0,0,0],[.35,.28,.28]);
      for(const s of [-1,1])model.add(G.cone,'#e7b2dd',[s*.42,0,0],[.22,.38,.22],[0,0,s*Math.PI/2]);
      this.triggers=[portalHitDistance(section)];
    }
    const baked=model.finish(material,material,false).children[0] as T.Mesh;
    this.mesh=new T.InstancedMesh(baked.geometry,material,24);this.mesh.count=0;this.mesh.frustumCulled=false;
    const sparkModel=new WorldModel();
    sparkModel.add(G.rock,'#c5ff7e',[0,0,0],[.14,.3,.14]);
    const bits=sparkModel.finish(this.glow,this.glow,false).children[0] as T.Mesh;
    this.spark=new T.InstancedMesh(bits.geometry,this.glow,96);this.spark.count=0;this.spark.frustumCulled=false;
    this.group.add(this.mesh,this.spark);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.spark.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  private put(mesh:T.InstancedMesh,p:T.Vector3,size=1,rx=0,ry=0,rz=0){
    this.dummy.position.copy(p);this.dummy.rotation.set(rx,ry,rz);this.dummy.scale.setScalar(size);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
  }
  update(time:number,distance:number,reduced:boolean){
    if(time<this.lastTime||distance<this.previous-5){this.fired=[];this.previous=-Infinity;}
    for(let i=0;i<this.triggers.length;i++)if(Number.isFinite(this.previous)&&this.previous<this.triggers[i]&&distance>=this.triggers[i])this.fired[i]=time;
    this.previous=distance;this.lastTime=time;this.mesh.count=0;this.spark.count=0;
    const s=this.section;
    if(s.kind==='witchhat'){
      const {x,z,radius}=witchHatCenter(s),age=time-(this.fired[0]??-1e6),energy=age>=0?Math.exp(-age*.2):0;
      for(let i=0;i<3;i++){
        const boost=this.fired[0]===undefined?0:2*(1-energy);
        const angle=i*Math.PI*2/3+(reduced?0:time*.24+boost);
        const r=Math.max(3,radius*.49),y=s.amplitude*.8+2;
        // Face along the orbit: radial broom tails reach into the banked train.
        this.put(this.mesh,new T.Vector3(x+Math.sin(angle)*r,y+(reduced?0:Math.sin(angle*2+i)*.65),z+Math.cos(angle)*r),1,0,angle,.09*Math.sin(angle));
        if(!reduced)for(let j=0;j<6;j++){
          const a=angle-.08*(j+1),trail=new T.Vector3(x+Math.sin(a)*r,y+Math.sin(a*2+i)*.65-.12*j,z+Math.cos(a)*r);
          this.put(this.spark,trail,(1-j/7)*(.65+energy*.65),0,a,.5);
        }
      }
      if(!reduced)for(let i=0;i<36;i++){
        const t=(time*.23+i/36)%1,a=t*Math.PI*5;
        const r=Math.max(1,(radius-2)*(1-t)*.85);
        this.put(this.spark,new T.Vector3(x+Math.sin(a)*r,3+t*(s.amplitude+4),z+Math.cos(a)*r),.7+energy*.8,0,a,.3);
      }
    }else if(s.kind==='pumpkinhop'){
      for(let i=0;i<3;i++)for(const side of [-1,1]){
        const age=time-(this.fired[i]??-1e6),beat=!reduced&&age>=0&&age<2?Math.max(0,Math.sin(age*17))*Math.exp(-age*1.5):0;
        // The green head is below the raised handle pivot. Its first downstroke
        // meets the drum skin; the whole handle stays above that surface.
        const p=this.positions[i].clone();p.z+=side*4.8;p.y+=2.67;
        this.put(this.mesh,p,1,side*.72*(1-beat),0,0);
        if(!reduced&&age>=0&&age<2.2)for(let j=0;j<12;j++){
          const phi=j*2.39996,t=age;
          const bit=this.positions[i].clone();bit.z+=side*(4.8+t*(1.5+j%3));bit.x+=Math.cos(phi)*t*2;
          bit.y+=1.2+(5+j%4)*t-4*t*t;
          this.put(this.spark,bit,Math.max(0,1-t/2.2),0,phi,t*3);
        }
      }
    }else{
      const age=time-(this.fired[0]??-1e6);
      if(reduced||this.fired[0]===undefined||age>3.2)for(let i=0;i<8;i++){
        const side=i<4?-1:1,a=(i%4)*Math.PI/2+(reduced?0:time*.6),local=new T.Vector3(side*8.5+Math.sin(a)*1.6,4.45+Math.cos(a)*1.6,2.4);
        local.applyQuaternion(this.portalRotation).add(this.portalCenter);
        this.put(this.mesh,local,.75,0,0,a);
      }
      if(!reduced&&age>=0&&age<3.2)for(let i=0;i<24;i++){
        const phi=i*2.39996,travel=(1-Math.exp(-age))*.85;
        const p=this.portalCenter.clone().add(new T.Vector3(Math.cos(phi)*(5+i%4)*travel,4+(5+i%4)*age-3.5*age*age,Math.sin(phi)*(6+i%3)*travel));
        p.y=Math.max(.3,p.y);
        this.put(this.mesh,p,Math.max(0,1-age/3.2),age*2,phi,age*3);
      }
    }
    for(const mesh of [this.mesh,this.spark]){mesh.visible=mesh.count>0;if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;}
  }
  dispose(){for(const mesh of [this.mesh,this.spark]){mesh.geometry.dispose();mesh.dispose();}this.glow.dispose();this.group.removeFromParent();}
}
export const createHalloweenPieceAnimation:PieceAnimationFactory=(section,material)=>
  ['pumpkinhop','pumpkintunnel','witchhat'].includes(section.kind)?new HalloweenPieceAnimation(section,material):undefined;
