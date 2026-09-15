# Multiplayer across mobile networks

The browser receives temporary TURN credentials from `https://keep-it-going-relay.robinlinacre.workers.dev/ice` when opening multiplayer. PeerJS passes them to WebRTC with `iceTransportPolicy: "all"`. ICE considers direct and relayed routes during connection establishment; there is no slow application-level “try direct, wait for failure, then relay” sequence. Cloudflare provides TURN over UDP, TCP and TLS, including TLS on port 443 for restrictive networks.

Each browser continues running its own game. The relay only forwards encrypted data-channel traffic. Signalling/invite lookup still uses PeerJS's public service; TURN cannot fix an unavailable signalling service, incompatible releases, or every firewall policy. Live network diagnostics distinguish credential loading, signalling, waiting for the other rider, connecting and connected states.

## Code layout

- `src/multiplayer/relay.ts`: public endpoint, bounded credential parsing, timeouts, test modes and sanitized selected-route diagnostics.
- `src/multiplayer/session.ts`: PeerJS configuration, cancellation, credential refresh and route inspection.
- `infra/turn/worker.ts`: credential broker. The long-lived Cloudflare TURN key stays in Worker secrets.
- `infra/turn/wrangler.jsonc`: independent Worker deployment, origin allowlist and request-rate binding.

The Worker permits POST `/ice` only from configured browser origins, issues two-hour credentials, applies a generous 120 requests/minute/IP limit to accommodate shared mobile/classroom networks, sets `Cache-Control: no-store`, and never returns raw provider errors or the long-lived key. CORS is not authentication: a non-browser can forge an Origin header. The rate limit is an abuse backstop, not a hard global spending cap; monitor TURN bandwidth in Cloudflare. No IP addresses or credentials are included in game diagnostics.

Credentials refresh every thirty minutes for long lobbies and rematches. Refresh updates both future PeerJS connections and existing peer connections without restarting the race. Lobby cancellation aborts pending credential requests. If the credential endpoint fails within five seconds, automatic mode retains PeerJS's existing default direct/public-relay path. That preserves ordinary connectivity during an outage but does not promise mobile-network compatibility without the managed relay.

## Set up / rotate the service

1. Enable Realtime in the intended Cloudflare account and create a dedicated TURN key named `Keep it going`. This is a TURN key, not the account-wide API token. Set its non-secret ID as `TURN_KEY_ID` in `infra/turn/wrangler.jsonc`.
2. Authenticate the CLI: `npm exec --yes --package=wrangler@4.131.2 -- wrangler login`.
3. Run `npm run relay:deploy` to create/update the Worker.
4. Store the API token using the interactive secret prompt:

   ```sh
   npm exec --yes --package=wrangler@4.131.2 -- wrangler secret put TURN_KEY_API_TOKEN --config infra/turn/wrangler.jsonc
   ```

5. If deploying under a different Worker URL, update `TURN_ENDPOINT` in `src/multiplayer/relay.ts`, or override it with `VITE_TURN_ENDPOINT`. Only a public URL belongs in a `VITE_` variable. Never put a long-lived TURN key there.
6. Commit source changes and run `npm run deploy:next`. The relay deploy is separate from GitHub Pages and leaves the stable game untouched.

Alternatively, `python3 scripts/configure-turn.py` accepts just the 64-character TURN API Token at a hidden prompt and passes it directly to `wrangler secret bulk`. It does not print or save the credential value. Never enter secret values as shell-command arguments.

For local Worker development, use `infra/turn/.dev.vars` for secrets and `npm run relay:dev`. That file and `.env.local` are ignored by Git. Override the endpoint with the local Worker URL when needed. The existing local Vite port 5198 is in the allowed-origin list; add other test origins explicitly rather than enabling `*`.

## Prove the fallback works

- Normal URL: automatic direct-or-relay selection.
- `?network=auto`: automatic selection with diagnostic text in the lobby.
- `?network=relay`: forces TURN on that browser. Credential failure is fatal in this mode; it cannot silently pass by connecting directly.
- `?network=relay-tls`: forces TURN and restricts URLs to TLS on port 443. This checks the route needed when UDP is blocked.

Copy-invite links preserve forced-relay modes. When entering codes manually, open the same test mode on both devices. The lobby shows the stage, selected route and credential-service status for these test URLs, and for any connection error. “Copy connection details” copies a report containing the protocol version, mode, route, transport and RTT, without credentials, invite codes or addresses.

`scripts/check-turn-browser.js` runs a desktop/touch-phone game through the chosen mode on local Vite. It requires four correct answers to reach the opponent, confirms both trains are moving and checks the selected candidate pair. TLS mode additionally requires `relayProtocol: "tls"` from both browsers. It uses real PeerJS signalling and real TURN traffic when credentials are configured. A local two-context test is not a physical mobile-network test: finally repeat with one device on Wi-Fi and another on cellular data.

`tests/relay.test.ts` covers automatic versus forced modes, malformed/expired credentials, cancellation/timeouts, worker origin/method/rate controls, secret/error redaction and selected-route reporting.

Sources: [Cloudflare credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/), [TURN transports](https://developers.cloudflare.com/realtime/turn/), [PeerJS configuration](https://peerjs.com/client/api/peer), [WebRTC TURN](https://webrtc.org/getting-started/turn-server).

## Validation on 15 September 2026

168 automated tests and the production build pass. Three actual desktop/touch-phone browser races passed: automatic mode while the credential endpoint was unavailable (direct route preserved); automatic mode with managed credentials (direct route selected, 0–1 ms RTT); and forced relay with only the TLS-443 URL (both selected TURN with `relayProtocol: "tls"`, 19–20 ms RTT). In each race both riders answered four questions, saw the opponent's four answers and kept moving without page errors or horizontal overflow. The unavailable relay-only mode also showed an explicit error rather than silently connecting directly. Reports are saved locally under `output/playwright/turn-validation.json`. These are browser contexts on this Mac, not a physical cellular-network test.
