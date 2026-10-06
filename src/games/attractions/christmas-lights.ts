import * as T from 'three';
import { WORLD_SHAPES } from '../world-models';
import type { MiniSection } from '../mini-track';
import type { ChristmasBuilder } from './christmas-builder';

export type ChristmasBulb = { position:T.Vector3; stop:number; color:string; size?:number; halo?:number };

const pulseShader = `
  attribute vec3 lampPosition, lampTint;
  attribute float lampSize, lampHalo, lampStop, lampFired, lampPhase;
  uniform float trainDistance, clock, motion;
  varying vec3 tint;
  varying float power;
  float lampPower() {
    float gap = (trainDistance - lampStop) / 11.;
    float approach = exp(-gap * gap);
    float afterglow = lampFired < 0. ? 0. : exp(-max(0., clock - lampFired) * .6) * .8;
    float twinkle = mix(1., .88 + .12 * pow(sin(clock * 2. + lampPhase), 2.), motion);
    return clamp(approach + afterglow, 0., 1.) * twinkle;
  }
`;

function instances(source:T.BufferGeometry,count:number) {
  const geometry=new T.InstancedBufferGeometry();
  geometry.setIndex(source.index?.clone()??null);
  for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute.clone());
  geometry.instanceCount=count;return geometry;
}

/** Coloured Christmas bulbs wake beside the train and leave a short afterglow.
 * Two fixed batches, no point lights and no rebuilding geometry during a ride. */
export class ChristmasLights {
  readonly core:T.Mesh;
  readonly halos:T.Mesh;
  readonly uniforms={trainDistance:{value:-1e6},clock:{value:0},motion:{value:1}};
  private readonly fired:T.InstancedBufferAttribute;
  private readonly stops:number[];
  private previous=-Infinity;
  private previousTime=-Infinity;
  constructor(v:ChristmasBuilder,s:MiniSection,bulbs:readonly ChristmasBulb[],name:string) {
    const count=bulbs.length,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
    const sizes=new Float32Array(count),radii=new Float32Array(count),stops=new Float32Array(count),phases=new Float32Array(count);
    this.stops=bulbs.map(b=>b.stop-s.start);
    for(let i=0;i<count;i++){
      const bulb=bulbs[i],color=new T.Color(bulb.color);
      positions.set(bulb.position.toArray(),i*3);colors.set([color.r,color.g,color.b],i*3);
      sizes[i]=bulb.size??.23;radii[i]=bulb.halo??1.4;stops[i]=this.stops[i];phases[i]=i*2.39996;
    }
    this.fired=new T.InstancedBufferAttribute(new Float32Array(count).fill(-1),1).setUsage(T.DynamicDrawUsage);
    const attributes={lampPosition:new T.InstancedBufferAttribute(positions,3),lampTint:new T.InstancedBufferAttribute(colors,3),
      lampSize:new T.InstancedBufferAttribute(sizes,1),lampHalo:new T.InstancedBufferAttribute(radii,1),
      lampStop:new T.InstancedBufferAttribute(stops,1),lampPhase:new T.InstancedBufferAttribute(phases,1),lampFired:this.fired};
    const core=instances(WORLD_SHAPES.round,count),quad=new T.PlaneGeometry(2,2),halo=instances(quad,count);quad.dispose();
    for(const geometry of [core,halo])for(const [key,attribute]of Object.entries(attributes))geometry.setAttribute(key,attribute);
    const bounds=new T.Box3();
    for(const bulb of bulbs)bounds.expandByPoint(bulb.position);
    bounds.expandByScalar(Math.max(0,...Array.from(radii))*1.4);
    for(const geometry of [core,halo])geometry.boundingSphere=bounds.getBoundingSphere(new T.Sphere());
    const coreMaterial=new T.ShaderMaterial({uniforms:this.uniforms,toneMapped:false,
      vertexShader:pulseShader+`varying vec3 facing;
        void main(){ power=lampPower();tint=lampTint;facing=normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(lampPosition+position*lampSize,1.); }`,
      fragmentShader:`varying vec3 tint,facing;varying float power;
        void main(){float shape=.65+.35*max(0.,dot(normalize(facing),normalize(vec3(.4,.8,1.))));
          vec3 hue=mix(tint,vec3(1.,.98,.9),power*.35);
          gl_FragColor=vec4(hue*shape*(.45+power*2.4),1.);
          #include <colorspace_fragment>
        }`,
    });
    const haloMaterial=new T.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,depthTest:true,
      blending:T.AdditiveBlending,toneMapped:false,
      vertexShader:pulseShader+`varying vec2 haloUv;
        void main(){ power=lampPower();tint=lampTint;haloUv=uv*2.-1.;
          vec4 p=modelViewMatrix*vec4(lampPosition,1.);
          p.xy+=position.xy*lampHalo*(.8+power*.55);gl_Position=projectionMatrix*p; }`,
      fragmentShader:`varying vec3 tint;varying vec2 haloUv;varying float power;
        void main(){float r2=dot(haloUv,haloUv);if(r2>1.)discard;
          float soft=exp(-r2*5.5)*(1.-smoothstep(.5,1.,r2));
          gl_FragColor=vec4(tint,soft*(.095+power*1.05));
          #include <colorspace_fragment>
        }`,
    });
    this.core=v.effect(core,coreMaterial);this.halos=v.effect(halo,haloMaterial);
    this.core.name=name+'-interactive-bulbs';this.halos.name=name+'-interactive-halos';
    this.core.userData.sectionStart=this.halos.userData.sectionStart=s.start;
    this.core.userData.christmasLights=this;this.halos.userData.christmasLights=this;
  }
  update(time:number,distance:number,reduced:boolean,start:number) {
    const relative=distance-start;
    let changed=false;
    if(time<this.previousTime||relative<this.previous-.01){this.fired.array.fill(-1);this.previous=-Infinity;changed=true;}
    for(let i=0;i<this.stops.length;i++)if(Number.isFinite(this.previous)&&this.previous<this.stops[i]&&relative>=this.stops[i]){
      this.fired.setX(i,time);changed=true;
    }
    if(changed)this.fired.needsUpdate=true;
    this.uniforms.clock.value=time;this.uniforms.trainDistance.value=relative;this.uniforms.motion.value=reduced?0:1;
    this.previous=relative;this.previousTime=time;
  }
}
