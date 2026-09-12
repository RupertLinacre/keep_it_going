import type { Difficulty } from "./types.ts";

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = <T>(items: readonly T[]): T =>
  items[randomInt(0, items.length - 1)];
export const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export const factors = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((f) => n % f === 0);
export const factorPairs = (n: number): [number, number][] =>
  factors(n)
    .filter((f) => f <= Math.sqrt(n))
    .map((f) => [f, n / f]);
export const pairKey = (a: number, b: number) =>
  [Math.min(a, b), Math.max(a, b)].join("×");
export const isFactor = (n: number, f: number) =>
  f > 0 && Number.isInteger(f) && n % f === 0;
export function targetNumber(difficulty: Difficulty): number {
  return pick(
    difficulty === "easy"
      ? [6, 8, 10, 12, 16, 18, 20]
      : difficulty === "normal"
        ? [12, 18, 20, 24, 28, 30, 32, 36, 40, 42, 48]
        : [36, 42, 48, 54, 56, 60, 64, 72, 84, 96],
  );
}
export function multiplication(difficulty: Difficulty): [number, number] {
  return [
    pick(
      difficulty === "easy"
        ? [2, 3, 4, 5, 10]
        : difficulty === "normal"
          ? [3, 4, 5, 6, 7, 8, 9, 10]
          : [6, 7, 8, 9, 11, 12],
    ),
    randomInt(2, difficulty === "easy" ? 6 : 12),
  ];
}
export function factorChoices(n: number): number[] {
  const valid = shuffle(factors(n).filter((f) => f !== n)).slice(0, 2);
  const invalid = shuffle(
    Array.from({ length: Math.min(15, n + 2) }, (_, i) => i + 2).filter(
      (f) => !isFactor(n, f),
    ),
  ).slice(0, 4 - valid.length);
  return shuffle([...valid, ...invalid]);
}
