# Keep it going

A miniature coaster game about keeping your momentum. Start with six coaches rolling gently over the top of a 22-metre hill at 2 m/s (about 7 km/h), then gather speed down the first drop. Solve multiplication products to boost; the ride ends when the train stops or misses a water jump.

The start screen has two choices: **1 player** starts immediately; **2 players** opens a private invite lobby for a friend. There is no computer opponent. Open **Times tables** before starting to select any combination from 1–12, with shortcuts for all tables or 2, 5 and 10. Your selection is remembered on this device.

In a two-player race, the host shares a four-character code or copies an invite link. The other player chooses **2 players**, enters the code, and joins; invite links prefill the code. Once both are connected, the host starts a shared three-second countdown. Both receive the host’s chosen times tables, the same shuffled question sequence and the same generated course. The questions advance at each person’s own pace. Whoever travels further wins once both trains have stopped or splashed down; equal distances at the displayed tenth of a metre are a draw.

Your teal train runs in the foreground. Your friend’s coral train runs on a reflected track behind it: turns towards the camera on your track turn away on theirs. Both views keep their own rider in front. A compact distance comparison remains visible on phones. Rear-coach lift, flying coaches, loose parcels and impact effects are sent to the other player. Either player can pause both trains with **P** or **Escape**; switching away also pauses the race. Both must be unpaused to continue. The result screen offers a rematch that begins only once both players choose it. Returning to the start screen leaves the connection.

The pre-multiplayer release is preserved in the annotated Git tag **v2.1** (`10570a1`). See [the multiplayer notes](docs/multiplayer.md) for connection behaviour, rendering and verification.

The ride grows with the distance you travel. After the opening drop, discover heartline rolls, wave turns, double dips, sustained upside-down stalls, top hats, Immelmann turns, dive loops, interlocking loops, and a fantasy loop within a loop. Rising sky spirals grow from two to eight turns; hills become taller and steeper, and loops become enormous. Familiar corkscrews, vertical climbs, protected inverted crests and occasional three-turn helter-skelter descents remain part of the ride.

The track director alternates demanding elements with lower recovery sections. Each complete element returns to a forward heading, a narrow route corridor and the same base elevation, so the railway keeps travelling broadly in a straight line. Crossings in compound loops have separate lanes. Correct answers always give the same energy boost: the track itself makes later runs harder. See [the element and balance notes](docs/ride-design.md) for the reference, progression and reproducible playtests.

The lead coach stays attached to the rails except during intentional jumps. Fast crests, including the tops of vertical climbs, can lift the following coaches into the air. Attached coaches stay directly above their rail positions and keep the track’s orientation. A vertical wave travels through the train: the second coach can rise at most 0.65 metres, later coaches progressively higher, up to 3.5 metres. Each arc has a quick takeoff and smooth pull-down within 0.8 seconds, with no sideways swing or repeated bouncing on the same hill. Coach lift starts only slightly above parcel-release speed; the breakaway threshold stays separate. Adjacent lift offsets are limited to 0.65 metres so the front anchors the wave without a rigid distance constraint flattening it on steep slopes. A detached coach inherits its wagon’s velocity and falls under gravity, with only a gentle tumble. Only the tail coupling can break, and at most one coach detaches per hill, even if a replacement joins before the train clears it. Retaining wheels make coaches slightly stickier than loose parcels. Parcels inherit almost the same speed as their wagon, with only a small amount of rotational motion; strong air resistance slows their flight and tumbling. The camera follows detached objects, carriages explode on impact, and parcels bounce.

Open wagons refill 2.5 seconds after spilling. They begin with two parcels, then return with three and finally four, stacked in two layers. Every later refill stays at the four-parcel limit. On desktop, a cargo counter and refill countdown show what's aboard. New coaches visibly approach from behind, match the train's speed, and couple onto the tail, up to a maximum of ten coaches. Losing a coach makes room for a replacement. Travelling faster brings them along sooner and closes the gap faster; answering does not instantly add a coach. Couplings turn amber as tension builds, and the camera returns to the ride once loose cargo has landed and impact flashes have faded.

