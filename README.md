# Keep it going

**Remix is the default game:** fresh, seeded courses assembled from the existing elements, with varied sizes and proportions. Correct answers boost speed. Collect coloured gates to activate one of seven 20-second effects: Ice glide, Gravity flip, Cargo carnival, Sky lift, Heavy metal, Tailwind and Downhill drift. **Two-player Remix** uses the same generated course and five powers: Sky lift and Downhill drift remain solo only. Each rider collects powers independently and keeps their chosen difficulty. Flooded splash zones are permanent track pieces: the rails dip through water that slows the train and throws up a large bow splash and wake. **Sky lift** makes correct answers raise the occupied track section by 30 metres; a struggling uphill train also gets a rescue boost, capped at one normal answer boost. Heavy metal uses 1g uphill and 3g downhill. Gravity flip pulls upward at 2g on climbs and uses normal 1g on descents. Weather and rocks stay anchored to the world as the train passes.

Leave the optional course seed blank for a fresh ride on every restart, or enter a number or word to replay a course and its power-up order. **Copy ride** creates a link to the current seed. The old `?mode=height` URL also opens Remix. The original solo and multiplayer game remains available at `?mode=classic`, linked from the start screen. Remix records are separate from Classic. See [the Remix notes](docs/remix.md) for power-up rules, balancing and verification.

## Adventure worlds

On the `feature/adventure-worlds` branch, Remix travels through four worlds:

- **Baa Baa Meadows:** Sheep Shuffle on grassy banks, Lily Pad Bridge over ducks and flowers, and a loop around a working windmill.
- **Marmalade Mountains:** Mountain Gorge with a cliff-edge railway and river below, a proper arched Glowstone Tunnel through a snowy mountain, and a timber Waterfall Viaduct. Snowy peaks and cable cars frame the route.
- **Starlight Carnival:** Rainbow Midway, Marquee Loop and Carousel Climb. Chasing bulbs, sweeping light beams, glowing fountains, ticket booths, spinning carousels and Ferris wheels make this a night-time funfair.
- **Pumpkin Party:** three Pumpkin Hops, a giant Pumpkin Portal and a three-turn descent around a crooked Witch’s Hat. Friendly ghosts, bats and glowing cottages keep it playful.

Worlds change on section boundaries near 900, 1,900 and 3,000 course metres. Beyond 4,200 metres, another adventure begins with new arrangements and additional elements. Hills remain bounded so later rides retain a visible train. Each world introduces all three signature pieces before its shuffled challenges. The track gallery has a world selector and animated scenery previews for all twelve attractions.

Fairground lamps brighten around each passing train, with soft coloured halos and a short light trail. Trains drive the windmill sails and carousel: faster trains spin them harder, then the rides coast down. The Ferris wheel receives a gentler push and bridge ducks paddle away. Each multiplayer lane reacts to its own rider.

The same seed creates the same journey in solo and multiplayer. Both players retain personal difficulty and identity colours. Mountains and other backdrops sit behind both lanes; rocky ledges and tunnels follow each lane. The gorge’s high wall sits behind both riders; tunnel cutaways open independently as each train passes. World scenery never requests camera zoom. WebGL and software fallback renderers both support the worlds; ambient animation respects reduced-motion preferences.

`npm test` includes world progression, all twelve attraction guarantees across 80 seeds, geometric continuity, energy conservation, later-course limits, scenery disposal and reduced-motion behaviour. `npx tsx scripts/playtest-worlds.ts` runs the full game with explicit answer-timing profiles. Browser scripts `scripts/check-worlds-browser.js` and `scripts/check-worlds-multiplayer-browser.js` cover frame pacing and real two-player connections. `scripts/check-world-attractions-browser.js` captures every signature on desktop/phone, and `scripts/check-world-gallery-browser.js` checks the world-filtered gallery. See [world design and validation](docs/adventure-worlds.md).

## Original solo and multiplayer game

A miniature coaster game about keeping your momentum. Start with six coaches rolling gently over the top of a 22-metre hill at 2 m/s (about 7 km/h), then gather speed down the first drop. Solve multiplication products to boost; the ride ends when the train stops or misses a water jump.

The start screen has two choices: **1 player** starts immediately; **2 players** opens a private invite lobby for a friend. There is no computer opponent. Open **Times tables** before starting to select any combination from 1–12, with shortcuts for all tables or 2, 5 and 10. Your selection is remembered on this device.

In a two-player race, the host shares a four-character code or copies an invite link. The other player chooses **2 players**, enters the code, and joins; invite links prefill the code. Once both are connected, the host starts a shared three-second countdown. Both receive the host’s chosen times tables, the same shuffled question sequence and the same generated course. The questions advance at each person’s own pace. Whoever travels further wins once both trains have stopped or splashed down; equal distances at the displayed tenth of a metre are a draw.

Your train runs in the foreground. The host stays teal and the guest stays coral on both screens. Your friend’s train runs on a reflected track behind it: turns towards the camera on your track turn away on theirs. Both views keep their own rider in front. A compact distance comparison remains visible on phones. Rear-coach lift, flying coaches, loose parcels and impact effects are sent to the other player. Either player can pause both trains with **P**; switching away also pauses the race. Both must be unpaused to continue. The result screen offers a rematch that begins only once both players choose it. Returning to the start screen leaves the connection.

