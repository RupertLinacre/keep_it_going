import * as THREE from "three";
import type { MiniTrack } from "./mini-track";
import type { RailFrame } from "./mini-rail";
import { POWERUPS, type PowerKind, type PowerVisualState } from "./ride-powerups";

const fract = (n: number) => n - Math.floor(n);
/** A bounded effects layer: one gate, one weather buffer and eight rocks.
 * No per-frame geometry creation or full-screen postprocessing. */
export class PowerupScene {
  readonly group = new THREE.Group();
  private gate = new THREE.Group();
  private gateMaterial = new THREE.MeshStandardMaterial({ color: "white", emissive: "white", emissiveIntensity: .35, roughness: .3 });
  private signMaterial = new THREE.SpriteMaterial({ transparent: true, depthTest: true });
  private textures = new Map<PowerKind, THREE.CanvasTexture>();
  private weatherGeometry = new THREE.BufferGeometry();
  private weatherMaterial = new THREE.LineBasicMaterial({ color: "white", transparent: true, opacity: .7 });
  private weather: THREE.LineSegments;
  private weatherPositions = new Float32Array(120 * 2 * 3);
  private rocks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.6, 0), new THREE.MeshStandardMaterial({ color: "#aaa0c2", roughness: .8 }), 8);
  private auraMaterial = new THREE.MeshBasicMaterial({ color: "white", transparent: true, opacity: .45 });
  private aura = new THREE.Mesh(new THREE.TorusGeometry(2, .045, 6, 40), this.auraMaterial);
  private dummy = new THREE.Object3D();
  private lastGate?: PowerKind;

  constructor(scene: THREE.Scene) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, .14, 8, 48), this.gateMaterial);
    const outside = new THREE.Mesh(new THREE.TorusGeometry(2.75, .035, 6, 48), this.gateMaterial);
    this.gate.add(ring, outside);
    const sign = new THREE.Sprite(this.signMaterial);
    sign.position.y = 3.4; sign.scale.set(2.8, 2.8, 1); this.gate.add(sign);
    this.weatherGeometry.setAttribute("position", new THREE.BufferAttribute(this.weatherPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.weather = new THREE.LineSegments(this.weatherGeometry, this.weatherMaterial);
    this.weather.frustumCulled = false;
    this.rocks.frustumCulled = false;
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.aura.rotation.x = Math.PI/2;
    this.group.add(this.gate, this.weather, this.rocks, this.aura);
    scene.add(this.group);
  }
  private texture(kind: PowerKind) {
    let texture = this.textures.get(kind);
    if (texture) return texture;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fffef5"; ctx.beginPath(); ctx.arc(128, 128, 110, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = POWERUPS[kind].color; ctx.lineWidth = 12; ctx.stroke();
    ctx.fillStyle = POWERUPS[kind].color; ctx.font = "bold 142px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(POWERUPS[kind].icon, 128, 135);
    texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(kind, texture); return texture;
  }
  render(power: PowerVisualState, track: MiniTrack, frame: Pick<RailFrame, "position">, anchor: number, time: number, laneOffset = 0, rival = false) {
    const kind = power.active, info = kind ? POWERUPS[kind] : undefined;
    this.group.position.z = rival ? -laneOffset : laneOffset;
    this.group.scale.z = rival ? -1 : 1;
    this.group.visible = !!kind || !!power.gate;
    this.gate.visible = !!power.gate && power.gate.distance >= track.sections[0].start && power.gate.distance <= track.end;
    if (power.gate && this.gate.visible) {
      const f = track.sample(power.gate.distance);
      this.gate.position.copy(f.position).addScaledVector(f.up, 2.4); this.gate.position.x -= anchor;
      this.gate.quaternion.copy(f.rotation);
      this.gate.scale.setScalar(1 + Math.sin(time*3)*.035);
      this.gateMaterial.color.set(POWERUPS[power.gate.kind].color);
      this.gateMaterial.emissive.copy(this.gateMaterial.color);
      if (this.lastGate !== power.gate.kind) {
        this.signMaterial.map = this.texture(power.gate.kind); this.signMaterial.needsUpdate = true;
        this.lastGate = power.gate.kind;
      }
    }
    this.aura.visible = !!kind;
    this.weather.visible = !!kind && kind !== "tilt";
    this.rocks.visible = kind === "reverse" || kind === "heavy";
    if (!kind || !info) return;
    const strength = Math.min(1, power.age * 3, power.remaining);
    this.weatherMaterial.color.set(kind === "ice" ? "#ffffff" : info.color);
    this.weatherMaterial.opacity = strength * (kind === "reverse" || kind === "wind" ? .45 : .6);
    const pos = this.weatherPositions, cx = frame.position.x - anchor, cy = Math.max(6, frame.position.y);
    for (let i = 0; i < 120; i++) {
      const rx = fract(Math.sin(i*127.1 + power.seed) * 43758.54), rz = fract(Math.sin(i*311.7 + 7) * 4159.93);
      const phase = fract(i*.618 + time*(kind === "heavy" ? .9 : kind === "reverse" || kind === "lift" ? -.25 : .3));
      let x = cx - 38 + rx*85, y = cy - 18 + (1-phase)*52, z = frame.position.z - 17 + rz*34;
      let dx = 0, dy = kind === "ice" || kind === "cargo" ? .25 : kind === "heavy" ? 2.4 : .9, dz = 0;
      if (kind === "wind") {
        x = cx - 45 + fract(rx + time*.48)*90; y = cy - 5 + phase*16;
        dx = 3.2; dy = .12; dz = .15;
      } else if (kind === "ice") x += Math.sin(time + i)*1.7;
      else if (kind === "lift") { x = cx - 12 + rx*24; z = frame.position.z - 7 + rz*14; }
      const at = i*6;
      pos[at] = x; pos[at+1] = y; pos[at+2] = z;
      pos[at+3] = x+dx; pos[at+4] = y+dy; pos[at+5] = z+dz;
    }
    this.weatherGeometry.getAttribute("position").needsUpdate = true;
    if (this.rocks.visible) {
      (this.rocks.material as THREE.MeshStandardMaterial).color.set(kind === "reverse" ? "#ab91cc" : "#ad8970");
      for (let i = 0; i < 8; i++) {
        const phase = fract(power.age*(kind === "reverse" ? .075 : .38) + i*.127);
        this.dummy.position.set(cx + (i-3)*9, kind === "reverse" ? .7 + phase*30 : .7 + (1-phase*phase)*28,
          frame.position.z + (i%2 ? -1 : 1)*(7 + i));
        this.dummy.rotation.set(time*.4+i, time*.7+i, i);
        this.dummy.scale.setScalar((.5 + i*.09)*strength); this.dummy.updateMatrix();
        this.rocks.setMatrixAt(i, this.dummy.matrix);
      }
      this.rocks.instanceMatrix.needsUpdate = true;
    }
    this.aura.position.set(cx, frame.position.y + .15, frame.position.z);
    this.aura.scale.setScalar(1 + Math.sin(time*3)*.12);
    this.auraMaterial.color.set(info.color); this.auraMaterial.opacity = strength*.4;
  }
  destroy() {
    this.textures.forEach(t => t.dispose());
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite) {
        if (obj.geometry) geometries.add(obj.geometry);
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => materials.add(m));
        if (obj instanceof THREE.InstancedMesh) obj.dispose();
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.group.removeFromParent();
  }
}
