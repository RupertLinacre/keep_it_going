import * as THREE from "three";
import { MiniRailCurve, MiniTrack, type MiniSection } from "./mini-track";
import {
  MINI_CART_SPACING,
  MINI_VISIBLE_CARTS,
  MINI_STARTING_CARTS,
} from "./mini-config";
import { clamp } from "../math";

/** A fixed-horizon, orthographic model railway view. The camera never rides the train. */
export class MiniView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-32, 32, 15, -15, 0.1, 220);
  readonly renderer: THREE.WebGLRenderer;
  readonly train: THREE.InstancedMesh[] = [];
  cartCount = MINI_STARTING_CARTS;
  renderedCartCount = MINI_STARTING_CARTS;
  private trainParts: {
    mesh: THREE.InstancedMesh;
    transform: THREE.Matrix4;
    body: boolean;
  }[] = [];
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
    const model = this.car("#ffffff");
    model.updateMatrixWorld(true);
    for (const child of model.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const mesh = new THREE.InstancedMesh(
        child.geometry,
        child.material,
        MINI_VISIBLE_CARTS,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.trainParts.push({
        mesh,
        transform: child.matrix.clone(),
        body: child.material === this.material("#ffffff"),
      });
      this.train.push(mesh);
      this.scene.add(mesh);
    }
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
    this.render(8, 5.5, 0, false);
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
  private car(color: string) {
    const group = new THREE.Group();
    const board = this.mesh(new THREE.BoxGeometry(1.45, 0.25, 2.1), "#6f8e89");
    board.position.y = 0.26;
    group.add(board);
    const cube = new THREE.BoxGeometry(0.7, 0.52, 0.52);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const block = this.mesh(cube, color);
        block.position.set(0, 0.64 + row * 0.56, (col - 1) * 0.57);
        group.add(block);
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
    for (const z of [-0.22, 0.22]) {
      const eye = this.mesh(new THREE.SphereGeometry(0.2, 10, 8), "#fffef7");
      eye.scale.set(0.4, 1.2, 0.8);
      eye.position.set(0.4, 1.1, z);
      group.add(eye);
      const pupil = this.mesh(new THREE.SphereGeometry(0.067, 8, 6), "#3b465a");
      pupil.position.set(0.49, 1.09, z - 0.025);
      group.add(pupil);
    }
    const roof = this.mesh(new THREE.BoxGeometry(0.84, 0.12, 1.9), "#fff0ca");
    roof.position.y = 1.57;
    group.add(roof);
    return group;
  }
  private build(section: MiniSection) {
    const group = new THREE.Group();
    const segments = Math.ceil(section.length * 14);
    for (const [i, offset] of [-0.57, 0.57].entries()) {
      const rail = this.mesh(
        new THREE.TubeGeometry(
          new MiniRailCurve(section, offset),
          segments,
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
    for (let i = 0; i < count; i++) {
      const f = section.sample(section.start + (i / count) * section.length);
      dummy.position
        .copy(f.position)
        .sub(section.origin)
        .addScaledVector(f.up, -0.14);
      dummy.quaternion.copy(f.rotation);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sleepers.setMatrixAt(i, dummy.matrix);
    }
    group.add(sleepers);
    const supports: THREE.Vector3[] = [];
    for (let s = section.start + 0.8; s < section.end; s += 2.4) {
      const f = section.sample(s);
      if (f.up.y > 0.2 && Math.abs(f.tangent.y) < 0.88)
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
    // Little model trees and paving give the track a tangible tabletop scale.
    const random = (n: number) =>
      (Math.sin(section.id * 93.17 + n * 71.43 + this.track.seed) * 4159.93 +
        5000) %
      1;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.17, 1, 6),
      leafGeo = new THREE.ConeGeometry(0.9, 2.2, 7);
    for (let i = 0; i < 5; i++) {
      const x = (Math.max(3, section.width) * (i + 0.5)) / 5;
      const z = (i % 2 ? 1 : -1) * (8.3 + random(i) * 2.5) - section.origin.z;
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
  ) {
    const state = `${distance}:${velocity}:${flash}:${close}:${cartCount}:${this.track.generated}`;
    if (state === this.lastState) return;
    this.lastState = state;
    const ids = new Set(this.track.sections.map((s) => s.id));
    for (const [id, mesh] of this.pieces)
      if (!ids.has(id)) {
        this.release(mesh);
        this.pieces.delete(id);
      }
    const f = this.track.sample(distance),
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
    const focus = new THREE.Vector3(
      f.position.x - anchor + (close ? 3 : 9),
      close
        ? Math.max(4.1, f.position.y * 0.78)
        : Math.max(4.1, skyline * 0.43),
      0,
    );
    const height = close ? 26 : Math.max(32, skyline * 1.25 + 10);
    this.camera.left = (-height * this.aspect) / 2;
    this.camera.right = (height * this.aspect) / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(focus).add(new THREE.Vector3(8, 17, 38));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(focus);
    this.camera.updateMatrixWorld(true);
    this.cartCount = cartCount;
    const count = Math.min(cartCount, MINI_VISIBLE_CARTS);
    const colors = [
      "#e5ef93",
      "#e9a8a7",
      "#9fbddd",
      "#c6b0e5",
      "#eec987",
      "#a8dac7",
    ].map((c) => new THREE.Color(c));
    const transforms: THREE.Matrix4[] = [];
    const colorIndices: number[] = [];
    for (let index = 0; index < count; index++) {
      const frame = this.track.sample(distance - index * MINI_CART_SPACING);
      const position = frame.position.clone();
      position.x -= anchor;
      const screen = position.clone().project(this.camera);
      if (Math.abs(screen.x) > 1.25 || Math.abs(screen.y) > 1.35) continue;
      transforms.push(
        new THREE.Matrix4().compose(
          position,
          frame.rotation,
          new THREE.Vector3(1, 1, 1),
        ),
      );
      colorIndices.push(index);
    }
    this.renderedCartCount = transforms.length;
    const matrix = new THREE.Matrix4();
    for (const part of this.trainParts) {
      part.mesh.count = transforms.length;
      transforms.forEach((transform, index) => {
        matrix.multiplyMatrices(transform, part.transform);
        part.mesh.setMatrixAt(index, matrix);
        if (part.body)
          part.mesh.setColorAt(
            index,
            colors[colorIndices[index] % colors.length],
          );
      });
      part.mesh.instanceMatrix.needsUpdate = true;
      if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
    }
    this.lamp.position.copy(f.position).addScaledVector(f.up, 0.6);
    this.lamp.position.x -= anchor;
    this.lamp.intensity = flash > 0 ? flash * 12 : 0;
    this.board.position.x = focus.x;
    this.renderer.render(this.scene, this.camera);
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
