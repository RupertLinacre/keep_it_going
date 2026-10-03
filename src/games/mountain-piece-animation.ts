import * as T from 'three';
import type { MiniSection } from './mini-track';
import type { PieceAnimation } from './piece-animation';
import { FairgroundLights } from './world-lighting';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import { gorgeLookout, GORGE_GOAT_STOPS } from './mountain-landforms';
import { MOUNTAIN_CABLE_STATIONS, tunnelCableTravel } from './mountain-gondolas';
import { ravineWaterfall } from './world-mountains';

/** Smooth, bounded greetings work with replay scrubbing and independent riders. */
export function mountainGreeting(distance: number, stop: number) {
  const gap = (distance - stop) / 11;
  return Math.exp(-gap * gap);
}

function baked(model: WorldModel, material: T.Material) {
  const group = model.finish(material, material, false);
  return (group.children[0] as T.Mesh).geometry;
}
function goatGeometry(material: T.Material, head = false) {
  const m = new WorldModel();
  if (head) {
    m.add(G.round, '#e7e2ce', [.5, .97, 0], [.31, .4, .3]);
    m.add(G.round, '#f8f1d9', [.69, .89, .02], [.27, .2, .25]);
    for (const side of [-1, 1]) {
      m.add(G.cone, '#c1a783', [.41, 1.43, side * .18], [.075, .58, .075], [0, 0, .24]);
      m.add(G.round, '#e3ccaa', [.5, 1.08, side * .33], [.18, .09, .17]);
      m.add(G.round, '#364e58', [.73, 1, side * .21], [.065, .073, .035]);
    }
    m.add(G.cone, '#f3edd9', [.67, .64, 0], [.12, .28, .12], [0, 0, Math.PI]);
    const geometry = baked(m, material); geometry.translate(-.43, -.78, 0); return geometry;
  }
  m.add(G.round, '#f1ecd6', [0, .62, 0], [.68, .46, .37]);
  for (const side of [-1, 1]) for (const x of [-.38, .39]) {
    m.add(G.pole, '#e6ddc7', [x, .25, side * .23], [.09, .45, .09]);
    m.add(G.box, '#7e7768', [x + .03, .065, side * .23], [.2, .13, .18]);
  }
  m.add(G.round, '#e3d6b8', [-.69, .7, 0], [.22, .11, .11], [0, 0, -.6]);
  m.add(G.box, '#70aaa6', [.4, .71, 0], [.19, .18, .65]);
  m.add(G.round, '#e6bc64', [.44, .59, .32], [.13, .13, .1]);
  return baked(m, material);
}
function wheelGeometry(material: T.Material, radius: number, water = false) {
  const m = new WorldModel();
  for (const z of [-.28, .28]) {
    m.add(G.ring, water ? '#b98c5a' : '#a8bdba', [0, 0, z], [radius, radius, radius]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      m.beam(water ? '#d4b07a' : '#76949f', new T.Vector3(0, 0, z), new T.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z), .075);
    }
  }
  for (let i = 0; i < (water ? 12 : 8); i++) {
    const a = i * Math.PI * 2 / (water ? 12 : 8);
    m.add(G.box, water ? '#779c96' : '#d6c79e', [Math.cos(a) * radius, Math.sin(a) * radius, 0], [.42, .16, .72], [0, 0, a + Math.PI / 2]);
    if (water) {
      for (const side of [-1, 1]) m.add(G.box, '#b79567', [Math.cos(a) * radius, Math.sin(a) * radius, side * .42], [.58, .44, .14], [0, 0, a + Math.PI / 2]);
      m.add(G.box, '#83ada5', [Math.cos(a - .07) * (radius - .16), Math.sin(a - .07) * (radius - .16), 0], [.18, .46, .75], [0, 0, a + Math.PI / 2]);
    }
  }
  m.add(G.pole, '#697e80', [0, 0, 0], [.22, .9, .22], [Math.PI / 2, 0, 0]);
  return baked(m, material);
}

/** At most three fixed instance batches per mountain piece. Shared scenery
 * materials remain owned by AdventureScene; only these geometries are owned. */
