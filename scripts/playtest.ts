import { rideResistance } from "../src/difficulty.ts";
import type { Difficulty } from "../src/types.ts";
/** Reproducible balancing harness using the game's real fixed-step physics and
 * seeded track director. Intervals include thinking, typing, and submitting.
 * These are design assumptions, not measurements of children or players. */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { MiniTrack } from "../src/games/mini-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { seededRandom } from "../src/games/mini-rail.ts";

export interface PlayerProfile { name: string; seconds: number; jitter: number; accuracy: number; hesitateEvery: number; }
export const PLAYER_PROFILES: readonly PlayerProfile[] = [
  { name: "Learning", seconds: 4.8, jitter: 0.25, accuracy: 0.9, hesitateEvery: 12 },
  { name: "Steady", seconds: 3.2, jitter: 0.25, accuracy: 0.94, hesitateEvery: 15 },
  { name: "Fluent", seconds: 2, jitter: 0.18, accuracy: 0.97, hesitateEvery: 20 },
  { name: "Expert", seconds: 1.25, jitter: 0.15, accuracy: 0.99, hesitateEvery: 25 },
];
export function simulateRide(seed: number, profile: PlayerProfile, limit = 600, difficulty: Difficulty = "normal") {
  const track = new MiniTrack(seed), physics = new MiniPhysics(track, rideResistance(difficulty));
  const random = seededRandom(seed ^ 0x5eed1234);
  let next = profile.seconds, answers = 0, attempts = 0, retry = false, lowSeconds = 0;
  let maximumSections = track.sections.length, maximumFrames = 0, maximumHeight = 0;
  const encountered = new Set<string>();
  while (physics.time < limit && !physics.held && !physics.crashed) {
    if (profile.seconds > 0 && physics.time >= next) {
      attempts++;
      if (retry || random() < profile.accuracy) {
        physics.impulse(); answers++; retry = false;
        next = physics.time + profile.seconds * (1 + profile.jitter * (random() * 2 - 1));
        if (profile.hesitateEvery && answers % profile.hesitateEvery === 0) next += profile.seconds * 0.55;
      } else { retry = true; next = physics.time + Math.max(0.8, profile.seconds * 0.35); }
    }
    track.ensure(physics.distance);
    const section = track.sectionAt(physics.distance);
    encountered.add(section.kind);
    maximumHeight = Math.max(maximumHeight, physics.track.height(physics.distance) - 4);
    maximumSections = Math.max(maximumSections, track.sections.length);
    maximumFrames = Math.max(maximumFrames, track.sections.reduce((sum, s) => sum + s.frames.length, 0));
    physics.update(1 / 30, h => {
      if (physics.velocity < 10) lowSeconds += h;
      if (physics.held || physics.crashed) return false;
    });
  }
  return { seed, profile: profile.name, seconds: Math.round(physics.time * 10) / 10,
    metres: Math.round(physics.distance - track.startDistance), answers, mistakes: attempts - answers,
    ended: physics.held || physics.crashed, cause: physics.crashed ? "water" : physics.held ? "stopped" : "time limit",
    element: track.sectionAt(physics.distance).kind, peakKmh: Math.round(physics.peakSpeed * 3.6),
    maximumHeight: Math.round(maximumHeight), lowSeconds: Math.round(lowSeconds), jumps: physics.jumps,
    elements: [...encountered], maximumSections, maximumFrames };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const count = process.argv.includes("--quick") ? 8 : 40;
  const rows = PLAYER_PROFILES.flatMap(profile => Array.from({ length: count }, (_, i) => simulateRide(1 + i * 17, profile)));
  const summaries = PLAYER_PROFILES.map(profile => {
    const runs = rows.filter(row => row.profile === profile.name);
    const median = (key: "metres" | "seconds") => {
      const values = runs.map(run => run[key]).sort((a, b) => a - b);
      return (values[Math.floor((count - 1) / 2)] + values[Math.floor(count / 2)]) / 2;
    };
    return { profile: profile.name, medianSeconds: median("seconds"), medianMetres: median("metres"),
      shortestSeconds: Math.min(...runs.map(run => run.seconds)), longestSeconds: Math.max(...runs.map(run => run.seconds)),
      survivedOneMinute: runs.filter(run => run.seconds >= 60).length, survivedFiveMinutes: runs.filter(run => run.seconds >= 300).length,
      reachedTimeLimit: runs.filter(run => !run.ended).length, seeds: count };
  });
  console.log(JSON.stringify({ assumptions: PLAYER_PROFILES, summaries, runs: rows }, null, 2));
}
