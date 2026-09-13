import { DIFFICULTIES, normalizeDifficulty } from "./difficulty";
import type { Difficulty, GameId } from "./types";

interface Save {
  difficulty: Difficulty;
  muted: boolean;
  best: Record<string, number>;
  rides: Partial<Record<Difficulty, { distance: number; jump: number }>>;
}

const defaults: Save = { difficulty: "normal", muted: false, best: {}, rides: {} };
const validRecord = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

function read(): Save {
  try {
    const saved = JSON.parse(localStorage.getItem("tiny-tracks-v1") || "{}");
    return {
      difficulty: normalizeDifficulty(saved.difficulty),
      muted: saved.muted === true,
      best:
        typeof saved.best === "object" && saved.best !== null ? saved.best : {},
      rides: Object.fromEntries(DIFFICULTIES.map(difficulty => [difficulty, {
        distance: validRecord(saved.rides?.[difficulty]?.distance),
        jump: validRecord(saved.rides?.[difficulty]?.jump),
      }])),
    };
  } catch {
    return { ...defaults, best: {}, rides: {} };
  }
}

export const save = read();

export function persist() {
  try {
    localStorage.setItem("tiny-tracks-v1", JSON.stringify(save));
  } catch {
    // Play remains available when storage is blocked.
  }
}

export function record(id: GameId, difficulty: Difficulty, score: number) {
  const key = `${id}:${difficulty}`;
  const previous = validRecord(save.best[key]);
  save.best[key] = Math.max(previous, validRecord(score));
  persist();
  return validRecord(score) > previous;
}

export function bestRide(difficulty: Difficulty, id: GameId = "mini") {
  if (id !== "mini") return { score: validRecord(save.best[`${id}:${difficulty}`]),
    distance: validRecord(save.best[`${id}-distance:${difficulty}`]), jump: validRecord(save.best[`${id}-jump:${difficulty}`]) };
  return { score: validRecord(save.best[`mini:${difficulty}`]),
    distance: validRecord(save.rides[difficulty]?.distance), jump: validRecord(save.rides[difficulty]?.jump) };
}

export function recordRide(difficulty: Difficulty, distance: number, jump: number, id: GameId = "mini") {
  const previous = bestRide(difficulty, id);
  if (id !== "mini") {
    save.best[`${id}-distance:${difficulty}`] = Math.max(previous.distance, validRecord(distance));
    save.best[`${id}-jump:${difficulty}`] = Math.max(previous.jump, validRecord(jump));
    persist(); return;
  }
  save.rides[difficulty] = { distance: Math.max(previous.distance, validRecord(distance)),
    jump: Math.max(previous.jump, validRecord(jump)) };
  persist();
}
