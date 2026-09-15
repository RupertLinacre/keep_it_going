import { normalizeDifficulty } from "../difficulty";
import type { Difficulty } from "../types";
import type Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { normalizeTables } from "../questions";
import { loadRelay, networkMode, selectedRoute, TURN_ENDPOINT, type NetworkMode, type RelayStatus, type RouteInfo } from "./relay";
import { cleanCode, cleanName, inviteCode, parseWire, PROTOCOL, validCode,
  type RaceResult, type RideState, type Round, type Wire } from "./protocol";

type Phase = "idle" | "opening" | "waiting" | "ready" | "preparing" | "countdown" | "racing" | "complete" | "error" | "closed";
type Events = { change: undefined; prepare: Round; go: number; state: RideState };
type PeerSetup = { signal: AbortSignal; mode: NetworkMode; relay(status: RelayStatus): void };
export type PeerFactory = (id?: string, setup?: PeerSetup) => Promise<Peer>;
const createPeer: PeerFactory = async (id, setup) => {
  const endpoint = import.meta.env?.VITE_TURN_ENDPOINT || TURN_ENDPOINT;
  const [{ default: Peer }, relay] = await Promise.all([import("peerjs"), loadRelay(endpoint, setup?.mode, setup?.signal)]);
  if (setup?.signal.aborted) throw new Error("Connection cancelled");
  setup?.relay(relay.status);
  const options = { debug: 1, ...(relay.config ? { config: relay.config } : {}) };
  const peer = id ? new Peer(id, options) : new Peer(options);
  // Refresh credentials for long waiting rooms/rematches without interrupting
  // the existing data channel. Future connections use the refreshed config too.
  const refresh = relay.config ? setInterval(async () => {
    const fresh = await loadRelay(endpoint, setup?.mode, setup?.signal).catch(() => undefined);
    if (!fresh?.config || peer.destroyed || setup?.signal.aborted) return;
    peer.options.config = fresh.config;
    for (const connections of Object.values(peer.connections)) for (const connection of connections) {
      try { connection.peerConnection?.setConfiguration(fresh.config); } catch { /* A closed connection needs no refresh. */ }
    }
    setup?.relay(fresh.status);
  }, 30 * 60 * 1000) : undefined;
  const cleanup = () => clearInterval(refresh);
  peer.on("close", cleanup);
  setup?.signal.addEventListener("abort", cleanup, { once: true });
  return peer;
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
  opponentDifficulty: Difficulty = "normal";
  remixMode = false;
  private courseSeed?: number;
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
  private abort?: AbortController;
  private routeTimer?: ReturnType<typeof setInterval>;
  network: RouteInfo & { mode: NetworkMode; relay: RelayStatus; stage: string; error?: string } = {
    mode: "auto", relay: "unconfigured", stage: "idle", route: "unknown",
  };

  /** Safe to copy into a bug report: no addresses, invite codes or credentials. */
  diagnostics() {
    const pc = this.connection?.peerConnection;
    return { version: PROTOCOL, phase: this.phase, ...this.network,
      iceState: pc?.iceConnectionState, gatheringState: pc?.iceGatheringState };
  }

  private async inspectRoute() {
    const connection = this.connection;
    if (!connection?.peerConnection?.getStats) return;
    try {
      const report = await connection.peerConnection.getStats();
      if (this.connection !== connection || this.phase === "closed") return;
      this.network = { ...this.network, ...selectedRoute(report) };
      this.change();
    } catch { /* Diagnostics must never interrupt a race. */ }
  }

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
    this.abort?.abort();
    clearTimeout(this.timeout); clearInterval(this.heartbeat); clearInterval(this.routeTimer);
    this.change();
  }
  async open(role: "host" | "guest", name: string, tables: number[], code = "", difficulty: Difficulty = "normal", options: { remixMode?: boolean; seed?: number } = {}) {
    this.close();
    const attempt = ++this.attempt;
    this.abort = new AbortController();
    this.network = { mode: networkMode(typeof location === "undefined" ? "" : location.search), relay: "loading", stage: "credentials", route: "unknown" };
    this.difficulty = normalizeDifficulty(difficulty);
    this.remixMode = !!options.remixMode;
    this.courseSeed = options.seed;
    this.role = role; this.name = cleanName(name); this.tables = normalizeTables(tables);
    this.code = role === "host" ? inviteCode() : cleanCode(code);
    this.phase = "opening";
    this.status = role === "host" ? "Creating your invite…" : "Finding your friend…";
    this.change();
    if (!validCode(this.code)) { this.fail("Enter the four-character invite code from your friend."); return; }
    this.deadline("Couldn’t reach the invite service. Check your internet connection and try again.", 30000);
    try {
      const peer = await this.factory(role === "host" ? `keep-going-v${PROTOCOL}-${this.code.toLowerCase()}` : undefined, {
        signal: this.abort.signal, mode: this.network.mode,
        relay: status => { if (attempt === this.attempt) { this.network.relay = status; this.change(); } },
      });
      if (attempt !== this.attempt || (this.phase as Phase) === "error") { peer.destroy(); return; }
      this.peer = peer;
      this.network.stage = "signalling";
      peer.on("open", () => {
        if (attempt !== this.attempt || this.phase === "error") return;
        if (role === "host") {
          clearTimeout(this.timeout);
          this.network.stage = "waiting";
          this.phase = "waiting"; this.status = "Invite ready. Waiting for your friend…"; this.change();
        } else this.attach(peer.connect(`keep-going-v${PROTOCOL}-${this.code.toLowerCase()}`, { reliable: true, serialization: "binary" }), attempt);
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
        this.network.error = type || "peer-error";
        this.fail(type === "unavailable-id" ? "That invite code is busy. Create a new invite."
          : type === "peer-unavailable" ? "That invite wasn’t found. Open the same game link on both devices, refresh, and create a new invite."
          : ["network", "server-error", "socket-error"].includes(type || "") ? "Couldn’t reach the invite service. Check your internet connection and try again."
          : "Couldn’t connect to your friend. Try again, or try another network.");
      });
      // Signalling can reconnect without interrupting an established data channel.
      peer.on("disconnected", () => { if (attempt === this.attempt && !peer.destroyed) peer.reconnect(); });
    } catch { if (attempt === this.attempt) { this.network.relay = "unavailable"; this.network.error = "setup-failed"; this.fail(this.network.mode !== "auto" ? "Relay testing could not start. The relay service needs to be available." : "Couldn’t start multiplayer. Check your connection and try again."); } }
  }
  private deadline(message: string, ms = 15000) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.fail(message), ms);
  }
  private attach(connection: DataConnection, attempt: number) {
    this.connection = connection;
    this.network.stage = "connecting";
    this.change();
    this.deadline("Your friend couldn’t finish connecting. Try a new invite or another network.", 30000);
    connection.on("open", () => {
      if (attempt !== this.attempt || this.phase === "error") return;
      this.network.stage = "connected";
      void this.inspectRoute();
      clearInterval(this.routeTimer);
      this.routeTimer = setInterval(() => { void this.inspectRoute(); }, 5000);
      this.lastActivity = performance.now();
      if (this.role === "guest") this.send({ kind: "hello", version: PROTOCOL, name: this.name, difficulty: this.difficulty });
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
      this.opponentDifficulty = message.difficulty;
      this.opponent = cleanName(message.name); this.connected = true; this.phase = "ready";
      this.status = "You’re both here. Ready to ride!";
      clearTimeout(this.timeout);
      this.send({ kind: "lobby", name: this.name, tables: this.tables, difficulty: this.difficulty, mode: this.remixMode ? "remix" : "classic" }); this.change(); return;
    }
    if (message.kind === "lobby" && this.role === "guest" && this.phase === "opening") {
      this.remixMode = message.mode === "remix";
      this.opponent = message.name; this.tables = message.tables; this.opponentDifficulty = message.difficulty; this.connected = true; this.phase = "ready";
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
    const round: Round = { id: `${Date.now()}-${seed[0]}`, seed: this.courseSeed ?? seed[0], questionSeed: seed[1], tables: [...this.tables], difficulty: this.difficulty, guestDifficulty: this.opponentDifficulty, mode: this.remixMode ? "remix" : "classic" };
    this.send({ kind: "prepare", round }); this.prepare(round);
  }
  private prepare(round: Round) {
    this.remixMode = round.mode === "remix";
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
    this.abort?.abort();
    clearTimeout(this.timeout); clearInterval(this.heartbeat); clearInterval(this.routeTimer);
    this.connection?.close(); this.peer?.destroy(); this.connection = undefined; this.peer = undefined;
    this.connected = false; this.phase = "closed"; this.round = undefined;
    this.network.stage = "closed";
    this.localResult = this.remoteResult = undefined;
  }
}