Water jumps have a real gap in the rails. The first gap is shorter so an early hesitation is less punishing; later jumps retain their full width. The landing straight is short; faster flights can rejoin a following track element. An approaching-jump preview accounts for hills and drag to tell you whether you can coast across or need another boost. Clear the far edge and land to collect ten bonus points per metre flown. Live airtime distance, a landing bonus and new jump records appear on desktop.

On desktop, type the correct answer to boost automatically; **C** changes the view and **P** pauses. Phones and tablets use a large three-column touch keypad with delete and submit keys. The mobile layout fits the viewport in portrait and landscape, showing only the coaster, question and keypad during play. Brief answer feedback appears beside the question; stats, track labels, physics messages and the camera control are hidden. The header contains the logo, a start-screen button and the track-gallery link. An amber answer underline warns of an imminent stall without adding text. On enormous structures, the camera follows the train upward instead of making it a dot in the distance.

On desktop, the live score shows your current answer streak. Correct answers boost immediately on both keyboard and touch input. The completed equation stays visible for 350 ms before the next question appears; typing early moves on without losing the new digit. Partial answers and typos remain editable; use Backspace or the delete key to correct them. If coasting would stop the train within the next few seconds, a momentum warning prompts another answer; slow downhill travel doesn't trigger it. Distance and jump records are saved separately for each difficulty. At the end, a ride card shows your score and a replay button, with detailed ride statistics on desktop and a brief pause to see the splash before the card appears.

The header logo was created with the built-in imagegen tool. Its asset and generation prompt are in `public/images/`.

Airborne action can widen the camera to at most three times the normal view size. The train stays in view; objects flung beyond that limit can leave the screen. The camera eases back after the action settles. This limit also applies to the fallback renderer.

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
```

## GitHub Pages

The Vite build uses relative asset paths, so it works from a repository subdirectory. The workflow in `.github/workflows/pages.yml` tests and builds the site whenever `main` is pushed, or when run manually. Publishing is a separate step using `npm run deploy` below.

GitHub Pages serves the `gh-pages` branch. No repository-name configuration is required.

### Track gallery

Open `tracks.html` (or use **Track gallery** above the game) to browse all 25 elements. Drag to orbit, scroll or pinch to zoom, and use the side/top presets to inspect inversions and crossings. The distance slider previews the shared game generation rules from the opening scale to 20 km. Each selection has a reusable URL. The animated coach shows direction only; it does not simulate ride physics.

### Deploy to GitHub Pages

Game URL (after enabling Pages): https://rupertlinacre.com/keep_it_going/

Track gallery: https://rupertlinacre.com/keep_it_going/tracks.html

One-time repository-owner setup: open **Settings → Pages**, choose **Deploy from a branch**, select **gh-pages** and **/(root)**, and save. This requires admin access; write access alone can publish the branch but cannot enable the site.

Run `npm ci` after cloning, then publish with:

```sh
npm run deploy
```

The command builds both pages and pushes the contents of `dist/` to the `gh-pages` branch on `origin`. GitHub Pages serves that branch’s root. You need Git push access to `RupertLinacre/keep_it_going`. Source code stays on `main`; commit and push source changes separately. Deployment is manual, so pushing `main` alone does not publish. Generated recordings in `output/` stay local.

### Ride difficulty

Choose Very easy, Easy, Medium, Hard or Very hard on the start screen. Medium retains the original balance; momentum loss is respectively 0.3×, 0.55×, 1×, 1.5× and 2.1×. Gravity, starting speed, boost strength and selected times tables stay the same. The setting is remembered, solo replays retain it, and a multiplayer host chooses it for both riders (including rematches). Best scores remain separate by difficulty.

A seeded balance check over eight tracks, with one answer every 3.2 seconds, 20% timing variation, 95% accuracy and a two-minute limit, averaged 4,934 / 4,004 / 3,222 / 2,747 / 1,794 metres from Very easy to Very hard. These are simulated answering assumptions rather than measured player data. `simulateRide` in `scripts/playtest.ts` accepts a difficulty as its fourth argument.
