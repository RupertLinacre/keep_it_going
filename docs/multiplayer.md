# Multiplayer races

The annotated tag `v2.1` preserves the deployed single-player release at source commit `10570a1`. The new start screen launches a solo game in one click or opens an invite lobby for a real second player. Times tables are optional setup, not another required step.

## Connection and round lifecycle

`src/multiplayer/session.ts` follows the PeerJS invite-code approach in `arithmetic_annihilation_mp_branch/src/multiplayer/MultiplayerSession.ts`. It has its own versioned `keep-going-v8-` signalling namespace, so an invite cannot join the other game. PeerJS is loaded only when a player creates or joins a room. Public PeerJS signalling introduces the browsers; a small Cloudflare Worker supplies temporary managed TURN credentials, including TLS on port 443, for automatic relay fallback. The game remains hosted on GitHub Pages and needs no camera or microphone. See [relay setup and testing](relay.md). [PeerJS documents this connection flow](https://peerjs.com/client/getting-started).

The host chooses the game mode, track seed, question seed and tables. A prepare/ready handshake waits for both games to load before starting the three-second countdown; measured connection round-trip time adjusts the guest’s countdown delay. Both clients use the existing fixed 120 Hz coaster simulation. Each device owns only its own game, so network delays do not delay a correct-answer boost or affect local coach physics. `src/questions.ts` supplies a separate seeded deck covering every selected table against factors 1–12 without repeats within a deck. Question order does not depend on frame rate, scenery or the opponent’s answers.

The data connection sends bounded, validated snapshots at 12 Hz. They include actual carriage poses (including jumps and vertical lift), cargo, detached coaches, loose parcels, couplings and impacts. An adaptive 150–350 ms presentation buffer interpolates motion at display rate, with short, bounded prediction for packet gaps. It does not invent boosts or extrapolate a train indefinitely when packets stop arriving. Out-of-order snapshots and messages for old rounds are ignored. Buffered snapshots are skipped when the data channel is congested; final results, pause and rematch messages remain reliable.

Either active rider can pause both trains; a finished spectator cannot pause the winner. Each must clear their own pause before play resumes. A final pose is sent when a pause starts. A heartbeat detects a lost or unresponsive peer, freezes an unfinished race and provides a way back to the start screen. Results already completed remain visible after a disconnect. A winner can start a new game for both players without a new invite. Tied games retain the mutual rematch handshake. Results, pauses, snapshots and coach counts reset, while the host’s tables and each rider’s difficulty persist.

If one rider stops and the other passes their final distance, the moving rider wins immediately. Their train pauses for a choice: **Start new game** restarts both players; **Keep going** resumes their existing run while the finished player waits. A small Start new game button remains available during that continuation. If both trains stop first, the result screen offers the winner a new game; stopped or crashed trains are not revived. Distance, rounded to the same tenth of a metre shown in the result card, decides the winner. Score and answer count do not break ties. A finished rider sees their distance and waits for the other rider. When a train is far beyond the other player’s current view, the distance indicator tracks it rather than zooming arbitrarily far away from the local train.

This is a private game between friends, with each rider’s results supplied by their own browser. It is not an authoritative server or a competitive anti-cheat system. Connectivity depends on PeerJS and the players’ network conditions; unavailable rooms, full rooms, failed connections and dropped peers have explicit recovery messages.

## Two tracks, one renderer

The host is teal and the guest coral on both devices; each screen keeps its own player in the foreground. `MiniView` uses one WebGL renderer, one camera and the same built rail geometry for both tracks. The second set of track transforms is reflected in depth, with a clear aisle based on the retained course’s full lateral bounds. Positions, forward vectors and up vectors are reflected consistently even at verticals and inversions. Car rotations are rebuilt as proper rotation matrices instead of using unsupported negative instance scales.

Both trains share the existing instanced model batches. Remote effects also use the existing particle batches. Pruned track copies release their own instance buffers while sharing owned rail geometry. The existing 3× maximum camera zoom-out remains in effect. The software renderer has a two-lane alternative if WebGL cannot be created.

The race HUD shows each rider’s distance and the gap; Remix adds a compact power name and countdown inside each rider’s card. The question remains centred on desktop, with the touch keypad on mobile. Setup panels collapse the decorative introduction on phones to keep joining controls immediately accessible. Table preferences are saved separately from existing ride records, and unavailable local storage does not prevent playing.

## Verification

Run `npm test` and `npm run build` for the physics, rendering geometry, seeded questions, snapshot validation/interpolation and room lifecycle checks. Session tests include an in-memory transport to reproduce missing/full rooms, delayed readiness, stale messages, pause, final results, disconnects and mutual rematches without depending on public signalling.

`scripts/check-multiplayer-browser.js` is a Playwright CLI script for a real two-browser test. Open the game in a desktop browser session, then run it with `playwright-cli run-code --filename=scripts/check-multiplayer-browser.js`. It opens a second mobile browser context and uses real PeerJS/WebRTC, normal keyboard input and the actual touch buttons. It checks table selection, immediate solo start, invite-link joining, common questions, answers, shared pause, agreement on results, rematches and leaving mid-race. Screenshots go to `output/playwright/`. Read the report with `playwright-cli eval 'multiplayerCheck'` in the same session.

The initial real two-client playtest completed a roughly 1.25 km race with 16 answers from each player and agreed on both final distances and the winner. A subsequent no-answer rematch reset to six coaches and produced matching 143.1 m distances and a draw. Desktop (1920×1080) and emulated touch phone (360×640) sessions ran concurrently on this Mac at about 60 Hz. The initial sample’s 95th-percentile render CPU time was approximately 2.7–2.8 ms. These are desktop-hosted browser measurements, not measurements on physical phones. Existing single-player profiling remains available in `scripts/profile-browser.js`.

A production build served under `/keep_it_going/` passed the real-browser workflow with no page errors. During the moving portion of that test, both the 1920×1080 desktop and 390×844 touch context delivered 1,763 frames in approximately 29.4 seconds (60.0 fps; 95th-percentile interval 16.7 ms). The workflow also passed with WebGL disabled in the mobile context, using the two-track software renderer, including 844×390 landscape and 320×568 portrait keypad checks. To repeat that variant, set `window.checkSoftwareRenderer = true` using the CLI’s `eval` command before running the browser-check script.

Remix races and their six independent powers are described in [the Remix notes](remix.md#two-player-remix). Classic remains available and uses the same connection lifecycle.

Adventure-world builds use protocol 9 for winner decisions and cannot join older builds with incompatible race flow. Both sides derive the worlds from the seeded course; separate lift snapshots describe each rider’s raised rail.


## Join/create and winner-flow checks

The start screen has separate Join a game (left) and Create a game (right) routes.
After a guest submits a valid invite code and connects, the lobby prominently
shows the host's tables for both riders. Guest practice selections never replace
those tables. Both players retain their individual difficulty.

Run `scripts/check-multiplayer-flow-browser.js` through playwright-cli against
Vite for a repeatable real WebRTC desktop/touch-phone test. It checks shared table
confirmation, a host winning and continuing, a guest winning and immediately
restarting, and settings preserved across consecutive games. Session tests also
cover both trains stopping, ties, invalid choices, and rounded-distance ties.
Winner/choice messages are scoped to the current round; only the winning rider
can request continuation or a unilateral restart. The host remains responsible
for generating the next round and the usual prepare/ready countdown.
