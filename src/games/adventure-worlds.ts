import type { MiniKind } from "./mini-track";

export type WorldKind = "meadow" | "mountain" | "night" | "halloween";
export interface AdventureWorld {
  id: WorldKind; name: string; icon: string; invitation: string;
  start: number; end: number; sky: string; ground: string; earth: string;
  rail: string; light: string; ambient: string; darkness: number; maxHeight: number;
  challenges: readonly MiniKind[];
}
export const WORLDS: readonly AdventureWorld[] = [
  { id: "meadow", name: "Baa Baa Meadows", icon: "✿", invitation: "Wave to the sheep!", start: 0, end: 900,
    sky: "#c6e5e4", ground: "#a9cf77", earth: "#b29366", rail: "#ec9671", light: "#fff3cf", ambient: "#d8efdc", darkness: 0, maxHeight: 30,
    challenges: ["hill", "loop", "helix", "doubledip", "waveturn", "splash"] },
  { id: "mountain", name: "Marmalade Mountains", icon: "▲", invitation: "Up the mountain, through the tunnels!", start: 900, end: 1900,
    sky: "#becfdf", ground: "#9aaea5", earth: "#777f8c", rail: "#edb451", light: "#e5efff", ambient: "#cbd9ed", darkness: .12, maxHeight: 38,
    challenges: ["mountainpass", "tunnel", "ascendinghelix", "skyhill", "jump", "mountainpass"] },
  { id: "night", name: "Starlight Carnival", icon: "✦", invitation: "Follow the lights to the stars!", start: 1900, end: 3000,
    sky: "#17213d", ground: "#344e61", earth: "#253246", rail: "#70e5df", light: "#bdceff", ambient: "#b2c5e6", darkness: 1, maxHeight: 38,
    challenges: ["lanternrun", "noninvertingloop", "corkscrew", "interlockingloops", "helix", "lanternrun"] },
  { id: "halloween", name: "Pumpkin Party", icon: "☾", invitation: "Friendly frights. Pumpkin delights!", start: 3000, end: 4200,
    sky: "#352440", ground: "#625571", earth: "#403548", rail: "#ffb35d", light: "#f0c1f5", ambient: "#b2a0cd", darkness: .85, maxHeight: 40,
    challenges: ["pumpkinhop", "tunnel", "pretzelknot", "triplehelix", "zerogstall", "pumpkinhop"] },
];
export const WORLD_LAP = 4200;
export function adventureAt(distance: number) {
  const lap = Math.floor(Math.max(0, distance) / WORLD_LAP);
  const at = Math.max(0, distance) % WORLD_LAP;
  const index = WORLDS.findIndex(world => at < world.end);
  const world = WORLDS[index];
  return { world, index, lap, stage: lap * WORLDS.length + index,
    progress: Math.max(0, Math.min(1, (at - world.start) / (world.end - world.start))) };
}

// Returning to a world unlocks a few wilder silhouettes, still within its size cap.
export const WORLD_ENCORES: Record<WorldKind, readonly MiniKind[]> = {
  meadow: ["skyhill", "corkscrew"], mountain: ["verticalhill", "diveloop"],
  night: ["nestedloop", "cobraroll"], halloween: ["invertedhill", "tophat", "immelmann"],
};
