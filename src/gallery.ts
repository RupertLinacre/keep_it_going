import { WinterAtmosphere } from "./games/winter-atmosphere";
import { christmasLayout, isChristmasKind } from "./games/christmas-rails";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createMiniSection,
  MiniSection,
  MiniTrack,
  MiniRailCurve,
  type MiniKind,
} from "./games/mini-track";
import { WORLDS } from "./games/adventure-worlds";
import { AdventureScene } from "./games/adventure-scene";
import { ELEMENT_NAMES } from "./games/mini-progression";
import { seededRandom } from "./games/mini-rail";
import { floodedPool } from "./games/flooded-track";
import "./gallery.css";

const descriptions: Record<MiniKind, string> = {
  chimneyhouse: "Santa visits a cosy Lapland home, pauses to deliver presents, then bursts from its chimney in a magical leap. More entry speed means a higher flight. Play it at christmas.html?piece=chimneyhouse.",
  startree: "Three narrowing spirals climb a giant Christmas tree. Passing coaches wake its golden stars before sweeping down outside the branches.",
  snowmanscarf: "Climb a snowman’s striped scarf, duck beneath the hat, then return through the tunnel in its bottom snowball.",
  ribbonreel: "Ride the two actual rail loops of a giant Christmas bow above an elf wrapping workshop, setting its ribbon reels spinning.",
  snowglobe: "Circle inside a glass snow globe, sweep outside, then return through its snowy village. Your train stirs a cloud of twinkling snow.",
  honeyfactory: "Busy delivery bees fill jars of honey beneath a giant turning sunflower.",
  pancakemill: "A giant smiling chef flips pancakes as the train loops past the pans.",
  penguinplunge: "Penguins race along icy slides and ride a return conveyor beside the viaduct.",
  bigtopjuggle: "A towering circus loop brings a colourful juggling show to life.",
  silkspindle: "A friendly giant spider weaves glowing threads around the spiralling railway.",
  strengthtower: "A Starlight Carnival finale: climb for a height score, turn around, and return through the switch. Play it at tower.html.",
  sheepbank: "Sheep graze on three gentle crests, then leap safely onto the banks as your train approaches.",
  pondbridge: "Duck boats race beneath a lily bridge; passing trains set the paddle wheels turning.",
  windmillloop: "A storybook windmill mills flour as the train loops around its turning sails.",
  ravinebridge: "The train turns a huge waterwheel beside a rainbow waterfall.",
  midwayloop: "A giant vertical loop outlined with chasing fairground bulbs and a star at its crown.",
  carouselhelix: "Climb around a multi-decker unicorn carousel that keeps spinning after the train passes.",
  pumpkintunnel: "Burst through a candy castle full of flying pumpkins and green sparkles.",
  witchhat: "Friendly witches practise their broomstick skills around a towering spiral.",
  mountainpass: "Goats sing from a snowy alpine gorge as your train climbs past their perches.",
  tunnel: "A glowing mountain tunnel powers a little gondola ropeway overhead.",
  lanternrun: "Rolling hills trace a parade of glowing lanterns.",
  pumpkinhop: "Pumpkins beat their drums as the train bounces over three playful crests.",
  noninvertingloop:
    "A regular loop with a roll on the climb, putting the coach upright at the crown before it unwinds on the descent.",
  pretzelknot:
    "A half corkscrew dives into a half loop, then a second half loop climbs into the exit twist. The entrance crosses over the exit; the knot reverses direction before its connecting turn.",
  cobraroll:
    "Two half loops and opposing half corkscrews form a cobra hood. A connecting turn returns the route forward.",
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
  jump: "A launch ramp over water, followed by a short landing section. The gap has no rail.",
  splash: "A shallow flooded trough with continuous rails. The train throws up a huge bow splash and loses speed while submerged, then climbs back out. This is a permanent track feature, independent of power-ups.",
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
const signatures = WORLDS.flatMap(w=>w.pieces);
// The tower has a two-way, unlimited route; its playable preview is tower.html.
const kinds = [...signatures, ...(Object.keys(ELEMENT_NAMES) as MiniKind[]).filter(k=>k!=="strengthtower"&&!signatures.includes(k))];
let collection = new URLSearchParams(location.search).get("world") ?? "all";
if (!WORLDS.some(w=>w.id===collection)) collection="all";
const shownKinds = () => {
  const world = WORLDS.find(w => w.id === collection);
  return world ? [...(world.pieces.length ? world.pieces : world.challenges)] : kinds;
};
const title = (kind: MiniKind) =>
  ELEMENT_NAMES[kind].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const initial = new URLSearchParams(location.search).get("element") as MiniKind;
let kind: MiniKind = kinds.includes(initial) ? initial : "nestedloop";
if (!shownKinds().includes(kind)) kind=shownKinds()[0];
let distance = Math.max(
  0,
  Math.min(20, Number(new URLSearchParams(location.search).get("km")) || 0),
);
let section: MiniSection;
let elapsed = 0;
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let group = new THREE.Group();
let attraction: AdventureScene | undefined;
const galleryTrack = new MiniTrack(71, {generative:true});
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="gallery-header"><a href="./index.html" class="brand"><img src="./images/keep-it-going-logo.png" alt="Keep it going" /></a><a class="back" href="./index.html">← Play the game</a></header>
<main class="gallery-layout">
<aside class="catalogue"><p class="eyebrow">THE TRACK COLLECTION</p><h1>Made to make<br>your stomach drop.</h1><p class="intro">Explore all ${kinds.length} pieces, from the first hill to the impossible inversions.</p>
<label class="collection-label" for="collection">Explore a world</label><select id="collection"><option value="all">All track sections</option>${WORLDS.map(w=>`<option value="${w.id}">${w.icon} ${w.name}</option>`).join("")}</select>
<label class="mobile-picker" for="element">Track section</label><select id="element">${kinds.map((k) => `<option value="${k}">${title(k)}</option>`).join("")}</select>
<nav class="piece-list" aria-label="Track sections">${kinds.map((k, i) => `<button data-kind="${k}" aria-pressed="false"><span>${String(i + 1).padStart(2, "0")}</span>${title(k)}</button>`).join("")}</nav></aside>
<section class="explorer" aria-label="Interactive track viewer">
<div class="piece-heading"><div><p class="eyebrow" id="piece-number"></p><h2 id="piece-title"></h2></div><div class="step-buttons"><button id="previous" aria-label="Previous section">←</button><button id="next" aria-label="Next section">→</button></div></div>
<p id="description"></p>
<div class="viewport"><div class="camera-tools" role="group" aria-label="Camera views"><button data-view="attraction" hidden>Close-up</button><button data-view="perspective" aria-pressed="true">3D</button><button data-view="side" aria-pressed="false">Side</button><button data-view="top" aria-pressed="false">Top</button><button id="reset">Reset view</button><button id="tunnel-cutaway" aria-pressed="false" hidden>Inside tunnel</button></div><div class="stage" aria-label="3D track. Drag to orbit, scroll or pinch to zoom."></div><div class="viewer-footer"><span>Drag to orbit · scroll or pinch to zoom</span><button id="play"></button></div></div>
<div class="details"><div class="progression"><label for="distance">Later in the ride <output id="distance-value"></output></label><input id="distance" type="range" min="0" max="20" step="1" value="${distance}" /><div class="range-ends"><span>Opening scale</span><span>20 km</span></div></div><dl class="metrics"><div><dt>Height above entry</dt><dd id="height"></dd></div><div><dt>Rail length</dt><dd id="length"></dd></div><div><dt>Turns</dt><dd id="turns"></dd></div></dl></div>
<p class="footnote">The same track geometry and growth rules as the game. The little coach is a direction marker, moving at a constant preview speed—not a physics simulation. The opening hill and recovery pieces grow little or not at all.</p>
</section></main>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  app.querySelector<T>(selector)!;
const stage = $(".stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#e6eee8");
const winterSky=new WinterAtmosphere(scene);
let galleryWorld=WORLDS[0];
const ambient = new THREE.HemisphereLight("#fffbea", "#8bafa6", 2.4);
scene.add(ambient);
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
const floodMaterials = new Map<string, THREE.MeshStandardMaterial>();
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
let view = ["startree","snowmanscarf","snowglobe"].includes(kind)?"attraction":"perspective";
function fit() {
  let framing=bounds;
  const focus=isChristmasKind(kind)&&view==='attraction';
  if(focus&&isChristmasKind(kind)){const l=christmasLayout(kind,section.width,section.amplitude,section.hand),r=l.radius+5,c=l.center;
    framing=new THREE.Box3(new THREE.Vector3(c.x-r,0,c.z-r),new THREE.Vector3(c.x+r,Math.max(section.origin.y+section.amplitude+12,kind==='snowglobe'?(l.radius+5.6)*1.6+6.3:0),c.z+r));}
  const center = framing.getCenter(new THREE.Vector3());
  const size = framing.getSize(new THREE.Vector3());
  camera.up.set(0, 1, 0);
  const direction =
    view === "side"
      ? new THREE.Vector3(0, 0, 1)
      : view === "top"
        ? new THREE.Vector3(0, 1, 0)
        : focus ? new THREE.Vector3(-.18,.32,1) : (kind === "pretzelknot" ? new THREE.Vector3(0.12, 0.28, -1) : new THREE.Vector3(-0.65, 0.65, 1));
  if (view === "top") camera.up.set(0, 0, -1);
  controls.target.copy(center);
  camera.position
    .copy(center)
    .addScaledVector(direction.normalize(), size.length() + 100);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const projected = new THREE.Box3();
  for (const x of [framing.min.x, framing.max.x])
    for (const y of [framing.min.y, framing.max.y])
      for (const z of [framing.min.z, framing.max.z])
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
  attraction?.destroy(); attraction=undefined;
  $("#tunnel-cutaway").hidden=kind!=="tunnel";$("#tunnel-cutaway").setAttribute("aria-pressed","false");
  const selectedWorld = WORLDS.find(w => w.id === collection);
  const world = selectedWorld && !selectedWorld.pieces.length ? selectedWorld : WORLDS.find(w=>w.pieces.includes(kind));
  galleryWorld=world??WORLDS[0];
  winterSky.material.uniforms.weight.value=(world?.id==="lapland"||world?.id==="winterfair")?1:0;
  scene.background = new THREE.Color(world?.sky ?? '#e6eee8');
  materials.ground.color.set(world?.ground ?? '#d5e3c3');
  materials.rail.color.set(world?.rail ?? '#b87545');
  materials.rail.emissive.set(world?.rail ?? '#000000');materials.rail.emissiveIntensity=(world?.darkness??0)*.35;
  ambient.color.set(world?.ambient??'#fffbea');sun.color.set(world?.light??'#fff2d5');sun.intensity=3-(world?.darkness??0)*1.6;
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
          new THREE.Vector3(0,world?4:0,0),
          distance === 0 ? 0 : 20,
          seededRandom(71),
        );
  elapsed = 0;
  const end = section.end;
  const ranges =
    ["jump","chimneyhouse"].includes(kind)
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
          ).translate(section.origin.x,section.origin.y,section.origin.z),
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
      const bottom = world ? 0 : Math.min(-3, bounds.min.y - 2);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.22, p.y - bottom, 5),
        materials.support,
      );
      post.position.set(p.x, (p.y + bottom) / 2, p.z);
      group.add(post);
    }
  }
  const railHeight = Math.max(0,bounds.max.y-section.origin.y);
  if(world){
    galleryTrack.sections.splice(0,galleryTrack.sections.length,section);
    attraction=new AdventureScene(scene,{attractionsOnly:!!world?.pieces.length&&!isChristmasKind(kind),world});
    attraction.render(galleryTrack,section.start,0,0,0);
    if(isChristmasKind(kind)){for(const tile of attraction.tiles.values())if(tile.animations[0])bounds.expandByObject(tile.animations[0].group);}
    else bounds.expandByObject(attraction.group);
  }
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(size.x + 12, 0.7, size.z + 14),
    materials.ground,
  );
  ground.visible=!isChristmasKind(kind);
  ground.position.set(center.x, (world ? 0 : Math.min(-3, bounds.min.y - 2)) - 0.4, center.z);
  group.add(ground);
  if (kind === "jump") {
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(section.width * 0.44, 0.2, 10),
      materials.water,
    );
    water.position.set(section.width * 0.42, -2.7, 0);
    group.add(water);
  }
  if (kind === "splash") {
    group.add(floodedPool(section, color => {
      if (!floodMaterials.has(color)) floodMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .4 }));
      return floodMaterials.get(color)!;
    }));
    bounds.expandByPoint(new THREE.Vector3(section.width/2, section.waterLevel + 1.8, 8));
    bounds.expandByPoint(new THREE.Vector3(section.width/2, section.waterLevel - .7, -8));
  }
  $("#piece-title").textContent = title(kind);
  $("#description").textContent = descriptions[kind];
  $("#piece-number").textContent =
    `${world ? world.icon+" "+world.name+" · " : ""}SECTION ${String(kinds.indexOf(kind) + 1).padStart(2, "0")} / ${kinds.length}`;
  $("#height").textContent = `${railHeight.toFixed(1)} m`;
  $("#length").textContent =
    `${(section.kind === "jump" ? section.length - (section.distanceAtX(section.landingX) - section.takeoff) : section.length).toFixed(0)} m`;
  $("#turns").textContent = ["ascendinghelix", "triplehelix", "helix", "carouselhelix", "witchhat", "startree", "snowmanscarf"].includes(
    kind,
  )
    ? String(section.turns)
    : "—";
  $("#distance-value").textContent =
    distance === 0 ? "Opening" : `${distance} km`;
  $<HTMLSelectElement>("#collection").value=collection;
  $<HTMLSelectElement>("#element").innerHTML=shownKinds().map(k=>`<option value="${k}">${title(k)}</option>`).join('');
  $<HTMLSelectElement>("#element").value = kind;
  app.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(b=>b.hidden=!shownKinds().includes(b.dataset.kind as MiniKind));
  app
    .querySelectorAll<HTMLButtonElement>("[data-kind]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.kind === kind)),
    );
  history.replaceState(null, "", `?element=${kind}&km=${distance}${collection==="all"?"":"&world="+collection}`);
  $<HTMLButtonElement>('[data-view="attraction"]').hidden=!isChristmasKind(kind);
  if(!isChristmasKind(kind)&&view==='attraction')view='perspective';
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
$<HTMLSelectElement>("#collection").onchange = event => {
  collection=(event.target as HTMLSelectElement).value;
  if(!shownKinds().includes(kind))kind=shownKinds()[0];
  rebuild();
};
$("#previous").onclick = () => {
  const list=shownKinds();kind = list[(list.indexOf(kind) + list.length - 1) % list.length];
  rebuild();
};
$("#next").onclick = () => {
  const list=shownKinds();kind = list[(list.indexOf(kind) + 1) % list.length];
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
$("#tunnel-cutaway").onclick = () => {
  const reveal=$("#tunnel-cutaway").getAttribute("aria-pressed")!=="true";
  $("#tunnel-cutaway").setAttribute("aria-pressed",String(reveal));
  attraction?.setTunnelCutaway(reveal);
};
$("#reset").onclick = () => {
  view = isChristmasKind(kind)?"attraction":"perspective";
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
  const end = section.end;
  const d = section.start + ((elapsed / 14) % 1) * (end - section.start);
  const frame = section.sample(d);
  coach.position.copy(frame.position);
  coach.quaternion.copy(frame.rotation);
  coach.visible = section.hasRail(d);
  attraction?.render(galleryTrack,d,0,0,elapsed);
  winterSky.update(galleryWorld,scene.background as THREE.Color,1/60,stage.clientWidth/stage.clientHeight,-10000);
  controls.update();
  renderer.render(scene, camera);
});
