import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MiniSection, MiniTrack, createMiniSection } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { seededRandom } from "../src/games/mini-rail.ts";
import { SPECIAL_KINDS } from "../src/games/mini-elements.ts";
import { rideProgress, RECOVERY, ELEMENT_NAMES } from "../src/games/mini-progression.ts";
import { PLAYER_PROFILES, simulateRide } from "../scripts/playtest.ts";

function collect(seed: number, end = 15000) {
  const track = new MiniTrack(seed), sections = new Map<number, MiniSection>();
  for (let at = 0; at < end; at += 150) {
    track.ensure(at);
    for (const s of track.sections) sections.set(s.id, s);
  }
  return [...sections.values()];
}

test("new track pieces have continuous positions, tangents and upright forward exits across seeds and scales", () => {
  for (const seed of [1, 12, 42, 93]) {
    const sections = collect(seed);
    for (const kind of SPECIAL_KINDS) assert.ok(sections.some(s => s.kind === kind), `${kind} is reachable`);
    for (let i = 1; i < sections.length; i++) {
      const s = sections[i], f = s.frames, previous = sections[i - 1].frames.at(-1)!;
      assert.ok(f[0].position.distanceTo(previous.position) < 1e-7, `${s.kind}: joined rail`);
      assert.ok(f[0].tangent.dot(previous.tangent) > 0.9999, `${s.kind}: tangent at join`);
      assert.ok(Math.abs(f[0].rotation.dot(previous.rotation)) > 0.9999, `${s.kind}: orientation at join`);
      assert.ok(f.at(-1)!.tangent.x > 0.9999, `${s.kind}: return to the forward corridor`);
      assert.ok(Math.abs(f.at(-1)!.position.y - 4) < 1e-6, "No accumulated altitude or downhill energy gift");
      assert.ok(Math.abs(f.at(-1)!.position.z) <= 3.5 + 1e-6, "No cumulative sideways drift");
      for (let j = 0; j < f.length; j++) {
        const frame = f[j];
        assert.ok(Number.isFinite(frame.position.length() + frame.curvature.length() + frame.rotation.length()));
        assert.ok(Math.abs(frame.up.length() - 1) < 1e-8 && Math.abs(frame.up.dot(frame.tangent)) < 1e-8);
        assert.ok(frame.position.y > 1, "Real rail stays above the ground");
        if (j && s.hasRail(s.start + s.distances[j]) && s.hasRail(s.start + s.distances[j - 1]))
          assert.ok(Math.abs(frame.rotation.dot(f[j - 1].rotation)) > 0.97, `${s.kind}: no instantaneous roll or pitch on actual rail`);
      }
      assert.ok(ELEMENT_NAMES[s.kind]);
    }
  }
});

test("compound loops and rising spirals provide physical clearance at nonadjacent crossings", () => {
  for (const s of collect(42).filter(s => ["nestedloop", "interlockingloops", "ascendinghelix", "noninvertingloop", "cobraroll", "pretzelknot"].includes(s.kind))) {
    const samples: THREE.Vector3[] = [];
    for (let at = s.start; at < s.end; at += 1) samples.push(s.sample(at).position);
    for (let i = 0; i < samples.length; i++) for (let j = i + 10; j < samples.length; j++)
      assert.ok(samples[i].distanceTo(samples[j]) > 3.4, `${s.kind} at ${s.start}: rails must not intersect`);
  }
});

test("special elements retain their defining inversions, turnarounds, verticals and nested loops", () => {
  const sections = collect(42);
  for (const kind of ["heartline", "zerogstall", "immelmann", "diveloop", "interlockingloops", "nestedloop"] as const) {
    const s = sections.find(s => s.kind === kind)!;
    assert.ok(s.frames.some(f => f.up.y < -0.9), `${kind}: genuinely inverted`);
  }
  for (const kind of ["immelmann", "diveloop", "ascendinghelix"] as const) {
    const s = sections.find(s => s.kind === kind)!;
    assert.ok(s.frames.some(f => f.tangent.x < -0.9), `${kind}: travels back before turning forward again`);
  }
  const hat = sections.find(s => s.kind === "tophat")!;
  assert.ok(hat.frames.filter(f => f.tangent.y > 0.9999).length > 20);
  assert.ok(hat.frames.filter(f => f.tangent.y < -0.9999).length > 20);
  const stall = sections.find(s => s.kind === "zerogstall")!;
  assert.ok(stall.frames.filter(f => f.up.y < -0.85).length > stall.frames.length * 0.3, "A sustained upside-down crown");
  for (const kind of ["nestedloop", "interlockingloops"] as const) {
    const s = sections.find(s => s.kind === kind)!;
    let inverted = false, inversions = 0;
    for (const f of s.frames) { if (f.up.y < -0.5 && !inverted) { inverted = true; inversions++; } if (f.up.y > 0.5) inverted = false; }
    assert.equal(inversions, 2, `${kind}: two complete inversions`);
  }
});

