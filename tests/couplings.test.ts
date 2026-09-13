import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, Quaternion } from "three";
import { MiniTrack, MiniSection } from "../src/games/mini-track.ts";
import { isolatedHill } from "./mini-fixtures.ts";
import { MiniCarriages, outwardForce } from "../src/games/mini-carriages.ts";
import { MINI_PARCEL_DRAG, MINI_COACH_LINK_LIFT, MINI_COACH_HOP_DURATION, MINI_COACH_MAX_LIFT, parcelOffsets } from "../src/games/mini-config.ts";

test("parcel drag matches the analytical horizontal solution at different frame rates", () => {
  const run = (fps: number) => {
    const c = new MiniCarriages(new MiniTrack(42), 0);
    const parcel = { position: new Vector3(0, 100, 0), velocity: new Vector3(30, 0, 0),
      rotation: new Quaternion(), angularVelocity: new Vector3(2, 1, 0), age: 0, groundedFor: 0, bounces: 0 };
    c.parcels.push(parcel);
    for (let i = 0; i < fps; i++) c.update(1 / fps, 8, 0, false);
    assert.ok(Math.abs(parcel.position.x - Math.log1p(MINI_PARCEL_DRAG * 30) / MINI_PARCEL_DRAG) < 1e-8);
    assert.ok(Math.abs(parcel.velocity.x - 30 / (1 + MINI_PARCEL_DRAG * 30)) < 1e-8);
    assert.ok(parcel.position.x < 21, "Drag prevents the previous long forward flight");
    assert.ok(parcel.angularVelocity.length() < 1, "Tumbling loses energy too");
    return parcel;
  };
  assert.ok(run(30).position.distanceTo(run(144).position) < 1e-8);
});

test("a stack spills in staggered individual arcs without an extra launch boost", () => {
  const track = new MiniTrack(42), c = new MiniCarriages(track);
  const hill = track.sections.find(s => s.kind === "skyhill")!;
  const wagon = c.coaches[1];
  wagon.cargo = 4;
  wagon.dynamite = 0b1010;
  c.coaches.splice(2);
  const distance = hill.start + hill.length / 2 + wagon.offset;
  const releases: { time: number; slot: number; dynamite: boolean; spin: Vector3; slip: Vector3 }[] = [];
  for (let i = 0; i < 120 && wagon.cargo; i++) {
    c.update(1 / 120, distance, 20);
    const fresh = c.parcels.filter(p => p.age === 0);
    assert.ok(fresh.length <= 1, "An attached wagon releases one parcel at a time");
    for (const parcel of fresh) {
      assert.ok(parcel.velocity.length() <= wagon.velocity.length() * 1.040001);
      assert.ok(parcel.velocity.distanceTo(wagon.velocity) < 1.500001);
      releases.push({time:i/120,slot:wagon.cargo,dynamite:!!parcel.dynamite,spin:parcel.angularVelocity.clone(),slip:parcel.velocity.clone().sub(wagon.velocity)});
    }
  }
  assert.equal(releases.length, 4);
  assert.ok(releases.at(-1)!.time-releases[0].time > .15);
  assert.ok(releases.at(-1)!.time-releases[0].time < .4, "The spill remains a short burst");
  assert.deepEqual(releases.map(r=>r.slot), [3,2,1,0], "Upper slots peel away without moving the remaining boxes");
  assert.deepEqual(releases.map(r=>r.dynamite), [true,false,true,false]);
  assert.equal(parcelOffsets(30).length, 4, "Rendering and ejection share the four-parcel limit");
  const carrierVelocity = wagon.velocity;
  assert.ok(carrierVelocity.distanceTo(track.sample(distance - wagon.offset).tangent.clone()
    .multiplyScalar(20).add(wagon.relativeVelocity)) < 1e-8,
    "A wagon's visual lean must not redirect its cargo's inherited velocity");
  assert.ok(releases[0].spin.distanceTo(releases[1].spin) > .3, "Boxes tumble individually");
  assert.ok(releases[0].slip.distanceTo(releases[2].slip) > .2, "The arcs separate gently");
});

