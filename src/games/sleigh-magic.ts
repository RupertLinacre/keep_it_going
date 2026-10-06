import * as THREE from 'three';

const CAPACITY = 384;
const COLORS = ['#ffe29b', '#fff7d9', '#89f3ec', '#f9adf1'].map(c => new THREE.Color(c));

/** Twin runner trails: fixed world-space sparkles, one small additive batch.
 * The train leaves them behind; only the floating render origin moves the group. */
export class SleighMagic {
  readonly group = new THREE.Group();
  readonly geometry = new THREE.BufferGeometry();
  readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points;
  reducedMotion = false;
  private clock = 0;
  private emission = 0;
  private cursor = 0;
  private expires = 0;
  private seed = 0x5a17a;
  private previous = false;
  private disposed = false;
  private readonly last = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly outlet = new THREE.Vector3();
  private readonly viewport = new THREE.Vector2();
  private readonly positions = new Float32Array(CAPACITY * 3);
  private readonly births = new Float32Array(CAPACITY).fill(-100);
  private readonly lives = new Float32Array(CAPACITY);
  private readonly phases = new Float32Array(CAPACITY);
  private readonly sizes = new Float32Array(CAPACITY);
  private readonly colors = new Float32Array(CAPACITY * 3);

  constructor() {
    this.group.name = 'santa-magical-contrails';
    for (const [name, array, stride] of [
      ['position', this.positions, 3], ['born', this.births, 1], ['life', this.lives, 1],
      ['phase', this.phases, 1], ['size', this.sizes, 1], ['color', this.colors, 3],
    ] as const) this.geometry.setAttribute(name, new THREE.BufferAttribute(array, stride).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { clock: { value: 0 }, pixelScale: { value: 20 }, motion: { value: 1 } },
      vertexShader: `
        attribute float born, life, phase, size;
        attribute vec3 color;
        uniform float clock, pixelScale, motion;
        varying vec3 tint;
        varying float fade, angle, shimmer;
        void main() {
          float age = clock - born;
          float t = age / max(life, .001);
          if (age < 0. || t >= 1.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
          vec3 p = position;
          p += vec3(sin(phase + age * 2.) - sin(phase), age * .24,
            cos(phase + age * 1.7) - cos(phase)) * .3 * motion;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
          fade = smoothstep(0., .06, t) * (1. - smoothstep(.48, 1., t));
          shimmer = mix(.8, .35 + .65 * pow(sin(phase + age * 7.), 2.), motion);
          angle = phase + age * .7 * motion;
          tint = color;
          gl_PointSize = clamp(size * pixelScale * mix(.7, 1.05, shimmer), 2., 64.);
        }`,
      fragmentShader: `
        varying vec3 tint;
        varying float fade, angle, shimmer;
        void main() {
          vec2 p = gl_PointCoord * 2. - 1.;
          p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
          float r = length(p);
          if (r > 1.) discard;
          float core = exp(-r * r * 36.);
          float rays = pow(max(0., 1. - min(abs(p.x), abs(p.y)) * 14.), 2.) * pow(1. - r, 2.);
          float halo = exp(-r * r * 5.) * .19;
          float light = core + rays * .8 + halo;
          gl_FragColor = vec4(mix(tint, vec3(1.), core * .45) * 1.35, light * fade * shimmer);
        }`,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'sleigh-gold-and-aurora-glitter';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(this.viewport);
      this.material.uniforms.pixelScale.value = this.viewport.y * camera.projectionMatrix.elements[5] * .5;
    };
    this.group.add(this.points);
  }

  get activeCount() {
    let count = 0;
    for (let i = 0; i < CAPACITY; i++) if (this.clock >= this.births[i] && this.clock - this.births[i] < this.lives[i]) count++;
    return count;
  }

  update(dt: number, position: THREE.Vector3 | null, rotation: THREE.Quaternion, speed: number) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.clock += dt;
    this.material.uniforms.clock.value = this.clock;
    this.material.uniforms.motion.value = this.reducedMotion ? 0 : 1;
    this.points.visible = this.clock < this.expires;
    if (!position) { this.previous = false; this.emission = 0; return; }
    const pace = Number.isFinite(speed) ? Math.min(Math.abs(speed), 70) : 0;
    const jump = this.previous && this.last.distanceToSquared(position) > Math.pow(Math.max(8, pace * dt * 3), 2);
    if (jump || dt > .15) this.emission = 0;
    const interval = 1 / (58 * (1 + pace * .006) * (this.reducedMotion ? .5 : 1));
    this.emission += Math.min(dt, .15);
    let emitted = false;
    while (this.emission + 1e-10 >= interval) {
      this.emission = Math.max(0, this.emission - interval);
      if (this.previous && !jump && dt <= .15) this.origin.lerpVectors(this.last, position, 1 - this.emission / dt);
      else this.origin.copy(position);
      for (let side = -1; side <= 1; side += 2) {
        const index = this.cursor++ % CAPACITY;
        this.outlet.set(side * .86, .72, 1.05).applyQuaternion(rotation).add(this.origin);
        this.positions[index * 3] = this.outlet.x;
        this.positions[index * 3 + 1] = this.outlet.y;
        this.positions[index * 3 + 2] = this.outlet.z;
        this.births[index] = this.clock - this.emission;
        this.lives[index] = 1.7 + this.random() * .6;
        this.expires = Math.max(this.expires, this.births[index] + this.lives[index]);
        this.phases[index] = this.random() * Math.PI * 2;
        this.sizes[index] = 1.35 + this.random() * .9;
        const color = COLORS[index % 4];
        this.colors[index * 3] = color.r; this.colors[index * 3 + 1] = color.g; this.colors[index * 3 + 2] = color.b;
      }
      emitted = true;
    }
    if (emitted) {
      this.points.visible = true;
      for (const attribute of Object.values(this.geometry.attributes)) attribute.needsUpdate = true;
    }
    this.last.copy(position); this.previous = true;
  }

  reset() {
    this.births.fill(-100); this.lives.fill(0);
    this.clock = this.emission = this.cursor = this.expires = 0; this.previous = false; this.seed = 0x5a17a;
    this.points.visible = false;
    this.material.uniforms.clock.value = 0;
    this.geometry.getAttribute('born').needsUpdate = this.geometry.getAttribute('life').needsUpdate = true;
  }
  dispose() {
    if (this.disposed) return;
    this.group.removeFromParent(); this.geometry.dispose(); this.material.dispose(); this.disposed = true;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
