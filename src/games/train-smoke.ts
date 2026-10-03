import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type SmokeVariant = 'normal' | 'a' | 'b' | 'c' | 'd' | 'e';

export const SMOKE_DESIGNS = [
  { id: 'normal', name: 'Gentle Steam', description: 'Little warm-white puffs drift softly out of the funnel.' },
  { id: 'a', name: 'Rainbow Express', description: 'A ribbon of plump rainbow puffs curls behind the train.' },
  { id: 'b', name: 'Dragon Chuffs', description: 'Big mint-and-lime clouds tumble out in bouncy dragon breaths.' },
  { id: 'c', name: 'Bubble Rings', description: 'Golden and turquoise smoke rings float up and gently tumble.' },
  { id: 'd', name: 'Rocket Whistle', description: 'A fizzy blue rocket plume shoots out little golden stars.' },
  { id: 'e', name: 'Confetti Clouds', description: 'Cotton-candy clouds carry a shower of rainbow star embers.' },
] as const satisfies readonly { id: SmokeVariant; name: string; description: string }[];

const CAPACITY = 120;
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const RING_NORMAL = new THREE.Vector3(0, 0, 1);
const CREAM = new THREE.Color('#fff8e8');
const PALETTES: Record<SmokeVariant, readonly THREE.Color[]> = {
  normal: ['#f3eee3', '#e2e4df', '#fff7e6'].map(c => new THREE.Color(c)),
  a: ['#ff8ea9', '#ffbc70', '#ffdf78', '#95dfac', '#7ecdea', '#b8a3f2'].map(c => new THREE.Color(c)),
  b: ['#81d4b5', '#d3e978', '#48b6a9', '#b9e7a9'].map(c => new THREE.Color(c)),
  c: ['#ffd273', '#77dbd1', '#fff0b1', '#92cce4'].map(c => new THREE.Color(c)),
  d: ['#a6e9f0', '#6fc7eb', '#e8faff', '#ffdc77'].map(c => new THREE.Color(c)),
  e: ['#fac1e4', '#d4b9f3', '#b8e7ed', '#fbe3b3'].map(c => new THREE.Color(c)),
};
const RAINBOW = PALETTES.a;
const RATES: Record<SmokeVariant, number> = { normal: 9, a: 19, b: 4.2, c: 8, d: 25, e: 6 };

type Particle = {
  live: boolean; kind: 0 | 1 | 2; born: number; life: number;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  size: number; grow: number; stretch: number; buoyancy: number; gravity: number; drag: number;
  curl: number; phase: number; bounce: number; spin: number;
  qx: number; qy: number; qz: number; qw: number;
  r: number; g: number; b: number;
};

function cloudGeometry() {
  // Three intersecting lobes give even the smallest puff a scalloped silhouette.
  // All three fit in one 180-triangle geometry and one instanced draw batch.
  const lobes = [
    new THREE.SphereGeometry(.77, 6, 6).scale(1, 1.07, 1),
    new THREE.SphereGeometry(.59, 6, 6).translate(-.49, .10, .06),
    new THREE.SphereGeometry(.56, 6, 6).translate(.46, .24, -.10),
  ];
  const geometry = mergeGeometries(lobes);
  for (const lobe of lobes) lobe.dispose();
  return geometry;
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .43 : 1;
    if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .18, bevelEnabled: true, bevelSegments: 1,
    bevelThickness: .06, bevelSize: .04, steps: 1, curveSegments: 1,
  });
  geometry.center();
  // One material and one draw call; the extruder's cap/side groups are unnecessary.
  geometry.clearGroups();
  return geometry;
}

/** Opaque, pooled funnel smoke. Attach group to the scene, not to the locomotive.
 * All particle positions use the emitter's coordinates; callers may translate
 * group when shifting a large world's render origin. Three draw batches at most,
 * no shadows or textures, and no allocations in the animation loop. */
