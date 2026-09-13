import { AdventureScene } from "./adventure-scene";
import { adventureAt } from "./adventure-worlds";
import { sailDeployment } from "./tailwind-sails";
import { groundBounds, RaceSpacing } from "./mini-world";
import { riderColor, riderColorIndex, type RiderRole } from "../multiplayer/identity";
import * as THREE from "three";
import { mergeStaticMeshes, railGeometries, refreshRails } from "./mini-mesh";
import { HeightTrack } from "./height-track";
import { PowerupScene } from "./powerup-scene";
import { floodedPool, splashFanGeometry } from "./flooded-track";
import { POWERUPS, type RidePowerups } from "./ride-powerups";
import { MiniTrack, type MiniSection } from "./mini-track";
import {
  MINI_CART_SPACING,
  MINI_VISIBLE_CARTS,
  MINI_STARTING_CARTS,
  MINI_START_SPEED,
  MINI_MAX_FLYING_CARTS,
  MINI_MAX_FLYING_PARCELS, MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES,
  parcelPresentation, isParcelWagon, MINI_POWER_PARCELS,
} from "./mini-config";
import { clamp } from "../math";
import type { MiniCarriages } from "./mini-carriages";
import { lanePosition, mirrorRotation } from "../multiplayer/ghost";
import type { RideState } from "../multiplayer/protocol";
import { MINI_CAMERA_DIRECTION, MiniCameraRig, coasterFraming } from "./mini-camera";
import { DOWNHILL_TILT, tiltPoint } from "./mini-tilt";

type ModelPart = { mesh: THREE.InstancedMesh; transform: THREE.Matrix4; body: boolean };
const CART_COLORS = ["#e5ef93", "#e9a8a7", "#9fbddd", "#c6b0e5", "#eec987", "#a8dac7"].map(c => new THREE.Color(c));

