import * as THREE from "three";
import { isHump, type MiniTrack } from "./mini-track";
import { seededRandom, type RailFrame } from "./mini-rail";
import {
  MINI_CART_SPACING, MINI_MAX_FLYING_CARTS, MINI_MAX_FLYING_PARCELS,
  MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES, MINI_VISIBLE_CARTS,
  parcelOffsets, isParcelWagon, MINI_STARTING_CARTS, MINI_PARCEL_RESPAWN,
  MINI_PARCEL_DRAG, MINI_COUPLING_SLACK, MINI_COUPLING_STRENGTH,
  MINI_ENGINE_COUPLING_STRENGTH, MINI_PARCELS_PER_WAGON,
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
  coupledTo?: number;
  linkLength?: number;
}
export interface FlyingParcel extends FlyingBody {
  bounces: number;
}
export interface Explosion {
  water?: boolean;
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
  return frame.up.y > 0.65 && !frame.airborne
    ? Math.max(0, -gravity * frame.up.y - speed ** 2 * frame.curvature.dot(frame.up)) : 0;
}
export interface Coach {
  id: number;
  offset: number;
  lift: number;
  liftVelocity: number;
  cargo: number;
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
}

/** Fixed-step carriage, cargo and impact physics; rendering consumes this state. */
export class MiniCarriages {
  lost = 0;
  spilled = 0;
  impacts = 0;
  readonly flights: FlyingCart[] = [];
  readonly parcels: FlyingParcel[] = [];
  readonly explosions: Explosion[] = [];
  readonly coaches: Coach[] = [];
  incoming?: Coach;
  arrived = 0;
  refills = 0;
  private nextId = MINI_STARTING_CARTS;
  private arrivalTravel = 0;
  sample: (distance: number) => RailFrame;

