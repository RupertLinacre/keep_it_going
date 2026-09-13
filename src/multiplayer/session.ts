import { normalizeDifficulty } from "../difficulty";
import type { Difficulty } from "../types";
import type Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { normalizeTables } from "../questions";
import { cleanCode, cleanName, inviteCode, parseWire, PROTOCOL, validCode,
  type RaceResult, type RideState, type Round, type Wire } from "./protocol";

type Phase = "idle" | "opening" | "waiting" | "ready" | "preparing" | "countdown" | "racing" | "complete" | "error" | "closed";
type Events = { change: undefined; prepare: Round; go: number; state: RideState };
export type PeerFactory = (id?: string) => Promise<Peer>;
const createPeer: PeerFactory = async id => {
  const { default: Peer } = await import("peerjs");
  return id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
};

/** Each rider owns their coaster. Only presentation snapshots cross the connection;
 * remote packets cannot boost or change the local physics. */
export class RaceSession {
  role: "host" | "guest" = "host";
  phase: Phase = "idle";
  code = "";
  name = "Rider";
  opponent = "Friend";
  tables: number[] = normalizeTables(undefined);
  difficulty: Difficulty = "normal";
  status = "";
  connected = false;
  round?: Round;
  startsAt = 0;
  localPaused = false;
  remotePaused = false;
  localResult?: RaceResult;
  remoteResult?: RaceResult;
  localRematch = false;
  remoteRematch = false;
  private listeners = new Map<keyof Events, Set<(value: any) => void>>();
  private peer?: Peer;
  private connection?: DataConnection;
  private attempt = 0;
  private lastActivity = 0;
  private heartbeat?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private localReady = false;
  private remoteReady = false;
  private roundTrip = 0;
  private lastSeq = -1;