export function createMountainPieceAnimation(section: MiniSection, material: T.Material, lights: FairgroundLights): PieceAnimation | undefined {
  if (!['mountainpass', 'tunnel', 'ravinebridge'].includes(section.kind)) return undefined;
  const group = new T.Group(), owned: T.BufferGeometry[] = [], dummy = new T.Object3D();
  group.name = `mountain-play-${section.kind}`;
  const instances = (geometry: T.BufferGeometry, count: number, mat = material) => {
    owned.push(geometry);
    const mesh = new T.InstancedMesh(geometry, mat, count);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    // The section window already bounds these tiny batches. Avoid recalculating
    // instance bounds as the water falls or a greeting makes the goats hop.
    mesh.frustumCulled = false; mesh.castShadow = false;
    group.add(mesh); return mesh;
  };
  const diamond = () => {
    const g = new T.OctahedronGeometry(1);
    const count = g.getAttribute('position').count;
    // The shared luminous material multiplies vertex and instance colours.
    // Supply white vertices so particles keep their pastel instance colours.
    g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    g.setAttribute('lightPhase', new T.Float32BufferAttribute(new Float32Array(count).fill(-1), 1));
    return g;
  };
  const put = (mesh: T.InstancedMesh, i: number, x: number, y: number, z: number, scale: number, rx = 0, ry = 0, rz = 0) => {
    dummy.position.set(x, y, z); dummy.scale.setScalar(scale); dummy.rotation.set(rx, ry, rz);
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  };
  let update: PieceAnimation['update'];
  if (section.kind === 'mountainpass') {
    const goats = instances(goatGeometry(material), GORGE_GOAT_STOPS.length);
    const heads = instances(goatGeometry(material, true), GORGE_GOAT_STOPS.length);
    const sparks = instances(diamond(), GORGE_GOAT_STOPS.length * 3, lights);
    const stops = GORGE_GOAT_STOPS.map(f => ({ p: gorgeLookout(section, f), at: section.start + section.length * f }));
    for (let i = 0; i < sparks.count; i++) sparks.setColorAt(i, new T.Color(['#b8e9de', '#e9e2ae', '#b4d6eb'][i % 3]));
    const neck = new T.Object3D(), headMatrix = new T.Matrix4(); neck.position.set(.43, .78, 0);
    update = (time, distance, reduced) => {
      for (let i = 0; i < stops.length; i++) {
        const { p, at } = stops[i], hello = mountainGreeting(distance, at);
        const bounce = reduced ? 0 : hello * Math.max(0, Math.sin(time * 4.8 + i * .7));
        put(goats, i, p.x, p.y + .15 + bounce * .72, p.z, 1.4, 0, i % 2 ? Math.PI + .3 : -.3, bounce * .12);
        neck.rotation.set(0, reduced ? 0 : (i % 2 ? 1 : -1) * hello * .5, reduced ? 0 : hello * Math.sin(time * 3.2 + i) * .22);
        neck.updateMatrix(); headMatrix.multiplyMatrices(dummy.matrix, neck.matrix); heads.setMatrixAt(i, headMatrix);
        for (let j = 0; j < 3; j++) {
          const a = j * 2.1 + i + (reduced ? 0 : time * .75);
          put(sparks, i * 3 + j, p.x + Math.cos(a) * 1.35, p.y + 2.1 + j * .28, p.z + Math.sin(a) * .6,
            reduced ? .05 : .035 + hello * .13, 0, a, a);
        }
      }
      goats.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; sparks.instanceMatrix.needsUpdate = true;
    };
  } else if (section.kind === 'tunnel') {
    const pulley = instances(wheelGeometry(material, 1.25), 2);
    const glints = instances(diamond(), 12, lights);
    const bellModel = new WorldModel();
    bellModel.add(G.pole, '#e3ba72', [0, -.45, 0], [.55, .8, .55]);
    bellModel.add(G.ring, '#f1d596', [0, -.83, 0], [.62, .62, .62], [Math.PI / 2, 0, 0]);
    bellModel.add(G.round, '#9b815d', [0, -.96, 0], [.14, .16, .14]);
    bellModel.add(G.box, '#76a79f', [0, .05, 0], [.14, .85, .14]);
    const bells = instances(baked(bellModel, material), 2);
    const frame = section.sample(section.start + section.length / 2);
    const orientation = frame.rotation.clone(), center = frame.position.clone(); center.x -= section.origin.x; center.z -= section.origin.z;
    // Cache build-time heights. The owner applies later track-lift changes once.
    const world = (p: T.Vector3) => p.applyQuaternion(orientation).add(center);
    const stations = MOUNTAIN_CABLE_STATIONS.map(p => world(new T.Vector3(...p)));
    const bellStops = [-1, 1].map(sign => ({ p: world(new T.Vector3(4.7, 6.9, sign * 14.6)), at: section.start + section.length / 2 + sign * 14 }));
    const crystals = Array.from({ length: 12 }, (_, i) => world(new T.Vector3(i % 2 ? -2.36 : 2.36, .55 + i % 3 * .15, -12 + i * 2.15)));
    for (let i = 0; i < glints.count; i++) glints.setColorAt(i, new T.Color(i % 2 ? '#bce9e2' : '#ead7a7'));
    const local = new T.Quaternion(), bellAxis = new T.Vector3(0, 0, 1), base = new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0));
    update = (time, distance, reduced) => {
      const travel = reduced ? 0 : time * .85 + tunnelCableTravel(section, distance);
      for (let i = 0; i < stations.length; i++) {
        const p = stations[i];
        dummy.position.copy(p); dummy.scale.setScalar(1);
        local.setFromAxisAngle(T.Object3D.DEFAULT_UP, -travel / 1.3);
        dummy.quaternion.copy(orientation).multiply(local).multiply(base);
        dummy.updateMatrix(); pulley.setMatrixAt(i, dummy.matrix);
      }
      for (let i = 0; i < crystals.length; i++) {
        const p = crystals[i], at = section.start + section.length / 2 - 12 + i * 2.15;
        const hello = mountainGreeting(distance, at);
        put(glints, i, p.x, p.y, p.z, reduced ? .09 : .1 + hello * (.04 + .03 * Math.sin(time * 3 + i)), 0, reduced ? 0 : time * .35, .25);
      }
      for (const [i, { p, at }] of bellStops.entries()) {
        dummy.position.copy(p); dummy.scale.setScalar(1);
        local.setFromAxisAngle(bellAxis, reduced ? 0 : mountainGreeting(distance, at) * Math.sin(time * 6) * .52);
        dummy.quaternion.copy(orientation).multiply(local); dummy.updateMatrix(); bells.setMatrixAt(i, dummy.matrix);
      }
      pulley.instanceMatrix.needsUpdate = true; glints.instanceMatrix.needsUpdate = true; bells.instanceMatrix.needsUpdate = true;
    };
  } else {
    const wheel = instances(wheelGeometry(material, 2.15, true), 1);
    const drops = instances(diamond(), 24, lights), glints = instances(diamond(), 10, lights);
    const { x, z, height } = ravineWaterfall(section), middle = section.start + section.length / 2;
    for (let i = 0; i < drops.count; i++) drops.setColorAt(i, new T.Color(i % 2 ? '#d1efeb' : '#a4dce5'));
    for (let i = 0; i < glints.count; i++) glints.setColorAt(i, new T.Color(['#efb6a6', '#eee0b3', '#c5e1b9', '#b7dfeb', '#d0c9ed'][i % 5]));
    update = (time, distance, reduced) => {
      const hello = mountainGreeting(distance, middle), clock = reduced ? 0 : time;
      const push = reduced ? 0 : T.MathUtils.clamp(distance - section.start, 0, section.length) * .045;
      put(wheel, 0, x + 6.1, 2.7, z + 1.65, 1, 0, 0, -clock * .42 - push);
      for (let i = 0; i < drops.count; i++) {
        if (i >= 16) {
          const u = (clock * .33 + (i - 16) / 8) % 1;
          put(drops, i, x + 2.2 + u * 3.9, height * .55 * (1 - u) + 5.02 * u, z + 1.65, .13 + hello * .035, 0, 0, 0);
          continue;
        }
        const fall = (clock * .36 + i / 8) % 1, lower = i >= 8;
        const y = lower ? height * .54 * (1 - fall * fall) : height * (.54 + .46 * (1 - fall * fall));
        put(drops, i, x - 1.1 + (i % 4) * .84 + (lower ? .6 : 0), .15 + y, z + (lower ? 1.38 : .3), .12 + i % 3 * .04, 0, i, 0);
      }
      for (let i = 0; i < glints.count; i++) {
        const a = .16 + i / (glints.count - 1) * (Math.PI - .32);
        const radius = 6.05 + Math.sin(i) * .14;
        put(glints, i, x + Math.cos(a) * radius, 1.7 + Math.sin(a) * radius, z + 2.85,
          reduced ? .065 : .06 + hello * (.09 + .055 * Math.sin(clock * 4 + i)), 0, 0, clock * .7 + i);
      }
      wheel.instanceMatrix.needsUpdate = true; drops.instanceMatrix.needsUpdate = true; glints.instanceMatrix.needsUpdate = true;
    };
  }
  update(0, section.start - 60, false);
  return { group, update, dispose() {
    // Instance attributes are owned by the mesh, separately from its geometry.
    for (const mesh of group.children) if (mesh instanceof T.InstancedMesh) mesh.dispose();
    owned.forEach(g => g.dispose()); group.clear();
  } };
}
