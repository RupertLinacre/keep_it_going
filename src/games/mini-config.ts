export const MINI_STARTING_CARTS = 6;
export const MINI_START_SPEED = 2;
export const MINI_CART_SPACING = 2.4;
export const MINI_MAX_FLYING_CARTS = 12;
export const MINI_MAX_FLYING_PARCELS = 64;
export const MINI_MAX_EXPLOSIONS = 6;
export const MINI_EXPLOSION_PARTICLES = 28;
export const isParcelWagon = (index: number) => index > 0 && index % 2 === 1;
export const MINI_PARCEL_RESPAWN = 2.5;
export const MINI_PARCELS_PER_WAGON = 4;
// Quadratic drag per metre; loose boxes have much more area per kilogram than the train.
export const MINI_PARCEL_DRAG = 0.055;
export const MINI_COUPLING_SLACK = 0.06;
export const MINI_COACH_RETENTION = 150;
// Only the tail drawbar can break; the remaining chain stays tethered to the engine.
export const MINI_COUPLING_STRENGTH = 250;
export const parcelOffsets = (count: number) => Array.from({ length: Math.min(count, MINI_PARCELS_PER_WAGON) }, (_, i) => ({
  x: 0, y: 1 + Math.floor(i / 2) * 0.7, z: i % 2 ? 0.47 : -0.47,
}));
/** A short staggered drop as fresh parcels settle into their wagon. */
export const parcelPresentation = (count: number, age: number) => parcelOffsets(count).map((offset, i) => {
  const delay = count > 1 ? i / (count - 1) * 0.14 : 0;
  const t = Math.min(1, Math.max(0, (age - delay) / 0.38));
  const scale = Math.min(1, t * 4);
  return { ...offset, y: offset.y + 0.85 * (1 - t) ** 2 + 0.06 * Math.sin(t * Math.PI * 2) * (1 - t),
    scale: scale * scale * (3 - 2 * scale) };
});
export const MINI_TRAIL_DISTANCE = 180;
export const MINI_VISIBLE_CARTS =
  Math.ceil(MINI_TRAIL_DISTANCE / MINI_CART_SPACING) + 1;
// Energy per unit mass, applied only when an answer is correct. It gives a
// substantial launch from rest and smaller speed increments when already fast.
export const MINI_BOOST_ENERGY = 300;