export class TrainSmoke {
  readonly group = new THREE.Group();
  reducedMotion = false;
  private readonly material = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .12 });
  private readonly batches: THREE.InstancedMesh[];
  private readonly particles: Particle[] = Array.from({ length: CAPACITY }, () => ({
    live: false, kind: 0, born: 0, life: 1,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    size: 0, grow: 0, stretch: 1, buoyancy: 0, gravity: 0, drag: 1,
    curl: 0, phase: 0, bounce: 0, spin: 0,
    qx: 0, qy: 0, qz: 0, qw: 1, r: 1, g: 1, b: 1,
  }));
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly turn = new THREE.Quaternion();
  private readonly color = new THREE.Color();
  private readonly lastEmitter = new THREE.Vector3();
  private readonly outlet = new THREE.Vector3();
  private readonly flow = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly across = new THREE.Vector3();
  private readonly counts = [0, 0, 0];
  private previousEmitter = false;
  private previousVariant: SmokeVariant = 'normal';
  private clock = 0;
  private emissionClock = 0;
  private cursor = 0;
  private chuff = 0;
  private seed = 0x5eeda11;
  private disposed = false;

  get activeCount(): number { return this.batches.reduce((count, batch) => count + batch.count, 0); }

  constructor() {
    this.group.name = 'train-funnel-smoke';
    this.batches = [
      cloudGeometry(),
      new THREE.TorusGeometry(1, .115, 5, 16),
      starGeometry(),
    ].map((geometry, kind) => {
      const mesh = new THREE.InstancedMesh(geometry, this.material, CAPACITY);
      mesh.name = ['smoke-puffs', 'smoke-rings', 'smoke-stars'][kind];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, CREAM);
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = false;
      this.group.add(mesh);
      return mesh;
    });
  }

  /** direction is the funnel's world up; optional velocity is train travel.
   * Passing null stops emission and lets the existing trail finish. A zero dt
   * leaves everything untouched, including the seeded emission sequence. */
  update(dt: number, emitter: THREE.Vector3 | null, direction: THREE.Vector3,
    speed: number, variant: SmokeVariant = 'normal', velocity?: THREE.Vector3): void {
    if (this.disposed || !(dt > 0) || !Number.isFinite(dt)) return;
    this.clock += dt;
    if (emitter) {
      const pace = Number.isFinite(speed) ? Math.min(Math.abs(speed), 60) : 0;
      this.up.copy(direction);
      if (this.up.lengthSq() < .0001) this.up.copy(UP);
      else this.up.normalize();
      this.side.set(1, 0, 0);
      if (Math.abs(this.up.x) > .9) this.side.set(0, 0, 1);
      this.side.cross(this.up).normalize();
      this.across.crossVectors(this.up, this.side);
      const jump = this.previousEmitter && this.lastEmitter.distanceToSquared(emitter) > Math.pow(Math.max(8, pace * dt * 3), 2);
      if (velocity) this.flow.copy(velocity).clampLength(0, 60);
      else if (this.previousEmitter && !jump) this.flow.copy(emitter).sub(this.lastEmitter).multiplyScalar(1 / dt).clampLength(0, 60);
      else this.flow.set(0, 0, 0);
      // A resumed tab or a teleported train must not draw a connecting smoke line.
      const elapsed = Math.min(dt, .15);
      if (jump || dt > .15 || variant !== this.previousVariant) this.emissionClock = 0;
      const interval = 1 / (RATES[variant] * (1 + pace * .005) * (this.reducedMotion ? .55 : 1));
      this.emissionClock += elapsed;
      while (this.emissionClock + 1e-10 >= interval) {
        this.emissionClock = Math.max(0, this.emissionClock - interval);
        const fraction = 1 - this.emissionClock / dt;
        if (this.previousEmitter && !jump && dt <= .15) this.outlet.lerpVectors(this.lastEmitter, emitter, fraction);
        else this.outlet.copy(emitter);
        this.emit(variant, this.clock - this.emissionClock);
      }
      this.lastEmitter.copy(emitter);
      this.previousEmitter = true;
      this.previousVariant = variant;
    } else {
      this.previousEmitter = false;
      this.emissionClock = 0;
    }
    this.render();
  }

  reset(): void {
    for (const particle of this.particles) particle.live = false;
    for (const batch of this.batches) { batch.count = 0; batch.visible = false; }
    this.previousEmitter = false;
    this.previousVariant = 'normal';
    this.clock = this.emissionClock = this.cursor = this.chuff = 0;
    this.seed = 0x5eeda11;
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.group.removeFromParent();
    for (const batch of this.batches) { batch.geometry.dispose(); batch.dispose(); }
    this.material.dispose();
    this.disposed = true;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private spawn(kind: 0 | 1 | 2, born: number, color: THREE.Color): Particle {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % CAPACITY;
    p.live = true; p.kind = kind; p.born = born;
    p.x = this.outlet.x; p.y = this.outlet.y; p.z = this.outlet.z;
    p.vx = this.flow.x * .1; p.vy = this.flow.y * .1; p.vz = this.flow.z * .1;
    p.life = 1.6; p.size = .11; p.grow = .28; p.stretch = 1;
    p.buoyancy = .8; p.gravity = 0; p.drag = 1.4; p.curl = .14; p.bounce = 0;
    p.phase = this.random() * Math.PI * 2; p.spin = (this.random() - .5) * 1.8;
    this.rotation.setFromUnitVectors(kind === 1 ? RING_NORMAL : UP, this.up);
    p.qx = this.rotation.x; p.qy = this.rotation.y; p.qz = this.rotation.z; p.qw = this.rotation.w;
    p.r = color.r; p.g = color.g; p.b = color.b;
    return p;
  }

  private thrust(p: Particle, speed: number, spread: number): void {
    const a = (this.random() - .5) * spread, b = (this.random() - .5) * spread;
    p.vx += this.up.x * speed + this.side.x * a + this.across.x * b;
    p.vy += this.up.y * speed + this.side.y * a + this.across.y * b;
    p.vz += this.up.z * speed + this.side.z * a + this.across.z * b;
    if (this.reducedMotion) { p.curl *= .3; p.spin *= .35; p.bounce *= .3; }
  }

  private emit(variant: SmokeVariant, born: number): void {
    const palette = PALETTES[variant], index = this.chuff++;
    if (variant === 'normal') {
      const p = this.spawn(0, born, palette[index % palette.length]);
      p.life = 1.05 + this.random() * .2; p.size = .10; p.grow = .25;
      p.stretch = .82; p.curl = .10;
      this.thrust(p, 1.6, .35);
    } else if (variant === 'a') {
      const p = this.spawn(0, born, palette[Math.floor(index / 2) % palette.length]);
      p.life = 1.8; p.size = .13; p.grow = .48; p.curl = .38;
      p.stretch = .88; p.bounce = .08; p.buoyancy = 1.05;
      this.thrust(p, 2.65, .6);
    } else if (variant === 'b') {
      for (let lobe = 0; lobe < 3; lobe++) {
        const p = this.spawn(0, born, palette[(index + lobe) % palette.length]);
        const angle = lobe * Math.PI * 2 / 3 + index * .7, radius = lobe ? .20 : 0;
        p.x += (this.side.x * Math.cos(angle) + this.across.x * Math.sin(angle)) * radius;
        p.y += (this.side.y * Math.cos(angle) + this.across.y * Math.sin(angle)) * radius;
        p.z += (this.side.z * Math.cos(angle) + this.across.z * Math.sin(angle)) * radius;
        p.life = 2.0 + lobe * .06; p.size = lobe ? .20 : .28;
        p.grow = lobe ? .74 : .92; p.stretch = .86;
        p.curl = .55; p.bounce = .30; p.spin *= 3; p.buoyancy = .95;
        this.thrust(p, 4.35 + lobe * .18, 2.7);
      }
    } else if (variant === 'c') {
      const p = this.spawn(1, born, palette[index % palette.length]);
      p.life = 2; p.size = .12; p.grow = .8; p.curl = .1;
      p.buoyancy = .6; p.spin = (index % 2 ? -1 : 1) * .55;
      this.thrust(p, 2.5, .45);
    } else if (variant === 'd') {
      const p = this.spawn(0, born, palette[index % 3]);
      p.life = .78; p.size = .09; p.grow = .19; p.stretch = 2.5;
      p.curl = .035; p.drag = 1.2; p.buoyancy = .1;
      this.thrust(p, 11.5, .24);
      if (index % 2 === 0) {
        const star = this.spawn(2, born, palette[3]);
        star.life = 1.05; star.size = .1; star.grow = .25;
        star.curl = .04; star.buoyancy = -.45; star.spin *= 5;
        this.thrust(star, 10.2, 2.6);
      }
    } else {
      for (let lobe = 0; lobe < 3; lobe++) {
        const p = this.spawn(0, born, palette[(index + lobe) % palette.length]);
        p.life = 1.95; p.size = .15; p.grow = .50; p.stretch = .82;
        p.curl = .35; p.bounce = .1;
        this.thrust(p, 2.6 + lobe * .35, 1.8);
      }
      for (let ember = 0; ember < 3; ember++) {
        const p = this.spawn(2, born, RAINBOW[(index + ember * 2) % RAINBOW.length]);
        p.life = 1.7; p.size = .12; p.grow = .40; p.spin *= 4;
        p.buoyancy = 0; p.gravity = 1.1; p.drag = .75; p.curl = .13;
        this.thrust(p, 6.6, 6.8);
      }
    }
  }

  private render(): void {
    this.counts.fill(0);
    for (const p of this.particles) {
      if (!p.live) continue;
      const age = this.clock - p.born;
      if (age >= p.life) { p.live = false; continue; }
      const t = age / p.life, drift = (1 - Math.exp(-age * p.drag)) / p.drag;
      const curl = p.curl * (Math.sin(p.phase + age * 2.1) - Math.sin(p.phase));
      this.position.set(
        p.x + p.vx * drift + curl,
        p.y + p.vy * drift + p.buoyancy * age - p.gravity * age * age + p.bounce * Math.sin(age * 7) * Math.sin(t * Math.PI),
        p.z + p.vz * drift + p.curl * (Math.cos(p.phase + age * 1.8) - Math.cos(p.phase)),
      );
      // Opaque geometry dissipates by shrinking; no alpha sorting or overdraw.
      const fade = Math.min(1, (1 - t) / .28);
      const size = (p.size + p.grow * Math.sqrt(t)) * fade * fade * (3 - 2 * fade);
      const roll = 1 + p.bounce * Math.sin(age * 9 + p.phase);
      this.scale.set(size * roll, size * p.stretch / roll, size);
      this.rotation.set(p.qx, p.qy, p.qz, p.qw);
      // Stars spin in their own plane so their points stay legible as confetti.
      this.turn.setFromAxisAngle(p.kind === 1 ? RIGHT : p.kind === 2 ? RING_NORMAL : UP, p.spin * age);
      this.rotation.multiply(this.turn);
      this.matrix.compose(this.position, this.rotation, this.scale);
      const mesh = this.batches[p.kind], instance = this.counts[p.kind]++;
      mesh.setMatrixAt(instance, this.matrix);
      this.color.setRGB(p.r, p.g, p.b).lerp(CREAM, t * (p.kind === 2 ? .1 : .25));
      mesh.setColorAt(instance, this.color);
    }
    for (let kind = 0; kind < this.batches.length; kind++) {
      const mesh = this.batches[kind];
      mesh.count = this.counts[kind];
      mesh.visible = mesh.count > 0;
      if (mesh.visible) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
      }
    }
  }
}
