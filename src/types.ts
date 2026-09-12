export type Difficulty = "easy" | "normal" | "hard";
export type GameId = "mini";
export type Stat = { label: string; value: string | number };

export interface Result {
  score: number;
  won: boolean;
  message: string;
  correct: number;
  mistakes: number;
  ride?: {
    distance: number;
    bestDistance: number;
    bestJump: number;
    longestTrain: number;
    peakSpeed: number;
    bestStreak: number;
    newDistanceRecord: boolean;
    newScoreRecord: boolean;
  };
}

export interface Host {
  difficulty: Difficulty;
  stage: HTMLElement;
  panel: (html: string) => void;
  stats: (stats: Stat[]) => void;
  feedback: (message: string, positive?: boolean) => void;
  sound: (kind: "good" | "bad" | "jump" | "beat" | "win") => void;
  finish: (result: Result) => void;
}

export interface Game {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  action(value: string): void;
  key(key: string): void;
  pointer?(x: number, y: number): void;
  destroy?(): void;
}
