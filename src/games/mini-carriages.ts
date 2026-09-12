import * as THREE from "three";
import { isHump, type MiniTrack } from "./mini-track";
import { seededRandom, type RailFrame } from "./mini-rail";
import {
  MINI_CART_SPACING, MINI_MAX_FLYING_CARTS, MINI_MAX_FLYING_PARCELS,
  MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES, MINI_VISIBLE_CARTS,
  parcelOffsets, isParcelWagon, MINI_STARTING_CARTS, MINI_PARCEL_RESPAWN,
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

function fly(body: FlyingBody, dt: number, gravity: number) {
  body.age += dt;
  body.position.addScaledVector(body.velocity, dt);
  body.position.y -= 0.5 * gravity * dt * dt;
  body.velocity.y -= gravity * dt;
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
  nextCargo: number;
  refill: number;
  grace: number;
  parcelStrain: number;
  cartStrain: number;
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
      nextCargo: 3, refill: 0, grace: 0, parcelStrain: 0, cartStrain: 0 };
  }
  frame(coach: Coach, distance: number) {
    const frame = this.sample(distance - coach.offset);
    frame.position.addScaledVector(frame.up, coach.lift);
    frame.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(frame.right, -coach.liftVelocity * 0.025));
    return frame;
  }
  poses(distance: number) {
    return [...this.coaches.slice(0, MINI_VISIBLE_CARTS), ...(this.incoming ? [this.incoming] : [])]
      .filter(c => distance - c.offset >= this.track.sections[0].start)
      .map(coach => ({ coach, frame: this.frame(coach, distance) }));
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
    const angularVelocity = frame.tangent.clone().cross(frame.curvature).multiplyScalar(speed);
    for (const offset of parcelOffsets(count)) {
      const local = new THREE.Vector3(offset.x, offset.y, offset.z).applyQuaternion(frame.rotation);
      if (this.parcels.length >= MINI_MAX_FLYING_PARCELS) this.parcels.shift();
      this.parcels.push({
        position: frame.position.clone().add(local),
        velocity: frame.tangent.clone().multiplyScalar(speed)
          .add(angularVelocity.clone().cross(local)),
        rotation: frame.rotation.clone(),
        angularVelocity: angularVelocity.clone().add(new THREE.Vector3(0.7, 0.4, -0.6)),
        age: 0, groundedFor: 0, bounces: 0,
      });
      this.spilled++;
    }
  }

  update(dt: number, distance: number, speed: number, running = true) {
    if (!Number.isFinite(dt) || dt < 0) return false;
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
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const cart = this.flights[i];
      fly(cart, dt, this.gravity);
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
      fly(parcel, dt, this.gravity);
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
      this.incoming.offset = Math.max(target, this.incoming.offset - (2 + speed * 0.7) * dt);
      if (this.incoming.offset <= target + 0.001) {
        this.coaches.push(this.incoming);
        this.incoming = undefined;
        this.arrived++;
      }
    }
    let shed = false;
    for (let index = this.coaches.length - 1; index >= 1; index--) {
      const coach = this.coaches[index];
      coach.offset = Math.max(index * MINI_CART_SPACING, coach.offset - dt * 3);
      coach.grace = Math.max(0, coach.grace - dt);
      if (coach.refill > 0) {
        coach.refill -= dt;
        if (coach.refill <= 0) {
          coach.cargo = coach.nextCargo++;
          coach.grace = 0.75;
          this.refills++;
        }
      }
      const at = distance - coach.offset;
      if (at < this.track.sections[0].start) continue;
      const section = this.track.sectionAt(at);
      const frame = this.sample(at);
      const outward = isHump(section.kind) ? outwardForce(frame, speed, this.gravity) : 0;
      const whip = 1 + Math.min(index, 12) * 0.09;
      const targetLift = Math.min(0.6, Math.max(0, outward * whip - 140) / 500);
      coach.liftVelocity += ((targetLift - coach.lift) * 180 - coach.liftVelocity * 18) * dt;
      coach.lift = Math.max(0, coach.lift + coach.liftVelocity * dt);
      if (coach.cargo && coach.grace === 0) {
        coach.parcelStrain = Math.max(0, coach.parcelStrain + (outward > 110 ? outward / 110 - 1 : -4) * dt);
        if (coach.parcelStrain > 0.035) this.spill(coach, this.frame(coach, distance), speed);
      }
      coach.cartStrain = Math.max(0, coach.cartStrain + (outward * whip > 430 ? outward * whip / 430 - 1 : -4) * dt);
      if (coach.cartStrain <= 0.055) continue;
      const pose = this.frame(coach, distance);
      if (coach.cargo) this.spill(coach, pose, speed);
      this.lost++;
      shed = true;
      if (this.flights.length >= MINI_MAX_FLYING_CARTS) this.flights.shift();
      this.flights.push({
        position: pose.position,
        velocity: frame.tangent.clone().multiplyScalar(speed)
          .addScaledVector(frame.up, Math.max(1.5, coach.liftVelocity)),
        rotation: pose.rotation,
        angularVelocity: frame.tangent.clone().cross(frame.curvature).multiplyScalar(speed * whip),
        colorIndex: coach.id, cargo: 0, age: 0, groundedFor: 0,
      });
      this.coaches.splice(index, 1);
    }
    return shed;
  }
}
