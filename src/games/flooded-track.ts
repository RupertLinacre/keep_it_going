import * as THREE from "three";
import type { MiniSection } from "./mini-track";

function roundedPool(length: number, width: number, radius: number) {
  const x = length / 2, z = width / 2, s = new THREE.Shape();
  s.moveTo(-x + radius, -z); s.lineTo(x - radius, -z);
  s.quadraticCurveTo(x, -z, x, -z + radius); s.lineTo(x, z - radius);
  s.quadraticCurveTo(x, z, x - radius, z); s.lineTo(-x + radius, z);
  s.quadraticCurveTo(-x, z, -x, z - radius); s.lineTo(-x, -z + radius);
  s.quadraticCurveTo(-x, -z, -x + radius, -z);
  return s;
}

/** The pool stays at its original elevation when Sky lift raises the railway. */
export function floodedPool(section: MiniSection, material: (color: string) => THREE.Material) {
  const group = new THREE.Group(), length = section.width * .72;
  const level = section.waterLevel - section.origin.y;
  const layer = (width: number, extraLength: number, height: number, thickness: number, color: string, rim = false) => {
    const shape = roundedPool(length + extraLength, width, 2);
    if (rim) shape.holes.push(roundedPool(length, 13.6, 2));
    const geometry = new THREE.ExtrudeGeometry(shape,
      { depth: thickness, bevelEnabled: false, curveSegments: 8 });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.set(section.width / 2, height, 0);
    mesh.receiveShadow = true; group.add(mesh);
  };
  layer(15, 1.4, level - .9, .83, "#d7c7a3", true);
  layer(13.6, 0, level - .9, .06, "#94c5bd");
  const water = material("#55bccc");
  water.transparent = true; water.opacity = .6; water.depthWrite = false;
  const surface = new THREE.Mesh(new THREE.ShapeGeometry(roundedPool(length, 13.6, 2)), water);
  surface.rotation.x = -Math.PI/2; surface.position.set(section.width/2, level, 0);
  group.add(surface);
  // Long foam streaks and smaller glints leave the submerged rails readable.
  const glints = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .025, .055), material("#c5f4f1"), 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    dummy.position.set(section.width*.16 + (i%24)/23 * section.width*.68, level + .02,
      (i < 24 ? -1 : 1) * (2 + (i*7%11)/11 * 4));
    dummy.rotation.y = Math.sin(i*2.7)*.12;
    dummy.scale.set(.5 + (i%4)*.55, 1, 1); dummy.updateMatrix(); glints.setMatrixAt(i, dummy.matrix);
  }
  group.add(glints);
  // Small entry markers make a permanent obstacle distinct from a pickup ring.
  for (const z of [-7.6, 7.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, 2.4, 6), material("#f1d087"));
    post.position.set(section.width*.14, level + .4, z); group.add(post);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(.6, .9, .1), material("#439bab"));
    marker.position.set(section.width*.14, level + 1.25, z); group.add(marker);
  }
  return group;
}

/** One curved sheet fanning out from a bow wave; reused for both sides of a splash. */
export function splashFanGeometry() {
  const positions: number[] = [];
  for (let i = 0; i < 18; i++) {
    const a = i/18, b = (i+1)/18;
    const point = (t: number) => [t, Math.sin(Math.PI*t) * (.9 + .1*Math.sin(t*19)), .9*t*t];
    positions.push(0, 0, 0, ...point(a), ...point(b));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
