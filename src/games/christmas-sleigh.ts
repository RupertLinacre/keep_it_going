import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MiniModelMeshFactory } from "./train-model";
import { adventureAt } from "./adventure-worlds";
import type { MiniTrack } from "./mini-track";

const RED = "#ed2448", RUBY = "#ff4b57", GOLD = "#ffd570", CREAM = "#fff9e9";
const BAKED = "#fffcf4";
const PRESENTS = ["#e44364", "#33bda5", "#8b71dc", "#e1b757", "#57a6d5", "#ef967a"];

function defaultFactory(): MiniModelMeshFactory {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  return (geometry, color) => {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .12 });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
}

/** Switch the entire train at the same section boundary as the scenery. Each
 * racer resolves their own distance, including when their worlds differ. */
export function christmasTrainAt(track: Pick<MiniTrack, "options" | "sectionAt"> & Partial<Pick<MiniTrack,"worlds">>, distance: number) {
  if (!track.options.generative || track.options.towerDemo) return false;
  const world = adventureAt(Math.max(0, track.sectionAt(distance).start),track.worlds).world.id;
  return world === "lapland" || world === "winterfair";
}

/** A tiny wrapped present fits the ordinary parcel's .68 m physics box. Body
 * remains white so the renderer can vary gift paper with instance colours. */
export function createChristmasGift(meshFactory: MiniModelMeshFactory = defaultFactory()) {
  const group = new THREE.Group();
  group.name = "christmas-present";
  const box = meshFactory(new THREE.BoxGeometry(.66, .64, .66), "#ffffff");
  box.name = "wrapping-paper";
  const lid = meshFactory(new THREE.BoxGeometry(.69, .06, .69), "#ffffff");
  lid.position.y = .29;
  group.add(box, lid);
  for (const scale of [[.105, .66, .69], [.69, .66, .105]]) {
    const ribbon = meshFactory(new THREE.BoxGeometry(...scale), GOLD);
    ribbon.name = "gold-crossed-ribbon";
    group.add(ribbon);
  }
  for (const sign of [-1, 1]) {
    const bow = meshFactory(new THREE.TorusGeometry(.1, .026, 5, 12), GOLD);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = sign * .32;
    bow.scale.set(1, .58, 1);
    bow.position.set(sign * .087, .35, 0);
    bow.name = "looped-bow";
    group.add(bow);
  }
  const knot = meshFactory(new THREE.SphereGeometry(.047, 8, 5), GOLD);
  knot.position.y = .35; group.add(knot);
  return group;
}

/** Detailed sleighs bake to one vertex-coloured batch per type. A train of ten
 * uses the same draw calls as one sleigh. Local forward matches the train: -Z.
 * Decorative toy sacks replace the old solid closed-coach load; actual open
 * wagon gifts are supplied separately by the existing parcel simulation. */