test("the track director grows climbs and turn counts while keeping recovery sections between challenges", () => {
  const sections = collect(42, 24000);
  for (const kind of ["tophat", "nestedloop", "ascendinghelix", "interlockingloops"] as const) {
    const all = sections.filter(s => s.kind === kind), first = all[0], last = all.at(-1)!;
    const early = createMiniSection(kind, 1000, new THREE.Vector3(), 20, seededRandom(42));
    const late = createMiniSection(kind, 20000, new THREE.Vector3(), 20, seededRandom(42));
    assert.ok(late.amplitude > early.amplitude * 2, `${kind}: substantially taller later`);
    if (kind === "ascendinghelix") assert.ok(last.turns > first.turns && first.turns === 2, "Spirals grow from two turns toward eight");
  }
  const directed = sections.filter(s => s.id >= 11);
  for (let i = 1; i < directed.length; i++) {
    if (!RECOVERY.includes(directed[i].kind)) assert.ok(RECOVERY.includes(directed[i - 1].kind), "A recovery element before every challenge");
  }
  assert.ok(sections.find(s => s.kind === "ascendinghelix")!.start < 2500, "Introduce spirals while the game is still approachable");
  assert.ok(rideProgress(10000).scale > rideProgress(5000).scale);
  assert.deepEqual(collect(75, 3000).map(s => [s.kind, s.length]), collect(75, 3000).map(s => [s.kind, s.length]));
});

test("new inversions and multi-turn climbs conserve mechanical energy with resistance disabled", () => {
  const sections = collect(42, 9000);
  for (const kind of SPECIAL_KINDS) {
    const section = sections.find(s => s.kind === kind)!;
    const physics = new MiniPhysics(section, { initialDistance: section.start, initialSpeed: 70, drag: 0, rolling: 0 });
    const energy = physics.energy;
    for (let i = 0; i < 30000 && physics.distance < section.end; i++) {
      physics.update(1 / 120);
      assert.ok(Math.abs(physics.energy - energy) / energy < 0.003, `${kind}: gravity and height agree`);
      assert.ok(!physics.held, `${kind}: no fictitious stall`);
    }
    assert.ok(physics.distance >= section.end);
  }
});

test("realistic answer profiles survive the introduction and meet progressively harder climbs", () => {
  const steady = simulateRide(42, PLAYER_PROFILES[1], 600);
  const fluent = simulateRide(42, PLAYER_PROFILES[2], 600);
  assert.ok(steady.seconds > 60 && steady.ended, "Steady answers get a proper ride, then face a real challenge");
  assert.ok(fluent.metres > steady.metres * 1.3, "Faster arithmetic earns a meaningfully longer ride");
  assert.ok(fluent.maximumHeight > steady.maximumHeight);
  assert.ok(fluent.maximumSections < 24 && fluent.maximumFrames < 35000, "Track memory remains a sliding window");
});

test("the camera follows immense structures without shrinking the mobile train away", async () => {
  const { coasterFraming, MiniCameraRig, MINI_CAMERA_DIRECTION } = await import("../src/games/mini-camera.ts");
  for (const aspect of [0.7, 1, 2.1, 3.5]) for (const close of [false, true]) {
    const rig = new MiniCameraRig();
    for (let y = 4; y < 350; y += 1) {
      const lead = new THREE.Vector3(40, y, 20 * Math.sin(y / 30));
      const { focus, height } = coasterFraming(lead, 350, aspect, close);
      assert.ok(height <= (close ? 26 : aspect < 1.1 ? 64 : 100));
      rig.update(focus, height, aspect, [lead], 1 / 60);
      const camera = new THREE.OrthographicCamera(-rig.height * aspect / 2, rig.height * aspect / 2, rig.height / 2, -rig.height / 2, 0.1, 2000);
      camera.position.copy(rig.focus).addScaledVector(MINI_CAMERA_DIRECTION, 1000);
      camera.lookAt(rig.focus); camera.updateMatrixWorld(true);
      const screen = lead.clone().project(camera);
      assert.ok(Math.abs(screen.x) < 0.85 && Math.abs(screen.y) < 0.73, "The engine stays visible through the climb");
      assert.ok(rig.height < 150, "The camera does not frame the whole 350-metre tower");
    }
  }
});