test("eight-box spills are repeatable, varied between wagons, and refill only once empty", () => {
  const run = (id: number) => {
    const track = new MiniTrack(42), c = new MiniCarriages(track);
    c.coaches.splice(2); const wagon = c.coaches[1]; wagon.id = id;
    c.setCargoRush(true); wagon.grace = 0;
    const hill = track.sections.find(s => s.kind === "skyhill")!;
    const at = hill.start + hill.length/2 + wagon.offset;
    const released: { time: number; velocity: number[]; spin: number[]; dynamite: boolean; drag: number }[] = [];
    for(let i=0;i<120 && wagon.cargo;i++) {
      c.update(1/120,at,20);
      for(const p of c.parcels.filter(p=>p.age===0)) released.push({time:i/120,velocity:p.velocity.toArray(),spin:p.angularVelocity.toArray(),dynamite:!!p.dynamite,drag:p.dragScale!});
      if(wagon.cargo) assert.equal(wagon.refill,0);
    }
    assert.equal(released.length,8); assert.ok(released.at(-1)!.time-released[0].time<.8);
    assert.ok(released.some(p=>p.dynamite)); assert.ok(released.some(p=>!p.dynamite));
    for(let i=0;i<110;i++) c.update(1/120,8,0);
    assert.equal(wagon.cargo,8); assert.equal(c.refills,1); assert.equal(wagon.spillDelay,undefined);
    return released;
  };
  assert.deepEqual(run(1),run(1));
  assert.notDeepEqual(run(1),run(3));
});

test("vertical crest forces still lift wheels when the rail is almost vertical", () => {
  const { hill } = isolatedHill("verticalhill");
  const frame = hill.frames.find(f => f.up.y > 0.05 && f.up.y < 0.4 && f.curvature.dot(f.up) < -0.1)!;
  assert.ok(frame);
  assert.ok(outwardForce(frame, 35) > 150);
  assert.equal(outwardForce({ ...frame, airborne: true }, 35), 0, "Intentional jumps do not overload retaining wheels");
});

test("moderate speeds trigger higher vertical hops without breaking a coupling", () => {
  for (const [kind, speed, minimumLift] of [["skyhill", 24, 0.25], ["skyhill", 32, 0.3], ["verticalhill", 28, 0.35], ["verticalhill", 32, 0.75]] as const) {
    const { track, hill } = isolatedHill(kind), c = new MiniCarriages(track);
    let lift = 0, airborne = 0;
    for (let step = 0; step < (hill.length + 65) / speed * 120; step++) {
      const distance = hill.start + step * speed / 120;
      c.update(1 / 120, distance, speed);
      const poses = c.poses(distance).filter(p => p.coach !== c.incoming);
      assert.ok(poses[0].frame.position.distanceTo(track.sample(distance).position) < 1e-8);
      for (let i = 1; i < poses.length; i++) {
        assert.ok(Math.abs(poses[i].coach.lift - poses[i - 1].coach.lift) <= MINI_COACH_LINK_LIFT + 1e-8);
        lift = Math.max(lift, poses[i].coach.lift);
      }
      airborne = Math.max(airborne, c.coaches.filter(coach => coach.derailed).length);
    }
    assert.ok(lift > minimumLift && lift <= MINI_COACH_MAX_LIFT && airborne >= 2, `${kind} at ${speed} m/s: a visible, controlled wave`);
    assert.equal(c.lost, 0, "Easier airtime does not weaken the tail coupling");
    assert.ok(c.coaches.every(coach => !coach.derailed && coach.displacement.length() < 1e-8));
  }
});

