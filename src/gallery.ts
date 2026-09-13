import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createMiniSection,
  MiniSection,
  MiniRailCurve,
  type MiniKind,
} from "./games/mini-track";
import { ELEMENT_NAMES } from "./games/mini-progression";
import { seededRandom } from "./games/mini-rail";
import "./gallery.css";

const descriptions: Record<MiniKind, string> = {
  station: "A short, level breather between the bigger challenges.",
  firsthill:
    "The starting hill. The train begins just beyond its crest and picks up speed on the descent.",
  hill: "A rounded crest that lifts the trailing coaches and loose parcels.",
  skyhill:
    "A long climb that asks you to store enough momentum for the summit.",
  dip: "A shallow valley that gives the train a little help from gravity.",
  loop: "A full vertical inversion. Later loops grow in both height and width.",
  corkscrew:
    "A twisting inversion that carries the rail around its direction of travel.",
  helix: "A banked rising turn followed by a descending exit.",
  triplehelix:
    "A climb to a tower, then three descending turns like a helter skelter.",
  invertedhill: "The rail rolls upside down across the crown of a tall hill.",
  verticalhill: "Straight vertical faces connected by rounded transitions.",
  jump: "A launch ramp over water, followed by a long landing straight. The gap has no rail.",
  heartline:
    "A complete roll around a point above the track, keeping the twist compact.",
  zerogstall:
    "A climb into an extended upside-down crown before rolling upright.",
  waveturn:
    "An airtime hill swept sideways with a steep bank through the crest.",
  doubledip:
    "Three falling crests separated by two dips, making a rolling descent.",
  tophat: "A vertical ascent, a high rounded crown and a vertical plunge.",
  immelmann:
    "A rising half-loop and half-roll reverse direction; a banked turn brings the route forward again.",
  diveloop:
    "A curved approach leads into a twisting dive and half-loop, finishing in the forward direction.",
  ascendinghelix:
    "A spiral tower that gains height and turns later in the ride, followed by a sweeping descent.",
  interlockingloops: "Two overlapping loop silhouettes on separate rail lanes.",
  nestedloop:
    "A fantasy element: a smaller complete inversion tucked into the crown of a giant loop.",
};
const kinds = Object.keys(ELEMENT_NAMES) as MiniKind[];
const title = (kind: MiniKind) =>
  ELEMENT_NAMES[kind].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const initial = new URLSearchParams(location.search).get("element") as MiniKind;