test("a phone camera stays compact even when the keypad makes its game area wider than tall", async () => {
  const { coasterFraming, MiniCameraRig } = await import("../src/games/mini-camera.ts");
  const lead = new THREE.Vector3(40, 210, 20);
  const framing = coasterFraming(lead, 250, 1.3, false, true, true);
  assert.ok(framing.height < 60);
  const rig = new MiniCameraRig();
  for (let i = 0; i < 300; i++) rig.update(framing.focus, framing.height, 1.3, [lead], 1 / 60);
  assert.ok(rig.height < 65, "Keep coaches visible instead of fitting the entire tower");
  assert.equal(rig.settled, true, "A paused view can stop redrawing even with the engine in its subject list");
});

test("short water jumps allow fast flights to rejoin following track pieces", () => {
  let landings = 0, beyondRunout = 0;
  for (const seed of [5, 19, 27, 39]) {
    const track = new MiniTrack(seed), physics = new MiniPhysics(track);
    let next = 1;
    while (physics.time < 600 && !physics.held && !physics.crashed) {
      if (physics.time >= next) { physics.impulse(); next++; }
      track.ensure(physics.distance);
      const previous = physics.jumps;
      physics.update(1 / 30);
      if (physics.jumps > previous) {
        landings++;
        assert.ok(track.hasRail(physics.distance), "Rejoin actual rail");
        assert.ok(Number.isFinite(physics.velocity), "Landing preserves finite motion");
        if (track.sectionAt(physics.distance).kind !== "jump") beyondRunout++;
      }
    }
  }
  assert.ok(landings >= 15);
  assert.ok(beyondRunout > 0, "Fast jumps may land beyond the short straight");
  const jump = new MiniTrack(42).sections.find(s => s.kind === "jump")!;
  assert.equal(jump.runout, 0);
  assert.ok(jump.span - (jump.landingX - jump.origin.x) < 30, "Keep the original short landing section");
});

test("very long rides cap per-piece sampling and discard old rail even during a large seek", () => {
  const track = new MiniTrack(42);
  track.ensure(100000);
  assert.ok(track.sections.length < 24);
  assert.ok(track.end >= 100230);
  assert.ok(track.sections.length === 2 || track.sections[0].end >= 99820, "Retain only the current window or the minimum pair of sections");
  for (const section of track.sections) {
    assert.ok(section.frames.length <= 16385);
    assert.ok(section.frames.every(f => Number.isFinite(f.position.length() + f.curvature.length())));
  }
});


test("the non-inverting loop stays upright and both new knots have two inversions", () => {
  for (const seed of [1,42,71]) for (const distance of [0,20000]) {
    for (const kind of ["noninvertingloop", "cobraroll", "pretzelknot"] as const) {
      const s=createMiniSection(kind,distance,new THREE.Vector3(),20,seededRandom(seed));
      let inverted=false, count=0;
      for (const f of s.frames) {
        if (f.up.y < -0.5 && !inverted) {count++; inverted=true;}
        if (f.up.y > 0.5) inverted=false;
      }
      assert.equal(count,kind === "noninvertingloop" ? 0 : 2,kind);
      if (kind === "noninvertingloop") assert.ok(s.frames.reduce((top,f)=>f.position.y>top.position.y?f:top).up.y>.95, "The roll puts the coach upright at the crown");
      assert.ok(s.frames.some(f=>f.tangent.x<-.25), "The silhouette turns back on itself");
    }
  }
});


test("pretzel knot has crossed half-corkscrews, two half-loops and a reversed core exit", () => {
  for (const distance of [0, 12000]) {
    const s = createMiniSection("pretzelknot",distance,new THREE.Vector3(),20,seededRandom(71));
    const h=s.amplitude, lead=1.5*h;
    const nearest=(x:number,y:number,z:number)=>s.frames.reduce((a,b)=>
      a.position.distanceToSquared(new THREE.Vector3(x,y,z))<b.position.distanceToSquared(new THREE.Vector3(x,y,z))?a:b);
    const hand=s.hand;
    const entrance=nearest(lead,.65*h,-hand*.5*h), exit=nearest(lead,.3*h,-hand*.5*h);
    assert.ok(Math.hypot(entrance.position.x-exit.position.x,entrance.position.z-exit.position.z)<.02*h, "Entrance and exit actually cross in plan view");
    assert.ok(entrance.position.y-exit.position.y>.3*h,"Entrance passes above exit with clearance");
    for (const x of [lead+.8*h,lead-.8*h]) {
      const crown=nearest(x,h,0);
      assert.ok(crown.up.y<-.98 && crown.tangent.x>.98,"Each crown joins an inverted half-corkscrew to a half-loop, not a full loop");
    }
    const reversed=nearest(lead+1.2*h,0,-hand*1.2*h);
    assert.ok(reversed.tangent.x<-.98 && reversed.up.y>.98,"The core exits upright in the opposite direction");
    assert.ok(s.frames.at(-1)!.tangent.x>.99,"Separate connecting turn returns forward");
  }
});
