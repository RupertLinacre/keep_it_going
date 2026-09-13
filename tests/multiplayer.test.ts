import { riderColor, riderColorIndex } from "../src/multiplayer/identity.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Vector3 } from "three";
import { Mini } from "../src/games/mini.ts";
import { MiniTrack } from "../src/games/mini-track.ts";
import { ALL_TABLES, normalizeTables, questionSequence } from "../src/questions.ts";
import { OpponentGhost, lanePosition, mirrorRotation, raceLaneOffset, snapshotRide } from "../src/multiplayer/ghost.ts";
import { cleanCode, inviteCode, parseWire, raceWinner, validCode, validRideState, type RideState } from "../src/multiplayer/protocol.ts";
import { RaceSession, type PeerFactory } from "../src/multiplayer/session.ts";
import type { Host } from "../src/types.ts";

const state = (seq = 1, x = 10): RideState => ({ seq, time: seq / 12, distance: 100 + x, speed: 20, correct: 1, ended: false,
  bodies: [{ id: "coach-0", color: 0, cargo: 0, cargoAge: 1, position: [x, 4, 0], rotation: [0, 0, 0, 1] }], parcels: [], links: [], impacts: [] });

test("selected tables form a deterministic full deck with no duplicates", () => {
  const a = questionSequence([7, 12], 813), b = questionSequence([12, 7], 813);
  const deck = Array.from({ length: 24 }, a);
  assert.deepEqual(deck, Array.from({ length: 24 }, b));
  assert.equal(new Set(deck.map(pair => pair.join("x"))).size, 24);
  assert.ok(deck.every(([a, b]) => [7, 12].includes(a) && ALL_TABLES.includes(b)));
  assert.equal(Array.from({ length: 24 }, a).length, 24, "A fresh deck remains available");
  assert.deepEqual(normalizeTables([0, 7, 7, 13, "2", NaN]), [7]);
  assert.ok(normalizeTables([]).length > 0);
});

test("two players see the same questions independently of their answer pace and scenery", () => {
  class Headless extends Mini { setup() {} }
  const host: Host = { difficulty: "normal", stage: {} as HTMLElement, panel() {}, stats() {}, feedback() {}, sound() {}, finish() {} };
  const a = new Headless(host, 42, { tables: [8, 9], questionSeed: 19 });
  const b = new Headless(host, 42, { tables: [8, 9], questionSeed: 19 });
  const questions: [number, number][] = [];
  for (let i = 0; i < 25; i++) {
    questions.push([a.a, a.b]);
    for (const key of String(a.a * a.b)) a.key(key);
    a.update(.1);
  }
  for (const expected of questions) {
    assert.deepEqual([b.a, b.b], expected);
    for (const key of String(b.a * b.b)) b.key(key);
  }
  assert.equal(a.correct, 25); assert.equal(b.correct, 25);
  assert.ok(validRideState(snapshotRide(a, 1)));
});

test("mirrored tracks stay separated and car orientation follows every reflected rail", () => {
  for (const seed of [1, 12, 42]) {
    const track = new MiniTrack(seed);
    for (const distance of [track.startDistance, 1800, 4500]) {
      track.ensure(distance);
      const offset = raceLaneOffset(track);
      for (const section of track.sections) for (const frame of section.frames.filter((_, i) => i % 12 === 0)) {
        const local = lanePosition(frame.position, offset);
        const rival = lanePosition(frame.position, offset, true);
        assert.ok(local.z >= 7 - 1e-8 && rival.z <= -7 + 1e-8);
        assert.equal(local.x, rival.x); assert.equal(local.y, rival.y);
        const rotation = mirrorRotation(frame.rotation);
        const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
        const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
        assert.ok(forward.distanceTo(new Vector3(frame.tangent.x, frame.tangent.y, -frame.tangent.z)) < 1e-8);
        assert.ok(up.distanceTo(new Vector3(frame.up.x, frame.up.y, -frame.up.z)) < 1e-8);
      }
    }
  }
});

