import * as T from 'three';
import type { MiniSection } from '../mini-track';
import { CHIMNEY } from '../chimney-jump';
import { ChristmasBuilder } from './christmas-builder';
import { alpineChalet } from './alpine-chalet';
import { ChristmasLights } from './christmas-lights';
import { CrossingPulses } from './piece-builder';

/** One bounded billboard batch: a big version of the sleigh's magical glitter.
 * Every trajectory and colour is preallocated; launch only changes uniforms. */
function magicBurst(v:ChristmasBuilder,mouth:T.Vector3) {
  const count=320,quad=new T.PlaneGeometry(2,2),geometry=new T.InstancedBufferGeometry();
  geometry.setIndex(quad.index!.clone());for(const [n,a]of Object.entries(quad.attributes))geometry.setAttribute(n,a.clone());quad.dispose();geometry.instanceCount=count;
  const velocity=new Float32Array(count*3),color=new Float32Array(count*3),phase=new Float32Array(count),size=new Float32Array(count),delay=new Float32Array(count);
  const colors=['#ffe178','#ffd6a0','#68f5dc','#f997e9'];
  for(let i=0;i<count;i++){
    const a=i*2.399963,r=3+(i%11)*.85;
    velocity.set([Math.cos(a)*r,6+(i%13)*.8,Math.sin(a)*r],i*3);
    new T.Color(colors[i%4]).toArray(color,i*3);phase[i]=a;size[i]=.32+(i%5)*.11;delay[i]=(i%17)/17*.23;
  }
  for(const [n,array,stride]of [['sparkVelocity',velocity,3],['sparkTint',color,3],['sparkPhase',phase,1],['sparkSize',size,1],['sparkDelay',delay,1]] as const)geometry.setAttribute(n,new T.InstancedBufferAttribute(array,stride));
  const uniforms={age:{value:-10},mouth:{value:mouth},motion:{value:1}};
  const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
    vertexShader:`attribute vec3 sparkVelocity,sparkTint;attribute float sparkPhase,sparkSize,sparkDelay;
      uniform vec3 mouth;uniform float age,motion;varying vec2 q;varying vec3 tint;varying float fade,angle;
      void main(){float t=age-sparkDelay;if(t<0.||t>2.8){gl_Position=vec4(2.,2.,2.,1.);return;}
        vec3 p=mouth+sparkVelocity*t*motion;p.y-=2.5*t*t*motion;
        vec4 view=modelViewMatrix*vec4(p,1.);view.xy+=position.xy*sparkSize*(1.+t*.35);
        gl_Position=projectionMatrix*view;q=uv*2.-1.;tint=sparkTint;fade=(1.-smoothstep(.5,2.8,t))*(.75+.25*pow(sin(sparkPhase+t*8.),2.));angle=sparkPhase+t*.7;}`,
    fragmentShader:`varying vec2 q;varying vec3 tint;varying float fade,angle;
      void main(){vec2 p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;float r=length(p);if(r>1.)discard;
        float core=exp(-r*r*28.);float rays=pow(max(0.,1.-min(abs(p.x),abs(p.y))*10.),2.)*pow(1.-r,2.);
        gl_FragColor=vec4(mix(tint,vec3(1.),core*.2)*1.15,(core+rays+exp(-r*r*5.)*.2)*fade);}`});
  const mesh=v.effect(geometry,material);mesh.name='chimney-magic-starburst';mesh.frustumCulled=false;mesh.visible=false;
  return (age:number,reduced:boolean)=>{uniforms.age.value=age;uniforms.motion.value=reduced?.25:1;mesh.visible=age>=0&&age<3.1;};
}

export function chimneyHouse(v:ChristmasBuilder,s:MiniSection) {
  const {model,snow,bulbs}=alpineChalet(s);
  const snowMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,
    emissive:'#c7d5e6',emissiveIntensity:.38});
  const snowBatch=snow.finish(snowMaterial,snowMaterial,false);
  for(const child of [...snowBatch.children])if(child instanceof T.Mesh)
    v.effect(child.geometry,snowMaterial).name='alpine-chalet-snow';
  v.festive(model);
  const lights=new ChristmasLights(v,s,bulbs,'hearth-and-chimney'),pulses=new CrossingPulses([s.takeoff]);
  const burst=magicBurst(v,new T.Vector3(s.width*CHIMNEY.mouth,s.origin.y+s.amplitude+.5,0));
  v.animate((time,distance,reduced)=>{lights.update(time,distance,reduced,s.start);pulses.update(time,distance);burst(pulses.age(0,time),reduced);});
}