  constructor(readonly track: MiniTrack, readonly gravity = 9.81) {
    this.sample = distance => track.sample(distance);
    for (let i = 0; i < MINI_STARTING_CARTS; i++) this.coaches.push(this.newCoach(i, i * MINI_CART_SPACING));
  }
  private newCoach(id: number, offset: number): Coach {
    return { id, offset, lift: 0, liftVelocity: 0, cargo: isParcelWagon(id) ? 2 : 0,
      cargoAge: 1, nextCargo: 3, refill: 0, grace: 0, parcelStrain: 0,
      displacement: new THREE.Vector3(), relativeVelocity: new THREE.Vector3(), couplingLoad: 0, couplingStrain: 0, stress: 0, velocity: new THREE.Vector3() };
  }
  frame(coach: Coach, distance: number) {
    const frame = this.sample(distance - coach.offset);
    frame.position.add(coach.displacement);
    const index = this.coaches.indexOf(coach);
    if (index > 0) {
      const ahead = this.coaches[index - 1], behind = this.coaches[index + 1] ?? coach;
      frame.tangent.addScaledVector(ahead.displacement.clone().sub(behind.displacement),
        1 / (MINI_CART_SPACING * (behind === coach ? 1 : 2))).normalize();
      frame.right.copy(frame.tangent).cross(frame.up).normalize();
      frame.up.copy(frame.right).cross(frame.tangent).normalize();
      frame.rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent.clone().negate()));
    }
    return frame;
  }
  /** Coupler endpoints are shared by the 3D view and the side-view fallback. */
  links(distance: number) {
    const links: { start: THREE.Vector3; end: THREE.Vector3; stress: number }[] = [];
    const end = (position: THREE.Vector3, rotation: THREE.Quaternion, front: boolean) =>
      new THREE.Vector3(0, 0.3, front ? -1.02 : 1.02).applyQuaternion(rotation).add(position);
    const poses = this.poses(distance).filter(p => p.coach !== this.incoming);
    for (let i = 1; i < poses.length; i++) links.push({
      stress: poses[i].coach.stress,
      start: end(poses[i - 1].frame.position, poses[i - 1].frame.rotation, false),
      end: end(poses[i].frame.position, poses[i].frame.rotation, true),
    });
    for (const cart of this.flights) {
      const ahead = this.flights.find(c => c.colorIndex === cart.coupledTo);
      if (ahead) links.push({ stress: 0, start: end(ahead.position, ahead.rotation, false), end: end(cart.position, cart.rotation, true) });
    }
    return links;
  }
  poses(distance: number) {
    return [...this.coaches.slice(0, MINI_VISIBLE_CARTS), ...(this.incoming ? [this.incoming] : [])]
      .filter(c => distance - c.offset >= this.track.sections[0].start)
      .map(coach => ({ coach, frame: this.frame(coach, distance) }));
  }
  cameraSubjects() {
    return [
      ...this.flights.map(cart => cart.position),
      ...this.parcels.filter(parcel => !parcel.bounces && !parcel.groundedFor).map(parcel => parcel.position),
      ...this.explosions.filter(explosion => explosion.age < 0.65)
        .flatMap(explosion => [explosion.position, ...explosion.particles.map(particle => particle.position)]),
    ];
  }
  splash(frame: RailFrame) {
    this.explode({ position: frame.position.clone(), velocity: new THREE.Vector3(),
      rotation: frame.rotation, angularVelocity: new THREE.Vector3(), age: 0, groundedFor: 0, colorIndex: 0, cargo: 0 });
    this.explosions.at(-1)!.water = true;
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
    coach.cargo = 0;
    coach.refill = MINI_PARCEL_RESPAWN;
    coach.parcelStrain = 0;
    const angularVelocity = frame.tangent.clone().cross(frame.curvature).multiplyScalar(speed).clampLength(0, 3);
    const carrierVelocity = coach.velocity;
    for (const offset of parcelOffsets(count)) {
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
        if (particle.position.y < particle.size + 0.075) {
          particle.position.y = particle.size + 0.075;
          particle.velocity.y = Math.abs(particle.velocity.y) * 0.2;
          particle.velocity.x *= 0.8;
          particle.velocity.z *= 0.8;
        }
      }
    }
    for (const cart of this.flights) fly(cart, dt, this.gravity);
    this.constrainFlyingTrain(dt);
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const cart = this.flights[i];
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
      if (parcel.groundedFor > 0) {
        parcel.groundedFor += dt;
        if (parcel.groundedFor > 2) this.parcels.splice(i, 1);
        continue;
      }
      fly(parcel, dt, this.gravity, MINI_PARCEL_DRAG);
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(parcel.rotation).elements;
      const floor = 0.075 + 0.34 * (Math.abs(matrix[1]) + Math.abs(matrix[5]) + Math.abs(matrix[9]));
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
    this.arrivalTravel += speed * dt;
    if (!this.incoming && this.arrivalTravel >= 140) {
      this.arrivalTravel = 0;
      this.incoming = this.newCoach(this.nextId++, this.coaches.at(-1)!.offset + 34);
    }
    if (this.incoming) {
      const target = this.coaches.at(-1)!.offset + MINI_CART_SPACING;
      const gap = this.incoming.offset - target;
      // Brake relative to the train before the drawbars meet, without overshooting.
      const closing = Math.min(2 + speed * 0.7, gap * 5);
      this.incoming.offset = Math.max(target, this.incoming.offset - closing * dt);
      if (this.incoming.offset <= target + 0.025) {
        this.incoming.offset = target;
        this.coaches.push(this.incoming);
        this.incoming = undefined;
        this.arrived++;
      }
    }
    const frames = this.coaches.map(coach => this.sample(distance - coach.offset));
    const outward = frames.map((frame, index) =>
      isHump(this.track.sectionAt(distance - this.coaches[index].offset).kind)
        ? outwardForce(frame, speed, this.gravity) : 0);
    const shed = this.updateCouplings(dt, frames, outward, distance, speed);
    for (const coach of this.coaches.slice(1)) {
      coach.cargoAge += dt;
      coach.grace = Math.max(0, coach.grace - dt);
      if (coach.refill > 0) {
        coach.refill -= dt;
        if (coach.refill <= 0) {
          coach.cargo = Math.min(coach.nextCargo, MINI_PARCELS_PER_WAGON);
          coach.nextCargo = Math.min(coach.cargo + 1, MINI_PARCELS_PER_WAGON);
          coach.cargoAge = 0;
          coach.grace = 0.75;
          this.refills++;
        }
      }
      if (distance - coach.offset < this.track.sections[0].start) continue;
      const index = this.coaches.indexOf(coach);
      if (coach.cargo && coach.grace === 0) {
        coach.parcelStrain = Math.max(0, coach.parcelStrain + (outward[index] > 110 ? outward[index] / 110 - 1 : -4) * dt);
        if (coach.parcelStrain > 0.035) this.spill(coach, this.frame(coach, distance), speed);
      }
    }
    return shed;
  }

  private updateCouplings(dt: number, frames: RailFrame[], outward: number[], distance: number, speed: number) {
    if (dt <= 0) return false;
    const previous = this.coaches.map(c => c.displacement.clone());
    const velocities = this.coaches.map(c => c.relativeVelocity.clone());
    this.coaches[0].displacement.set(0, 0, 0);
    this.coaches[0].relativeVelocity.set(0, 0, 0);
    // Rail suspension and neighbouring drawbars share the load. The front is
    // the fixed end of this damped chain.
    for (let i = 1; i < this.coaches.length; i++) {
      const coach = this.coaches[i];
      const acceleration = frames[i].up.clone().multiplyScalar(Math.max(0, outward[i] - 230))
        .addScaledVector(previous[i], -360).addScaledVector(velocities[i], -12);
      for (const neighbour of [i - 1, i + 1]) if (neighbour < this.coaches.length) {
        acceleration.addScaledVector(previous[neighbour].clone().sub(previous[i]), 420)
          .addScaledVector(velocities[neighbour].clone().sub(velocities[i]), 12);
      }
      coach.relativeVelocity.addScaledVector(acceleration, dt);
      coach.displacement.addScaledVector(coach.relativeVelocity, dt);
    }
    const positions = this.coaches.map((c, i) => frames[i].position.clone().add(c.displacement));
    const lengths = frames.map((f, i) => i ? f.position.distanceTo(frames[i - 1].position) + MINI_COUPLING_SLACK : 0);
    let breakAt = -1;
    for (let i = 1; i < this.coaches.length; i++) {
      const coach = this.coaches[i];
      const extension = Math.max(0, positions[i].distanceTo(positions[i - 1]) - lengths[i]);
      coach.couplingLoad = extension / (dt * dt * (i === 1 ? 1 : 2));
      // The engine has a reinforced tow point; ordinary coach drawbars share one rating.
      const strength = i === 1 ? MINI_ENGINE_COUPLING_STRENGTH : MINI_COUPLING_STRENGTH;
      coach.couplingStrain = Math.max(0, coach.couplingStrain
        + (coach.couplingLoad > strength ? coach.couplingLoad / strength - 1 : -3) * dt);
      const stress = Math.min(1, Math.max(coach.couplingLoad / strength * 0.7, coach.couplingStrain / 0.025));
      coach.stress = Math.max(stress, coach.stress * Math.exp(-6 * dt));
      if (coach.couplingStrain > 0.025 && breakAt < 0) breakAt = i;
    }
    // Position constraints stop a stretched coupling from becoming a rubber band.
    // Both neighbours react, while the engine remains exactly on its rail frame.
    for (let iteration = 0; iteration < 12; iteration++) {
      for (let k = 1; k < positions.length; k++) {
        const i = iteration % 2 ? positions.length - k : k;
        const delta = positions[i].clone().sub(positions[i - 1]);
        const length = delta.length();
        if (length <= lengths[i]) continue;
        const correction = delta.multiplyScalar((length - lengths[i]) / length);
        positions[i].addScaledVector(correction, i === 1 ? -1 : -0.5);
        if (i > 1) positions[i - 1].addScaledVector(correction, 0.5);
      }
      for (let i = 1; i < positions.length; i++) {
        const below = positions[i].clone().sub(frames[i].position).dot(frames[i].up);
        if (below < 0) positions[i].addScaledVector(frames[i].up, -below);
      }
    }
    for (let i = 1; i < this.coaches.length; i++) {
      const coach = this.coaches[i];
      coach.displacement.copy(positions[i]).sub(frames[i].position);
      coach.relativeVelocity.copy(coach.displacement).sub(previous[i]).divideScalar(dt);
      coach.lift = coach.displacement.dot(frames[i].up);
      coach.liftVelocity = coach.relativeVelocity.dot(frames[i].up);
      coach.velocity.copy(frames[i].tangent).multiplyScalar(speed).add(coach.relativeVelocity);
    }
    if (breakAt < 0) return false;
    const tail = this.coaches.slice(breakAt);
    const poses = tail.map(coach => this.frame(coach, distance));
    for (let i = 0; i < tail.length; i++) {
      const coach = tail[i], frame = poses[i];
      if (coach.cargo) this.spill(coach, frame, speed);
      if (this.flights.length >= MINI_MAX_FLYING_CARTS) this.flights.shift();
      this.flights.push({ position: frame.position, rotation: frame.rotation,
        velocity: coach.velocity.clone(),
        angularVelocity: frames[breakAt + i].tangent.clone().cross(frames[breakAt + i].curvature).multiplyScalar(speed).clampLength(0, 5),
        colorIndex: coach.id, cargo: 0, age: 0, groundedFor: 0,
        coupledTo: i ? tail[i - 1].id : undefined,
        linkLength: i ? poses[i - 1].position.distanceTo(frame.position) : undefined,
      });
    }
    this.lost += tail.length;
    this.coaches.splice(breakAt);
    return true;
  }

  private constrainFlyingTrain(dt: number) {
    const byId = new Map(this.flights.map(c => [c.colorIndex, c]));
    for (let iteration = 0; iteration < 12; iteration++) for (const cart of this.flights) {
      const ahead = byId.get(cart.coupledTo!);
      if (!ahead || !cart.linkLength) continue;
      const delta = cart.position.clone().sub(ahead.position);
      const length = delta.length();
      if (length < 1e-8) continue;
      delta.divideScalar(length);
      const correction = (length - cart.linkLength) * 0.5;
      cart.position.addScaledVector(delta, -correction);
      ahead.position.addScaledVector(delta, correction);
      const separating = cart.velocity.clone().sub(ahead.velocity).dot(delta) * 0.5;
      cart.velocity.addScaledVector(delta, -separating);
      ahead.velocity.addScaledVector(delta, separating);
    }
    for (const cart of this.flights) {
      const ahead = byId.get(cart.coupledTo!);
      const behind = this.flights.find(c => c.coupledTo === cart.colorIndex);
      if (!ahead && !behind) continue;
      const tangent = (ahead?.position ?? cart.position).clone().sub(behind?.position ?? cart.position).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cart.rotation);
      const right = tangent.clone().cross(up).normalize();
      up.copy(right).cross(tangent).normalize();
      const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, tangent.negate()));
      cart.rotation.slerp(rotation, 1 - Math.exp(-16 * dt));
      cart.angularVelocity.multiplyScalar(Math.exp(-8 * dt));
    }
  }
}