test("remote snapshots interpolate at display rate, reject reordering and never run ahead", () => {
  const ghost = new OpponentGhost();
  ghost.push(state(1, 0), 0); ghost.push(state(2, 10), 100);
  assert.equal(ghost.sample(160)!.bodies[0].position[0], 5);
  const positions = Array.from({ length: 6 }, (_, i) => ghost.sample(110 + i * 16)!.bodies[0].position[0]);
  assert.equal(new Set(positions).size, 6);
  ghost.push(state(1, -100), 200);
  assert.equal(ghost.latest!.seq, 2);
  assert.equal(ghost.sample(5000)!.bodies[0].position[0], 10);
  assert.equal(ghost.sample(5000)!.distance, 110);
});

test("wire validation bounds remote geometry and rejects malformed packets", () => {
  assert.ok(validCode(inviteCode())); assert.ok(validCode(cleanCode(" abcd ")));
  assert.equal(validCode("AB0I"), false);
  const good = { kind: "state", round: "round-1", state: state() };
  assert.ok(parseWire(good));
  for (const change of [{ distance: NaN }, { speed: Infinity }, { bodies: [] }, { seq: -1 }, { links: Array(11).fill({}) }])
    assert.equal(parseWire({ ...good, state: { ...good.state, ...change } }), undefined);
  const body = good.state.bodies[0];
  for (const change of [{ cargo: 5 }, { position: [0, 0] }, { rotation: [0, 0, 0, 0] }])
    assert.equal(validRideState({ ...good.state, bodies: [{ ...body, ...change }] }), false);
  assert.equal(parseWire({ kind: "prepare", round: { id: "x", seed: 1, questionSeed: 2, tables: [] } }), undefined);
});

test("distance alone decides the race, with ties at the displayed tenth of a metre", () => {
  const a = { distance: 50.001, correct: 8, score: 100, water: false };
  assert.equal(raceWinner(a, { ...a, distance: 50.003, correct: 9 }), "draw");
  assert.equal(raceWinner(a, { ...a, distance: 49.9, score: 2000 }), "local");
  assert.equal(raceWinner(a, { ...a, distance: 51, water: true }), "remote");
});

class Connection extends EventEmitter {
  open = false;
  other!: Connection;
  dataChannel = { bufferedAmount: 0 };
  send(data: unknown) { queueMicrotask(() => { if (this.other.open) this.other.emit("data", structuredClone(data)); }); }
  close() {
    if (!this.open) return;
    this.open = false; this.emit("close");
    if (this.other.open) { this.other.open = false; this.other.emit("close"); }
  }
}
function peers() {
  const registry = new Map<string, FakePeer>();
  class FakePeer extends EventEmitter {
    destroyed = false;
    connections: Connection[] = [];
    constructor(readonly id: string) {
      super(); registry.set(id, this); setTimeout(() => { if (!this.destroyed) this.emit("open", id); }, 0);
    }
    connect(id: string) {
      const a = new Connection(), b = new Connection(); a.other = b; b.other = a;
      this.connections.push(a);
      setTimeout(() => {
        const host = registry.get(id);
        if (!host) { this.emit("error", { type: "peer-unavailable" }); return; }
        host.connections.push(b); host.emit("connection", b);
        a.open = b.open = true; b.emit("open"); a.emit("open");
      }, 0);
      return a;
    }
    reconnect() {}
    destroy() { this.destroyed = true; registry.delete(this.id); this.connections.forEach(c => c.close()); }
  }
  const factory: PeerFactory = async id => new FakePeer(id ?? `guest-${Math.random()}`) as any;
  return { factory, registry };
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail("Expected session transition did not arrive");
}

