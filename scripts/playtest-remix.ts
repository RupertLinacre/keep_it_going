import { pathToFileURL } from "node:url";
import { Mini } from "../src/games/mini.ts";
import { seededRandom } from "../src/games/mini-rail.ts";
import type { Difficulty, Host } from "../src/types.ts";
import type { PowerKind } from "../src/games/ride-powerups.ts";

class Headless extends Mini { setup() {} }
export function simulateRemix(seed: number, interval: number, limit = 180, difficulty: Difficulty = "normal") {
  const host: Host = { stage: {} as HTMLElement, difficulty, panel() {}, stats() {}, feedback() {}, sound() {}, finish() {} };
  const game = new Headless(host, seed, { remixMode: true, tables: [2,3,4,5,6,7,8,9], questionSeed: seed ^ 17 });
  const random = seededRandom(seed ^ 0x516ee);
  let next = interval, previous: PowerKind | undefined;
  const effects: PowerKind[] = [];
  while (!game.ended && game.elapsed < limit) {
    if (interval && game.elapsed >= next) {
      if (random() < .96) for (const digit of String(game.a * game.b)) game.key(digit);
      next = game.elapsed + interval * (.8 + random()*.4);
    }
    game.update(1/30);
    if (game.powerups!.active && game.powerups!.active !== previous) effects.push(game.powerups!.active);
    previous = game.powerups!.active;
  }
  return { seed, interval, difficulty, seconds: +game.elapsed.toFixed(1), metres: Math.round(game.travelled),
    answers: game.correct, ended: game.ended, cause: game.physics.crashed ? "water" : game.track.sectionAt(game.physics.distance).kind,
    effects, jumps: game.physics.jumps, carts: game.cartCount, parcels: game.carriages.parcels.length,
    finite: Number.isFinite(game.physics.velocity) && Number.isFinite(game.physics.distance) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const quick = process.argv.includes("--quick");
  for (const interval of [4.8, 3.2, 2]) for (const seed of quick ? [1,18,42] : [1,18,42,73,127,731,2048,9917])
    console.log(JSON.stringify(simulateRemix(seed, interval, quick ? 90 : 180)));
}
