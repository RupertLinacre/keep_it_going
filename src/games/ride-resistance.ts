/** Medium difficulty: retain the old resistance below 8 m/s and at 20 m/s,
 * then let reduced quadratic drag reward fast drops. Difficulty and Ice glide
 * scale both coefficients together, preserving the same transition speeds. */
export const BASE_DRAG = 0.002;
export const BASE_ROLLING = 0.86;

export function rollingResistance(speed: number, rolling: number) {
  const v = Math.max(0, speed);
  const t = Math.max(0, Math.min(1, (v - 8) / 12));
  const blend = t * t * (3 - 2 * t);
  // At low speed replace precisely the drag removed by halving its coefficient.
  // Above 20 m/s this extra resistance is constant, rather than quadratic.
  const extra = (1 - blend) * (v / 20) ** 2 + blend;
  return rolling / BASE_ROLLING * (0.06 * Math.tanh(v * 5) + 0.8 * extra);
}
