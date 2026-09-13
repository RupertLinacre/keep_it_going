import * as THREE from "three";
import { isHump, type MiniTrack } from "./mini-track";
import { seededRandom, type RailFrame } from "./mini-rail";
import {
  MINI_CART_SPACING, MINI_MAX_FLYING_CARTS, MINI_MAX_FLYING_PARCELS,
  MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES, MINI_VISIBLE_CARTS, MINI_MAX_CARTS,
  parcelOffsets, isParcelWagon, MINI_STARTING_CARTS, MINI_PARCEL_RESPAWN,
  MINI_PARCEL_DRAG, MINI_PARCEL_RETENTION, MINI_COACH_LINK_LIFT, MINI_COUPLING_STRENGTH,
  MINI_COUPLING_LOAD_THRESHOLD, MINI_COACH_RETENTION, MINI_COACH_MAX_LIFT, MINI_COACH_HOP_DURATION, MINI_PARCELS_PER_WAGON,
  MINI_POWER_PARCELS,
} from "./mini-config";

interface FlyingBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Quaternion;
  angularVelocity: THREE.Vector3;
  age: number;
  groundedFor: number;
}
export interface FlyingCart extends FlyingBody {
  colorIndex: number;
  cargo: number;
}
export interface FlyingParcel extends FlyingBody {
  bounces: number;
  dynamite?: boolean;
  fuse?: number;
}
export interface Explosion {
  water?: boolean;
  flood?: { rotation: THREE.Quaternion; strength: number };
  dynamite?: boolean;
  position: THREE.Vector3;
  age: number;
  colorIndex: number;
  particles: { position: THREE.Vector3; velocity: THREE.Vector3; size: number }[];
}

function fly(body: FlyingBody, dt: number, gravity: number, drag = 0) {
  body.age += dt;
  if (drag) {
    // Exact quadratic-drag drift between gravity half-kicks. Small substeps also
    // keep parcel motion consistent when effects continue after game over.
    for (let remaining = dt; remaining > 1e-10;) {
      const h = Math.min(remaining, 1 / 120);
      body.velocity.y -= gravity * h / 2;
      const resistance = drag * body.velocity.length();
      const travel = resistance > 0 ? Math.log1p(resistance * h) / resistance : h;
      body.position.addScaledVector(body.velocity, travel);
      body.velocity.multiplyScalar(1 / (1 + resistance * h));
      body.velocity.y -= gravity * h / 2;
      remaining -= h;
    }
    body.angularVelocity.multiplyScalar(Math.exp(-1.2 * dt));
  } else {
    body.position.addScaledVector(body.velocity, dt);
    body.position.y -= 0.5 * gravity * dt * dt;
    body.velocity.y -= gravity * dt;
  }
  const spin = body.angularVelocity.length();
  if (spin > 0)
    body.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(
      body.angularVelocity.clone().divideScalar(spin), spin * dt,
    ));
}

export function outwardForce(frame: RailFrame, speed: number, gravity = 9.81) {
  // Inverted crests press the load into the wagon. Retaining wheels and cargo
  // friction add deliberately forgiving adhesion beyond the weightless threshold.
  return !frame.airborne
    ? Math.max(0, -gravity * frame.up.y - speed ** 2 * frame.curvature.dot(frame.up)) : 0;
}
export interface Coach {
  id: number;
  offset: number;
  lift: number;
  previousLift: number;
  liftVelocity: number;
  cargo: number;
  dynamite?: number;
  cargoAge: number;
  nextCargo: number;
  refill: number;
  grace: number;
  parcelStrain: number;
  displacement: THREE.Vector3;
  relativeVelocity: THREE.Vector3;
  couplingLoad: number;
  couplingStrain: number;
  stress: number;
  velocity: THREE.Vector3;
  position: THREE.Vector3;
  derailed: boolean;
  airTime: number;
  wheelStrain: number;
  liftPeak: number;
  hillId?: number;
}

