// Only this public endpoint belongs in the game bundle. TURN keys stay in the Worker.
export const TURN_ENDPOINT = "https://keep-it-going-relay.robinlinacre.workers.dev/ice";
export type NetworkMode = "auto" | "relay" | "relay-tls";
export type RelayStatus = "loading" | "available" | "unavailable" | "unconfigured";
export type RelaySetup = { config?: RTCConfiguration; status: RelayStatus; expiresAt?: number };

export function networkMode(search: string): NetworkMode {
  const mode = new URLSearchParams(search).get("network");
  return mode === "relay" || mode === "relay-tls" ? mode : "auto";
}

/** Allow only bounded, authenticated ICE server data; never accept arbitrary RTC options. */
export function readIceServers(value: unknown): RTCIceServer[] {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error("Invalid relay response");
  return value.map(server => {
    if (!server || typeof server !== "object") throw new Error("Invalid relay server");
    const urls = typeof server.urls === "string" ? [server.urls] : server.urls;
    if (!Array.isArray(urls) || !urls.length || urls.length > 12 || urls.some(url =>
      typeof url !== "string" || url.length > 300 || !/^(stun|stuns|turn|turns):[^\s/@]+(?::\d+)?(?:\?transport=(udp|tcp))?$/.test(url))) throw new Error("Invalid relay URL");
    const needsAuth = urls.some(url => /^turns?:/.test(url));
    if (needsAuth && (typeof server.username !== "string" || !server.username.length || server.username.length > 1024 ||
      typeof server.credential !== "string" || !server.credential.length || server.credential.length > 1024)) throw new Error("Missing relay credentials");
    return needsAuth ? { urls: [...urls], username: server.username, credential: server.credential } : { urls: [...urls] };
  });
}

export async function loadRelay(endpoint: string, mode: NetworkMode = "auto", signal?: AbortSignal,
  fetcher: typeof fetch = fetch, timeoutMs = 5000): Promise<RelaySetup> {
  if (!endpoint) {
    if (mode !== "auto") throw new Error("Relay testing needs a configured relay service.");
    return { status: "unconfigured" };
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Relay endpoint must use HTTPS");
    const response = await fetcher(url, { method: "POST", credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error("Relay service unavailable");
    const text = await response.text();
    if (text.length > 24000) throw new Error("Invalid relay response");
    const data = JSON.parse(text);
    let iceServers = readIceServers(data.iceServers);
    if (!Number.isFinite(data.expiresAt) || data.expiresAt < Date.now() + 60000 || data.expiresAt > Date.now() + 86400000) throw new Error("Expired relay credentials");
    if (mode === "relay-tls") iceServers = iceServers.map(server => ({ ...server,
      urls: (server.urls as string[]).filter(url => /^turns:.*:443\?transport=tcp$/.test(url)),
    })).filter(server => server.urls.length);
    if (!iceServers.some(server => (server.urls as string[]).some(url => /^turns?:/.test(url)))) throw new Error("No usable TURN server");
    return { status: "available", config: { iceServers, iceTransportPolicy: mode === "auto" ? "all" : "relay" }, expiresAt: data.expiresAt };
  } catch {
    if (signal?.aborted) throw new Error("Connection cancelled");
    if (mode !== "auto") throw new Error("The relay test could not obtain credentials. Try again when the relay service is available.");
    // Preserve the existing PeerJS direct/public-relay path during a credential-service outage.
    return { status: "unavailable" };
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}

export type RouteInfo = { route: "unknown" | "direct" | "relay"; protocol?: string; relayProtocol?: string; roundTripMs?: number };
/** Deliberately omit addresses, peer IDs, URLs and all credentials from diagnostics. */
export function selectedRoute(report: RTCStatsReport): RouteInfo {
  const stats = Array.from(report.values());
  const transport = stats.find(s => s.type === "transport" && s.selectedCandidatePairId);
  const pair = transport ? report.get(transport.selectedCandidatePairId) : stats.find(s => s.type === "candidate-pair" && s.state === "succeeded" && s.nominated);
  if (!pair) return { route: "unknown" };
  const local = report.get(pair.localCandidateId), remote = report.get(pair.remoteCandidateId);
  const relay = local?.candidateType === "relay" || remote?.candidateType === "relay";
  return { route: relay ? "relay" : "direct", protocol: local?.protocol, relayProtocol: local?.relayProtocol,
    roundTripMs: Number.isFinite(pair.currentRoundTripTime) ? Math.round(pair.currentRoundTripTime * 1000) : undefined };
}
