export const MINI_STARTING_CARTS = 3;
export const MINI_ANSWERS_PER_CART = 3;
export const MINI_CART_SPACING = 2.4;
export const MINI_TRAIL_DISTANCE = 180;
export const MINI_VISIBLE_CARTS =
  Math.ceil(MINI_TRAIL_DISTANCE / MINI_CART_SPACING) + 1;
// Energy per unit mass, applied only when an answer is correct. It gives a
// substantial launch from rest and smaller speed increments when already fast.
export const MINI_BOOST_ENERGY = 300;
export const miniCartCount = (correct: number) =>
  MINI_STARTING_CARTS + Math.floor(correct / MINI_ANSWERS_PER_CART);
