import type { Difficulty } from "./types";

export const DIFFICULTIES = ["very-easy", "easy", "normal", "hard", "very-hard"] as const;
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  "very-easy": "Very easy", easy: "Easy", normal: "Medium", hard: "Hard", "very-hard": "Very hard",
};
export const isDifficulty = (value: unknown): value is Difficulty => DIFFICULTIES.some(level => level === value);
export const normalizeDifficulty = (value: unknown): Difficulty => isDifficulty(value) ? value : "normal";

// Keep gravity, launch speed and boosts consistent. Change energy lost between
// answers, so an easier ride needs fewer boosts to sustain the same speed.
export function rideResistance(level: Difficulty) {
  const multiplier = { "very-easy": 0.3, easy: 0.55, normal: 1, hard: 1.5, "very-hard": 2.1 }[level];
  return { drag: 0.004 * multiplier, rolling: 0.06 * multiplier };
}