/** Fixed-step carriage, cargo and impact physics; rendering consumes this state. */
export class MiniCarriages {
  lost = 0;
  spilled = 0;
  impacts = 0;
  floodEntries = 0;
  private inFlood = false;
  private wakeTravel = 0;
  private sprayCount = 0;
  readonly flights: FlyingCart[] = [];
  readonly parcels: FlyingParcel[] = [];
  readonly explosions: Explosion[] = [];
  readonly coaches: Coach[] = [];
  incoming?: Coach;
  arrived = 0;
  refills = 0;
  private nextId = MINI_STARTING_CARTS;
  private arrivalTravel = 0;
  private readonly detachedHills = new Set<number>();
  cargoRush = false;
  sample: (distance: number) => RailFrame;

  constructor(readonly track: MiniTrack, public gravity = 9.81) {
    this.sample = distance => track.sample(distance);
    for (let i = 0; i < MINI_STARTING_CARTS; i++) this.coaches.push(this.newCoach(i, i * MINI_CART_SPACING));
  }
  private newCoach(id: number, offset: number): Coach {
    return { id, offset, lift: 0, previousLift: 0, liftVelocity: 0, cargo: isParcelWagon(id) ? this.cargoRush ? MINI_POWER_PARCELS : 2 : 0,
      dynamite: this.cargoRush && isParcelWagon(id) ? this.cargoMask(id) : 0,
      cargoAge: 1, nextCargo: 3, refill: 0, grace: 0, parcelStrain: 0,
      displacement: new THREE.Vector3(), relativeVelocity: new THREE.Vector3(), couplingLoad: 0, couplingStrain: 0, stress: 0, velocity: new THREE.Vector3(),
      position: new THREE.Vector3(), derailed: false, airTime: MINI_COACH_HOP_DURATION, wheelStrain: 0, liftPeak: 0 };
  }
  private cargoMask(id: number) {
    let mask = 0;
    for (let i = 0; i < MINI_POWER_PARCELS; i++) if ((this.track.seed + id + i + this.refills) % 3 === 0) mask |= 1 << i;
    return mask;
  }
  setCargoRush(enabled: boolean) {
    if (enabled === this.cargoRush) return;
    this.cargoRush = enabled;
    for (const coach of [...this.coaches, ...(this.incoming ? [this.incoming] : [])]) {
      if (!isParcelWagon(coach.id)) continue;
      coach.cargo = enabled ? MINI_POWER_PARCELS : Math.min(coach.cargo, MINI_PARCELS_PER_WAGON);
      coach.dynamite = enabled ? this.cargoMask(coach.id) : (coach.dynamite ?? 0) & 15;
      if (enabled) { coach.refill = 0; coach.cargoAge = 0; coach.grace = .8; }
    }
  }
  frame(coach: Coach, distance: number, alpha = 1) {
    const frame = this.sample(this.track.followerDistance(distance, coach.offset));
    // Tethered coaches follow the same rail position and orientation. Their only
    // extra degree of freedom is height in world space, never yaw or lateral drift.
    const lift = coach.previousLift + (coach.lift - coach.previousLift) * alpha;
    frame.position.y += lift;
    if (lift > 0) frame.airborne = true;
    return frame;
  }
  /** Coupler endpoints are shared by the 3D view and the side-view fallback. */
  links(distance: number, sampled = this.poses(distance)) {
    const links: { start: THREE.Vector3; end: THREE.Vector3; stress: number }[] = [];
    const end = (position: THREE.Vector3, rotation: THREE.Quaternion, front: boolean) =>
      new THREE.Vector3(0, 0.3, front ? -1.02 : 1.02).applyQuaternion(rotation).add(position);
    const poses = sampled.filter(p => p.coach !== this.incoming);
    for (let i = 1; i < poses.length; i++) links.push({
      stress: poses[i].coach.stress,
      start: end(poses[i - 1].frame.position, poses[i - 1].frame.rotation, false),
      end: end(poses[i].frame.position, poses[i].frame.rotation, true),
    });
    return links;
  }
  poses(distance: number, alpha = 1) {
    return [...this.coaches.slice(0, MINI_VISIBLE_CARTS), ...(this.incoming ? [this.incoming] : [])]
      .filter(c => this.track.followerDistance(distance, c.offset) >= this.track.sections[0].start)
      .map(coach => ({ coach, frame: this.frame(coach, distance, alpha) }));
  }
  cameraSubjects() {
    return [
      ...this.flights.map(cart => cart.position),
      ...this.parcels.filter(parcel => !parcel.bounces && !parcel.groundedFor).map(parcel => parcel.position),
      ...this.explosions.filter(explosion => explosion.age < 0.65)
        .flatMap(explosion => [explosion.position, ...explosion.particles.map(particle => particle.position)]),
    ];
  }
  splash(frame: RailFrame, strength = 1) {
    this.explode({ position: frame.position.clone(), velocity: new THREE.Vector3(),
      rotation: frame.rotation, angularVelocity: new THREE.Vector3(), age: 0, groundedFor: 0, colorIndex: 0, cargo: 0 });
    this.explosions.at(-1)!.water = true;
    for (const p of this.explosions.at(-1)!.particles) { p.velocity.multiplyScalar(strength); p.size *= Math.sqrt(strength); }
  }