test("a vertical hill lifts the rear chain, detaches only its tail, and leaves the lead pinned", () => {
  for (const speed of [35, 60, 80]) {
    const { track, hill } = isolatedHill("verticalhill"), c = new MiniCarriages(track);
    let airborne = 0, lift = 0;
    for (let step = 0; step < (hill.length + 100) / speed * 120; step++) {
      const distance = hill.start + step * speed / 120;
      if (c.update(1 / 120, distance, speed)) assert.equal(c.flights.at(-1)!.colorIndex, 5);
      const poses = c.poses(distance).filter(p => p.coach !== c.incoming);
      assert.ok(poses[0].frame.position.distanceTo(track.sample(distance).position) < 1e-8);
      assert.equal(c.links(distance).length, c.coaches.length - 1, "Every remaining coach is connected to the engine");
      for (let i = 1; i < poses.length; i++) {
        assert.ok(Math.abs(poses[i].coach.lift - poses[i - 1].coach.lift) <= MINI_COACH_LINK_LIFT + 1e-8);
        lift = Math.max(lift, poses[i].coach.lift);
      }
      airborne = Math.max(airborne, c.coaches.filter(coach => coach.derailed).length);
      assert.ok(c.lost <= 1, "A second coupling must never break on this hill");
    }
    assert.equal(c.lost, 1);
    assert.ok(airborne >= 3 && lift > 0.25 && lift <= MINI_COACH_MAX_LIFT);
    assert.ok(c.coaches.every(coach => !coach.derailed), "The remaining chain settles back onto the track");
  }
});

test("the one detached coach inherits its motion and follows gravity without towing the rest", () => {
  const { track, hill } = isolatedHill("verticalhill"), c = new MiniCarriages(track);
  let distance = hill.start;
  for (let step = 0; step < 400 && !c.lost; step++) {
    distance = hill.start + step * 35 / 120;
    c.update(1 / 120, distance, 35);
  }
  assert.equal(c.flights.length, 1);
  assert.deepEqual(c.coaches.map(coach => coach.id), [0, 1, 2, 3, 4]);
  const cart = c.flights[0], initial = cart.position.clone(), velocity = cart.velocity.clone();
  for (let i = 0; i < 60; i++) c.update(1 / 120, distance, 0, false);
  const expected = initial.addScaledVector(velocity, 0.5); expected.y -= 0.5 * 9.81 * 0.25;
  assert.ok(cart.position.distanceTo(expected) < 1e-8);
  assert.ok(Math.abs(cart.velocity.y - velocity.y + 9.81 * 0.5) < 1e-8);
  assert.equal(c.links(distance).length, 4);
});

test("a later hill has its own tail breakaway allowance after replacement coaches arrive", () => {
  const { track, hill } = isolatedHill("verticalhill"), c = new MiniCarriages(track);
  const exit = hill.frames.at(-1)!.position;
  const next = new MiniSection(hill.id + 2, "verticalhill", hill.end + 160,
    exit.clone().add(new Vector3(160, 0, 0)), hill.width, hill.amplitude, hill.shift, hill.hand);
  track.sections.splice(2, 1,
    new MiniSection(hill.id + 1, "station", hill.end, exit.clone(), 160, 0, 0, 1),
    next,
    new MiniSection(hill.id + 3, "station", next.end, next.frames.at(-1)!.position.clone(), 200, 0, 0, 1));
  let breaksOnFirst = 0, breaksOnSecond = 0;
  for (let step = 0; step < (next.end + 100 - hill.start) / 35 * 120; step++) {
    const distance = hill.start + step * 35 / 120;
    if (c.update(1 / 120, distance, 35)) {
      if (distance < next.start) breaksOnFirst++;
      else breaksOnSecond++;
    }
    assert.ok(breaksOnFirst <= 1 && breaksOnSecond <= 1);
  }
  assert.equal(breaksOnFirst, 1);
  assert.equal(breaksOnSecond, 1);
  assert.ok(c.arrived > 0);
});

