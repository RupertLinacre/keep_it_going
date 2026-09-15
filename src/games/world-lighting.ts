import * as T from 'three';

/** A smooth travelling glow in one shared material, not hundreds of scene lights.
 * Phase is baked per bulb; ordinary luminous scenery has phase -1 and stays steady. */
export class FairgroundLights extends T.MeshBasicMaterial {
  readonly clock = { value: 0 };
  readonly trains = { value: [new T.Vector3(1e6,1e6,1e6),new T.Vector3(1e6,1e6,1e6),new T.Vector3(1e6,1e6,1e6),new T.Vector3(1e6,1e6,1e6)] };
  readonly halos: T.ShaderMaterial;
  constructor() {
    super({ vertexColors: true });
    this.halos = new T.ShaderMaterial({
      transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexColors:true,
      uniforms:{fairTrains:this.trains},
      vertexShader:`attribute vec3 lightCenter; varying vec3 hue; varying vec3 faceNormal; varying vec3 eye; varying float strength;
        uniform vec3 fairTrains[4];
        void main(){
          vec3 center=(modelMatrix*vec4(lightCenter,1.)).xyz;
          float d=100000.;for(int i=0;i<4;i++)d=min(d,distance(center,fairTrains[i]));
          strength=exp(-d*d/190.);
          vec3 p=lightCenter+(position-lightCenter)*(2.5+strength*1.5);
          vec4 view=modelViewMatrix*vec4(p,1.); eye=-view.xyz;faceNormal=normalMatrix*normal;hue=color;
          gl_Position=projectionMatrix*view;
        }`,
      fragmentShader:`varying vec3 hue; varying vec3 faceNormal; varying vec3 eye; varying float strength;
        void main(){float soft=pow(max(0.,dot(normalize(faceNormal),normalize(eye))),2.);
          gl_FragColor=vec4(mix(hue,vec3(1.),.18),soft*strength*.48);}`,
    });
    this.onBeforeCompile = shader => {
      shader.uniforms.fairTime = this.clock;
      shader.uniforms.fairTrains = this.trains;
      shader.vertexShader = 'attribute float lightPhase; varying float fairPhase; varying vec3 fairWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfairPhase = lightPhase;');
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 fairP=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          fairP=instanceMatrix*fairP;
        #endif
        fairWorld=(modelMatrix*fairP).xyz;`);
      shader.fragmentShader = 'uniform float fairTime; uniform vec3 fairTrains[4]; varying float fairPhase; varying vec3 fairWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (fairPhase >= 0.0) {
          float wave = 0.5 + 0.5 * sin(fairTime * 1.4 - fairPhase);
          diffuseColor.rgb *= 0.35 + 0.65 * wave * wave;
          float d=100000.;for(int i=0;i<4;i++)d=min(d,distance(fairWorld,fairTrains[i]));
          float arrival=exp(-d*d/190.);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,.96,.84),arrival*.85);
        }`);
    };
  }
  override customProgramCacheKey() { return 'fairground-lights-v2'; }
  override dispose() { this.halos.dispose();super.dispose(); }
}

/** Translucent beams suggest stage lighting without full-screen bloom or shadows. */
export function fairgroundBeamMaterial() {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { tint: { value: new T.Color('#b7bcff') } },
    vertexShader: `varying vec2 beamUv;
      void main() { beamUv=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 beamUv; uniform vec3 tint;
      void main() { float alpha=0.14*pow(1.0-beamUv.y,.85); gl_FragColor=vec4(tint,alpha); }`,
  });
}
