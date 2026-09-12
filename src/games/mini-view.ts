import * as THREE from "three";
import { MiniRailCurve, MiniTrack, type MiniSection } from "./mini-track";
import {
  MINI_CART_SPACING,
  MINI_VISIBLE_CARTS,
  MINI_STARTING_CARTS,
  MINI_START_SPEED,
  MINI_MAX_FLYING_CARTS,
  MINI_MAX_FLYING_PARCELS, MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES,
  parcelPresentation, isParcelWagon,
} from "./mini-config";
import { clamp } from "../math";
import type { MiniCarriages } from "./mini-carriages";
import { MINI_CAMERA_DIRECTION, MiniCameraRig } from "./mini-camera";

type ModelPart = { mesh: THREE.InstancedMesh; transform: THREE.Matrix4; body: boolean };
const CART_COLORS = ["#e5ef93", "#e9a8a7", "#9fbddd", "#c6b0e5", "#eec987", "#a8dac7"].map(c => new THREE.Color(c));

/** A fixed-horizon, orthographic model railway view. The camera never rides the train. */
export class MiniView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-32, 32, 15, -15, 0.1, 220);
  readonly renderer: THREE.WebGLRenderer;
  readonly train: THREE.InstancedMesh[] = [];
  cartCount = MINI_STARTING_CARTS;
  renderedCartCount = MINI_STARTING_CARTS;
  private trainParts: ModelPart[];
  private wagonParts: ModelPart[];
  private parcelParts: ModelPart[];
  readonly debris: THREE.InstancedMesh;
  readonly couplings: THREE.InstancedMesh;
  readonly impactFlashes: THREE.InstancedMesh;
  readonly impactRings: THREE.InstancedMesh;
  readonly cameraRig = new MiniCameraRig();
  private lastTime = 0;
  readonly pieces = new Map<number, THREE.Group>();
  readonly resize: ResizeObserver;
  private board = new THREE.Group();
  private lastState = "";
  private aspect = 2;
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private lamp = new THREE.PointLight("#eaff90", 0, 8);
  constructor(
    readonly stage: HTMLElement,
    readonly track: MiniTrack,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "coaster-canvas mini-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    stage.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color("#e6eee8");
    this.scene.fog = new THREE.Fog("#e6eee8", 100, 180);
    this.scene.add(new THREE.HemisphereLight("#fffbea", "#8bafa6", 2));
    const sun = new THREE.DirectionalLight("#fff2d5", 2.5);
    sun.position.set(-18, 44, 28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -65;
    sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.far = 120;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const table = this.mesh(new THREE.BoxGeometry(170, 1.1, 27), "#cfae8c");
    table.position.y = -0.7;
    const turf = this.mesh(new THREE.BoxGeometry(170, 0.25, 26.8), "#d5e3c3");
    turf.position.y = -0.05;
    this.board.add(table, turf);
    for (const z of [-13.4, 13.4]) {
      const edging = this.mesh(
        new THREE.BoxGeometry(170, 0.18, 0.28),
        "#f7efdb",
      );
      edging.position.set(0, 0.14, z);
      this.board.add(edging);
    }
    this.scene.add(this.board);
    // Instance each model part: a long reward train costs the same number of
    // draw calls as a short one. Offscreen tail carts remain logical rewards.
    this.trainParts = this.instanceModel(this.car("#ffffff"), MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS);
    this.wagonParts = this.instanceModel(this.car("#ffffff", true), MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS);
    this.parcelParts = this.instanceModel(this.parcel(), 2 * (MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS) + MINI_MAX_FLYING_PARCELS);
    this.train.push(...[...this.trainParts, ...this.wagonParts].map(part => part.mesh));
    this.couplings = this.instances(new THREE.CylinderGeometry(0.085, 0.085, 1, 6), "#ffffff", MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS);
    this.debris = this.instances(new THREE.BoxGeometry(1, 1, 1), "#ffffff", MINI_MAX_EXPLOSIONS * MINI_EXPLOSION_PARTICLES);
    this.impactFlashes = this.instances(new THREE.IcosahedronGeometry(1, 1), "#ffe6a6", MINI_MAX_EXPLOSIONS);
    this.impactRings = this.instances(new THREE.TorusGeometry(1, 0.035, 6, 40), "#f6ad62", MINI_MAX_EXPLOSIONS);
    this.scene.add(this.lamp);
    this.resize = new ResizeObserver(() => {
      const w = stage.clientWidth,
        h = stage.clientHeight;
      if (w && h) {
        this.renderer.setSize(w, h);
        this.aspect = w / h;
        this.lastState = "";
      }
    });
    this.resize.observe(stage);
    this.renderer.setSize(stage.clientWidth, stage.clientHeight);
    this.aspect = stage.clientWidth / stage.clientHeight;
    this.render(track.startDistance, MINI_START_SPEED, 0, false);
  }
  private instances(geometry: THREE.BufferGeometry, color: string, capacity: number) {
    const mesh = new THREE.InstancedMesh(geometry, this.material(color), capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    this.scene.add(mesh);
    return mesh;
  }
  private instanceModel(model: THREE.Group, capacity: number) {
    const parts: ModelPart[] = [];
    model.updateMatrixWorld(true);
    for (const child of model.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const mesh = new THREE.InstancedMesh(
        child.geometry,
        child.material,
        capacity,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parts.push({
        mesh,
        transform: child.matrix.clone(),
        body: child.material === this.material("#ffffff"),
      });
      this.scene.add(mesh);
    }
    return parts;
  }
  private material(color: string) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.55,
          metalness: 0.06,
        }),
      );
    return this.materials.get(color)!;
  }
  private mesh(geometry: THREE.BufferGeometry, color: string) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  private car(color: string, open = false) {
    const group = new THREE.Group();
    const board = this.mesh(new THREE.BoxGeometry(1.45, 0.25, 2.1), "#6f8e89");
    board.position.y = 0.26;
    group.add(board);
    if (open) {
      for (const x of [-0.62, 0.62]) {
        const wall = this.mesh(new THREE.BoxGeometry(0.16, 0.58, 2.02), color);
        wall.position.set(x, 0.66, 0); group.add(wall);
        const rim = this.mesh(new THREE.BoxGeometry(0.2, 0.08, 2.06), "#fff0ca");
        rim.position.set(x, 0.98, 0); group.add(rim);
      }
      for (const z of [-0.95, 0.95]) {
        const wall = this.mesh(new THREE.BoxGeometry(1.1, 0.58, 0.16), color);
        wall.position.set(0, 0.66, z); group.add(wall);
      }
    } else {
      const cube = new THREE.BoxGeometry(0.7, 0.52, 0.52);
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 3; col++) {
          const block = this.mesh(cube, color);
          block.position.set(0, 0.64 + row * 0.56, (col - 1) * 0.57);
          group.add(block);
        }
    }
    for (const x of [-0.6, 0.6])
      for (const z of [-0.68, 0.68]) {
        const wheel = this.mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12),
          "#536b73",
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.12, z);
        group.add(wheel);
      }
    if (!open) for (const z of [-0.22, 0.22]) {
      const eye = this.mesh(new THREE.SphereGeometry(0.2, 10, 8), "#fffef7");
      eye.scale.set(0.4, 1.2, 0.8);
      eye.position.set(0.4, 1.1, z);
      group.add(eye);
      const pupil = this.mesh(new THREE.SphereGeometry(0.067, 8, 6), "#3b465a");
      pupil.position.set(0.49, 1.09, z - 0.025);
      group.add(pupil);
    }
    if (!open) {
      const roof = this.mesh(new THREE.BoxGeometry(0.84, 0.12, 1.9), "#fff0ca");
      roof.position.y = 1.57;
      group.add(roof);
    }
    return group;
  }
  private parcel() {
    const group = new THREE.Group();
    group.add(this.mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), "#c89560"));
    group.add(this.mesh(new THREE.BoxGeometry(0.12, 0.69, 0.69), "#f9e8b9"));
    group.add(this.mesh(new THREE.BoxGeometry(0.69, 0.69, 0.12), "#f9e8b9"));
    return group;
  }
  private build(section: MiniSection) {
    const group = new THREE.Group();
    const ranges = section.kind === "jump"
      ? [[section.start, section.takeoff - 0.03], [section.distanceAtX(section.landingX), section.end]]
      : [[section.start, section.end]];
    for (const [from, to] of ranges) for (const [i, offset] of [-0.57, 0.57].entries()) {
      const rail = this.mesh(
        new THREE.TubeGeometry(
          new MiniRailCurve(section, offset, from, to),
          Math.ceil((to - from) * 14),
          0.095,
          6,
          false,
        ),
        i ? "#f5d16f" : "#e89983",
      );
      group.add(rail);
    }
    const count = Math.ceil(section.length / 0.65);
    const sleepers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.55, 0.13, 0.18),
      this.material("#64988e"),
      count,
    );
    sleepers.castShadow = true;
    sleepers.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let sleeperCount = 0;
    for (let i = 0; i < count; i++) {
      const at = section.start + (i / count) * section.length;
      if (!section.hasRail(at)) continue;
      const f = section.sample(at);
      dummy.position
        .copy(f.position)
        .sub(section.origin)
        .addScaledVector(f.up, -0.14);
      dummy.quaternion.copy(f.rotation);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sleepers.setMatrixAt(sleeperCount++, dummy.matrix);
    }
    sleepers.count = sleeperCount;
    group.add(sleepers);
    const supports: THREE.Vector3[] = [];
    for (let s = section.start + 0.8; s < section.end; s += 2.4) {
      if (!section.hasRail(s)) continue;
      const f = section.sample(s);
      const onTower = section.kind === "triplehelix"
        && f.position.x - section.origin.x > section.width * 0.57;
      if (!onTower && f.up.y > 0.2 && Math.abs(f.tangent.y) < 0.88)
        supports.push(f.position.clone().sub(section.origin));
    }
    const posts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.1, 0.14, 1, 6),
      this.material("#9bbcb0"),
      supports.length,
    );
    const feet = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.34, 0.39, 0.14, 8),
      this.material("#f1ecd7"),
      supports.length,
    );
    supports.forEach((p, i) => {
      const height = p.y + section.origin.y - 0.15;
      dummy.quaternion.identity();
      dummy.scale.set(1, height, 1);
      dummy.position.set(p.x, height / 2 - section.origin.y, p.z);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(1, 1, 1);
      dummy.position.y = -section.origin.y + 0.15;
      dummy.updateMatrix();
      feet.setMatrixAt(i, dummy.matrix);
    });
    posts.castShadow = true;
    posts.receiveShadow = true;
    group.add(posts, feet);
    if (section.kind === "triplehelix") {
      const radius = section.width * 0.095;
      const height = section.amplitude + section.origin.y;
      const mast = this.mesh(new THREE.CylinderGeometry(0.4, 0.6, height, 10), "#e8cfac");
      mast.position.set(section.width * 0.68 + radius * 0.2, height / 2 - section.origin.y, section.hand * radius);
      group.add(mast);
      const cap = this.mesh(new THREE.ConeGeometry(1.2, 1.4, 10), "#e89983");
      cap.position.copy(mast.position); cap.position.y = section.amplitude + 0.7;
      group.add(cap);
      const spokeGeometry = new THREE.CylinderGeometry(0.07, 0.1, 1, 6);
      for (let i = 0; i < 12; i++) {
        const frame = section.frames[Math.round(section.resolution * (0.3 + 0.6 * (i + 0.5) / 12))];
        const end = frame.position.clone().sub(section.origin).addScaledVector(frame.up, -0.3);
        const start = new THREE.Vector3(mast.position.x, end.y - 0.3, mast.position.z);
        const direction = end.clone().sub(start);
        const spoke = this.mesh(spokeGeometry, "#9bbcb0");
        spoke.scale.y = direction.length();
        spoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        spoke.position.copy(start).add(end).multiplyScalar(0.5);
        group.add(spoke);
      }
    }
    if (section.kind === "jump") {
      const left = section.width * 0.2, right = section.width * 0.64;
      const water = this.mesh(new THREE.BoxGeometry(right - left + 1.5, 0.2, 11), "#58b9c9");
      water.position.set((left + right) / 2, 0.18 - section.origin.y, 0);
      group.add(water);
      for (const z of [-5.7, 5.7]) {
        const bank = this.mesh(new THREE.BoxGeometry(right - left + 2.2, 0.38, 0.55), "#f1dec0");
        bank.position.set((left + right) / 2, 0.18 - section.origin.y, z); group.add(bank);
      }
      for (let i = 0; i < 8; i++) {
        const ripple = this.mesh(new THREE.BoxGeometry(1.5 + i % 3, 0.025, 0.07), "#b9eced");
        ripple.position.set(left + 2 + (right - left - 4) * i / 7, 0.295 - section.origin.y, i % 2 ? 2.5 : -2);
        group.add(ripple);
      }
      for (const x of [left - 0.4, right + 0.4]) for (const z of [-1.2, 1.2]) {
        const height = x < right ? section.amplitude + section.origin.y + 0.7 : section.origin.y + 0.7;
        const post = this.mesh(new THREE.CylinderGeometry(0.12, 0.12, height, 8), "#f4ca64");
        post.position.set(x, height / 2 - section.origin.y, z); group.add(post);
        const flag = this.mesh(new THREE.BoxGeometry(0.65, 0.65, 0.08), "#e89983");
        flag.position.set(x + 0.28, height - section.origin.y - 0.2, z); group.add(flag);
      }
    }
    // Little model trees and paving give the track a tangible tabletop scale.
    const random = (n: number) =>
      (Math.sin(section.id * 93.17 + n * 71.43 + this.track.seed) * 4159.93 +
        5000) %
      1;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.17, 1, 6),
      leafGeo = new THREE.ConeGeometry(0.9, 2.2, 7);
    for (let i = 0; i < 5; i++) {
      const x = (Math.max(3, section.width) * (i + 0.5)) / 5;
      const side = section.kind === "helix" || section.kind === "triplehelix" ? -section.hand : i % 2 ? 1 : -1;
      const z = side * (8.3 + random(i) * 2.5) - section.origin.z;
      const tree = new THREE.Group();
      const trunk = this.mesh(trunkGeo, "#b99c82");
      trunk.position.y = 0.5;
      const crown = this.mesh(leafGeo, i % 2 ? "#7ca79b" : "#a8bf93");
      crown.position.y = 1.9;
      tree.add(trunk, crown);
      tree.position.set(x, -section.origin.y, z);
      tree.scale.setScalar(0.7 + random(i + 5) * 0.5);
      group.add(tree);
    }
    this.pieces.set(section.id, group);
    this.scene.add(group);
  }
  private release(group: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach((g) => g.dispose());
    this.scene.remove(group);
  }
  render(
    distance: number,
    velocity: number,
    flash: number,
    close: boolean,
    cartCount = MINI_STARTING_CARTS,
    effects?: MiniCarriages,
    time = 0,
  ) {
    const flights = effects?.flights ?? [], parcels = effects?.parcels ?? [], explosions = effects?.explosions ?? [];
    const dt = clamp(time - this.lastTime, 0, 0.05);
    this.lastTime = time;
    const state = `${distance}:${velocity}:${flash}:${close}:${cartCount}:${this.track.generated}:${effects?.spilled}:${effects?.refills}:${time}:${flights.map(c => c.age)}:${parcels.map(p => p.age + p.groundedFor)}:${explosions.map(e => e.age)}`;
    if (state === this.lastState && this.cameraRig.settled) return;
    this.lastState = state;
    const ids = new Set(this.track.sections.map((s) => s.id));
    for (const [id, mesh] of this.pieces)
      if (!ids.has(id)) {
        this.release(mesh);
        this.pieces.delete(id);
      }
    const poses = effects?.poses(distance);
    const f = poses?.[0]?.frame ?? this.track.sample(distance),
      anchor = Math.floor(f.position.x / 25) * 25;
    for (const section of this.track.sections) {
      if (!this.pieces.has(section.id)) this.build(section);
      this.pieces
        .get(section.id)!
        .position.copy(section.origin)
        .add(new THREE.Vector3(-anchor, 0, 0));
    }
    // Frame taller hills from the side. Fade the influence of approaching
    // peaks in at the edges so the model view opens up smoothly as we travel.
    let skyline = 10;
    for (const section of this.track.sections)
      for (let i = 0; i < section.frames.length; i += 12) {
        const p = section.frames[i].position;
        const influence =
          clamp((p.x - f.position.x + 30) / 12, 0, 1) *
          clamp((f.position.x + 65 - p.x) / 22, 0, 1);
        skyline = Math.max(skyline, 4 + (p.y - 4) * influence);
      }
    const baseFocus = new THREE.Vector3(
      // Narrow screens need the train centred, with less empty track ahead.
      f.position.x + (close ? 3 : 9) * clamp(this.aspect - 1, 0, 1),
      close
        ? Math.max(4.1, f.position.y * 0.78)
        : Math.max(4.1, skyline * 0.43),
      0,
    );
    const baseHeight = (close ? 26 : Math.max(32, skyline * 1.25 + 10))
      * (this.stage.clientHeight < 400 ? 1.22 : 1);
    const subjects = [
      ...(poses?.filter(p => p.coach.cargo > 4).map(p => p.frame.position.clone().addScaledVector(p.frame.up, 1.35 + Math.floor((p.coach.cargo - 1) / 2) * 0.7)) ?? []),
      ...(poses?.filter(p => p.frame.airborne || p.coach.lift > 0.05 || p.coach === effects?.incoming).map(p => p.frame.position) ?? []),
      ...(effects?.cameraSubjects() ?? []),
    ];
    if (subjects.length) subjects.unshift(f.position);
    this.cameraRig.update(baseFocus, baseHeight, this.aspect, subjects, dt);
    const height = this.cameraRig.height;
    const focus = this.cameraRig.focus.clone();
    focus.x -= anchor;
    const cameraDistance = Math.max(42.4, height * 1.5);
    this.camera.left = (-height * this.aspect) / 2;
    this.camera.right = (height * this.aspect) / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.far = cameraDistance + height * 3 + 220;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(focus).addScaledVector(MINI_CAMERA_DIRECTION, cameraDistance);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(focus);
    this.camera.updateMatrixWorld(true);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = cameraDistance + 60;
    fog.far = cameraDistance + Math.max(180, height * 3);
    this.cartCount = cartCount;
    const count = Math.min(cartCount, MINI_VISIBLE_CARTS);
    const closed: THREE.Matrix4[] = [], open: THREE.Matrix4[] = [], cargo: THREE.Matrix4[] = [];
    const closedColors: number[] = [], openColors: number[] = [];
    const addCar = (position: THREE.Vector3, rotation: THREE.Quaternion, index: number, loaded: number, cargoAge = 1) => {
      const matrix = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1));
      if (isParcelWagon(index)) {
        open.push(matrix); openColors.push(index);
        if (loaded) for (const offset of parcelPresentation(loaded, cargoAge)) {
          if (offset.scale <= 0) continue;
          cargo.push(matrix.clone().multiply(new THREE.Matrix4().compose(
            new THREE.Vector3(offset.x, offset.y, offset.z), new THREE.Quaternion(), new THREE.Vector3().setScalar(offset.scale))));
        }
      } else { closed.push(matrix); closedColors.push(index); }
    };
    const attached = poses ?? Array.from({ length: count }, (_, index) => ({
      frame: this.track.sample(distance - index * MINI_CART_SPACING), coach: { id: index, cargo: isParcelWagon(index) ? 2 : 0, cargoAge: 1 },
    }));
    for (const { frame, coach } of attached) {
      const position = frame.position.clone();
      position.x -= anchor;
      const screen = position.clone().project(this.camera);
      if (Math.abs(screen.x) > 1.25 || Math.abs(screen.y) > 1.35) continue;
      addCar(position, frame.rotation, coach.id, coach.cargo, coach.cargoAge);
    }
    this.renderedCartCount = open.length + closed.length;
    for (const cart of flights) {
      const position = cart.position.clone();
      position.x -= anchor;
      addCar(position, cart.rotation, cart.colorIndex, cart.cargo);
    }
    for (const parcel of parcels) {
      const position = parcel.position.clone(); position.x -= anchor;
      cargo.push(new THREE.Matrix4().compose(position, parcel.rotation, new THREE.Vector3(1, 1, 1)));
    }
    this.drawModel(this.trainParts, closed, closedColors);
    this.drawModel(this.wagonParts, open, openColors);
    this.drawModel(this.parcelParts, cargo, []);
    const dummy = new THREE.Object3D();
    const links = effects?.links(distance) ?? [];
    for (const [i, link] of links.entries()) {
      const direction = link.end.clone().sub(link.start);
      dummy.position.copy(link.start).add(link.end).multiplyScalar(0.5);
      dummy.position.x -= anchor;
      dummy.scale.set(1, direction.length(), 1);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      dummy.updateMatrix();
      this.couplings.setMatrixAt(i, dummy.matrix);
      const color = new THREE.Color("#56786f").lerp(new THREE.Color("#efb750"), Math.min(1, link.stress * 1.4));
      if (link.stress > 0.75) color.lerp(new THREE.Color("#e67657"), (link.stress - 0.75) * 4);
      this.couplings.setColorAt(i, color);
    }
    this.couplings.count = links.length;
    this.couplings.instanceMatrix.needsUpdate = true;
    if (this.couplings.instanceColor) this.couplings.instanceColor.needsUpdate = true;
    let chunks = 0, flashes = 0, rings = 0;
    for (const explosion of explosions) {
      for (const [i, particle] of explosion.particles.entries()) {
        dummy.position.copy(particle.position); dummy.position.x -= anchor;
        dummy.rotation.set(explosion.age * 3 + i, explosion.age * 2, i * 0.7);
        dummy.scale.setScalar(particle.size * 2 * Math.max(0, 1 - explosion.age / 2));
        dummy.updateMatrix();
        this.debris.setMatrixAt(chunks, dummy.matrix);
        this.debris.setColorAt(chunks++, explosion.water ? new THREE.Color(i % 3 ? "#58b9c9" : "#d9ffff") : i % 3 ? CART_COLORS[explosion.colorIndex % CART_COLORS.length] : new THREE.Color("#ffa451"));
      }
      dummy.position.copy(explosion.position); dummy.position.x -= anchor;
      dummy.rotation.set(0, 0, 0);
      if (explosion.age < 0.3 && !explosion.water) {
        dummy.scale.setScalar(2.2 * (1 - explosion.age / 0.3)); dummy.updateMatrix();
        this.impactFlashes.setMatrixAt(flashes++, dummy.matrix);
      }
      if (explosion.age < 0.8) {
        dummy.position.y = 0.16; dummy.rotation.x = Math.PI / 2;
        dummy.scale.setScalar(0.5 + explosion.age * 8); dummy.updateMatrix();
        this.impactRings.setColorAt(rings, new THREE.Color(explosion.water ? "#c7f7ff" : "#f6ad62"));
        this.impactRings.setMatrixAt(rings++, dummy.matrix);
      }
    }
    for (const [mesh, count] of [[this.debris, chunks], [this.impactFlashes, flashes], [this.impactRings, rings]] as const) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.lamp.position.copy(f.position).addScaledVector(f.up, 0.6);
    this.lamp.position.x -= anchor;
    this.lamp.intensity = flash > 0 ? flash * 12 : 0;
    this.board.position.x = focus.x;
    this.board.scale.set(Math.max(1, height * this.aspect / 150), 1, Math.max(1, height / 50));
    this.renderer.render(this.scene, this.camera);
  }
  private drawModel(parts: ModelPart[], transforms: THREE.Matrix4[], colorIndices: number[]) {
    const matrix = new THREE.Matrix4();
    for (const part of parts) {
      if (transforms.length > part.mesh.instanceMatrix.count) {
        const previous = part.mesh;
        const mesh = new THREE.InstancedMesh(previous.geometry, previous.material, 2 ** Math.ceil(Math.log2(transforms.length)));
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.remove(previous); previous.dispose();
        this.scene.add(mesh); part.mesh = mesh;
      }
      part.mesh.count = transforms.length;
      transforms.forEach((transform, index) => {
        matrix.multiplyMatrices(transform, part.transform);
        part.mesh.setMatrixAt(index, matrix);
        if (part.body)
          part.mesh.setColorAt(
            index,
            CART_COLORS[colorIndices[index] % CART_COLORS.length],
          );
      });
      part.mesh.instanceMatrix.needsUpdate = true;
      if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
    }
  }
  destroy() {
    this.resize.disconnect();
    // All geometries are owned by this view; shared materials are released once.
    this.release(this.scene);
    this.materials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
