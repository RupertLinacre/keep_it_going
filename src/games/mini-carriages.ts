import * as THREE from "three";
import { isHump, type MiniTrack } from "./mini-track";
import { seededRandom, type RailFrame } from "./mini-rail";
import {
  MINI_CART_SPACING, MINI_MAX_FLYING_CARTS, MINI_MAX_FLYING_PARCELS,
  MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES, MINI_VISIBLE_CARTS,
  parcelOffsets, isParcelWagon, MINI_STARTING_CARTS, MINI_PARCEL_RESPAWN,
  MINI_PARCEL_DRAG, MINI_COUPLING_SLACK, MINI_COUPLING_STRENGTH,
  MINI_COACH_RETENTION, MINI_PARCELS_PER_WAGON,
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
  return !frame.airborne
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
  position: THREE.Vector3;
  derailed: boolean;
  airTime: number;
  wheelStrain: number;
  hillId?: number;
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
  private readonly detachedHills = new Set<number>();
  sample: (distance: number) => RailFrame;

  constructor(readonly track: MiniTrack, readonly gravity = 9.81) {
    this.sample = distance => track.sample(distance);
    for (let i = 0; i < MINI_STARTING_CARTS; i++) this.coaches.push(this.newCoach(i, i * MINI_CART_SPACING));
  }
  private newCoach(id: number, offset: number): Coach {
    return { id, offset, lift: 0, liftVelocity: 0, cargo: isParcelWagon(id) ? 2 : 0,
      cargoAge: 1, nextCargo: 3, refill: 0, grace: 0, parcelStrain: 0,
      displacement: new THREE.Vector3(), relativeVelocity: new THREE.Vector3(), couplingLoad: 0, couplingStrain: 0, stress: 0, velocity: new THREE.Vector3(),
      position: new THREE.Vector3(), derailed: false, airTime: 0, wheelStrain: 0 };
  }
  frame(coach: Coach, distance: number) {
    const frame = this.sample(distance - coach.offset);
    if (coach.derailed) frame.position.copy(coach.position);
    else frame.position.add(coach.displacement);
    const index = this.coaches.indexOf(coach);
    if (index > 0 && coach.derailed) {
      const ahead = this.coaches[index - 1], behind = this.coaches[index + 1] ?? coach;
      const position = (cart: Coach) => cart.derailed ? cart.position : this.sample(distance - cart.offset).position;
      const tangent = position(ahead).clone().sub(position(behind));
      if (tangent.lengthSq() > 1e-8) frame.tangent.copy(tangent).normalize();
      frame.right.addScaledVector(frame.tangent, -frame.right.dot(frame.tangent));
      if (frame.right.lengthSq() < 1e-8) frame.right.copy(frame.tangent).cross(frame.up);
      frame.right.normalize();
      frame.up.copy(frame.right).cross(frame.tangent).normalize();
      frame.rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent.clone().negate()));
      frame.airborne = true;
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
      if (this.incoming.offset <= target + 0.025 && !this.coaches.at(-1)!.derailed) {
        this.incoming.offset = target;
        this.coaches.push(this.incoming);
        this.incoming = undefined;
        this.arrived++;
      }
    }
    const frames = this.coaches.map(coach => this.sample(distance - coach.offset));
    const outward = frames.map((frame, index) => {
      const section = this.track.sectionAt(distance - this.coaches[index].offset);
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
    const coaches = this.coaches;
    const release = (i: number, hillId?: number) => {
      const coach = coaches[i];
      coach.derailed = true;
      coach.airTime = 0;
      coach.hillId = hillId ?? this.track.sectionAt(distance - coach.offset).id;
    };
    for (let i = 0; i < coaches.length; i++) {
      const coach = coaches[i], frame = frames[i];
      coach.couplingLoad = 0;
      const onRetainedTrack = distance - coach.offset >= this.track.sections[0].start;
      if (!onRetainedTrack) { coach.derailed = false; coach.wheelStrain = 0; }
      if (!coach.derailed || i === 0) {
        coach.position.copy(frame.position);
        coach.velocity.copy(frame.tangent).multiplyScalar(speed);
        coach.wheelStrain = Math.max(0, coach.wheelStrain + (outward[i] / MINI_COACH_RETENTION - 1) * dt);
        if (i > 0 && onRetainedTrack && coach.wheelStrain > 0.02) release(i);
      } else {
        // Once the retaining wheels lose contact, momentum and gravity determine
        // the path. The articulated drawbars below tow and damp the airborne chain.
        coach.airTime += dt;
        coach.position.addScaledVector(coach.velocity, dt);
        coach.position.y -= this.gravity * dt * dt / 2;
        coach.velocity.y -= this.gravity * dt;
      }
    }
    const predicted = coaches.map(coach => coach.position.clone());
    const contacts = coaches.map((coach, i) => {
      if (!coach.derailed) return frames[i];
      // A flying coach can be ahead of its original rail position. Find the
      // actual surface beneath its wheels, including the bottom of a vertical drop.
      const nominal = distance - coach.offset;
      let nearest = nominal, best = Infinity;
      const radius = Math.min(28, coach.offset + 5);
      for (let s = nominal - radius; s <= nominal + radius; s += 2) {
        const gap = this.sample(s).position.distanceToSquared(coach.position);
        if (gap < best) { best = gap; nearest = s; }
      }
      for (let step = 1; step > 0.03; step /= 2) for (const s of [nearest - step, nearest + step]) {
        const gap = this.sample(s).position.distanceToSquared(coach.position);
        if (gap < best) { best = gap; nearest = s; }
      }
      return this.sample(nearest);
    });
    const maxLength = MINI_CART_SPACING + MINI_COUPLING_SLACK;
    for (let iteration = 0; iteration < (coaches.some(coach => coach.derailed) ? 64 : 0); iteration++) {
      for (let k = 1; k < coaches.length; k++) {
        const i = iteration % 2 ? coaches.length - k : k;
        const ahead = coaches[i - 1], coach = coaches[i];
        if (!ahead.derailed && !coach.derailed) continue;
        const delta = coach.position.clone().sub(ahead.position);
        const length = delta.length();
        if (length < 1e-8) continue;
        delta.divideScalar(length);
        // Articulated drawbars bend freely, but cannot fold a coach through its
        // neighbour. This also lets the wheels line up again after the crest.
        const forward = i > 1 && ahead.derailed
          ? coaches[i - 2].position.clone().sub(ahead.position).normalize() : frames[i - 1].tangent;
        const alignment = delta.dot(forward);
        if (alignment > -0.2) {
          const side = delta.clone().addScaledVector(forward, -alignment);
          if (side.lengthSq() < 1e-8) side.copy(frames[i].up);
          const limited = side.normalize().multiplyScalar(Math.sqrt(0.96)).addScaledVector(forward, -0.2);
          const change = limited.multiplyScalar(length).addScaledVector(delta, -length);
          const a = ahead.derailed ? 1 : 0, b = coach.derailed ? 1 : 0;
          coach.position.addScaledVector(change, b / (a + b));
          ahead.position.addScaledVector(change, -a / (a + b));
          delta.copy(coach.position).sub(ahead.position).normalize();
        }
        const extension = length - Math.max(MINI_CART_SPACING - 0.16, Math.min(maxLength, length));
        if (Math.abs(extension) < 1e-8) continue;
        // A taut drawbar can pull another set of wheels off the rail. The engine
        // is the immovable anchor; inverted track and jump traces keep their grip.
        if (extension > 0) for (const [index, normal] of [[i, -1], [i - 1, 1]]) {
          const cart = coaches[index], section = this.track.sectionAt(distance - cart.offset);
          if (index && !cart.derailed && isHump(section.kind) && section.kind !== "invertedhill"
            && !frames[index].airborne && delta.dot(frames[index].up) * normal * extension / (dt * dt) > MINI_COACH_RETENTION)
            release(index, (ahead.derailed ? ahead : coach).hillId);
        }
        const a = ahead.derailed ? 1 : 0, b = coach.derailed ? 1 : 0;
        if (!a && !b) continue;
        const correction = extension / (a + b);
        ahead.position.addScaledVector(delta, correction * a);
        coach.position.addScaledVector(delta, -correction * b);
        coach.couplingLoad += Math.max(0, correction) / (dt * dt);
      }
      // Unilateral rail contact: wheels may leave the running surface, but cannot
      // pass through it on the way back down. Vertical crests use the same normal.
      for (let i = 1; i < coaches.length; i++) if (coaches[i].derailed) {
        const contact = contacts[i];
        const offset = coaches[i].position.clone().sub(contact.position);
        const below = offset.dot(contact.up);
        if (below < 0 && Math.abs(offset.dot(contact.right)) < 1.2 && Math.abs(offset.dot(contact.tangent)) < 1.2)
          coaches[i].position.addScaledVector(contact.up, -below);
        coaches[i].position.y = Math.max(0.2, coaches[i].position.y);
      }
    }
    // Finish from the anchored end so no amount of whipping can stretch a joint.
    for (let i = 1; i < coaches.length; i++) if (coaches[i].derailed) {
      const delta = coaches[i].position.clone().sub(coaches[i - 1].position);
      if (delta.length() > maxLength) coaches[i].position.copy(coaches[i - 1].position).add(delta.setLength(maxLength));
    }
    for (let i = 1; i < coaches.length; i++) {
      const coach = coaches[i], frame = frames[i];
      if (coach.derailed) {
        coach.velocity.add(coach.position.clone().sub(predicted[i]).divideScalar(dt));
        const offset = coach.position.clone().sub(frame.position);
        // Catch the retaining wheels again only when they physically meet the rail.
        if (coach.airTime > 0.12 && outward[i] < MINI_COACH_RETENTION * 0.7
          && offset.length() < 0.32
          && coaches[i - 1].position.distanceTo(frame.position) <= maxLength
          && (!coaches[i + 1] || coaches[i + 1].position.distanceTo(frame.position) <= maxLength)
          && coach.velocity.clone().addScaledVector(frame.tangent, -speed).dot(frame.up) < 1) {
          coach.derailed = false;
          coach.position.copy(frame.position);
          coach.velocity.copy(frame.tangent).multiplyScalar(speed);
          coach.wheelStrain = 0;
          coach.airTime = 0;
        }
      }
      coach.displacement.copy(coach.position).sub(frame.position);
      coach.relativeVelocity.copy(coach.velocity).addScaledVector(frame.tangent, -speed);
      coach.lift = Math.max(0, coach.displacement.dot(frame.up));
      coach.liftVelocity = coach.relativeVelocity.dot(frame.up);
      coach.couplingStrain = Math.max(0, coach.couplingStrain
        + (coach.couplingLoad / MINI_COUPLING_STRENGTH - 1) * dt);
      const stress = Math.min(1, Math.max(coach.couplingLoad / MINI_COUPLING_STRENGTH * 0.5, coach.couplingStrain / 0.06));
      coach.stress = Math.max(stress, coach.stress * Math.exp(-6 * dt));
    }
    // Drawbar dampers dissipate relative motion without adding launch energy.
    for (let i = 1; i < coaches.length; i++) {
      const ahead = coaches[i - 1], coach = coaches[i];
      const a = ahead.derailed ? 1 : 0, b = coach.derailed ? 1 : 0;
      if (!a && !b) continue;
      const delta = coach.position.clone().sub(ahead.position);
      const direction = delta.clone().normalize();
      // The pivot bushings resist excessive bending, with equal and opposite
      // torque on neighbouring coaches. They guide the wheels back into line.
      const bend = frames[i].position.clone().sub(frames[i - 1].position).sub(delta);
      bend.addScaledVector(direction, -bend.dot(direction)).multiplyScalar(35 * dt);
      coach.velocity.addScaledVector(bend, b);
      ahead.velocity.addScaledVector(bend, -a);
      const relative = coach.velocity.clone().sub(ahead.velocity).multiplyScalar((1 - Math.exp(-8 * dt)) / (a + b));
      ahead.velocity.addScaledVector(relative, a);
      coach.velocity.addScaledVector(relative, -b);
    }
    for (let i = 1; i < coaches.length; i++) {
      coaches[i].relativeVelocity.copy(coaches[i].velocity).addScaledVector(frames[i].tangent, -speed);
      coaches[i].liftVelocity = coaches[i].relativeVelocity.dot(frames[i].up);
    }
    for (const id of this.detachedHills) if (id < this.track.sections[0].id && !coaches.some(c => c.hillId === id)) this.detachedHills.delete(id);
    coaches[0].displacement.set(0, 0, 0);
    coaches[0].relativeVelocity.set(0, 0, 0);
    const tail = coaches.at(-1)!;
    // One sacrificial tail coupling per physical hill, even if a replacement
    // catches up before the rest of the train has cleared the same crest.
    if (coaches.length < 2 || !tail.derailed || tail.airTime < 0.12 || tail.displacement.length() < 0.5
      || tail.couplingStrain < 0.06 || tail.hillId === undefined || this.detachedHills.has(tail.hillId)) return false;
    this.detachedHills.add(tail.hillId);
    const frame = this.frame(tail, distance);
    if (tail.cargo) this.spill(tail, frame, speed);
    if (this.flights.length >= MINI_MAX_FLYING_CARTS) this.flights.shift();
    this.flights.push({ position: frame.position, rotation: frame.rotation,
      velocity: tail.velocity.clone(),
      angularVelocity: frames.at(-1)!.tangent.clone().cross(frames.at(-1)!.curvature).multiplyScalar(speed).clampLength(0, 5),
      colorIndex: tail.id, cargo: 0, age: 0, groundedFor: 0,
    });
    this.lost++;
    coaches.pop();
    return true;
  }
}