The pre-multiplayer release is preserved in the annotated Git tag **v2.1** (`10570a1`). See [the multiplayer notes](docs/multiplayer.md) for connection behaviour, rendering and verification.

The ride grows with the distance you travel. After the opening drop, discover heartline rolls, wave turns, double dips, sustained upside-down stalls, top hats, Immelmann turns, dive loops, interlocking loops, and a fantasy loop within a loop. Rising sky spirals grow from two to eight turns; hills become taller and steeper, and loops become enormous. Familiar corkscrews, vertical climbs, protected inverted crests and occasional three-turn helter-skelter descents remain part of the ride.

The track director alternates demanding elements with lower recovery sections. Each complete element returns to a forward heading, a narrow route corridor and the same base elevation, so the railway keeps travelling broadly in a straight line. Crossings in compound loops have separate lanes. Correct answers always give the same energy boost: the track itself makes later runs harder. See [the element and balance notes](docs/ride-design.md) for the reference, progression and reproducible playtests.

The lead coach stays attached to the rails except during intentional jumps. Fast crests, including the tops of vertical climbs, can lift the following coaches into the air. Attached coaches stay directly above their rail positions and keep the track’s orientation. A vertical wave travels through the train: the second coach can rise at most 0.65 metres, later coaches progressively higher, up to 3.5 metres. Each arc has a quick takeoff and smooth pull-down within 0.8 seconds, with no sideways swing or repeated bouncing on the same hill. Coach lift starts only slightly above parcel-release speed; the breakaway threshold stays separate. Adjacent lift offsets are limited to 0.65 metres so the front anchors the wave without a rigid distance constraint flattening it on steep slopes. A detached coach inherits its wagon’s velocity and falls under gravity, with only a gentle tumble. Only the tail coupling can break, and at most one coach detaches per hill, even if a replacement joins before the train clears it. Retaining wheels make coaches slightly stickier than loose parcels. Parcels inherit almost the same speed as their wagon, with only a small amount of rotational motion; strong air resistance slows their flight and tumbling. The camera briefly makes room for nearby detached objects, carriages explode on impact, and parcels bounce.

Open wagons refill 2.5 seconds after spilling. They begin with two parcels, then return with three and finally four, stacked in two layers. Every later refill stays at the four-parcel limit. On desktop, a cargo counter and refill countdown show what's aboard. New coaches visibly approach from behind, match the train's speed, and couple onto the tail, up to a maximum of ten coaches. Losing a coach makes room for a replacement. Travelling faster brings them along sooner and closes the gap faster; answering does not instantly add a coach. Couplings turn amber as tension builds, and the camera returns to the ride as loose cargo falls behind and impact flashes fade.

Water jumps have a real gap in the rails. The first gap is shorter so an early hesitation is less punishing; later jumps retain their full width. The landing straight is short; faster flights can rejoin a following track element. An approaching-jump preview accounts for hills and drag to tell you whether you can coast across or need another boost. Clear the far edge and land to collect ten bonus points per metre flown. Live airtime distance, a landing bonus and new jump records appear on desktop.

On desktop, type the correct answer to boost automatically; **C** changes the view and **P** pauses. Phones and tablets use a large three-column touch keypad with delete and submit keys. The mobile layout fits the viewport in portrait and landscape, showing only the coaster, question and keypad during play. Brief answer feedback appears beside the question; stats, track labels, physics messages and the camera control are hidden. The header contains the logo, a start-screen button and the track-gallery link. An amber answer underline warns of an imminent stall without adding text. On enormous structures, the camera follows the train upward instead of making it a dot in the distance.

On desktop, the live score shows your current answer streak. Correct answers boost immediately on both keyboard and touch input. The completed equation stays visible for 350 ms before the next question appears; typing early moves on without losing the new digit. Partial answers and typos remain editable; use Backspace or the delete key to correct them, or Escape to clear the whole answer and refocus the game. If coasting would stop the train within the next few seconds, a momentum warning prompts another answer; slow downhill travel doesn't trigger it. Distance and jump records are saved separately for each difficulty. At the end, a ride card shows your score and a replay button, with detailed ride statistics on desktop and a brief pause to see the splash before the card appears.

The header logo was created with the built-in imagegen tool. Its asset and generation prompt are in `public/images/`.

Airborne trains can widen the camera to at most three times the normal view size. Nearby loose coaches and cargo receive a smaller 30% allowance; distant or lingering objects can leave the screen. Weather, splash spray and TNT debris do not drive framing. The camera eases back after the action settles, and Sky lift altitude alone does not zoom it out. The fallback renderer uses the same limits.

See [the live performance measurements](docs/performance.md) for the rendering changes, frame-timing results and repeatable browser profiling commands.

Google Analytics uses the same `G-94373ZKHEE` setup as `country_quiz` on the game and track gallery. Tracking is disabled on `localhost` and `127.0.0.1`.