let kind: MiniKind = kinds.includes(initial) ? initial : "nestedloop";
let distance = Math.max(
  0,
  Math.min(20, Number(new URLSearchParams(location.search).get("km")) || 0),
);
let section: MiniSection;
let elapsed = 0;
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let group = new THREE.Group();
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="gallery-header"><a href="./index.html" class="brand"><img src="./images/keep-it-going-logo.png" alt="Keep it going" /></a><a class="back" href="./index.html">← Play the game</a></header>
<main class="gallery-layout">
<aside class="catalogue"><p class="eyebrow">THE TRACK COLLECTION</p><h1>Made to make<br>your stomach drop.</h1><p class="intro">Explore all ${kinds.length} pieces, from the first hill to the impossible inversions.</p>
<label class="mobile-picker" for="element">Track section</label><select id="element">${kinds.map((k) => `<option value="${k}">${title(k)}</option>`).join("")}</select>
<nav class="piece-list" aria-label="Track sections">${kinds.map((k, i) => `<button data-kind="${k}" aria-pressed="false"><span>${String(i + 1).padStart(2, "0")}</span>${title(k)}</button>`).join("")}</nav></aside>
<section class="explorer" aria-label="Interactive track viewer">
<div class="piece-heading"><div><p class="eyebrow" id="piece-number"></p><h2 id="piece-title"></h2></div><div class="step-buttons"><button id="previous" aria-label="Previous section">←</button><button id="next" aria-label="Next section">→</button></div></div>
<p id="description"></p>
<div class="viewport"><div class="camera-tools" role="group" aria-label="Camera views"><button data-view="perspective" aria-pressed="true">3D</button><button data-view="side" aria-pressed="false">Side</button><button data-view="top" aria-pressed="false">Top</button><button id="reset">Reset view</button></div><div class="stage" aria-label="3D track. Drag to orbit, scroll or pinch to zoom."></div><div class="viewer-footer"><span>Drag to orbit · scroll or pinch to zoom</span><button id="play"></button></div></div>
<div class="details"><div class="progression"><label for="distance">Later in the ride <output id="distance-value"></output></label><input id="distance" type="range" min="0" max="20" step="1" value="${distance}" /><div class="range-ends"><span>Opening scale</span><span>20 km</span></div></div><dl class="metrics"><div><dt>Height above entry</dt><dd id="height"></dd></div><div><dt>Rail length</dt><dd id="length"></dd></div><div><dt>Turns</dt><dd id="turns"></dd></div></dl></div>
<p class="footnote">The same track geometry and growth rules as the game. The little coach is a direction marker, moving at a constant preview speed—not a physics simulation. The opening hill and recovery pieces grow little or not at all.</p>
</section></main>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  app.querySelector<T>(selector)!;
const stage = $(".stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#e6eee8");
scene.add(new THREE.HemisphereLight("#fffbea", "#8bafa6", 2.4));
const sun = new THREE.DirectionalLight("#fff2d5", 3);
sun.position.set(-30, 80, 60);
scene.add(sun);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.append(renderer.domElement);
const camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minZoom = 0.3;
controls.maxZoom = 12;
const materials = {
  rail: new THREE.MeshStandardMaterial({
    color: "#b87545",
    metalness: 0.25,
    roughness: 0.5,
  }),
  tie: new THREE.MeshStandardMaterial({ color: "#efce92" }),
  support: new THREE.MeshStandardMaterial({ color: "#9ab3a1" }),
  ground: new THREE.MeshStandardMaterial({ color: "#d5e3c3" }),
  water: new THREE.MeshStandardMaterial({ color: "#80c5d4", roughness: 0.25 }),
  coach: new THREE.MeshStandardMaterial({ color: "#d74e50" }),
  roof: new THREE.MeshStandardMaterial({ color: "#fff5d8" }),
};
const coach = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 0.8, 2),
  materials.coach,
);
body.position.y = 0.7;
coach.add(body);
const roof = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.16, 1.6),
  materials.roof,
);
roof.position.y = 1.2;
coach.add(roof);
scene.add(coach);
let bounds = new THREE.Box3();
let view = "perspective";
function fit() {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  camera.up.set(0, 1, 0);
  const direction =
    view === "side"
      ? new THREE.Vector3(0, 0, 1)
      : view === "top"
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(-0.65, 0.65, 1);
  if (view === "top") camera.up.set(0, 0, -1);
  controls.target.copy(center);
  camera.position
    .copy(center)
    .addScaledVector(direction.normalize(), size.length() + 100);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const projected = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z])
        projected.expandByPoint(
          new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
        );
  const aspect = stage.clientWidth / stage.clientHeight;
  const extent =
    Math.max(
      (projected.max.y - projected.min.y) / 2,
      (projected.max.x - projected.min.x) / 2 / aspect,
      5,
    ) * 1.2;
  camera.left = -extent * aspect;
  camera.right = extent * aspect;
  camera.top = extent;
  camera.bottom = -extent;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  controls.update();
  app
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === view)),
    );
}
function rebuild() {
  scene.remove(group);
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  group = new THREE.Group();
  scene.add(group);
  section =
    kind === "firsthill"
      ? new MiniSection(-1, kind, 0, new THREE.Vector3(), 90, 22, 0, 1)
      : createMiniSection(
          kind,
          distance * 1000,
          new THREE.Vector3(),
          distance === 0 ? 0 : 20,
          seededRandom(71),
        );
  elapsed = 0;
  // Hide most of the 320 m landing straight so the water gap remains easy to inspect.
  const end =
    kind === "jump" ? section.distanceAtX(section.width + 28) : section.end;
  const ranges =
    kind === "jump"
      ? [
          [section.start, section.takeoff],
          [section.distanceAtX(section.landingX), end],
        ]
      : [[section.start, end]];
  bounds = new THREE.Box3();
  for (let d = section.start; d <= end; d += (end - section.start) / 1000)
    bounds.expandByPoint(section.sample(d).position);
  bounds.expandByPoint(section.sample(end).position);
  for (const [from, to] of ranges) {
    for (const offset of [-0.72, 0.72])
      group.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(
            new MiniRailCurve(section, offset, from, to),
            Math.min(6000, Math.ceil((to - from) * 4)),
            0.12,
            6,
            false,
          ),
          materials.rail,
        ),
      );
    const count = Math.ceil((to - from) / 1.5) + 1;
    const ties = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.85, 0.16, 0.22),
      materials.tie,
      count,
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const f = section.sample(Math.min(to, from + i * 1.5));
      matrix.compose(f.position, f.rotation, new THREE.Vector3(1, 1, 1));
      ties.setMatrixAt(i, matrix);
    }
    group.add(ties);
    for (let d = from; d < to; d += 9) {
      const p = section.sample(d).position;
      const bottom = Math.min(-3, bounds.min.y - 2);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.22, p.y - bottom, 5),
        materials.support,
      );
      post.position.set(p.x, (p.y + bottom) / 2, p.z);
      group.add(post);
    }
  }
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(size.x + 12, 0.7, size.z + 14),
    materials.ground,
  );
  ground.position.set(center.x, Math.min(-3, bounds.min.y - 2) - 0.4, center.z);
  group.add(ground);
  if (kind === "jump") {
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(section.width * 0.44, 0.2, 10),
      materials.water,
    );
    water.position.set(section.width * 0.42, -2.7, 0);
    group.add(water);
  }
  $("#piece-title").textContent = title(kind);
  $("#description").textContent =
    descriptions[kind] +
    (kind === "jump"
      ? " The preview crops the far end of the landing straight."
      : "");
  $("#piece-number").textContent =
    `SECTION ${String(kinds.indexOf(kind) + 1).padStart(2, "0")} / ${kinds.length}`;
  $("#height").textContent = `${Math.max(0, bounds.max.y).toFixed(1)} m`;
  $("#length").textContent =
    `${(section.kind === "jump" ? section.length - (section.distanceAtX(section.landingX) - section.takeoff) : section.length).toFixed(0)} m`;
  $("#turns").textContent = ["ascendinghelix", "triplehelix", "helix"].includes(
    kind,
  )
    ? String(section.turns)
    : "—";
  $("#distance-value").textContent =
    distance === 0 ? "Opening" : `${distance} km`;
  $<HTMLSelectElement>("#element").value = kind;
  app
    .querySelectorAll<HTMLButtonElement>("[data-kind]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.kind === kind)),
    );
  history.replaceState(null, "", `?element=${kind}&km=${distance}`);
  fit();
}
app.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach(
  (b) =>
    (b.onclick = () => {
      kind = b.dataset.kind as MiniKind;
      rebuild();
    }),
);
$<HTMLSelectElement>("#element").onchange = (e) => {
  kind = (e.target as HTMLSelectElement).value as MiniKind;
  rebuild();
};
$("#previous").onclick = () => {
  kind = kinds[(kinds.indexOf(kind) + kinds.length - 1) % kinds.length];
  rebuild();
};
$("#next").onclick = () => {
  kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
  rebuild();
};
$<HTMLInputElement>("#distance").oninput = (e) => {
  distance = Number((e.target as HTMLInputElement).value);
  rebuild();
};
app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view!;
      fit();
    }),
);
$("#reset").onclick = () => {
  view = "perspective";
  fit();
};
const updatePlay = () => {
  $("#play").textContent = playing ? "Pause preview" : "Play preview";
  $("#play").setAttribute("aria-pressed", String(playing));
};
$("#play").onclick = () => {
  playing = !playing;
  updatePlay();
};
updatePlay();
new ResizeObserver(() => {
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  fit();
}).observe(stage);
rebuild();
let last = 0;
renderer.setAnimationLoop((time) => {
  if (playing && !document.hidden)
    elapsed += Math.min((time - last) / 1000, 0.05);
  last = time;
  const end =
    kind === "jump" ? section.distanceAtX(section.width + 28) : section.end;
  const d = section.start + ((elapsed / 14) % 1) * (end - section.start);
  const frame = section.sample(d);
  coach.position.copy(frame.position);
  coach.quaternion.copy(frame.rotation);
  coach.visible = section.hasRail(d);
  controls.update();
  renderer.render(scene, camera);
});