/** A fixed-horizon, orthographic model railway view. The camera never rides the train. */
export class MiniView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-32, 32, 15, -15, 0.1, 220);
  readonly renderer: THREE.WebGLRenderer;
  readonly train: THREE.InstancedMesh[] = [];
  multiplayer = false;
  riderRole: RiderRole = "host";
  private laneOffset = 0;
  private readonly spacing: RaceSpacing;
  private readonly opponentPieces = new Map<number, THREE.Group>();
  cartCount = MINI_STARTING_CARTS;
  renderedCartCount = MINI_STARTING_CARTS;
  private trainParts: ModelPart[];
  private wagonParts: ModelPart[];
  private parcelParts: ModelPart[];
  private sailParts?: ModelPart[];
  private dynamiteParts?: ModelPart[];
  private adventureScene?: AdventureScene;
  private sunlight?: THREE.DirectionalLight;
  private skylight?: THREE.HemisphereLight;
  private powerScene?: PowerupScene;
  private opponentPowerScene?: PowerupScene;
  private splashSheets: THREE.InstancedMesh;
  private waterDroplets: THREE.InstancedMesh;
  readonly debris: THREE.InstancedMesh;
  readonly couplings: THREE.InstancedMesh;
  readonly impactFlashes: THREE.InstancedMesh;
  readonly impactRings: THREE.InstancedMesh;
  readonly cameraRig = new MiniCameraRig();
  private lastTime = 0;
  readonly pieces = new Map<number, THREE.Group>();
  readonly resize: ResizeObserver;
  private board = new THREE.Group();
  private boardInlay: THREE.Mesh;
  private lastState = "";
  private aspect = 2;
  private readonly compactLayout = window.matchMedia("(max-width: 800px), (hover: none), (pointer: coarse)");
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private lamp = new THREE.PointLight("#eaff90", 0, 8);
  constructor(
    readonly stage: HTMLElement,
    readonly track: MiniTrack,
    options: { multiplayer?: boolean; role?: RiderRole; spacing?: RaceSpacing } = {},
  ) {
    this.multiplayer = !!options.multiplayer;
    this.riderRole = options.role ?? "host";
    this.spacing = options.spacing ?? new RaceSpacing();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "coaster-canvas mini-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    stage.prepend(this.renderer.domElement);
    this.scene.matrixAutoUpdate = false;
    this.scene.updateMatrix();
    this.scene.background = new THREE.Color("#e6eee8");
    this.scene.fog = new THREE.Fog("#e6eee8", 100, 180);
    this.skylight = new THREE.HemisphereLight("#fffbea", "#8bafa6", 2);
    this.scene.add(this.skylight);
    const sun = new THREE.DirectionalLight("#fff2d5", 2.5);
    this.sunlight = sun;
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
    // The board extends beyond the view around large elements. Fine inlaid
    // lines reveal its downhill pitch even when both outside edges are cropped.
    // One static mesh, part of the board, with no influence on camera framing.
    const inlay = new THREE.BufferGeometry(), vertices: number[] = [];
    for (let i = 0; i < 96; i++) {
      const z = i*8, a = z-.04, b = z+.04;
      vertices.push(-85,.079,a, -85,.079,b, 85,.079,a, 85,.079,a, -85,.079,b, 85,.079,b);
    }
    inlay.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    inlay.computeVertexNormals();
    const inlayMaterial = this.material("#94ad7c");
    inlayMaterial.transparent = true; inlayMaterial.depthWrite = false;
    this.boardInlay = new THREE.Mesh(inlay, inlayMaterial);
    this.boardInlay.visible = false;
    this.board.add(this.boardInlay);
    for (const z of [-13.4, 13.4]) {
      const edging = this.mesh(
        new THREE.BoxGeometry(170, 0.18, 0.28),
        "#f7efdb",
      );
      edging.position.set(0, 0.14, z);
      this.board.add(edging);
    }
    this.scene.add(this.board);
    // Instance each material batch, so adding coaches does not add draw calls.
    this.trainParts = this.instanceModel(this.car("#ffffff"), MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS);
    this.wagonParts = this.instanceModel(this.car("#ffffff", true), MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS);
    this.parcelParts = this.instanceModel(this.parcel(), 2 * (MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS) + MINI_MAX_FLYING_PARCELS);
    this.train.push(...[...this.trainParts, ...this.wagonParts].map(part => part.mesh));
    this.couplings = this.instances(new THREE.CylinderGeometry(0.085, 0.085, 1, 6), "#ffffff", 2 * (MINI_VISIBLE_CARTS + MINI_MAX_FLYING_CARTS));
    this.debris = this.instances(new THREE.BoxGeometry(1, 1, 1), "#ffffff", 2 * MINI_MAX_EXPLOSIONS * MINI_EXPLOSION_PARTICLES);
    this.impactFlashes = this.instances(new THREE.IcosahedronGeometry(1, 1), "#ffe6a6", 2 * MINI_MAX_EXPLOSIONS);
    this.impactRings = this.instances(new THREE.TorusGeometry(1, 0.035, 6, 40), "#ffffff", 2 * MINI_MAX_EXPLOSIONS);
    const sprayMaterial = this.material("#bdeef3");
    sprayMaterial.transparent = true; sprayMaterial.opacity = .48; sprayMaterial.depthWrite = false; sprayMaterial.side = THREE.DoubleSide;
    sprayMaterial.emissive.set("#8adbe6"); sprayMaterial.emissiveIntensity = .3;
    this.splashSheets = this.instances(splashFanGeometry(), "#bdeef3", MINI_MAX_EXPLOSIONS * 4);
    this.splashSheets.castShadow = this.splashSheets.receiveShadow = false;
    this.waterDroplets = this.instances(new THREE.IcosahedronGeometry(1, 0), "#ffffff", 4 * MINI_MAX_EXPLOSIONS * MINI_EXPLOSION_PARTICLES);
    this.waterDroplets.setColorAt(0, new THREE.Color("#8adbe6"));
    this.waterDroplets.castShadow = false;
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
    // Compile the water materials during setup, so the first entry splash is smooth.
    void this.renderer.compileAsync(this.scene, this.camera).catch(() => {});
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
    mergeStaticMeshes(model);
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
  private railMaterial(part: number, rival = false) {
    if (!this.multiplayer) return this.material(["#e89983", "#f5d16f", "#64988e"][part]);
    const key = `rail:${part}:${rival}`;
    if (!this.materials.has(key)) {
      const color = new THREE.Color(riderColor(this.riderRole, rival));
      if (part === 1) color.lerp(new THREE.Color("#fff4cf"), .28);
      if (part === 2) color.multiplyScalar(.68);
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .85 }));
    }
    return this.materials.get(key)!;
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
  private sail() {
    const group = new THREE.Group();
    const mast = this.mesh(new THREE.CylinderGeometry(.035, .045, 2.65, 6), "#96764f");
    mast.position.y = 1.325; group.add(mast);
    // A bowed cloth surface, rather than a rigid flat triangle.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0,2.6,0, 0,.65,0, .22,1.25,-.65,
      0,.65,0, 0,.65,-1.55, .22,1.25,-.65,
      0,.65,-1.55, 0,2.6,0, .22,1.25,-.65,
    ], 3));
    geometry.computeVertexNormals();
    this.material("#fff5d9").side = THREE.DoubleSide;
    group.add(this.mesh(geometry, "#fff5d9"));
    const pennant = new THREE.BufferGeometry();
    pennant.setAttribute("position", new THREE.Float32BufferAttribute([.01,2.62,0, .01,2.32,0, .01,2.47,-.55], 3));
    pennant.computeVertexNormals();
    this.material("#ffffff").side = THREE.DoubleSide;
    group.add(this.mesh(pennant, "#ffffff"));
    return group;
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
  private dynamite() {
    const group = new THREE.Group();
    for (const x of [-.2, 0, .2]) {
      const stick = this.mesh(new THREE.CylinderGeometry(.115, .115, .64, 8), "#d44739");
      stick.rotation.x = Math.PI/2; stick.position.x = x; group.add(stick);
    }
    const strap = this.mesh(new THREE.BoxGeometry(.64, .26, .15), "#55433a"); group.add(strap);
    const fuse = this.mesh(new THREE.CylinderGeometry(.028, .028, .35, 5), "#e6c570");
    fuse.rotation.x = -.55; fuse.position.set(0, .19, .27); group.add(fuse);
    const spark = this.mesh(new THREE.IcosahedronGeometry(.095), "#ffdd72"); spark.position.set(0, .34, .36); group.add(spark);
    return group;
  }
  private build(section: MiniSection) {
    const group = new THREE.Group();
    const dynamic = this.track instanceof HeightTrack;
    const railBuffers: { from: number; to: number; rails: THREE.BufferGeometry[] }[] = [];
    const ranges = section.kind === "jump"
      ? [[section.start, section.takeoff - 0.03], [section.distanceAtX(section.landingX), section.end]]
      : [[section.start, section.end]];
    for (const [from, to] of ranges) {
      const rails = railGeometries(section, from, to);
      railBuffers.push({ from, to, rails });
      rails.forEach((geometry, i) => {
        const rail = new THREE.Mesh(geometry, this.railMaterial(i));
        rail.castShadow = rail.receiveShadow = true;
        group.add(rail);
      });
    }
    const count = Math.ceil(section.length / 0.65);
    const sleepers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.55, 0.13, 0.18),
      this.railMaterial(2),
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
    const supportDistances: number[] = [];
    for (let s = section.start + 0.8; s < section.end; s += 2.4) {
      if (!section.hasRail(s)) continue;
      const f = section.sample(s);
      const local = f.position.clone().sub(section.origin);
      const onTower = section.kind === "triplehelix"
        ? local.x > section.width * 0.57
        : section.kind === "ascendinghelix" && Math.abs(local.x - section.width * 0.24) < section.width * 0.17;
      if ((dynamic || !onTower) && f.up.y > 0.2 && Math.abs(f.tangent.y) < 0.88) {
        supports.push(f.position.clone().sub(section.origin));
        supportDistances.push(s);
      }
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
    if (!dynamic && (section.kind === "triplehelix" || section.kind === "ascendinghelix")) {
      const rising = section.kind === "ascendinghelix";
      const radius = section.width * (rising ? 0.12 : 0.095);
      const height = section.amplitude + section.origin.y;
      const mast = this.mesh(new THREE.CylinderGeometry(0.4, 0.6, height, 10), "#e8cfac");
      mast.position.set(section.width * (rising ? 0.2 : 0.68) + radius * (rising ? 0.325 : 0.2), height / 2 - section.origin.y, section.hand * radius);
      group.add(mast);
      const cap = this.mesh(new THREE.ConeGeometry(1.2, 1.4, 10), "#e89983");
      cap.position.copy(mast.position); cap.position.y = section.amplitude + 0.7;
      group.add(cap);
      const spokeGeometry = new THREE.CylinderGeometry(0.07, 0.1, 1, 6);
      const spokes = section.turns * 4;
      for (let i = 0; i < spokes; i++) {
        const frame = section.frames[Math.round(section.resolution * ((rising ? 0.1 : 0.3) + (rising ? 0.68 : 0.6) * (i + 0.5) / spokes))];
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
    if (section.kind === "splash") group.add(floodedPool(section, color => this.material(color)));
    // Little model trees and paving give the track a tangible tabletop scale.
    const random = (n: number) =>
      (Math.sin(section.id * 93.17 + n * 71.43 + this.track.seed) * 4159.93 +
        5000) %
      1;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.17, 1, 6),
      leafGeo = new THREE.ConeGeometry(0.9, 2.2, 7);
    const trees = this.track.options.generative ? 0 : section.runout ? Math.ceil(section.span / 16) : 5;
    for (let i = 0; i < trees; i++) {
      const x = (Math.max(3, section.span) * (i + 0.5)) / trees;
      const side = ["helix", "triplehelix", "ascendinghelix", "immelmann", "diveloop", "nestedloop", "interlockingloops"].includes(section.kind) ? -section.hand : i % 2 ? 1 : -1;
      const z = section.kind === "splash" ? side * (9 + random(i) * 2.5)
        : side * (8.3 + random(i) * 2.5) - section.origin.z;
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
    if (dynamic) {
      let revision = section.revision;
      group.userData.refresh = () => {
        if (section.revision === revision) return;
        revision = section.revision;
        for (const { from, to, rails } of railBuffers) refreshRails(section, from, to, rails);
        let at = 0;
        for (let i = 0; i < count; i++) {
          const s = section.start + i / count * section.length;
          if (!section.hasRail(s)) continue;
          const f = section.sample(s);
          dummy.position.copy(f.position).sub(section.origin).addScaledVector(f.up, -.14);
          dummy.quaternion.copy(f.rotation); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
          sleepers.setMatrixAt(at++, dummy.matrix);
        }
        sleepers.instanceMatrix.needsUpdate = true;
        supportDistances.forEach((s, i) => {
          const p = section.sample(s).position;
          const height = Math.max(.1, p.y - .15);
          dummy.quaternion.identity(); dummy.scale.set(1, height, 1);
          dummy.position.set(p.x - section.origin.x, height/2 - section.origin.y, p.z - section.origin.z);
          dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix);
        });
        posts.instanceMatrix.needsUpdate = true;
        sleepers.computeBoundingSphere(); posts.computeBoundingSphere();
      };
    } else mergeStaticMeshes(group);
    group.traverse(object => { object.updateMatrix(); object.matrixAutoUpdate = false; });
    this.pieces.set(section.id, group);
    this.scene.add(group);
  }
  private release(group: THREE.Object3D, disposeGeometry = true) {
    const geometries = new Set<THREE.BufferGeometry>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    if (disposeGeometry) geometries.forEach((g) => g.dispose());
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
    alpha = 1,
    opponent?: RideState,
    powerups?: RidePowerups,
  ) {
    const flights = effects?.flights ?? [], parcels = effects?.parcels ?? [], explosions = effects?.explosions ?? [];
    const dt = clamp(time - this.lastTime, 0, 0.05) || 1 / 60;
    this.lastTime = time;
    const state = `${distance}:${velocity}:${flash}:${close}:${cartCount}:${this.track.generated}:${effects?.spilled}:${effects?.refills}:${time}:${flights.map(c => c.age)}:${parcels.map(p => p.age + p.groundedFor)}:${explosions.map(e => e.age)}`;
    if (!this.multiplayer && state === this.lastState && this.cameraRig.settled) return;
    this.lastState = state;
    const visibleSections = this.track.sections.filter(section => section.start <= distance + 350);
    const ids = new Set(visibleSections.map((s) => s.id));
    for (const [id, mesh] of this.pieces)
      if (!ids.has(id)) {
        const mirrored = this.opponentPieces.get(id);
        if (mirrored) { this.release(mirrored, false); this.opponentPieces.delete(id); }
        this.release(mesh);
        this.pieces.delete(id);
      }
    if (this.multiplayer) this.laneOffset = this.spacing.update(this.track, dt);
    const lane = (position: THREE.Vector3, rival = false) => lanePosition(position, this.multiplayer ? this.laneOffset : 0, rival);
    const poses = effects?.poses(distance, alpha);
    const f = poses?.[0]?.frame ?? this.track.sample(distance),
      anchor = Math.floor(f.position.x / 25) * 25;
    for (const section of visibleSections) {
      if (!this.pieces.has(section.id)) this.build(section);
      const piece = this.pieces.get(section.id)!;
      piece.userData.refresh?.();
      if (piece.position.x !== section.origin.x - anchor || piece.position.y !== section.origin.y || piece.position.z !== section.origin.z + this.laneOffset) {
        piece.position.set(section.origin.x - anchor, section.origin.y, section.origin.z + this.laneOffset);
        piece.updateMatrix();
      }
      if (this.multiplayer) {
        let mirrored = this.opponentPieces.get(section.id);
        if (!mirrored) {
          // Clone transforms and instance buffers; rails reuse their built geometry/materials.
          mirrored = piece.clone(true);
          mirrored.scale.z = -1;
          if (this.multiplayer) mirrored.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            for (let part = 0; part < 3; part++) if (object.material === this.railMaterial(part)) {
              object.material = this.railMaterial(part, true); break;
            }
          });
          this.opponentPieces.set(section.id, mirrored);
          this.scene.add(mirrored);
        }
        mirrored.position.set(section.origin.x - anchor, section.origin.y, -section.origin.z - this.laneOffset);
        mirrored.updateMatrix();
      }
    }
    // Frame taller hills from the side. Fade the influence of approaching
    // peaks in at the edges so the model view opens up smoothly as we travel.
    const elevation = this.track instanceof HeightTrack ? this.track.elevation(distance) : 0;
    let skyline = elevation + 10;
    for (const section of this.track.sections)
      for (let i = 0; i < section.frames.length; i += 12) {
        const p = section.frames[i].position;
        const influence =
          clamp((p.x - f.position.x + 30) / 12, 0, 1) *
          clamp((f.position.x + 65 - p.x) / 22, 0, 1);
        skyline = Math.max(skyline, elevation + 4 + (p.y - elevation - 4) * influence);
      }
    const framing = coasterFraming(lane(f.position), skyline, this.aspect, close, this.stage.clientHeight < 400, this.compactLayout.matches, elevation);
    // Follow the head of a long train. New arrivals enter from behind without
    // pulling the camera hundreds of metres back to its ever-growing tail.
    // Loose objects receive a smaller, separate framing budget.
    const subjects = [
      ...(poses?.slice(0, MINI_STARTING_CARTS).filter(p => p.coach !== effects?.incoming
        && (this.track instanceof HeightTrack || p.frame.airborne || p.coach.lift > 0.05)).map(p => p.frame.position) ?? []),
    ];
    subjects.unshift(f.position);
    const framedSubjects = subjects.map(p => lane(p));
    if (this.multiplayer) {
      // Always show the pair of lanes; a distant rival gets a distance indicator
      // instead of dragging the local player out of view.
      // Keep the normal framing centred on our own lane. The camera can widen
      // towards the rival, but its 3× cap must never push our train off screen.
      framing.focus.z = lane(f.position).z;
      framedSubjects.push(lane(f.position, true));
      const lead = opponent?.bodies[0];
      if (lead && Math.abs(lead.position[0] - f.position.x) < 45)
        framedSubjects.push(lane(new THREE.Vector3(...lead.position), true));
    }
    const tilt = powerups?.tilt ?? 0, pivot = framing.focus;
    const cameraCargo = (effects?.cameraSubjects(f.position) ?? []).map(p => tiltPoint(lane(p), pivot, tilt));
    this.cameraRig.update(framing.focus, framing.height, this.aspect,
      framedSubjects.map(p => tiltPoint(p, pivot, tilt)), dt, cameraCargo);
    // One rigid world transform: scenery, rails, shadows and loose bodies all
    // agree, while the camera and question stay level. Pivot near the train so
    // a large route coordinate cannot create a huge camera excursion.
    const localPivot = pivot.clone(); localPivot.x -= anchor;
    this.scene.rotation.z = -tilt;
    this.scene.position.copy(localPivot).sub(tiltPoint(localPivot, new THREE.Vector3(), tilt));
    this.scene.updateMatrix();
    this.boardInlay.visible = tilt > .0001;
    (this.boardInlay.material as THREE.MeshStandardMaterial).opacity = .65 * tilt / DOWNHILL_TILT;
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
    const closed: THREE.Matrix4[] = [], open: THREE.Matrix4[] = [], cargo: THREE.Matrix4[] = [], dynamite: THREE.Matrix4[] = [];
    const closedColors: number[] = [], openColors: number[] = [];
    const sails: THREE.Matrix4[] = [], sailColors: number[] = [];
    const localSail = sailDeployment(powerups), remoteSail = sailDeployment(opponent?.power);
    const addCar = (position: THREE.Vector3, rotation: THREE.Quaternion, index: number, loaded: number, cargoAge = 1, rival = false, bombs = 0, attached = false) => {
      const matrix = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1));
      const deployment = rival ? remoteSail : localSail;
      if (attached && index > 0 && deployment > 0) {
        const flutter = Math.sin((rival ? opponent!.time : time) * 5 + index * 1.7);
        sails.push(matrix.clone().multiply(new THREE.Matrix4().compose(
          new THREE.Vector3(.76, .7, .72),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), flutter * .06),
          new THREE.Vector3(1, deployment, .94 + flutter * .06))));
        sailColors.push(this.multiplayer ? riderColorIndex(this.riderRole, rival) : index);
      }
      if (isParcelWagon(index)) {
        open.push(matrix); openColors.push(this.multiplayer ? riderColorIndex(this.riderRole, rival) : index);
        if (loaded) for (const [i, offset] of parcelPresentation(loaded, cargoAge, powerups ? MINI_POWER_PARCELS : undefined).entries()) {
          if (offset.scale <= 0) continue;
          (bombs & (1 << i) ? dynamite : cargo).push(matrix.clone().multiply(new THREE.Matrix4().compose(
            new THREE.Vector3(offset.x, offset.y, offset.z), new THREE.Quaternion(), new THREE.Vector3().setScalar(offset.scale))));
        }
      } else { closed.push(matrix); closedColors.push(this.multiplayer ? riderColorIndex(this.riderRole, rival) : index); }
    };
    const attached = poses ?? Array.from({ length: count }, (_, index) => ({
      frame: this.track.sample(distance - index * MINI_CART_SPACING), coach: { id: index, cargo: isParcelWagon(index) ? 2 : 0, cargoAge: 1 },
    }));
    for (const { frame, coach } of attached) {
      const position = lane(frame.position);
      position.x -= anchor;
      const screen = position.clone().applyMatrix4(this.scene.matrix).project(this.camera);
      if (Math.abs(screen.x) > 1.25 || Math.abs(screen.y) > 1.35) continue;
      addCar(position, frame.rotation, coach.id, coach.cargo, coach.cargoAge, false, "dynamite" in coach && typeof coach.dynamite === "number" ? coach.dynamite : 0, true);
    }
    this.renderedCartCount = open.length + closed.length;
    for (const cart of flights) {
      const position = lane(cart.position);
      position.x -= anchor;
      addCar(position, cart.rotation, cart.colorIndex, cart.cargo);
    }
    for (const parcel of parcels) {
      const position = lane(parcel.position); position.x -= anchor;
      (parcel.dynamite ? dynamite : cargo).push(new THREE.Matrix4().compose(position, parcel.rotation, new THREE.Vector3(1, 1, 1)));
    }
    if (opponent) {
      for (const body of opponent.bodies) {
        const position = lane(new THREE.Vector3(...body.position), true); position.x -= anchor;
        const screen = position.clone().applyMatrix4(this.scene.matrix).project(this.camera);
        if (Math.abs(screen.x) > 1.25 || Math.abs(screen.y) > 1.35) continue;
        addCar(position, mirrorRotation(new THREE.Quaternion(...body.rotation)), body.color, body.cargo, body.cargoAge, true, body.bombs ?? 0, body.id.startsWith("coach-"));
      }
      for (const parcel of opponent.parcels) {
        const position = lane(new THREE.Vector3(...parcel.position), true); position.x -= anchor;
        if (Math.abs(position.x - f.position.x + anchor) > 130) continue;
        (parcel.dynamite ? dynamite : cargo).push(new THREE.Matrix4().compose(position, mirrorRotation(new THREE.Quaternion(...parcel.rotation)), new THREE.Vector3(1, 1, 1)));
      }
    }
    if (sails.length && !this.sailParts) this.sailParts = this.instanceModel(this.sail(), MINI_VISIBLE_CARTS * 2);
    if (this.sailParts) this.drawModel(this.sailParts, sails, sailColors);
    this.drawModel(this.trainParts, closed, closedColors);
    this.drawModel(this.wagonParts, open, openColors);
    this.drawModel(this.parcelParts, cargo, []);
    if (dynamite.length && !this.dynamiteParts) this.dynamiteParts = this.instanceModel(this.dynamite(), 64);
    if (this.dynamiteParts) this.drawModel(this.dynamiteParts, dynamite, []);
    const dummy = new THREE.Object3D();
    const links = (effects?.links(distance, poses) ?? []).map(link => ({ ...link, start: lane(link.start), end: lane(link.end) }));
    if (opponent) for (const link of opponent.links) {
      if (Math.abs(link.start[0] - f.position.x) < 130)
        links.push({ ...link, start: lane(new THREE.Vector3(...link.start), true), end: lane(new THREE.Vector3(...link.end), true) });
    }
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
    let chunks = 0, flashes = 0, rings = 0, sheets = 0, drops = 0;
    const allExplosions = [
      ...explosions.map(explosion => ({ ...explosion, rival: false })),
      ...(opponent?.impacts ?? []).filter(e => Math.abs(e.position[0] - f.position.x) < 130).map(e => ({
        position: new THREE.Vector3(...e.position), age: e.age, water: e.water, colorIndex: e.color, rival: true, dynamite: !!e.dynamite,
        flood: e.flood ? { rotation: new THREE.Quaternion(...e.flood.rotation), strength: e.flood.strength } : undefined,
        particles: e.particles.map(p => ({ position: new THREE.Vector3(...p.position), size: p.size })),
      })),
    ];
    for (const explosion of allExplosions) {
      if (explosion.flood && explosion.age < 1.1) {
        const rise = Math.sin(Math.PI * Math.min(1, explosion.age / 1.1));
        for (const side of [-1, 1]) {
          dummy.position.copy(lane(explosion.position, explosion.rival)); dummy.position.x -= anchor;
          dummy.quaternion.copy(explosion.rival ? mirrorRotation(explosion.flood.rotation) : explosion.flood.rotation);
          dummy.scale.set(side * (2 + explosion.age * 10) * explosion.flood.strength,
            rise * 7 * explosion.flood.strength, 6);
          dummy.updateMatrix(); this.splashSheets.setMatrixAt(sheets++, dummy.matrix);
        }
      }
      for (const [i, particle] of explosion.particles.entries()) {
        dummy.position.copy(lane(particle.position, explosion.rival)); dummy.position.x -= anchor;
        dummy.rotation.set(explosion.age * 3 + i, explosion.age * 2, i * 0.7);
        dummy.scale.setScalar(particle.size * 2 * Math.max(0, 1 - explosion.age / 2));
        if (explosion.water) {
          dummy.scale.y *= 1.45;
          dummy.updateMatrix(); this.waterDroplets.setMatrixAt(drops, dummy.matrix);
          this.waterDroplets.setColorAt(drops++, new THREE.Color(i % 3 ? "#8adbe6" : "#e9ffff"));
          continue;
        }
        dummy.updateMatrix();
        this.debris.setMatrixAt(chunks, dummy.matrix);
        this.debris.setColorAt(chunks++, explosion.water ? new THREE.Color(i % 3 ? "#58b9c9" : "#d9ffff") : explosion.dynamite ? new THREE.Color(["#e96732", "#ffd36a", "#554137"][i%3]) : i % 3 ? (this.multiplayer ? new THREE.Color(riderColor(this.riderRole, !!explosion.rival)) : CART_COLORS[explosion.colorIndex % CART_COLORS.length]) : new THREE.Color("#ffa451"));
      }
      dummy.position.copy(lane(explosion.position, explosion.rival)); dummy.position.x -= anchor;
      dummy.rotation.set(0, 0, 0);
      if (explosion.age < 0.3 && !explosion.water) {
        dummy.scale.setScalar(2.2 * (1 - explosion.age / 0.3)); dummy.updateMatrix();
        this.impactFlashes.setMatrixAt(flashes++, dummy.matrix);
      }
      if (explosion.age < 0.8) {
        dummy.position.y = explosion.water || explosion.dynamite ? explosion.position.y + .1 : .16; dummy.rotation.x = Math.PI / 2;
        dummy.scale.setScalar(0.5 + explosion.age * 8); dummy.updateMatrix();
        this.impactRings.setColorAt(rings, new THREE.Color(explosion.water ? "#c7f7ff" : "#f6ad62"));
        this.impactRings.setMatrixAt(rings++, dummy.matrix);
      }
    }
    if (this.splashSheets) {
      this.splashSheets.count = sheets; this.splashSheets.visible = sheets > 0;
      this.splashSheets.instanceMatrix.needsUpdate = true;
    }
    for (const [mesh, count] of [[this.debris, chunks], [this.waterDroplets, drops], [this.impactFlashes, flashes], [this.impactRings, rings]] as const) {
      mesh.count = count; mesh.visible = count > 0;
      if (!mesh.visible) continue;
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.lamp.position.copy(lane(f.position)).addScaledVector(f.up, 0.6);
    this.lamp.position.x -= anchor;
    this.lamp.intensity = flash > 0 ? flash * 12 : 0;
    const earth = groundBounds(this.track, this.laneOffset, tiltPoint(this.cameraRig.focus, pivot, -tilt), height, this.aspect);
    this.board.position.set((earth.min.x + earth.max.x)/2 - anchor, 0, (earth.min.z + earth.max.z)/2);
    this.board.scale.set((earth.max.x - earth.min.x)/170, 1, (earth.max.z - earth.min.z)/26.8);
    // Keep the inlays at fixed world intervals as the island grows. Resizing
    // the ground must not stretch or slide these visual references underneath it.
    const firstInlay = Math.ceil(Math.max(earth.min.z + .1, f.position.z - 384)/8)*8;
    this.boardInlay.position.z = (firstInlay - this.board.position.z)/this.board.scale.z;
    this.boardInlay.scale.z = 1/this.board.scale.z;
    this.boardInlay.geometry.setDrawRange(0, Math.min(96, Math.max(0, Math.ceil((earth.max.z - .1 - firstInlay)/8)))*6);
    if (powerups) {
      this.powerScene ??= new PowerupScene(this.scene);
      this.powerScene.render(powerups, this.track, f, anchor, time, this.laneOffset);
      const remoteLead = opponent?.bodies[0];
      if (opponent?.power && remoteLead && Math.abs(remoteLead.position[0] - f.position.x) < 130) {
        this.opponentPowerScene ??= new PowerupScene(this.scene);
        this.opponentPowerScene.render({ ...opponent.power, seed: this.track.seed }, this.track,
          { position: new THREE.Vector3(...remoteLead.position) }, anchor, opponent.time, this.laneOffset, true);
      } else if (this.opponentPowerScene) this.opponentPowerScene.group.visible = false;
      const active = powerups.active, info = active ? POWERUPS[active] : undefined;
      const blend = 1 - Math.exp(-dt*3);
      if (!this.track.options.generative) (this.scene.background as THREE.Color).lerp(new THREE.Color(info?.sky ?? "#e6eee8"), blend);
      fog.color.copy(this.scene.background as THREE.Color);
      if (!this.multiplayer && !this.track.options.generative) for (let i = 0; i < 3; i++) this.railMaterial(i).color.lerp(new THREE.Color(info ? i === 1 ? "#fff1bf" : info.color : ["#e89983", "#f5d16f", "#64988e"][i]), blend);
      if (!this.track.options.generative) this.material("#d5e3c3").color.lerp(new THREE.Color(active === "ice" ? "#e3eced" : active === "reverse" ? "#dcd6e7" : active === "heavy" ? "#e2d2bc" : "#d5e3c3"), blend);
    }
    if (this.track.options.generative) {
      const world = adventureAt(Math.max(0,this.track.sectionAt(distance).start)).world;
      this.adventureScene ??= new AdventureScene(this.scene);
      this.adventureScene.render(this.track,distance,anchor,this.laneOffset,time);
      const blend=1-Math.exp(-dt*1.5), dark=world.darkness;
      const sky=new THREE.Color(world.sky), ground=new THREE.Color(world.ground);
      if(powerups?.active) {
        sky.lerp(new THREE.Color(POWERUPS[powerups.active].sky),.12);
        if(powerups.active==="ice")ground.lerp(new THREE.Color("#e3eced"),.5);
      }
      (this.scene.background as THREE.Color).lerp(sky,blend);
      fog.color.copy(this.scene.background as THREE.Color);
      this.material("#d5e3c3").color.lerp(ground,blend);
      this.material("#cfae8c").color.lerp(new THREE.Color(world.earth),blend);
      this.sunlight!.color.lerp(new THREE.Color(world.light),blend);
      this.sunlight!.intensity += ((2.5-dark*1.3)-this.sunlight!.intensity)*blend;
      this.skylight!.color.lerp(new THREE.Color(world.ambient),blend);
      this.skylight!.intensity += ((2-dark*.6)-this.skylight!.intensity)*blend;
      if(!this.multiplayer) {
        this.railMaterial(0).color.lerp(new THREE.Color(world.rail),blend);
        this.railMaterial(1).color.lerp(new THREE.Color(dark?"#a2efdf":"#ffe4a1"),blend);
      }
      for(let part=0;part<2;part++)for(const rival of this.multiplayer?[false,true]:[false]) {
        const material=this.railMaterial(part,rival);
        material.emissive.copy(material.color);material.emissiveIntensity=dark*.42;
      }
    }
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
      part.mesh.visible = transforms.length > 0;
      if (!part.mesh.visible) continue;
      transforms.forEach((transform, index) => {
        matrix.multiplyMatrices(transform, part.transform);
        part.mesh.setMatrixAt(index, matrix);
        if (part.body)
          part.mesh.setColorAt(
            index,
            colorIndices[index] === -1 ? new THREE.Color("#e48670") : colorIndices[index] === -2 ? new THREE.Color("#68bdb0") : CART_COLORS[colorIndices[index] % CART_COLORS.length],
          );
      });
      part.mesh.instanceMatrix.clearUpdateRanges();
      part.mesh.instanceMatrix.addUpdateRange(0, transforms.length * 16);
      part.mesh.instanceMatrix.needsUpdate = true;
      if (part.mesh.instanceColor) {
        part.mesh.instanceColor.clearUpdateRanges();
        part.mesh.instanceColor.addUpdateRange(0, transforms.length * 3);
        part.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  destroy() {
    this.resize.disconnect();
    this.adventureScene?.destroy();
    this.powerScene?.destroy();
    this.opponentPowerScene?.destroy();
    // All geometries are owned by this view; shared materials are released once.
    this.release(this.scene);
    this.materials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
