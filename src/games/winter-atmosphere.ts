import * as T from "three";
import type { AdventureWorld } from "./adventure-worlds";
import type { MiniTrack } from "./mini-track";
import { sectionBounds } from "./mini-world";

/** Keep the horizon behind rail bends, snow banks and both mirrored lanes.
 * This is a world-space boundary, independent of height, zoom and camera depth. */
export function winterGroundBack(track:MiniTrack,laneOffset:number) {
  let back=-51;
  for(const section of track.sections) {
    const bounds=sectionBounds(section);
    const bend=Math.max(10,Math.abs(bounds.min.z-section.origin.z),Math.abs(bounds.max.z-section.origin.z));
    back=Math.min(back,-bend-41-Math.abs(section.origin.z)-laneOffset);
  }
  return back;
}

/** Soft local light is six vertices per source, in two shared scenery batches.
 * No render target, bloom pass, point lights or per-frame particle allocation. */
export function winterGlowMaterial() {
  return new T.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,blending:T.NormalBlending,premultipliedAlpha:true,
    vertexColors:true,fog:true,toneMapped:false,uniforms:T.UniformsUtils.merge([T.UniformsLib.fog]),
    vertexShader:`attribute vec2 glowOffset; attribute float groundGlow; attribute float glowStrength;
      varying vec2 glowUv; varying vec3 hue; varying float power; varying float onSnow;
      #include <fog_pars_vertex>
      void main(){
        glowUv=glowOffset; hue=color; power=glowStrength;onSnow=groundGlow;
        // Recover radius from the corner, so gradients remain identical at all scales.
        glowUv/=max(abs(glowOffset.x),abs(glowOffset.y));
        vec3 p=position;
        if(groundGlow>.5)p+=vec3(glowOffset.x,0.,-glowOffset.y);
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        if(groundGlow<.5)mvPosition.xy+=glowOffset;
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`varying vec2 glowUv; varying vec3 hue; varying float power; varying float onSnow;
      #include <fog_pars_fragment>
      void main(){
        float r2=dot(glowUv,glowUv);
        float edge=1.-smoothstep(.55,1.,r2);
        float alpha=(onSnow>.5?exp(-r2*1.4):.65*exp(-r2*12.)+.28*exp(-r2*2.))*edge*power;
        gl_FragColor=vec4(hue,alpha);
        #include <colorspace_fragment>
        // Fade emitted light to zero in the distance, rather than adding fog colour.
        #ifdef USE_FOG
          float fogFade=smoothstep(fogNear,fogFar,vFogDepth);
          gl_FragColor.a*=1.-fogFade;
        #endif
        // Halos emit light; snow spill tints amber instead of adding to white.
        gl_FragColor.rgb*=gl_FragColor.a;
        gl_FragColor.a*=onSnow;
      }`,
  });
}

/** One two-triangle sky layer. Soft blue-hour haze / an apricot sunset cost
 * no lights, postprocessing, reflections or particles. It is not a camera
 * subject; even the sun cannot change the ride's zoom or terrain bounds. */
export class WinterAtmosphere {
  readonly mesh: T.Mesh;
  readonly material = new T.ShaderMaterial({
    // Transparent meshes render after the entire opaque queue regardless of
    // renderOrder. Keep the sky opaque and blend its colours in the shader.
    transparent: false, depthTest: false, depthWrite: false,
    uniforms: { sky: { value: new T.Color() }, horizon: { value: new T.Color() },
      farGround: {value:new T.Color()}, back: {value: -10000}, drift: {value: 0}, weight: { value: 0 }, dawn: { value: 0 }, aspect: { value: 1 } },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform vec3 sky;
      uniform float weight; uniform float dawn; uniform float aspect; uniform float drift;
      float ridge(float x,float phase){
        return .83+.025*sin(x*5.+phase)+.018*sin(x*13.+phase*.4)+.007*sin(x*27.);
      }
      void main(){
        vec3 top=mix(vec3(.095,.13,.31),vec3(.72,.38,.57),dawn);
        vec3 low=mix(vec3(.47,.43,.66),vec3(1.,.60,.37),dawn);
        vec3 color=mix(low,top,smoothstep(.65,1.,vUv.y));
        vec2 delta=vUv-vec2(.78,.93);delta.x*=aspect;
        float d=length(delta);
        color=mix(color,vec3(1.,.73,.45),dawn*.7*exp(-d*d/.06));
        color=mix(color,vec3(1.,.91,.63),dawn*(1.-smoothstep(.037,.04,d)));
        float cloud=exp(-pow((vUv.y-.94-.012*sin(vUv.x*7.))*65.,2.));
        color=mix(color,vec3(.99,.72,.65),cloud*dawn*.18);
        float x=vUv.x*aspect+drift;
        float far=ridge(x,1.2),near=ridge(x*1.3,3.8)-.035;
        color=mix(color,mix(vec3(.30,.36,.59),vec3(.66,.56,.68),dawn),1.-smoothstep(far-.003,far+.003,vUv.y));
        color=mix(color,mix(vec3(.25,.34,.56),vec3(.52,.64,.76),dawn),1.-smoothstep(near-.002,near+.002,vUv.y));
        vec2 grid=vec2(x*39.,vUv.y*29.);vec2 cell=floor(grid);
        float hash=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
        float star=(1.-smoothstep(.015,.06,length(fract(grid)-.5)))*step(.975,hash);
        color+=vec3(.54,.57,.65)*star*(1.-dawn)*smoothstep(.60,.92,vUv.y);
        vec2 moon=vUv-vec2(.79,.91);moon.x*=aspect;
        float crescent=(1.-smoothstep(.025,.027,length(moon)))*smoothstep(.025,.027,length(moon-vec2(.014,.008)));
        color=mix(color,vec3(.91,.88,.73),crescent*(1.-dawn)*.7);
        gl_FragColor=vec4(mix(sky,color,weight),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  constructor(scene:T.Scene) {
    this.mesh=new T.Mesh(new T.PlaneGeometry(2,2),this.material);
    this.mesh.frustumCulled=false;this.mesh.renderOrder=-1000;this.mesh.visible=false;
    scene.add(this.mesh);
  }
  /** Only the extended board yields to the illustrated horizon. Distant
   * cabins, rails and both players still render normally, never cut in half. */
  attachGround(material:T.MeshStandardMaterial) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.winterBack=this.material.uniforms.back;
      shader.vertexShader='varying float winterGroundZ;\n'+shader.vertexShader
        .replace('#include <project_vertex>','#include <project_vertex>\nwinterGroundZ=(modelMatrix*vec4(transformed,1.)).z;');
      shader.uniforms.winterWeight=this.material.uniforms.weight;
      shader.uniforms.winterFarGround=this.material.uniforms.farGround;
      shader.fragmentShader='varying float winterGroundZ;uniform float winterBack;uniform float winterWeight;uniform vec3 winterFarGround;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif(winterWeight>.001&&winterGroundZ<mix(-10000.,winterBack,winterWeight))discard;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nfloat farSnow=(1.-smoothstep(winterBack+2.,winterBack+14.,winterGroundZ))*winterWeight;\ndiffuseColor.rgb=mix(diffuseColor.rgb,winterFarGround,farSnow*.92);');
    };
    material.customProgramCacheKey=()=> 'winter-ground-horizon-v3';material.needsUpdate=true;
  }
  update(world:AdventureWorld,sky:T.Color,dt:number,aspect:number,back=-51,travel=0) {
    const u=this.material.uniforms,winter=world.id==="lapland"||world.id==="winterfair",blend=1-Math.exp(-Math.max(0,dt)*1.5);
    u.weight.value+=(Number(winter)-u.weight.value)*blend;
    u.dawn.value+=(Number(world.id==="winterfair")-u.dawn.value)*blend;
    u.sky.value.copy(sky);u.horizon.value.set(world.id==="winterfair"?"#ffc69e":"#a49bc7");
    u.aspect.value=aspect;
    u.back.value=back;
    u.farGround.value.set(world.id==="winterfair"?"#c7bfd8":"#8299cf");
    u.drift.value=travel*.00018;
    this.mesh.visible=u.weight.value>.001;
  }
  destroy(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}
