import test from "node:test";
import assert from "node:assert/strict";
import { loadRelay, networkMode, readIceServers, selectedRoute } from "../src/multiplayer/relay.ts";
import { handle, type Env } from "../infra/turn/worker.ts";
import { RaceSession } from "../src/multiplayer/session.ts";
import { EventEmitter } from "node:events";

const servers = [{ urls: ["stun:stun.cloudflare.com:3478"] }, {
  urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:3478?transport=tcp", "turns:turn.cloudflare.com:443?transport=tcp"],
  username: "temporary-user", credential: "temporary-password",
}];
const valid = () => ({ iceServers: servers, expiresAt: Date.now() + 7200000 });
const endpoint = "https://relay.example/ice";
const reply = (body: unknown, status = 200): typeof fetch => async () => Response.json(body, { status });

test("automatic ICE permits both routes; relay-only and TLS-only tests cannot silently use direct", async () => {
  const automatic = await loadRelay(endpoint, "auto", undefined, reply(valid()));
  assert.equal(automatic.status, "available"); assert.equal(automatic.config?.iceTransportPolicy, "all");
  assert.equal((await loadRelay(endpoint, "relay", undefined, reply(valid()))).config?.iceTransportPolicy, "relay");
  const tls = await loadRelay(endpoint, "relay-tls", undefined, reply(valid()));
  assert.equal(tls.config?.iceTransportPolicy, "relay");
  assert.deepEqual(tls.config?.iceServers, [{ ...servers[1], urls: ["turns:turn.cloudflare.com:443?transport=tcp"] }]);
  assert.equal(networkMode("?network=relay-tls"), "relay-tls"); assert.equal(networkMode("?network=bad"), "auto");
});

test("credential failures retain PeerJS defaults in automatic mode but fail closed in relay tests", async () => {
  assert.deepEqual(await loadRelay(""), { status: "unconfigured" });
  for (const fetcher of [reply({}, 503), reply({ ...valid(), expiresAt: 0 }), reply({ iceServers: [], expiresAt: Date.now() + 7200000 }), reply({ ...valid(), iceServers: [servers[0]] })]) {
    assert.deepEqual(await loadRelay(endpoint, "auto", undefined, fetcher), { status: "unavailable" });
    await assert.rejects(loadRelay(endpoint, "relay", undefined, fetcher));
  }
  await assert.rejects(loadRelay("", "relay"));
});

test("credential requests time out and cancel when the lobby closes", async () => {
  const hanging: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    if (init?.signal?.aborted) reject(new Error("aborted"));
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
  assert.deepEqual(await loadRelay(endpoint, "auto", undefined, hanging, 5), { status: "unavailable" });
  const abort = new AbortController();
  const pending = loadRelay(endpoint, "auto", abort.signal, hanging);
  abort.abort(); await assert.rejects(pending, /cancelled/);
  assert.throws(() => readIceServers([{ urls: "https://evil.example", credential: "bad" }]));
  assert.throws(() => readIceServers([{ urls: "turn:relay.example:3478" }]));
});

const env: Env = { TURN_KEY_ID: "key-id", TURN_KEY_API_TOKEN: "server-secret", ALLOWED_ORIGINS: "https://game.example",
  CREDENTIAL_LIMIT: { limit: async () => ({ success: true }) } };
const request = (origin = "https://game.example", method = "POST") => new Request(endpoint, { method, headers: { Origin: origin, "CF-Connecting-IP": "192.0.2.1" } });

test("Worker confines credentials to approved origins and methods and enforces rate limits", async () => {
  let upstream = 0;
  const fetcher: typeof fetch = async () => { upstream++; return Response.json({ iceServers: servers }); };
  assert.equal((await handle(request("https://other.example"), env, fetcher)).status, 403);
  assert.equal((await handle(request(""), env, fetcher)).status, 403);
  assert.equal((await handle(request(undefined, "GET"), env, fetcher)).status, 405);
  const preflight = await handle(request(undefined, "OPTIONS"), env, fetcher);
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "https://game.example");
  const limited = await handle(request(), { ...env, CREDENTIAL_LIMIT: { limit: async () => ({ success: false }) } }, fetcher);
  assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal((await handle(request(), { ...env, TURN_KEY_API_TOKEN: "" }, fetcher)).status, 503);
  assert.equal(upstream, 0);
});

test("Worker returns only short-lived credentials and never includes provider secrets or errors", async () => {
  const response = await handle(request(), env, async (url, init) => {
    assert.equal(String(url), "https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer server-secret");
    assert.deepEqual(JSON.parse(init!.body as string), { ttl: 7200 });
    return Response.json({ iceServers: servers, secret: "server-secret" });
  });
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.text(); assert.ok(!body.includes("server-secret"));
  assert.equal(JSON.parse(body).iceServers.length, 2);
  const primaryOnly = await handle(request(), env, reply({ iceServers: [{ ...servers[1], urls: ["turn:turn.cloudflare.com:3478?transport=udp"] }] }));
  assert.equal(primaryOnly.status, 200);
  assert.ok((await primaryOnly.json()).iceServers[0].urls.includes("turns:turn.cloudflare.com:443?transport=tcp"));
  const bad = await handle(request(), env, reply({ errors: ["server-secret"] }, 401));
  assert.equal(bad.status, 502); assert.ok(!(await bad.text()).includes("server-secret"));
});

test("route diagnostics use the selected candidate pair and omit IP addresses and credentials", () => {
  const stats = new Map([
    ["transport", { type: "transport", selectedCandidatePairId: "pair" }],
    ["pair", { type: "candidate-pair", localCandidateId: "local", remoteCandidateId: "remote", currentRoundTripTime: .035 }],
    ["local", { candidateType: "relay", protocol: "udp", relayProtocol: "tls", address: "private-address" }],
    ["remote", { candidateType: "host", address: "other-address" }],
  ]) as unknown as RTCStatsReport;
  const route = selectedRoute(stats);
  assert.deepEqual(route, { route: "relay", protocol: "udp", relayProtocol: "tls", roundTripMs: 35 });
  assert.ok(!JSON.stringify(route).includes("address"));
  assert.deepEqual(selectedRoute(new Map() as unknown as RTCStatsReport), { route: "unknown" });
});

test("a peer arriving after leaving the lobby is destroyed and credential fetch is aborted", async () => {
  let done!: (peer: any) => void;
  let signal: AbortSignal | undefined;
  const session = new RaceSession(async (_id, setup) => { signal = setup?.signal; return new Promise(resolve => { done = resolve; }); });
  const opening = session.open("host", "Rider", [2]);
  session.close(); assert.ok(signal?.aborted);
  let destroyed = false;
  done(Object.assign(new EventEmitter(), { destroy() { destroyed = true; } }));
  await opening; assert.ok(destroyed); assert.equal(session.phase, "closed");
});
