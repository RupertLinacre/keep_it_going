import test from "node:test";
import assert from "node:assert/strict";
import { save, bestRide, record, recordRide } from "../src/storage.ts";

test("ride records keep personal bests, remain separate by difficulty, and survive shorter runs", () => {
  save.best = {}; save.rides = {};
  record("mini", "normal", 1200); recordRide("normal", 560, 45.8);
  record("mini", "normal", 100); recordRide("normal", 200, 0);
  recordRide("hard", 90, 12);
  assert.deepEqual(bestRide("normal"), { score: 1200, distance: 560, jump: 45.8 });
  assert.deepEqual(bestRide("hard"), { score: 0, distance: 90, jump: 12 });
  assert.deepEqual(bestRide("easy"), { score: 0, distance: 0, jump: 0 });
  recordRide("normal", NaN, Infinity);
  assert.equal(bestRide("normal").distance, 560, "Invalid values cannot erase or poison a record");
  assert.equal(bestRide("normal").jump, 45.8);
});