export function createChristmasSleigh(engine = false, meshFactory: MiniModelMeshFactory = defaultFactory(), decorativeCargo = false) {
  const parts: { geometry: THREE.BufferGeometry; color: string; matrix: THREE.Matrix4; name: string }[] = [];
  const transform = new THREE.Object3D();
  const add = (name: string, geometry: THREE.BufferGeometry, color: string,
    position: number[] = [0, 0, 0], scale: number[] = [1, 1, 1], rotation: number[] = [0, 0, 0]) => {
    transform.position.set(...position as [number, number, number]);
    transform.scale.set(...scale as [number, number, number]);
    transform.rotation.set(...rotation as [number, number, number]); transform.updateMatrix();
    parts.push({ geometry, color, matrix: transform.matrix.clone(), name });
  };
  const box = (name: string, color: string, position: number[], scale: number[], rotation?: number[]) =>
    add(name, new THREE.BoxGeometry(1, 1, 1), color, position, scale, rotation);
  const ball = (name: string, color: string, position: number[], scale: number[]) =>
    add(name, new THREE.SphereGeometry(1, 12, 8), color, position, scale);
  const tube = (name: string, color: string, points: number[][], radius: number, segments = 22) =>
    add(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number]))), segments, radius, 6, false), color);

  // Pass 1: a recognisable traditional sleigh outline, raised from the rails.
  box("velvet-floor", RED, [0, .35, 0], [1.27, .19, 1.96]);
  box("padded-bench", "#632843", [0, .52, .32], [1.05, .18, .6]);
  for (const side of [-1, 1]) {
    const x = side * .64;
    tube("curled-gold-runner", GOLD, [[x, .12, 1.07], [x, .08, .6], [x, .08, -.7],
      [x, .18, -1.05], [x, .38, -1.23], [x, .59, -1.14], [x, .55, -.99]], .063, 28);
    for (const z of [-.57, .63]) box("runner-strut", GOLD, [x, .24, z], [.06, .3, .07], [.15, 0, 0]);
    // Extrusion supplies an actual curved panel, with a high scrolling nose
    // and a dipped middle so cargo and Santa remain clearly visible.
    const outline = new THREE.Shape();
    outline.moveTo(-1.03, .4); outline.lineTo(1.02, .4); outline.lineTo(1.02, .78);
    outline.bezierCurveTo(.9, 1.03, .65, .95, .5, .79);
    outline.bezierCurveTo(.2, .65, -.34, .67, -.59, .87);
    outline.bezierCurveTo(-.7, 1.08, -.96, 1.09, -1.07, .92);
    outline.bezierCurveTo(-1.19, .74, -1.11, .57, -1.03, .4);
    add("scrolled-velvet-side", new THREE.ExtrudeGeometry(outline, { depth: .105, bevelEnabled: true,
      bevelSize: .035, bevelThickness: .025, bevelSegments: 1, steps: 1, curveSegments: 9 }), RED,
    [x + .0525, 0, 0], [1, 1, 1], [0, -Math.PI / 2, 0]);
    tube("top-gold-piping", GOLD, [[x, .79, 1.02], [x, .93, .83], [x, .8, .51],
      [x, .715, .15], [x, .76, -.38], [x, .91, -.63], [x, 1.02, -.88], [x, .93, -1.06]], .025);
    tube("lower-gold-piping", GOLD, [[x, .43, 1.01], [x, .43, .2], [x, .43, -.75], [x, .58, -1.1]], .024);
    // Pass 2: contrasting raised ornaments read on both mirrored race lanes.
    for (const z of [-.24, .4]) {
      ball("gold-side-rosette", GOLD, [x + side * .09, .59, z], [.018, .078, .078]);
      for (const angle of [0, Math.PI / 3, -Math.PI / 3])
        box("ivory-snowflake-inlay", CREAM, [x + side * .11, .59, z], [.016, .18, .027], [angle, 0, 0]);
    }
  }
  box("backrest", RED, [0, .69, .88], [1.22, .5, .13]);
  box("fur-backrest-top", CREAM, [0, .97, .88], [1.26, .1, .16]);
  box("front-curved-footboard", RUBY, [0, .58, -.89], [1.23, .3, .15], [.17, 0, 0]);
  for (const x of [-.48, .48]) ball("front-sleigh-bell", GOLD, [x, .85, -.96], [.075, .095, .075]);

  if (engine) {
    // Enlarge the driver around his seat, keeping runners and coach spacing
    // unchanged. Santa's face and hat should read at the ordinary game zoom.
    const driverStart = parts.length;
    // Pass 3: Santa's broad beard, floppy hat and fur cuffs read at play scale.
    ball("santa-coat", RUBY, [0, 1.05, .04], [.38, .48, .3]);
    box("santa-black-belt", "#35324c", [0, .91, -.24], [.57, .13, .055]);
    box("santa-belt-buckle", GOLD, [0, .91, -.279], [.16, .13, .026]);
    box("buckle-centre", "#35324c", [0, .91, -.296], [.083, .071, .01]);
    for (const side of [-1, 1]) {
      box("santa-boot", "#35324c", [side * .2, .64, -.45], [.22, .18, .37]);
      ball("santa-red-sleeve", RUBY, [side * .38, 1.1, -.06], [.16, .27, .17]);
      ball("santa-fur-cuff", CREAM, [side * .37, .98, -.24], [.13, .105, .12]);
      ball("santa-mitten", "#425966", [side * .35, .99, -.34], [.105, .1, .14]);
      tube("santa-reins", "#806347", [[side * .35, 1, -.4], [side * .35, .91, -.72], [side * .38, .83, -1]], .013, 10);
    }
    ball("santa-face", "#ffc4a2", [0, 1.59, -.08], [.265, .285, .25]);
    ball("santa-beard", CREAM, [0, 1.39, -.24], [.3, .28, .18]);
    for (const side of [-1, 1]) {
      ball("beard-curl", CREAM, [side * .2, 1.45, -.235], [.12, .17, .105]);
      ball("rosy-cheek", "#db7e85", [side * .155, 1.57, -.279], [.07, .055, .03]);
      ball("santa-eye", "#35324c", [side * .1, 1.665, -.294], [.027, .032, .017]);
      ball("santa-eyebrow", CREAM, [side * .1, 1.717, -.292], [.055, .019, .016]);
      ball("santa-moustache", CREAM, [side * .072, 1.535, -.327], [.096, .047, .06]);
    }
    ball("santa-nose", "#ffc4a2", [0, 1.585, -.348], [.073, .072, .063]);
    ball("hat-fur-band", CREAM, [0, 1.83, -.06], [.3, .083, .275]);
    add("santa-hat", new THREE.ConeGeometry(.285, .48, 12), RUBY, [.025, 2.055, -.05], [1, 1, 1], [0, 0, -.19]);
    tube("floppy-hat-tip", RUBY, [[.05, 2.2, -.05], [.2, 2.25, -.04], [.3, 2.16, -.03]], .074, 10);
    ball("hat-pompom", CREAM, [.3, 2.13, -.03], [.113, .113, .113]);
    const driverScale = new THREE.Matrix4().makeTranslation(0, .62, 0)
      .multiply(new THREE.Matrix4().makeScale(1.34, 1.12, 1.16))
      .multiply(new THREE.Matrix4().makeTranslation(0, -.62, 0));
    for (const part of parts.slice(driverStart)) part.matrix.premultiply(driverScale);
    // A small sack behind the driver strengthens the Santa silhouette.
    ball("santa-toy-sack", "#b48a60", [-.02, 1.13, .67], [.35, .4, .28]);
    ball("sack-gather", "#b48a60", [-.02, 1.53, .67], [.13, .13, .12]);
    tube("sack-tie", GOLD, [[-.12, 1.46, .66], [0, 1.45, .55], [.12, 1.46, .66]], .027, 8);
  } else if (decorativeCargo) {
    // Closed coaches originally carry a fixed solid load. Their matching
    // sleighs carry toy sacks; only real simulated parcels use gift boxes.
    for (const [index, z] of [-.38, .39].entries()) {
      const color = index ? "#28bfa8" : "#c867b3";
      ball("velvet-toy-sack", color, [index ? .13 : -.11, .99, z], [.4, .43, .37]);
      ball("gathered-toy-sack", color, [index ? .15 : -.13, 1.42, z], [.14, .12, .13]);
      box("gold-sack-label", GOLD, [.38, 1.04, z], [.024, .16, .16], [.15, 0, 0]);
    }
  }

  // Pass 4: bake primitive detail into one indexed-independent vertex batch.
  // This avoids a material/draw-call cost for each beard curl and gold rail.
  const geometries = parts.map(part => {
    const source = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    source.applyMatrix4(part.matrix); source.deleteAttribute("uv");
    const color = new THREE.Color(part.color), colors = new Float32Array(source.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
    source.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    // Colour-aware fill light is baked into the single instanced batch. Gold
    // shines most, velvet stays rich, and pale fur keeps its shaded shape.
    // It costs no real lights, bloom passes or extra draw calls.
    const glow = part.color === GOLD ? .7 : part.color === RED || part.color === RUBY ? .44
      : part.color === CREAM ? .2 : .27;
    source.setAttribute("sleighGlow", new THREE.BufferAttribute(
      new Float32Array(source.getAttribute("position").count).fill(glow), 1));
    part.geometry.dispose(); return source;
  });
  const geometry = mergeGeometries(geometries)!;
  geometries.forEach(part => part.dispose()); geometry.computeBoundingSphere();
  const model = meshFactory(geometry, BAKED);
  for (const material of Array.isArray(model.material) ? model.material : [model.material]) {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.vertexColors = true; material.roughness = .38; material.metalness = .08;
      material.emissive.set("#ffffff"); material.emissiveIntensity = 1;
      material.onBeforeCompile = shader => {
        shader.vertexShader = "attribute float sleighGlow; varying float vSleighGlow;\n" + shader.vertexShader
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSleighGlow = sleighGlow;");
        shader.fragmentShader = "varying float vSleighGlow;\n" + shader.fragmentShader
          .replace("#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb * vSleighGlow;");
      };
      material.customProgramCacheKey = () => "christmas-sleigh-coloured-fill-v1";
    }
  }
  model.name = engine ? "santa-sleigh-batch" : "gift-sleigh-batch";
  const group = new THREE.Group(); group.name = engine ? "santa-sleigh" : "christmas-sleigh";
  group.userData.detailNames = parts.map(part => part.name);
  group.add(model); return group;
}

export const CHRISTMAS_GIFT_COLORS = PRESENTS.map(color => new THREE.Color(color));