test("attached coaches only rise vertically and settle their vertical hop within 0.8 seconds", () => {
  for (const kind of ["skyhill", "verticalhill"] as const) for (const seed of [1, 12, 42, 93]) for (const speed of [32, 35, 80]) {
    const { track, hill } = isolatedHill(kind, seed), c = new MiniCarriages(track);
    const airborne = new Map<number, { first: number; last: number }>();
    for (let step = 0; step < (hill.length + 100) / speed * 120; step++) {
      const time = step / 120, distance = hill.start + time * speed;
      c.update(1 / 120, distance, speed);
      for (const { coach, frame } of c.poses(distance)) {
        const rail = track.sample(distance - coach.offset);
        assert.equal(frame.position.x, rail.position.x, "No forward or backward swing relative to the rail");
        assert.equal(frame.position.z, rail.position.z, "No sideways swing");
        assert.ok(frame.position.y >= rail.position.y && frame.position.y <= rail.position.y + MINI_COACH_MAX_LIFT + 1e-8);
        assert.ok(1 - Math.abs(frame.rotation.dot(rail.rotation)) < 1e-10, "No extra spin or roll beyond the track's own orientation");
        assert.equal(coach.relativeVelocity.x, 0);
        assert.equal(coach.relativeVelocity.z, 0);
        if (coach.lift > 1e-6) {
          const interval = airborne.get(coach.id) ?? { first: time, last: time };
          interval.last = time;
          airborne.set(coach.id, interval);
        }
      }
    }
    assert.ok(airborne.size > 0, `${kind}, seed ${seed}, speed ${speed}: retain visible airtime`);
    for (const interval of airborne.values()) assert.ok(interval.last - interval.first <= MINI_COACH_HOP_DURATION + 1e-8, "No hovering, repeated bouncing or lingering swing");
    assert.ok(c.coaches.every(coach => coach.lift === 0 && coach.liftVelocity === 0));
    assert.ok(c.lost <= 1);
  }
});

test("sustained crest overload cannot launch a coach repeatedly on the same hill", () => {
  const { track, hill } = isolatedHill(), c = new MiniCarriages(track);
  const distance = hill.start + hill.length / 2 + c.coaches[1].offset;
  const heights: number[] = [];
  for (let step = 0; step < 360; step++) {
    c.update(1 / 120, distance, 80);
    heights.push(c.coaches[1].lift);
  }
  assert.ok(Math.max(...heights) > 0.1);
  assert.ok(heights.slice(120).every(height => height === 0), "The same force must not keep re-triggering airtime");
});

test("coach lift starts just above parcel speed and grows towards the tail", () => {
  for (const kind of ["skyhill", "verticalhill"] as const) {
    let cargoSpeed=0, coachSpeed=0;
    let peaks: number[]=[];
    for(let speed=18; speed<=32 && !coachSpeed; speed++) {
      const {track,hill}=isolatedHill(kind), c=new MiniCarriages(track);
      const heights=Array(6).fill(0);
      for(let step=0; step<(hill.length+50)/speed*120; step++) {
        c.update(1/120,hill.start+step*speed/120,speed);
        c.coaches.slice(0,6).forEach((coach,i)=>heights[i]=Math.max(heights[i],coach.lift));
      }
      if(c.spilled && !cargoSpeed) cargoSpeed=speed;
      if(heights[5]>.5) {coachSpeed=speed; peaks=heights;}
    }
    assert.ok(cargoSpeed>0 && coachSpeed>cargoSpeed && coachSpeed<=cargoSpeed*1.1, `${kind}: coach threshold should be only slightly faster than cargo`);
    assert.equal(peaks[0],0);
    assert.ok(peaks[1]>.3 && peaks[1]<=MINI_COACH_LINK_LIFT);
    assert.ok(peaks[5]>2, "The rear wave is visible, not clipped down to a tiny tremble");
    for(let i=2;i<6;i++) assert.ok(peaks[i]>peaks[i-1]+.25, "Each later coach has more height available");
  }
});
