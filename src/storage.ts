import type { Difficulty, GameId } from "./types";

interface Save {
  difficulty: Difficulty;
  muted: boolean;
  best: Record<string, number>;
}

const defaults: Save = { difficulty: "normal", muted: false, best: {} };

function read(): Save {
  try {
    const saved = JSON.parse(localStorage.getItem("tiny-tracks-v1") || "{}");
    return {
      difficulty: ["easy", "normal", "hard"].includes(saved.difficulty)
        ? saved.difficulty
        : "normal",
      muted: saved.muted === true,
      best:
        typeof saved.best === "object" && saved.best !== null ? saved.best : {},
    };
  } catch {
    return { ...defaults, best: {} };
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
  const previous = save.best[key] || 0;
  save.best[key] = Math.max(previous, score);
  persist();
  return score > previous;
}
