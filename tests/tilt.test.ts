import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Vector3 } from "three";
import { DOWNHILL_TILT, downhillTilt, tiltedGravity, tiltPoint } from "../src/games/mini-tilt.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { MiniTrack } from "../src/games/mini-track.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import { RidePowerups } from "../src/games/ride-powerups.ts";
import { MiniCameraRig, coasterFraming } from "../src/games/mini-camera.ts";

const near = (a: number, b: number, e = 1e-7) => assert.ok(Math.abs(a-b) < e, `${a} ≈ ${b}`);
const flat = (direction: number) => ({
  slope: () => 0, height: () => 20,
  sample: (s: number) => ({ position: new Vector3(s*direction,20,0), tangent: new Vector3(direction,0,0),
    up: new Vector3(0,1,0), right: new Vector3(0,0,1), rotation: new Quaternion(), curvature: new Vector3() }),
});

test("a tilted flat gains speed through gravity, switchbacks lose it, and mechanical energy is conserved", () => {
  for (const direction of [1,-1]) {
    const p = new MiniPhysics(flat(direction), { initialDistance: 0, initialSpeed: 20, drag: 0, rolling: 0, worldTilt: DOWNHILL_TILT });
    const energy = p.energy;
    for (let i=0; i<120; i++) p.update(1/120);
    near(p.velocity, 20 + direction*9.81*Math.sin(DOWNHILL_TILT));
    near(p.energy, energy, 1e-6);
    near(p.distance, 20 + .5*direction*9.81*Math.sin(DOWNHILL_TILT));
  }
});

test("downhill drift eases both ends, never grants an impulse, and restores all gravity components", () => {
  const track = new MiniTrack(42), p = new MiniPhysics(track), carts = new MiniCarriages(track), power = new RidePowerups(42,"normal");
  power.activate("tilt", p, carts);
  near(p.options.worldTilt, 0);
  const speed = p.velocity;
  power.update(.7, track, p, carts); near(p.options.worldTilt, DOWNHILL_TILT/2);
  power.update(.7, track, p, carts); near(p.options.worldTilt, DOWNHILL_TILT);
  near(p.velocity, speed); near(carts.gravityX, 9.81*Math.sin(DOWNHILL_TILT));
  power.update(17.9, track, p, carts); near(p.options.worldTilt, DOWNHILL_TILT/2);
  power.update(.7, track, p, carts); near(p.options.worldTilt, 0); near(carts.gravity,9.81); near(carts.gravityX,0);
  assert.equal(power.active, undefined);
  assert.ok(downhillTilt(.01,19.99) < .00001);
  assert.ok(downhillTilt(19.99,.01) < .00001);
});

test("rendered loose bodies fall world-down on a tilted board, with no sideways gravity", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track);
  const gravity = tiltedGravity(9.81,DOWNHILL_TILT); c.gravity=gravity.down; c.gravityX=gravity.x;
  const start = new Vector3(0,30,0), cart = { position: start.clone(), velocity: new Vector3(), rotation: new Quaternion(), angularVelocity: new Vector3(), age:0,groundedFor:0,colorIndex:1,cargo:0 };
  c.flights.push(cart);
  c.update(.25,track.startDistance,0,false);
  const visual = tiltPoint(cart.position,start,DOWNHILL_TILT);
  near(visual.x,0); near(visual.y,30-.5*9.81*.25**2); near(visual.z,0);
});

test("downhill water jumps retain a finite landing arc", () => {
  const track = new MiniTrack(42), jump = track.sections.find(s=>s.kind==="jump")!;
  const p = new MiniPhysics(track,{initialDistance:jump.takeoff-.01,initialSpeed:30,worldTilt:DOWNHILL_TILT});
  for (let i=0;i<900 && !p.jumps && !p.crashed;i++) { track.ensure(p.distance); p.update(1/120); }
  assert.equal(p.crashed,false); assert.equal(p.jumps,1); assert.ok(p.lastJumpDistance<170);
});

test("moving the render origin cannot change the world tilt or move the train on screen", () => {
  const p = new Vector3(249999,22,3), pivot = new Vector3(250010,19,1);
  const world = tiltPoint(p,pivot,DOWNHILL_TILT);
  for (const anchor of [249975,250000,250025]) {
    const offset = new Vector3(anchor,0,0);
    const local = tiltPoint(p.clone().sub(offset),pivot.clone().sub(offset),DOWNHILL_TILT).add(offset);
    assert.ok(local.distanceTo(world)<1e-8);
  }
});

test("weather, splash plumes, TNT fragments and old floating cargo cannot pull the camera away", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track), lead = track.sample(track.startDistance).position;
  const parcel = { position: lead.clone().add(new Vector3(1,3,0)), velocity: new Vector3(),rotation:new Quaternion(),angularVelocity:new Vector3(),age:0,groundedFor:0,bounces:0 };
  c.parcels.push(parcel); assert.ok(c.cameraSubjects(lead).includes(parcel.position));
  parcel.age=2; assert.equal(c.cameraSubjects(lead).length,0);
  parcel.age=0; parcel.position.y+=500; assert.equal(c.cameraSubjects(lead).length,0);
  for (const flags of [{water:true},{dynamite:true}]) c.explosions.push({ ...flags, position:lead.clone(),age:0,colorIndex:0,particles:[{position:lead.clone().add(new Vector3(1000,1000,0)),velocity:new Vector3(),size:1}] });
  assert.equal(c.cameraSubjects(lead).length,0);
});

test("optional airborne action gets a small smooth zoom while the train stays central on desktop and phone", () => {
  for (const aspect of [.48,1,1.8,3]) {
    const base = new Vector3(100,20,0), rig = new MiniCameraRig();
    rig.update(base,40,aspect,[base],1/60);
    const before=rig.height;
    const cargo=[new Vector3(8000,8000,8000),new Vector3(-8000,-8000,-8000)];
    rig.update(base,40,aspect,[base],1/60,cargo);
    assert.ok(rig.height-before < 1,"No immediate debris zoom");
    for(let i=0;i<240;i++) rig.update(base,40,aspect,[base],1/60,cargo);
    assert.ok(rig.height<=40*1.3+.001);
    assert.ok(rig.focus.distanceTo(base)<.001);
    for(let i=0;i<240;i++) rig.update(base,40,aspect,[base],1/60);
    near(rig.height,40,.002);
  }
});

test("Sky lift altitude does not enlarge a section's normal framing", () => {
  for(const aspect of [.48,1.8]) {
    const normal = coasterFraming(new Vector3(10,15,0),26,aspect,false);
    const lifted = coasterFraming(new Vector3(10,315,0),326,aspect,false,false,aspect<1.1,300);
    near(normal.height,lifted.height); near(lifted.focus.y-normal.focus.y,300);
  }
});
