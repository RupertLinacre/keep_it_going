import { HeightTrack } from "../src/games/height-track.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { rideResistance } from "../src/difficulty.ts";

// Answer intervals include thinking and entry time. This is a model, not human data.
for (const seconds of [0, 4.8, 3.2, 2]) {
  for (const seed of [1, 18, 42]) {
    const track = new HeightTrack(seed), physics = new MiniPhysics(track, rideResistance("normal"));
    let next = seconds, answers = 0, queued = 0;
    while (!physics.held && !physics.crashed && physics.time < 120) {
      if (seconds && physics.time >= next) {
        if (physics.flight) queued++; else track.raise(physics.distance);
        answers++; next += seconds;
      }
      track.ensure(physics.distance);
      if (!physics.flight) {
        while (queued > 0) { track.raise(physics.distance); queued--; }
        track.advance(1/30);
      }
      physics.update(1/30, () => physics.held || physics.crashed ? false : undefined);
    }
    console.log(JSON.stringify({ seconds, seed, duration: +physics.time.toFixed(1), metres: Math.round(physics.distance - track.startDistance),
      answers, end: physics.crashed ? "water" : physics.held ? track.sectionAt(physics.distance).kind : "time limit" }));
  }
}
