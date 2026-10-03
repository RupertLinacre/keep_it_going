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
  private accent:T.InstancedMesh;
  private position=new T.Vector3();
  private bookMatrix=new T.Matrix4();
  private bookPosition=new T.Vector3();
  private bookRotation=new T.Quaternion();
  private bookEuler=new T.Euler();
  private bookScale=new T.Vector3(1,1,1);
  private hat:ReturnType<typeof witchHatCenter>;
  private glow=new T.MeshBasicMaterial({vertexColors:true});
  private triggers:number[]=[];
  private fired:number[]=[];
  private previous=-Infinity;
  private lastTime=-1;
  private positions:T.Vector3[]=[];
  private portalCenter:T.Vector3;
  private portalRotation:T.Quaternion;
  constructor(private section:MiniSection,material:T.Material){
    this.hat=witchHatCenter(section);
    const accentModel=new WorldModel();
    const portalFrame=section.sample(section.start+section.length/2);
    this.portalCenter=portalFrame.position.clone();this.portalRotation=portalFrame.rotation.clone();
    this.portalCenter.x-=section.origin.x;this.portalCenter.z-=section.origin.z;
    const model=new WorldModel();
    if(section.kind==='witchhat'){
      // A page hinged along the spine of each kitten's flying spell book.
      accentModel.add(G.box,'#efdfa8',[.27,0,0],[.54,.065,.67]);
      for(let line=0;line<3;line++)accentModel.add(G.box,'#aa8db5',[.29,.038,(line-1)*.15],[.34,.012,.035]);
      accentModel.add(G.round,'#d19bc1',[.38,.046,.17],[.07,.014,.06]);
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
      model.add(G.box,'#785989',[.71,.08,0],[1.18,.08,.75]);
      for(const side of [-1,1]){
        model.add(G.ring,'#e9cd8d',[.56,.4,side*.23],[.12,.14,.12],[0,Math.PI/2,0]);
        model.add(G.round,'#d6c5f0',[.72,.16,side*.37],[.13,.12,.1]);
      }
      this.triggers=[section.start+section.length*.38];
    }else if(section.kind==='pumpkinhop'){
      // Oversized musical notes read as a comic drum-roll even with no sound.
      accentModel.add(G.round,'#e7b1d9',[-.18,-.22,0],[.42,.25,.17],[0,0,.22]);
      accentModel.add(G.box,'#f0c884',[.15,.45,0],[.13,1.45,.13]);
      accentModel.add(G.box,'#f0c884',[.47,1.1,0],[.73,.2,.13],[0,0,-.2]);
      model.add(G.pole,'#e4bc91',[0,0,0],[.09,2.2,.09]);
      model.add(G.round,'#c7f081',[0,-1.1,0],[.43,.38,.43]);
      for(let j=0;j<4;j++)model.add(G.pole,j%2?'#f5dc9e':'#be83bc',[0,.12+j*.25,0],[.12,.12,.12]);
      for(let i=0;i<3;i++){
        const f=section.frames[Math.round(section.resolution*(i+.5)/3)];
        this.positions.push(new T.Vector3(f.position.x-section.origin.x,f.position.y+.1,f.position.z-section.origin.z));
        this.triggers.push(section.start+section.distances[Math.round(section.resolution*(i+.5)/3)]);
      }
    }else{
      accentModel.add(G.box,'#e7b2dd',[.75,.05,0],[1.5,.85,.1]);
      accentModel.add(G.cone,'#d5edac',[1.75,.05,0],[.43,.65,.07],[0,0,-Math.PI/2]);
      accentModel.add(G.round,'#f6e0aa',[.7,.06,.065],[.25,.27,.05]);
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
    const accentGeometry=(accentModel.finish(material,material,false).children[0] as T.Mesh).geometry;
    this.accent=new T.InstancedMesh(accentGeometry,material,12);this.accent.count=0;this.accent.frustumCulled=false;this.accent.name='halloween-character-details';this.accent.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.group.add(this.mesh,this.spark,this.accent);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.spark.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  private put(mesh:T.InstancedMesh,p:T.Vector3,size=1,rx=0,ry=0,rz=0){
    this.dummy.position.copy(p);this.dummy.rotation.set(rx,ry,rz,'XYZ');this.dummy.scale.setScalar(size);this.dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,this.dummy.matrix);
  }
  update(time:number,distance:number,reduced:boolean){
    if(time<this.lastTime||distance<this.previous-5){this.fired=[];this.previous=-Infinity;}
    for(let i=0;i<this.triggers.length;i++)if(Number.isFinite(this.previous)&&this.previous<this.triggers[i]&&distance>=this.triggers[i])this.fired[i]=time;
    this.previous=distance;this.lastTime=time;this.mesh.count=0;this.spark.count=0;this.accent.count=0;
    const s=this.section;
    if(s.kind==='witchhat'){
      const {x,z,radius}=this.hat,age=time-(this.fired[0]??-1e6),energy=age>=0?Math.exp(-age*.2):0;
      for(let i=0;i<3;i++){
        const boost=this.fired[0]===undefined?0:2*(1-energy);
        const angle=i*Math.PI*2/3+(reduced?0:time*.24+boost);
        const r=Math.max(3,radius*.49),y=s.amplitude*.8+2;
        // Face along the orbit: radial broom tails reach into the banked train.
        const pitch=.09*Math.sin(angle),height=y+(reduced?0:Math.sin(angle*2+i)*.65);
        this.position.set(x+Math.sin(angle)*r,height,z+Math.cos(angle)*r);this.put(this.mesh,this.position,1,0,angle,pitch);
        // Both pages share the broom's transform; flapping stays local to the
        // spine rather than sending loose props into the train envelope.
        for(const side of [-1,1]){
          this.dummy.position.set(.71,.14,0);this.dummy.rotation.set(0,side<0?Math.PI:0,.15+(reduced?0:(.5+.5*Math.sin(time*6+i))*.38),'YXZ');this.dummy.scale.setScalar(1);this.dummy.updateMatrix();
          // Cache the broom transform separately because dummy is shared.
          this.bookMatrix.compose(this.bookPosition.set(x+Math.sin(angle)*r,height,z+Math.cos(angle)*r),this.bookRotation.setFromEuler(this.bookEuler.set(0,angle,pitch)),this.bookScale);
          this.bookMatrix.multiply(this.dummy.matrix);this.accent.setMatrixAt(this.accent.count++,this.bookMatrix);
        }
        if(!reduced)for(let j=0;j<6;j++){
          const a=angle-.08*(j+1),trail=this.position.set(x+Math.sin(a)*r,y+Math.sin(a*2+i)*.65-.12*j,z+Math.cos(a)*r);
          this.put(this.spark,trail,(1-j/7)*(.65+energy*.65),0,a,.5);
        }
      }
      if(!reduced)for(let i=0;i<36;i++){
        const t=(time*.23+i/36)%1,a=t*Math.PI*5;
        const r=Math.max(1,(radius-2)*(1-t)*.85);
        this.put(this.spark,this.position.set(x+Math.sin(a)*r,3+t*(s.amplitude+4),z+Math.cos(a)*r),.7+energy*.8,0,a,.3);
      }
    }else if(s.kind==='pumpkinhop'){
      for(let i=0;i<3;i++)for(const side of [-1,1]){
        const age=time-(this.fired[i]??-1e6),beat=!reduced&&age>=0&&age<2?Math.max(0,Math.sin(age*17))*Math.exp(-age*1.5):0;
        // The green head is below the raised handle pivot. Its first downstroke
        // meets the drum skin; the whole handle stays above that surface.
        const p=this.position.copy(this.positions[i]);p.z+=side*4.8;p.y+=2.67;
        this.put(this.mesh,p,1,side*.72*(1-beat),0,0);
        const noteAge=age-(side>0?.13:0),note=!reduced&&noteAge>=0&&noteAge<2.1;
        if(note){this.position.copy(this.positions[i]);this.position.z+=side*(4.8+noteAge*.4);this.position.x+=Math.sin(noteAge*3+i)*.7;this.position.y+=3+Math.sin(noteAge/2.1*Math.PI)*2.5;this.put(this.accent,this.position,Math.sin(noteAge/2.1*Math.PI)*.9,0,side*.2,Math.sin(noteAge*5)*.25);}
        if(!reduced&&age>=0&&age<2.2)for(let j=0;j<12;j++){
          const phi=j*2.39996,t=age;
          const bit=this.position.copy(this.positions[i]);bit.z+=side*(4.8+t*(1.5+j%3));bit.x+=Math.cos(phi)*t*2;
          bit.y+=1.2+(5+j%4)*t-4*t*t;
          this.put(this.spark,bit,Math.max(0,1-t/2.2),0,phi,t*3);
        }
      }
    }else{
      const age=time-(this.fired[0]??-1e6);
      for(const side of [-1,1]){
        const cheer=!reduced&&age>=0?Math.exp(-age*.45):0;
        this.dummy.position.set(side*6.1,10.2,0);this.dummy.rotation.set(0,(side<0?Math.PI:0)+(reduced?0:Math.sin(time*(2+cheer*3))*(.12+cheer*.35)),side*.07,'XYZ');this.dummy.scale.setScalar(1);this.dummy.updateMatrix();
        this.bookMatrix.compose(this.portalCenter,this.portalRotation,this.bookScale).multiply(this.dummy.matrix);this.accent.setMatrixAt(this.accent.count++,this.bookMatrix);
      }
      if(reduced||this.fired[0]===undefined||age>3.2)for(let i=0;i<8;i++){
        const side=i<4?-1:1,a=(i%4)*Math.PI/2+(reduced?0:time*.6),local=this.position.set(side*8.5+Math.sin(a)*1.6,4.45+Math.cos(a)*1.6,2.4);
        local.applyQuaternion(this.portalRotation).add(this.portalCenter);
        this.put(this.mesh,local,.75,0,0,a);
      }
      if(!reduced&&age>=0&&age<3.2)for(let i=0;i<24;i++){
        const phi=i*2.39996,travel=(1-Math.exp(-age))*.85;
        const p=this.position.set(Math.cos(phi)*(5+i%4)*travel,4+(5+i%4)*age-3.5*age*age,Math.sin(phi)*(6+i%3)*travel).add(this.portalCenter);
        p.y=Math.max(.3,p.y);
        this.put(this.mesh,p,Math.max(0,1-age/3.2),age*2,phi,age*3);
      }
    }
    for(const mesh of [this.mesh,this.spark,this.accent]){mesh.visible=mesh.count>0;if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;}
  }
  dispose(){for(const mesh of [this.mesh,this.spark,this.accent]){mesh.geometry.dispose();mesh.dispose();}this.glow.dispose();this.group.removeFromParent();}
}
export const createHalloweenPieceAnimation:PieceAnimationFactory=(section,material)=>
  ['pumpkinhop','pumpkintunnel','witchhat'].includes(section.kind)?new HalloweenPieceAnimation(section,material):undefined;
