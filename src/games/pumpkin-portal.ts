import * as T from 'three';
import type { MiniSection } from './mini-track';

export const PORTAL_PUMPKINS=15;
export const portalHitDistance=(section:MiniSection)=>section.start+section.length/2-1.5;
/** Trigger once when the engine's nose meets the pile. Gallery wraparound and
 * replay checkpoints rearm it; loading an already-passed piece cannot explode. */
export class PortalImpact {
  age=-1;
  hits=0;
  private hitTime?:number;
  private previous?:number;
  private previousTime?:number;
  update(time:number,distance:number,hit:number,reduced=false) {
    if(this.previous!==undefined&&distance<this.previous-5&&distance<hit-3){this.hitTime=undefined;this.previous=undefined;}
    if(this.previous===undefined&&distance>=hit)this.hitTime=time-6;
    else if(this.hitTime===undefined&&distance>=hit){
      const fraction=T.MathUtils.clamp((distance-hit)/Math.max(.0001,distance-(this.previous??distance)),0,1);
      this.hitTime=time-Math.min(.1,time-(this.previousTime??time))*fraction;this.hits++;
    }
    this.previous=distance;this.previousTime=time;
    this.age=this.hitTime===undefined?-1:reduced?6:Math.max(0,time-this.hitTime);
  }
}
export function portalPumpkin(section:MiniSection,index:number,age:number,gravity=9.81) {
  let row=0,column=index;
  while(column>=5-row){column-=5-row;row++;}
  const size=.93+(index%3)*.035;
  const f=section.sample(section.start+section.length/2);
  const offset=new T.Vector3((column-(4-row)/2)*1.7,row*1.39+.02,Math.sin(index*2.4)*.15)
    .applyAxisAngle(new T.Vector3(0,1,0),.5);
  const position=offset.applyQuaternion(f.rotation).add(f.position);
  let spin=0,scale=1;
  if(age>=0){
    const t=Math.min(6,age),phi=index*2.39996323,speed=6+(index%4)*1.15;
    const drag=(1-Math.exp(-t*.85))/.85;
    const launch=new T.Vector3(Math.cos(phi)*speed,0,Math.sin(phi)*speed-2).applyQuaternion(f.rotation);
    position.addScaledVector(launch,drag);
    const vy=7.5+(index%5)*1.1,initial=position.y;
    position.y+=vy*t-.5*gravity*t*t;
    if(gravity>0){
      const impact=(vy+Math.sqrt(vy*vy+2*gravity*Math.max(0,initial-.1)))/gravity;
      if(t>impact)position.y=.1+Math.abs(Math.sin((t-impact)*8))*.7*Math.exp(-(t-impact)*3);
    }
    spin=(index%2?1:-1)*drag*(1.1+index%3*.35);
    scale=1-T.MathUtils.smoothstep(age,4.5,6);
  }
  return {position,size:size*scale,spin};
}

/** One bounded smoke buffer and one ring buffer, shared by both riders. */
export class PortalEffects {
  readonly group=new T.Group();
  private material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  private smoke:T.InstancedMesh;
  private rings:T.InstancedMesh;
  private dummy=new T.Object3D();
  private colors=['#74ff38','#1be881','#bdff53','#20ba64','#ffe077'].map(c=>new T.Color(c));
  constructor(parent:T.Group){
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float instanceFade; varying float vFade;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFade=instanceFade;');
      shader.fragmentShader='varying float vFade;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vFade;');
    };
    const make=(geometry:T.BufferGeometry)=>{
      geometry.setAttribute('instanceFade',new T.InstancedBufferAttribute(new Float32Array(192),1).setUsage(T.DynamicDrawUsage));
      const mesh=new T.InstancedMesh(geometry,this.material,192);mesh.count=0;mesh.frustumCulled=false;
      mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(192*3).fill(1),3).setUsage(T.DynamicDrawUsage);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);return mesh;
    };
    this.smoke=make(new T.IcosahedronGeometry(1,1));this.rings=make(new T.TorusGeometry(1,.035,5,64));
    parent.add(this.group);
  }
  begin(){this.smoke.count=0;this.rings.count=0;}
  private put(mesh:T.InstancedMesh,color:T.Color,fade:number){
    if(mesh.count>=192||fade<=0)return;
    const i=mesh.count++;this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);mesh.setColorAt(i,color);
    (mesh.geometry.getAttribute('instanceFade') as T.InstancedBufferAttribute).setX(i,fade);
  }
  emit(section:MiniSection,age:number,anchor:number,lane:number,mirror:boolean){
    if(age<0||age>2.4)return;
    const f=section.sample(section.start+section.length/2),center=f.position.clone().add(new T.Vector3(0,1.5,0));
    for(let i=0;i<38;i++){
      const spark=i>=14,phi=i*2.39996323,r=(spark?8:6)*age,fade=(1-T.MathUtils.smoothstep(age,spark?.6:.3,spark?2.4:1.8))*(spark?.95:.2);
      this.dummy.position.copy(center).add(new T.Vector3(Math.cos(phi)*r,(i%5)*.35+(spark?4:2.5)*age,Math.sin(phi)*r));
      this.dummy.position.x-=anchor;this.dummy.position.z=(this.dummy.position.z+lane)*(mirror?-1:1);
      this.dummy.rotation.set(age,phi,age*.5);
      this.dummy.scale.setScalar(spark?.13+(i%3)*.05:.8+age*(1.8+(i%3)*.2));
      this.put(this.smoke,this.colors[i%(spark?5:4)],fade);
    }
    for(let i=0;i<2;i++){
      const t=age-i*.12;if(t<0||t>1.15)continue;
      this.dummy.position.copy(center);this.dummy.position.x-=anchor;this.dummy.position.z=(center.z+lane)*(mirror?-1:1);
      this.dummy.quaternion.copy(f.rotation);if(i)this.dummy.rotateX(Math.PI/2);
      if(mirror){this.dummy.quaternion.x*=-1;this.dummy.quaternion.y*=-1;}
      this.dummy.scale.setScalar(.5+t*8);this.put(this.rings,this.colors[i],1-t/1.15);
    }
  }
  finish(){for(const mesh of [this.smoke,this.rings]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;(mesh.geometry.getAttribute('instanceFade') as T.InstancedBufferAttribute).needsUpdate=true;}}
  destroy(){for(const mesh of [this.smoke,this.rings]){mesh.geometry.dispose();mesh.dispose()}this.material.dispose();this.group.removeFromParent();}
}
