export const MINI_STARTING_CARTS = 6;
export const MINI_MAX_CARTS = 10;
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
export const MINI_PARCEL_RETENTION = 110;
// About 4% more speed than cargo release on the same crest.
export const MINI_COACH_RETENTION = MINI_PARCEL_RETENTION * 1.08;
export const MINI_COACH_MAX_LIFT = 3.5;
export const MINI_COACH_LINK_LIFT = 0.65;
export const MINI_COACH_HOP_DURATION = 0.8;
// Lift is easier to trigger than an actual breakaway.
export const MINI_COUPLING_LOAD_THRESHOLD = 150;
// Only the tail drawbar can break; the remaining chain stays tethered to the engine.
export const MINI_COUPLING_STRENGTH = 250;
export const MINI_POWER_PARCELS = 8;
export const parcelOffsets = (count: number, limit = MINI_PARCELS_PER_WAGON) => Array.from({ length: Math.min(count, limit) }, (_, i) => ({
  x: 0, y: 1 + Math.floor(i / 2) * 0.7, z: i % 2 ? 0.47 : -0.47,
}));
/** A short staggered drop as fresh parcels settle into their wagon. */
export const parcelPresentation = (count: number, age: number, limit = MINI_PARCELS_PER_WAGON) => parcelOffsets(count, limit).map((offset, i) => {
  const delay = count > 1 ? i / (count - 1) * 0.14 : 0;
  const t = Math.min(1, Math.max(0, (age - delay) / 0.38));
  const scale = Math.min(1, t * 4);
  return { ...offset, y: offset.y + 0.85 * (1 - t) ** 2 + 0.06 * Math.sin(t * Math.PI * 2) * (1 - t),
    scale: scale * scale * (3 - 2 * scale) };
});
export const MINI_TRAIL_DISTANCE = 180;
export const MINI_VISIBLE_CARTS = MINI_MAX_CARTS;
// Energy per unit mass, applied only when an answer is correct. It gives a
// substantial launch from rest and smaller speed increments when already fast.
export const MINI_BOOST_ENERGY = 300;