## Run locally

Requires Node.js 22.12 or newer (Node 24 LTS recommended).

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
npm run playtest -- --quick # 32 simulated rides
npm run playtest            # 160 simulated rides, up to ten minutes each
npx tsx scripts/playtest-remix.ts --quick # 9 simulated Remix rides
npx tsx scripts/playtest-remix.ts         # 24 rides, up to three minutes each
```

## GitHub Pages

The Vite build uses relative asset paths, so the same build works at the stable URL or under `/next/`. The workflow in `.github/workflows/pages.yml` tests and builds pushes to `main` and `feature/adventure-worlds`, or runs manually. Publishing is a separate step using the commands below.

GitHub Pages serves the `gh-pages` branch. No repository-name configuration is required.

### Track gallery

Open `tracks.html` (or use **Track gallery** above the game) to browse all 26 elements. Drag to orbit, scroll or pinch to zoom, and use the side/top presets to inspect inversions and crossings. The distance slider previews the shared game generation rules from the opening scale to 20 km. Each selection has a reusable URL. The animated coach shows direction only; it does not simulate ride physics.

### Deploy to GitHub Pages

| Source branch | Command | Published game |
| --- | --- | --- |
| `main` | `npm run deploy` | https://rupertlinacre.com/keep_it_going/ |
| `feature/adventure-worlds` (or a future preview branch) | `npm run deploy:next` | https://rupertlinacre.com/keep_it_going/next/ |

Each version has its own `tracks.html` gallery alongside the game. Multiplayer invite and course links retain the version's path.

One-time repository-owner setup: open **Settings → Pages**, choose **Deploy from a branch**, select **gh-pages** and **/(root)**, and save. This requires admin access; write access alone can publish the branch but cannot enable the site.

Run `npm ci` after cloning. Commit and push source changes, then publish the current branch's preview with:

```sh
npm run deploy:next
```

To release stable, check out `main` and run `npm run deploy`. Stable deployment refuses to run from another branch. Both commands check that tracked changes are committed, run the tests, build both pages, and publish through `scripts/deploy.mjs`. Each replaces only its own files and removes obsolete bundles while preserving the other version. Root domain configuration is also preserved. `release.json` beside each game records its source branch, commit and build time.

Keep source code in normal Git branches: `next/` exists only in the generated `gh-pages` output, not as a second source tree. When the preview is ready, merge its source branch into `main` and deploy stable. Keep the deployment script on both branches; do not use the old raw `gh-pages -d dist` command, which would remove the preview during a stable update.

You need Git push access to `RupertLinacre/keep_it_going`. Source commits are pushed separately from deployment; pushing a source branch alone does not publish. Generated recordings in `output/` stay local.

### Ride difficulty

Choose Very easy, Easy, Medium, Hard or Very hard on the start screen. Medium retains the original balance; momentum loss is respectively 0.3×, 0.55×, 1×, 1.5× and 2.1×. Gravity, starting speed, boost strength and selected times tables stay the same. The setting is remembered, solo replays retain it, and each multiplayer rider chooses their own level (retained for rematches). Best scores remain separate by difficulty.

A seeded balance check over eight tracks, with one answer every 3.2 seconds, 20% timing variation, 95% accuracy and a two-minute limit, averaged 4,934 / 4,004 / 3,222 / 2,747 / 1,794 metres from Very easy to Very hard. These are simulated answering assumptions rather than measured player data. `simulateRide` in `scripts/playtest.ts` accepts a difficulty as its fourth argument.

Multiplayer colours follow identity: the host is teal and the guest coral on both devices, including the lobby, trains, detached coaches, impact debris, HUD and results. Your own track always stays in the foreground. Invite links expose a personal difficulty selector before joining; times tables remain shared.

### Multiplayer rendering

Opponent playback uses the sender’s simulation timestamps rather than packet arrival times. A 150–350 ms adaptive jitter buffer feeds display-rate rail sampling, with the opponent’s own gravity/resistance used to predict brief gaps. Correct answers also send an immediate checkpoint. PeerJS binary serialization provides chunking for snapshots larger than the JSON channel’s 16 KB limit. Late corrections ease along the rail, preserving carriage orientation and coupling alignment; a long gap adds at most 200 ms of predicted travel. Authoritative snapshots and finish messages still decide the race. Stable object IDs prevent flying parcels/coaches from swapping when another disappears.

Rail colours follow the host/guest identity on both devices. Lane spacing plans fourteen seconds ahead, widens smoothly at no more than 6 m/s, and never contracts just because an old section was removed. Distant planning geometry stays out of the rendered scene. The ground covers the actual bounds of all loaded pieces in both lanes, with extra room for scenery and the camera; section bounds are cached to avoid scanning geometry every frame.

`npm test` includes jitter, bounded prediction, curved-rail playback, object identities, paused clocks, ground coverage and fast-rider lane-clearance regressions. `scripts/check-network-browser.js` adds 35–140 ms of uneven receive delay to two real WebRTC peers and reports their display performance; run it via `playwright-cli run-code` against the Vite development server.
