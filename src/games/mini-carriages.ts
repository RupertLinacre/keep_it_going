import * as THREE from "three";
import { isHump, type MiniTrack } from "./mini-track";
import { seededRandom, type RailFrame } from "./mini-rail";
import {
  MINI_CART_SPACING, MINI_MAX_FLYING_CARTS, MINI_MAX_FLYING_PARCELS,
  MINI_MAX_EXPLOSIONS, MINI_EXPLOSION_PARTICLES, MINI_VISIBLE_CARTS,
  MINI_PARCEL_OFFSETS, isParcelWagon,
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
  hasCargo: boolean;
}
export interface FlyingParcel extends FlyingBody {
  bounces: number;
}
export interface Explosion {
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

export function losesContact(frame: RailFrame, speed: number, gravity = 9.81) {
  // N/m = g·up.y + v² κ·up. The inverted crest turns the curvature toward
  // the floor of the wagon, so speed holds the load in instead of throwing it out.
  return frame.up.y > 0.65
    && gravity * frame.up.y + speed ** 2 * frame.curvature.dot(frame.up) < -0.5;
}

/** Fixed-step carriage, cargo and impact physics; rendering consumes this state. */
export class MiniCarriages {
  lost = 0;
  spilled = 0;
  impacts = 0;
  readonly flights: FlyingCart[] = [];
  readonly parcels: FlyingParcel[] = [];
  readonly explosions: Explosion[] = [];
  readonly emptyWagons = new Set<number>();
  private shedHumps = new Set<number>();

  constructor(readonly track: MiniTrack, readonly gravity = 9.81) {}

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

  private spill(index: number, frame: RailFrame, speed: number) {
    this.emptyWagons.add(index);
    const angularVelocity = frame.tangent.clone().cross(frame.curvature).multiplyScalar(speed);
    for (const offset of MINI_PARCEL_OFFSETS) {
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

  update(dt: number, distance: number, speed: number, cartCount: number) {
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
        const centerY = open ? (cart.hasCargo ? 0.66 : 0.46) : 0.765;
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

    for (const index of this.emptyWagons) if (index >= cartCount) this.emptyWagons.delete(index);
    for (const id of this.shedHumps)
      if (id < this.track.sections[0].id) this.shedHumps.delete(id);
    for (let index = 1; index < Math.min(cartCount, MINI_VISIBLE_CARTS); index++) {
      if (!isParcelWagon(index) || this.emptyWagons.has(index)) continue;
      const at = distance - index * MINI_CART_SPACING;
      if (at < this.track.sections[0].start) continue;
      const section = this.track.sectionAt(at);
      if (isHump(section.kind)) {
        const frame = section.sample(at);
        if (losesContact(frame, speed, this.gravity)) this.spill(index, frame, speed);
      }
    }
    if (cartCount <= 1) return false;
    const tailDistance = distance - (cartCount - 1) * MINI_CART_SPACING;
    if (tailDistance < this.track.sections[0].start) return false;
    const section = this.track.sectionAt(tailDistance);
    if (!isHump(section.kind) || this.shedHumps.has(section.id)) return false;
    const frame = section.sample(tailDistance);
    if (!losesContact(frame, speed, this.gravity)) return false;
    this.shedHumps.add(section.id);
    this.lost++;
    if (this.flights.length >= MINI_MAX_FLYING_CARTS) this.flights.shift();
    this.flights.push({
      position: frame.position.clone(),
      velocity: frame.tangent.clone().multiplyScalar(speed),
      rotation: frame.rotation.clone(),
      angularVelocity: frame.tangent.clone().cross(frame.curvature).multiplyScalar(speed),
      colorIndex: cartCount - 1,
      hasCargo: isParcelWagon(cartCount - 1) && !this.emptyWagons.has(cartCount - 1),
      age: 0, groundedFor: 0,
    });
    this.emptyWagons.delete(cartCount - 1);
    return true;
  }
}
