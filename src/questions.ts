import { seededRandom } from "./games/mini-rail";

export const ALL_TABLES = Array.from({ length: 12 }, (_, i) => i + 1);
export const DEFAULT_TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function normalizeTables(value: unknown): number[] {
  const tables = Array.isArray(value)
    ? [...new Set(value.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b)
    : [];
  return tables.length ? tables : [...DEFAULT_TABLES];
}

/** A separate random stream keeps scenery and answer timing out of the question order. */
export function questionSequence(tables: readonly number[], seed: number) {
  const selected = normalizeTables(tables);
  const random = seededRandom(seed);
  let bag: [number, number][] = [];
  return (): [number, number] => {
    if (!bag.length) {
      bag = selected.flatMap(a => ALL_TABLES.map(b => [a, b] as [number, number]));
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}
