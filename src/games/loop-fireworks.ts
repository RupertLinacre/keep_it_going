import * as T from 'three';
import { adventureAt } from './adventure-worlds';
import type { MiniSection, MiniTrack } from './mini-track';
import { seededRandom } from './mini-rail';
const LOOP_KINDS=new Set(['loop','midwayloop','windmillloop','noninvertingloop','nestedloop','interlockingloops','pretzelknot','cobraroll']);
const peaks=new WeakMap<MiniSection,number[]>();
/** Local maxima on loop elements, including the separate crests of nested loops. */
export function loopCrests(section:MiniSection) {
  if(!LOOP_KINDS.has(section.kind))return [];
  let result=peaks.get(section);
  if(!result) {
    result=[];
    for(let i=1;i<section.frames.length;i++) {
      const a=section.frames[i-1],b=section.frames[i];
      if(a.tangent.y>0&&b.tangent.y<=0) {
        const at=section.start+section.distances[i];
        if(!result.length||at-result.at(-1)!>5)result.push(at);
      }
    }
    peaks.set(section,result);
  }
  return result;
}
export function crossedNightCrests(track:MiniTrack, previous:number|undefined, distance:number) {
  if(previous===undefined||distance<=previous||distance-previous>120)return [];
  return track.sections.filter(s=>s.end>=previous&&s.start<=distance&&adventureAt(s.start).world.id==='night')
    .flatMap(section=>loopCrests(section).filter(at=>at>previous&&at<=distance).map(at=>({section,at})));
}
type Burst={born:number;center:T.Vector3;seed:number;rival:boolean};
const COLORS=['#ffb7ee','#80fff0','#fff0a1','#a7b9ff','#ffbc7e'];
/** Six bounded bursts, one additive draw call. Sparks never affect camera bounds. */
export class LoopFireworks {
  readonly geometry=new T.BufferGeometry();
  readonly material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{pixelRatio:{value:1}},
    vertexShader:`attribute vec3 sparkColor; attribute float strength; varying vec3 tint; varying float fade; uniform float pixelRatio;
      void main(){tint=sparkColor;fade=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=(3.0+4.0*strength)*pixelRatio;}`,
    fragmentShader:`varying vec3 tint;varying float fade;void main(){float r=length(gl_PointCoord-vec2(.5))*2.0;if(r>1.0)discard;gl_FragColor=vec4(tint,(1.0-r)*(1.0-r)*fade);}`});
  readonly points=new T.Points(this.geometry,this.material);
  readonly bursts:Burst[]=[];
  private previous:(number|undefined)[]=[];
  private positions=new Float32Array(6*72*3*3);
  private colors=new Float32Array(this.positions.length);
  private strengths=new Float32Array(this.positions.length/3);
  constructor(scene:T.Scene) {
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('sparkColor',new T.BufferAttribute(this.colors,3).setUsage(T.DynamicDrawUsage));
    this.geometry.setAttribute('strength',new T.BufferAttribute(this.strengths,1).setUsage(T.DynamicDrawUsage));
    this.geometry.setDrawRange(0,0);this.points.frustumCulled=false;scene.add(this.points);
  }
  update(track:MiniTrack,distance:number,time:number,anchor:number,lane:number,opponentDistance?:number,opponentTrack?:MiniTrack,reduced=false,pixelRatio=1) {
    for(const rider of [0,1]) {
      const at=rider?opponentDistance:distance;
      if(at===undefined){this.previous[rider]=undefined;continue;}
      const rail=rider?opponentTrack??track:track;
      if(!reduced)for(const crest of crossedNightCrests(rail,this.previous[rider],at)) {
        const center=crest.section.sample(crest.at).position.clone();center.y+=5;
        for(const side of [-1,1]) {
          this.bursts.push({born:time+(side===1?.15:0),center:center.clone().add(new T.Vector3(side*3,side===1?3:0,side*6)),seed:crest.section.id*37+Math.round(crest.at)+side,rival:!!rider});
        }
      }
      this.previous[rider]=at;
    }
    if(reduced)this.bursts.length=0;
    while(this.bursts.length>6)this.bursts.shift();
    for(let i=this.bursts.length-1;i>=0;i--)if(time-this.bursts[i].born>2.4)this.bursts.splice(i,1);
    let count=0;
    for(const burst of this.bursts) {
      const age=time-burst.born;if(age<0)continue;
      const random=seededRandom(burst.seed);
      for(let i=0;i<72;i++) {
        const angle=i*2.399963, y=1-2*(i+.5)/72,r=Math.sqrt(1-y*y),speed=5+random()*5;
        const vx=Math.cos(angle)*r*speed,vy=y*speed,vz=Math.sin(angle)*r*speed;
        const color=new T.Color(COLORS[(i+Math.abs(burst.seed))%COLORS.length]);
        for(let tail=0;tail<3;tail++) {
          const t=Math.max(0,age-tail*.045),spread=(1-Math.exp(-t*.8))/.8;
          this.positions[count*3]=burst.center.x-anchor+vx*spread;
          this.positions[count*3+1]=burst.center.y+vy*spread-1.6*t*t;
          this.positions[count*3+2]=(burst.center.z+vz*spread+lane)*(burst.rival?-1:1);
          color.toArray(this.colors,count*3);
          this.strengths[count]=(1-age/2.4)*(1-tail*.25);count++;
        }
      }
    }
    this.material.uniforms.pixelRatio.value=pixelRatio;
    this.geometry.setDrawRange(0,count);
    for(const name of ['position','sparkColor','strength'])this.geometry.getAttribute(name).needsUpdate=true;
  }
  destroy(){this.points.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