test("invite, shared start, independent inputs, pause, final results and mutual rematch", async () => {
  const { factory, registry } = peers();
  const host = new RaceSession(factory), guest = new RaceSession(factory);
  try {
    await host.open("host", "Alice", [7], "", "very-easy"); await until(() => host.phase === "waiting");
    await guest.open("guest", "Bob", [2], host.code); await until(() => guest.phase === "ready");
    assert.equal(host.opponent, "Bob"); assert.equal(guest.opponent, "Alice"); assert.deepEqual(guest.tables, [7]);
    host.on("prepare", () => host.ready()); guest.on("prepare", () => guest.ready());
    host.start(); await until(() => guest.phase === "countdown");
    assert.equal(guest.difficulty, "normal"); assert.equal(host.opponentDifficulty, "normal"); assert.equal(guest.opponentDifficulty, "very-easy"); assert.equal(guest.round!.guestDifficulty, "normal"); assert.equal(guest.round!.difficulty, "very-easy");
    assert.deepEqual(host.round, guest.round); assert.ok(Math.abs(host.startsAt - guest.startsAt) < 50);
    host.begin(); guest.begin();
    let remote: RideState | undefined; guest.on("state", state => { remote = state; });
    host.sendState(state()); await until(() => !!remote); assert.equal(remote!.distance, 110);
    host.sendState(state(0, 300)); await new Promise(r => setTimeout(r, 5)); assert.equal(remote!.distance, 110);
    const hostPeer = [...registry.values()].find(p => p.id.startsWith("keep-going"))!;
    hostPeer.connections[0].send({ kind: "state", round: "old-round", state: state(50, 500) });
    await new Promise(r => setTimeout(r, 5)); assert.equal(remote!.distance, 110);
    guest.pause(true); await until(() => host.remotePaused); guest.pause(false); await until(() => !host.remotePaused);
    host.finish({ distance: 100, correct: 8, score: 1000, water: false }); await until(() => !!guest.remoteResult);
    assert.equal(guest.phase, "racing");
    guest.finish({ distance: 120, correct: 9, score: 1100, water: true }); await until(() => host.phase === "complete");
    assert.equal(guest.phase, "complete"); assert.deepEqual(guest.localResult, host.remoteResult);
    const previous = host.round!.id;
    host.rematch(); await new Promise(r => setTimeout(r, 5)); assert.equal(host.round!.id, previous);
    guest.rematch(); await until(() => guest.phase === "countdown");
    assert.notEqual(host.round!.id, previous); assert.deepEqual(host.round, guest.round);
    assert.equal(host.localResult, undefined); assert.equal(host.remoteResult, undefined);
    guest.close(); await until(() => host.phase === "error");
  } finally { host.close(); guest.close(); }
});

test("missing rooms fail, a third rider cannot displace either player, leaving cancels pending setup", async () => {
  const { factory } = peers();
  const host = new RaceSession(factory), guest = new RaceSession(factory), third = new RaceSession(factory);
  try {
    await third.open("guest", "Third", [2], "ABCD"); await until(() => third.phase === "error");
    await host.open("host", "Alice", [7]); await until(() => host.phase === "waiting");
    await guest.open("guest", "Bob", [2], host.code); await until(() => guest.phase === "ready");
    await third.open("guest", "Third", [2], host.code); await until(() => third.phase === "error");
    assert.match(third.status, /two players/); assert.equal(host.opponent, "Bob"); assert.equal(host.phase, "ready");
    const pending = third.open("host", "Third", [5]); third.close(); await pending;
    await new Promise(r => setTimeout(r, 10)); assert.equal(third.phase, "closed");
  } finally { host.close(); guest.close(); third.close(); }
});

test("countdown waits until both games have loaded and completed results survive a disconnect", async () => {
  const { factory } = peers();
  const host = new RaceSession(factory), guest = new RaceSession(factory);
  try {
    await host.open("host", "Alice", [3]); await until(() => host.phase === "waiting");
    await guest.open("guest", "Bob", [9], host.code); await until(() => guest.phase === "ready");
    guest.start(); assert.equal(guest.phase, "ready", "Only the host can start");
    host.on("prepare", () => host.ready());
    host.start(); await until(() => guest.phase === "preparing");
    assert.equal(host.phase, "preparing", "One loaded game cannot start the clock");
    guest.ready(); await until(() => guest.phase === "countdown");
    host.begin(); guest.begin();
    host.finish({ distance: 25, correct: 1, score: 100, water: false });
    guest.finish({ distance: 27, correct: 1, score: 100, water: false });
    await until(() => host.phase === "complete" && guest.phase === "complete");
    host.close(); await until(() => !guest.connected);
    assert.equal(guest.phase, "complete"); assert.equal(guest.localResult!.distance, 27);
    assert.equal(guest.remoteResult!.distance, 25); guest.rematch(); assert.equal(guest.localRematch, false);
  } finally { host.close(); guest.close(); }
});

test("identity colours match across screens independently of foreground placement", () => {
  assert.equal(riderColor("host"), riderColor("guest", true));
  assert.equal(riderColor("guest"), riderColor("host", true));
  assert.notEqual(riderColor("host"), riderColor("guest"));
  assert.equal(riderColorIndex("host"), riderColorIndex("guest", true));
  assert.equal(riderColorIndex("guest"), riderColorIndex("host", true));
});