  constructor(private factory: PeerFactory = createPeer) {}
  on<K extends keyof Events>(event: K, fn: (value: Events[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => { this.listeners.get(event)?.delete(fn); };
  }
  private emit<K extends keyof Events>(event: K, value: Events[K]) { this.listeners.get(event)?.forEach(fn => fn(value)); }
  private change() { this.emit("change", undefined); }
  private fail(message: string) {
    if (this.phase === "closed" || this.phase === "error") return;
    if (this.phase !== "complete") this.phase = "error";
    this.status = message; this.connected = false;
    clearTimeout(this.timeout); clearInterval(this.heartbeat);
    this.change();
  }
  async open(role: "host" | "guest", name: string, tables: number[], code = "", difficulty: Difficulty = "normal") {
    this.close();
    const attempt = ++this.attempt;
    this.difficulty = normalizeDifficulty(difficulty);
    this.role = role; this.name = cleanName(name); this.tables = normalizeTables(tables);
    this.code = role === "host" ? inviteCode() : cleanCode(code);
    this.phase = "opening";
    this.status = role === "host" ? "Creating your invite…" : "Finding your friend…";
    this.change();
    if (!validCode(this.code)) { this.fail("Enter the four-character invite code from your friend."); return; }
    this.deadline("Couldn’t connect. Check your internet connection and try again.", 20000);
    try {
      const peer = await this.factory(role === "host" ? `keep-going-v${PROTOCOL}-${this.code.toLowerCase()}` : undefined);
      if (attempt !== this.attempt) { peer.destroy(); return; }
      this.peer = peer;
      peer.on("open", () => {
        if (attempt !== this.attempt || this.phase === "error") return;
        if (role === "host") {
          clearTimeout(this.timeout);
          this.phase = "waiting"; this.status = "Invite ready. Waiting for your friend…"; this.change();
        } else this.attach(peer.connect(`keep-going-v${PROTOCOL}-${this.code.toLowerCase()}`, { reliable: true, serialization: "json" }), attempt);
      });
      peer.on("connection", connection => {
        if (attempt !== this.attempt || role !== "host" || this.connection || this.phase !== "waiting") {
          connection.on("open", () => {
            connection.send({ kind: "error", message: "This ride already has two players. Ask your friend for a new invite." } satisfies Wire);
            setTimeout(() => connection.close(), 300);
          });
          return;
        }
        this.attach(connection, attempt);
      });
      peer.on("error", error => {
        if (attempt !== this.attempt) return;
        const type = (error as { type?: string }).type;
        if (this.connection?.open && (type === "network" || type === "server-error")) return;
        this.fail(type === "unavailable-id" ? "That invite code is busy. Create a new invite."
          : type === "peer-unavailable" ? "That invite wasn’t found. Check the code and that your friend is still on the invite screen."
          : "Couldn’t connect to your friend. Try again, or try another network.");
      });
      // Signalling can reconnect without interrupting an established data channel.
      peer.on("disconnected", () => { if (attempt === this.attempt && !peer.destroyed) peer.reconnect(); });
    } catch { if (attempt === this.attempt) this.fail("Couldn’t start multiplayer. Check your connection and try again."); }
  }
  private deadline(message: string, ms = 15000) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.fail(message), ms);
  }
  private attach(connection: DataConnection, attempt: number) {
    this.connection = connection;
    this.deadline("Your friend couldn’t finish connecting. Try a new invite or another network.");
    connection.on("open", () => {
      if (attempt !== this.attempt) return;
      this.lastActivity = performance.now();
      if (this.role === "guest") this.send({ kind: "hello", version: PROTOCOL, name: this.name });
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        if (performance.now() - this.lastActivity > 15000) {
          this.fail("Connection lost. The race has stopped; no winner has been declared."); return;
        }
        this.send({ kind: "ping", at: performance.now() });
      }, 1000);
    });
    connection.on("data", data => {
      if (attempt !== this.attempt || this.phase === "error") return;
      const message = parseWire(data);
      if (!message) return;
      this.lastActivity = performance.now();
      this.receive(message);
    });
    connection.on("close", () => { if (attempt === this.attempt) this.fail("Your friend disconnected. Return to the start screen to invite them again."); });
    connection.on("error", () => { if (attempt === this.attempt) this.fail("Connection lost. Try a new invite or another network."); });
  }
  private send(message: Wire) {
    if (!this.connection?.open) return;
    try { this.connection.send(message); }
    catch { this.fail("Connection lost. Return to the start screen to try again."); }
  }
  private receive(message: Wire) {
    if (message.kind === "ping") { this.send({ kind: "pong", at: message.at }); return; }
    if (message.kind === "pong") { this.roundTrip = Math.min(1000, Math.max(0, performance.now() - message.at)); return; }
    if (message.kind === "error") { this.fail(message.message); return; }
    if (message.kind === "leave") { this.fail("Your friend left the ride. Return to the start screen to play again."); return; }
    if (message.kind === "hello" && this.role === "host" && this.phase === "waiting") {
      if (message.version !== PROTOCOL) {
        this.send({ kind: "error", message: "You’re using different game versions. Both refresh the page, then create a new invite." });
        this.fail("Your friend is using a different version. Both refresh the page and try again."); return;
      }
      this.opponent = cleanName(message.name); this.connected = true; this.phase = "ready";
      this.status = "You’re both here. Ready to ride!";
      clearTimeout(this.timeout);
      this.send({ kind: "lobby", name: this.name, tables: this.tables, difficulty: this.difficulty }); this.change(); return;
    }
    if (message.kind === "lobby" && this.role === "guest" && this.phase === "opening") {
      this.opponent = message.name; this.tables = message.tables; this.difficulty = message.difficulty; this.connected = true; this.phase = "ready";
      this.status = "You’re connected. Your friend will start the ride.";
      clearTimeout(this.timeout); this.change(); return;
    }
    if (message.kind === "prepare" && this.role === "guest" && ["ready", "complete"].includes(this.phase)) {
      if (this.phase === "complete" && !this.localRematch) return;
      this.prepare(message.round); return;
    }
    if (!("round" in message) || message.round !== this.round?.id) return;
    if (message.kind === "ready" && this.phase === "preparing" && this.role === "host") {
      this.remoteReady = true; this.maybeGo();
    } else if (message.kind === "go" && this.phase === "preparing" && this.role === "guest" && this.localReady) {
      this.go(message.delay);
    } else if (message.kind === "state" && ["racing", "countdown"].includes(this.phase) && message.state.seq > this.lastSeq) {
      this.lastSeq = message.state.seq; this.emit("state", message.state);
    } else if (message.kind === "finish" && ["racing", "countdown"].includes(this.phase) && !this.remoteResult) {
      this.remoteResult = message.result; this.checkComplete();
    } else if (message.kind === "pause" && ["racing", "countdown"].includes(this.phase)) {
      this.remotePaused = message.paused; this.change();
    } else if (message.kind === "rematch" && this.phase === "complete") {
      this.remoteRematch = true; this.change(); this.maybeRematch();
    }
  }
  start() {
    if (this.role !== "host" || !this.connected || !["ready", "complete"].includes(this.phase)) return;
    const seed = crypto.getRandomValues(new Uint32Array(2));
    const round: Round = { id: `${Date.now()}-${seed[0]}`, seed: seed[0], questionSeed: seed[1], tables: [...this.tables], difficulty: this.difficulty };
    this.send({ kind: "prepare", round }); this.prepare(round);
  }
  private prepare(round: Round) {
    this.round = round; this.phase = "preparing"; this.localReady = this.remoteReady = false;
    this.localPaused = this.remotePaused = false; this.localResult = this.remoteResult = undefined;
    this.localRematch = this.remoteRematch = false; this.lastSeq = -1;
    this.deadline("Your friend’s game couldn’t load. Return to the start screen and try again.", 30000);
    this.change(); this.emit("prepare", round);
  }
  ready() {
    if (this.phase !== "preparing" || !this.round) return;
    this.localReady = true;
    if (this.role === "guest") this.send({ kind: "ready", round: this.round.id });
    else this.maybeGo();
  }
  private maybeGo() {
    if (!this.localReady || !this.remoteReady || this.phase !== "preparing") return;
    this.send({ kind: "go", round: this.round!.id, delay: Math.max(2000, 3000 - this.roundTrip / 2) });
    this.go(3000);
  }
  private go(delay: number) {
    clearTimeout(this.timeout); this.startsAt = performance.now() + delay; this.phase = "countdown";
    this.emit("go", this.startsAt); this.change();
  }
  begin() { if (this.phase === "countdown") { this.phase = "racing"; this.change(); } }
  sendState(state: RideState) {
    if (this.round && ["racing", "countdown"].includes(this.phase) && (this.connection?.dataChannel?.bufferedAmount ?? 0) < 64000)
      this.send({ kind: "state", round: this.round.id, state });
  }
  finish(result: RaceResult) {
    if (!this.round || this.localResult || !["racing", "countdown"].includes(this.phase)) return;
    this.localResult = result; this.send({ kind: "finish", round: this.round.id, result }); this.checkComplete();
  }
  private checkComplete() {
    if (this.localResult && this.remoteResult) this.phase = "complete";
    this.change();
  }
  pause(paused: boolean) {
    if (!this.round || !["racing", "countdown"].includes(this.phase)) return;
    this.localPaused = paused; this.send({ kind: "pause", round: this.round.id, paused }); this.change();
  }
  rematch() {
    if (this.phase !== "complete" || this.localRematch || !this.connected) return;
    this.localRematch = true; this.send({ kind: "rematch", round: this.round!.id }); this.change(); this.maybeRematch();
  }
  private maybeRematch() { if (this.role === "host" && this.localRematch && this.remoteRematch) this.start(); }
  close() {
    if (this.connection?.open) this.send({ kind: "leave" });
    ++this.attempt;
    clearTimeout(this.timeout); clearInterval(this.heartbeat);
    this.connection?.close(); this.peer?.destroy(); this.connection = undefined; this.peer = undefined;
    this.connected = false; this.phase = "closed"; this.round = undefined;
    this.localResult = this.remoteResult = undefined;
  }
}
