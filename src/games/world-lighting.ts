import * as T from 'three';

/** A smooth travelling glow in one shared material, not hundreds of scene lights.
 * Phase is baked per bulb; ordinary luminous scenery has phase -1 and stays steady. */
export class FairgroundLights extends T.MeshBasicMaterial {
  readonly clock = { value: 0 };
  constructor() {
    super({ vertexColors: true });
    this.onBeforeCompile = shader => {
      shader.uniforms.fairTime = this.clock;
      shader.vertexShader = 'attribute float lightPhase; varying float fairPhase;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfairPhase = lightPhase;');
      shader.fragmentShader = 'uniform float fairTime; varying float fairPhase;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (fairPhase >= 0.0) {
          float wave = 0.5 + 0.5 * sin(fairTime * 1.4 - fairPhase);
          diffuseColor.rgb *= 0.35 + 0.65 * wave * wave;
        }`);
    };
  }
  override customProgramCacheKey() { return 'fairground-lights-v1'; }
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