  private floodSplash(frame: RailFrame, level: number, speed: number, entry: boolean) {
    const random = seededRandom(this.track.seed ^ (++this.sprayCount * 104729));
    const position = frame.position.clone(); position.y = level;
    const strength = THREE.MathUtils.clamp(speed / 28, .55, 1.6) * (entry ? 1 : .55);
    const right = frame.right.clone().setY(0).normalize();
    const forward = frame.tangent.clone().setY(0).normalize();
    const particles = Array.from({ length: MINI_EXPLOSION_PARTICLES * (entry ? 2 : 1) }, (_, i) => {
      const side = i % 2 ? -1 : 1;
      return {
        position: position.clone().addScaledVector(right, side * .65),
        velocity: right.clone().multiplyScalar(side * (4 + random()*8)*strength)
          .addScaledVector(forward, speed*(.15 + random()*.2)).setY((7 + random()*11)*strength),
        size: (.12 + random()*.23) * (entry ? 1.3 : 1),
      };
    });
    if (this.explosions.length >= MINI_MAX_EXPLOSIONS) this.explosions.shift();
    this.explosions.push({ position, particles, age: 0, colorIndex: 0, water: true,
      flood: { rotation: frame.rotation.clone(), strength } });
  }

  private explode(cart: FlyingCart) {
    this.impacts++;
    const random = seededRandom(this.track.seed ^ (this.impacts * 7919));
    const position = cart.position.clone();
    const particles = Array.from({ length: MINI_EXPLOSION_PARTICLES }, (_, i) => {
      const angle = i * 2.39996;
      const speed = 3 + random() * 9;
      return {
        position: position.clone(),
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 4 + random() * 11, Math.sin(angle) * speed)
          .addScaledVector(cart.velocity, 0.08),
        size: 0.14 + random() * 0.3,
      };
    });
    if (this.explosions.length >= MINI_MAX_EXPLOSIONS) this.explosions.shift();
    this.explosions.push({ position, particles, age: 0, colorIndex: cart.colorIndex });
  }

  private spill(coach: Coach, frame: RailFrame, speed: number) {
    const count = coach.cargo;
    const dynamite = coach.dynamite ?? 0;
    coach.cargo = 0;
    coach.dynamite = 0;
    coach.refill = this.cargoRush ? .8 : MINI_PARCEL_RESPAWN;
    coach.parcelStrain = 0;
    const angularVelocity = frame.tangent.clone().cross(frame.curvature).multiplyScalar(speed).clampLength(0, 3);
    const carrierVelocity = coach.velocity;
    for (const [i, offset] of parcelOffsets(count, MINI_POWER_PARCELS).entries()) {
      const local = new THREE.Vector3(offset.x, offset.y, offset.z).applyQuaternion(frame.rotation);
      // Boxes can slip against one another: a taller stack is not a rigid lever.
      const contact = new THREE.Vector3(offset.x, Math.min(offset.y, 1), offset.z).applyQuaternion(frame.rotation);
      const surfaceVelocity = angularVelocity.clone().cross(contact).clampLength(0, Math.min(1.5, speed * 0.04));
      const velocity = carrierVelocity.clone().add(surfaceVelocity).clampLength(0, carrierVelocity.length() * 1.04);
      if (this.parcels.length >= MINI_MAX_FLYING_PARCELS) this.parcels.shift();
      this.parcels.push({
        position: frame.position.clone().add(local),
        velocity,
        rotation: frame.rotation.clone(),
        angularVelocity: angularVelocity.clone().add(new THREE.Vector3(0.7, 0.4, -0.6)),
        age: 0, groundedFor: 0, bounces: 0,
        dynamite: !!(dynamite & (1 << i)), fuse: 1.6 + (i % 3) * .3,
      });
      this.spilled++;
    }
  }

  update(dt: number, distance: number, speed: number, running = true) {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.age += dt;
      if (explosion.age > 2) { this.explosions.splice(i, 1); continue; }
      for (const particle of explosion.particles) {
        particle.position.addScaledVector(particle.velocity, dt);
        particle.position.y -= 0.5 * this.gravity * dt * dt;
        particle.velocity.y -= this.gravity * dt;
        if (explosion.flood && particle.velocity.y < 0 && particle.position.y < explosion.position.y) {
          particle.position.y = explosion.position.y;
          particle.velocity.set(0, 0, 0); particle.size *= Math.exp(-dt * 14);
        } else if (particle.position.y < particle.size + 0.075) {
          particle.position.y = particle.size + 0.075;
          particle.velocity.y = Math.abs(particle.velocity.y) * 0.2;
          particle.velocity.x *= 0.8;
          particle.velocity.z *= 0.8;
        }
      }
    }
    for (const cart of this.flights) fly(cart, dt, this.gravity);
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const cart = this.flights[i];
      if (cart.age > 45) { this.flights.splice(i, 1); continue; }
      if (cart.position.y < 2 && cart.velocity.y < 0) {
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cart.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cart.rotation);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(cart.rotation);
        const open = isParcelWagon(cart.colorIndex);
        const centerY = open ? (cart.cargo ? 0.66 : 0.46) : 0.765;
        const halfHeight = centerY + 0.1;
        const bottom = centerY * up.y - halfHeight * Math.abs(up.y)
          - 0.725 * Math.abs(right.y) - 1.05 * Math.abs(forward.y);
        if (cart.position.y + bottom <= 0.075) {
          cart.position.y = 0.075 - bottom;
          cart.groundedFor = Math.max(dt, Number.EPSILON);
          this.explode(cart);
          this.flights.splice(i, 1);
        }
      }
    }
    for (let i = this.parcels.length - 1; i >= 0; i--) {
      const parcel = this.parcels[i];
      if (parcel.age > 35) { this.parcels.splice(i, 1); continue; }
      if (parcel.groundedFor > 0) {
        parcel.groundedFor += dt;
        if (parcel.groundedFor > 2) this.parcels.splice(i, 1);
        continue;
      }
      fly(parcel, dt, this.gravity, MINI_PARCEL_DRAG);
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(parcel.rotation).elements;
      const floor = 0.075 + 0.34 * (Math.abs(matrix[1]) + Math.abs(matrix[5]) + Math.abs(matrix[9]));
      if (parcel.dynamite && (parcel.age >= (parcel.fuse ?? 2) || parcel.position.y < floor)) {
        this.explode({ ...parcel, colorIndex: 4, cargo: 0 });
        const explosion = this.explosions.at(-1)!;
        explosion.dynamite = true;
        for (const p of explosion.particles) { p.velocity.multiplyScalar(1.6); p.size *= 1.3; }
        this.parcels.splice(i, 1); continue;
      }
      if (parcel.position.y < floor && parcel.velocity.y < 0) {
        parcel.position.y = floor;
        if (parcel.bounces++ < 2 && Math.abs(parcel.velocity.y) > 1) {
          parcel.velocity.y *= -0.25;
          parcel.velocity.x *= 0.55;
          parcel.velocity.z *= 0.55;
        } else {
          parcel.velocity.set(0, 0, 0);
          parcel.groundedFor = Math.max(dt, Number.EPSILON);
        }
      }
    }

    if (!running) return false;
    // Each arriving coach is a real, visible rail traveller, closing the gap faster
    // at high speed. Distance travelled also brings the next one along sooner.
    if (this.coaches.length >= MINI_MAX_CARTS) { this.incoming = undefined; this.arrivalTravel = 0; }
    else this.arrivalTravel += speed * dt;
    if (this.coaches.length < MINI_MAX_CARTS && !this.incoming && this.arrivalTravel >= 140) {
      this.arrivalTravel = 0;
      this.incoming = this.newCoach(this.nextId++, this.coaches.at(-1)!.offset + 34);
    }
    if (this.incoming) {
      const target = this.coaches.at(-1)!.offset + MINI_CART_SPACING;
      const gap = this.incoming.offset - target;
      // Brake relative to the train before the drawbars meet, without overshooting.
      const closing = Math.min(2 + speed * 0.7, gap * 5);
      this.incoming.offset = Math.max(target, this.incoming.offset - closing * dt);
      if (this.incoming.offset <= target + 0.025 && !this.coaches.at(-1)!.derailed) {
        this.incoming.offset = target;
        this.coaches.push(this.incoming);
        this.incoming = undefined;
        this.arrived++;
      }
    }
    const frames = this.coaches.map(coach => this.sample(this.track.followerDistance(distance, coach.offset)));
    const wet = !frames[0].airborne && this.track.waterDepth(distance) > .035;
    const tailAt = this.track.followerDistance(distance, this.coaches.at(-1)!.offset);
    const trailing = !frames.at(-1)!.airborne && this.track.waterDepth(tailAt) > .035;
    if (wet && !this.inFlood) this.floodEntries++;
    if ((wet || trailing) && speed > 1) {
      this.wakeTravel += speed * dt;
      if ((wet && !this.inFlood) || this.wakeTravel >= 6) {
        const at = wet ? distance : tailAt;
        this.floodSplash(wet ? frames[0] : frames.at(-1)!, this.track.sectionAt(at).waterLevel, speed, wet && !this.inFlood);
        this.wakeTravel = 0;
      }
    } else this.wakeTravel = 6;
    this.inFlood = wet;
    const outward = frames.map((frame, index) => {
      const section = this.track.sectionAt(this.track.followerDistance(distance, this.coaches[index].offset));
      return isHump(section.kind) && section.kind !== "invertedhill"
        ? outwardForce(frame, speed, this.gravity) : 0;
    });
    const shed = this.updateCouplings(dt, frames, outward, distance, speed);
    for (const coach of this.coaches.slice(1)) {
      coach.cargoAge += dt;
      coach.grace = Math.max(0, coach.grace - dt);
      if (coach.refill > 0) {
        coach.refill -= dt;
        if (coach.refill <= 0) {
          coach.cargo = this.cargoRush ? MINI_POWER_PARCELS : Math.min(coach.nextCargo, MINI_PARCELS_PER_WAGON);
          coach.dynamite = this.cargoRush ? this.cargoMask(coach.id) : 0;
          coach.nextCargo = Math.min(coach.cargo + 1, MINI_PARCELS_PER_WAGON);
          coach.cargoAge = 0;
          coach.grace = 0.75;
          this.refills++;
        }
      }
      if (this.track.followerDistance(distance, coach.offset) < this.track.sections[0].start) continue;
      const index = this.coaches.indexOf(coach);
      if (coach.cargo && coach.grace === 0) {
        const load = this.cargoRush ? outward[index] * 1.5 : outward[index];
        coach.parcelStrain = Math.max(0, coach.parcelStrain + (load > MINI_PARCEL_RETENTION ? load / MINI_PARCEL_RETENTION - 1 : -4) * dt);
        // Upside-down gravity visibly lifts loose cargo; the leading coach stays tethered.
        if (this.gravity < 0 && frames[index].up.y > .25) coach.parcelStrain += dt * 6;
        if (coach.parcelStrain > 0.035) this.spill(coach, this.frame(coach, distance), speed);
      }
    }
    return shed;
  }

  private updateCouplings(dt: number, frames: RailFrame[], outward: number[], distance: number, speed: number) {
    const coaches = this.coaches;
    const previous = coaches.map(coach => coach.lift);
    for (const coach of coaches) coach.previousLift = coach.lift;
    for (let i = 0; i < coaches.length; i++) {
      const coach = coaches[i], frame = frames[i];
      const section = this.track.sectionAt(this.track.followerDistance(distance, coach.offset));
      const retained = this.track.followerDistance(distance, coach.offset) >= this.track.sections[0].start;
      coach.couplingLoad = Math.max(0, outward[i] - MINI_COUPLING_LOAD_THRESHOLD);
      coach.wheelStrain = Math.max(0, coach.wheelStrain + (outward[i] / MINI_COACH_RETENTION - 1) * dt);
      coach.airTime = Math.min(MINI_COACH_HOP_DURATION, coach.airTime + dt);
      if (i > 0 && retained && coach.airTime >= MINI_COACH_HOP_DURATION
        && outward[i] > MINI_COACH_RETENTION && coach.wheelStrain > 0.035 && coach.hillId !== section.id) {
        coach.hillId = section.id;
        coach.airTime = 0;
        coach.couplingStrain = 0;
        // A light coach near the engine has little freedom; each successive
        // drawbar permits a larger arc. Excess speed strengthens the same arc.
        const strength = Math.min(1.6, 0.85 + (outward[i] / MINI_COACH_RETENTION - 1) * 0.7);
        coach.liftPeak = Math.min(MINI_COACH_MAX_LIFT, i * 0.6 * strength);
      }
      const t = coach.airTime / MINI_COACH_HOP_DURATION;
      // Quick momentum-driven takeoff, followed by a longer, smooth pull-down.
      // This normalized arc peaks at one third and lands with zero velocity.
      coach.lift = i > 0 && retained ? coach.liftPeak * 6.75 * t * (1 - t) ** 2 : 0;
      coach.couplingStrain = Math.max(0, coach.couplingStrain
        + (coach.couplingLoad > 0 ? coach.couplingLoad / MINI_COUPLING_STRENGTH : -1) * dt);
      coach.stress = Math.max(Math.min(1, coach.couplingStrain / 0.08), coach.stress * Math.exp(-6 * dt));
      coach.position.copy(frame.position);
    }
    // Constrain lift relative to each coach's own rail position, not the chord
    // between two positions on a steep hill. A rigid world-space length limit
    // erases the wave on descents. These one-dimensional tethers only lower
    // excess lift; they cannot swing sideways or pull the lead off its rails.
    coaches[0].lift = 0;
    for (let i = 1; i < coaches.length; i++)
      coaches[i].lift = Math.min(coaches[i].lift, coaches[i - 1].lift + MINI_COACH_LINK_LIFT);
    for (let i = coaches.length - 2; i > 0; i--)
      coaches[i].lift = Math.min(coaches[i].lift, coaches[i + 1].lift + MINI_COACH_LINK_LIFT);
    for (let i = 0; i < coaches.length; i++) {
      const coach = coaches[i];
      coach.derailed = coach.lift > 1e-6;
      coach.liftVelocity = (coach.lift - previous[i]) / dt;
      coach.displacement.set(0, coach.lift, 0);
      coach.relativeVelocity.set(0, coach.liftVelocity, 0);
      coach.position.y += coach.lift;
      coach.velocity.copy(frames[i].tangent).multiplyScalar(speed).add(coach.relativeVelocity);
    }
    for (const id of this.detachedHills) if (id < this.track.sections[0].id
      && !coaches.some(coach => coach.hillId === id && coach.airTime < MINI_COACH_HOP_DURATION)) this.detachedHills.delete(id);
    const tail = coaches.at(-1)!;
    // Each physical hill can shed only its tail coach. The rest remain tethered.
    if (coaches.length < 2 || tail.lift < 0.12 || tail.airTime < 0.08
      || tail.couplingStrain < 0.08 || tail.hillId === undefined || this.detachedHills.has(tail.hillId)) return false;
    this.detachedHills.add(tail.hillId);
    const frame = this.frame(tail, distance);
    if (tail.cargo) this.spill(tail, frame, speed);
    if (this.flights.length >= MINI_MAX_FLYING_CARTS) this.flights.shift();
    this.flights.push({ position: frame.position, rotation: frame.rotation,
      velocity: tail.velocity.clone(),
      angularVelocity: frames.at(-1)!.tangent.clone().cross(frames.at(-1)!.curvature).multiplyScalar(speed).clampLength(0, 0.6),
      colorIndex: tail.id, cargo: 0, age: 0, groundedFor: 0,
    });
    this.lost++;
    coaches.pop();
    return true;
  }
}
