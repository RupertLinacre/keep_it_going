import { readIceServers } from "../../src/multiplayer/relay";

export type Env = {
  TURN_KEY_ID: string;
  TURN_KEY_API_TOKEN: string;
  ALLOWED_ORIGINS: string;
  CREDENTIAL_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
};
const TTL = 7200; // Long enough for a lobby and race; browsers refresh well before expiry.

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()).includes(origin) && origin !== "";
  const headers: Record<string, string> = { "Cache-Control": "no-store", "Vary": "Origin", "Content-Type": "application/json" };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
  if (new URL(request.url).pathname !== "/ice") return reply(404, { error: "Not found" });
  if (!allowed) return reply(403, { error: "Origin not allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST", "Access-Control-Max-Age": "600" } });
  if (request.method !== "POST") return reply(405, { error: "Use POST" });
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN || !env.CREDENTIAL_LIMIT) return reply(503, { error: "Relay unavailable" });
  try {
    // Generous per-IP allowance accommodates classrooms/carrier NAT. This is an
    // abuse backstop, not authentication or a strict global spending limit.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!(await env.CREDENTIAL_LIMIT.limit({ key: ip })).success) {
      headers["Retry-After"] = "60";
      return reply(429, { error: "Please wait a minute before trying again" });
    }
    const response = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
      method: "POST", headers: { "Authorization": `Bearer ${env.TURN_KEY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: TTL }), signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return reply(502, { error: "Relay unavailable" });
    const data = await response.json() as { iceServers?: unknown };
    const iceServers = readIceServers(data.iceServers).map(server => ({ ...server,
      urls: (server.urls as string[]).filter(url => !/:53(?:\?|$)/.test(url)),
    })).filter(server => server.urls.length);
    // Some provider responses list only primary ports. Cloudflare documents
    // 443 as the TLS alternate; the same temporary credentials work there.
    const cloudflareTurn = iceServers.find(server => server.credential && server.urls.some(url => /^turns?:turn\.cloudflare\.com:/.test(url)));
    const tls443 = "turns:turn.cloudflare.com:443?transport=tcp";
    if (cloudflareTurn && !cloudflareTurn.urls.includes(tls443)) cloudflareTurn.urls.push(tls443);
    if (!iceServers.some(server => server.urls.some(url => /^turns:.*:443\?transport=tcp$/.test(url)))) return reply(502, { error: "Relay unavailable" });
    return reply(200, { iceServers, expiresAt: Date.now() + TTL * 1000 });
  } catch { return reply(502, { error: "Relay unavailable" }); }
}

export default { fetch: (request: Request, env: Env) => handle(request, env) };
