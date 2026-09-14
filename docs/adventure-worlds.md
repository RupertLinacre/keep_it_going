# Adventure worlds — design and validation

Work branch: `feature/adventure-worlds`. Remix progresses through four distance-based worlds. Classic remains available. This document describes the refined version with twelve signature attractions.

## The four worlds

| World | Three signature track pieces | Scenery and animation |
| --- | --- | --- |
| Baa Baa Meadows | **Sheep Shuffle**, **Lily Pad Bridge**, **Windmill Loop** | Track-shaped grassy banks, flower beds, hay bales, hopping sheep, ducks swimming amongst lilies, curved timber decking and turning sails inside the loop silhouette. |
| Marmalade Mountains | **Mountain Gorge**, **Glowstone Tunnel**, **Waterfall Viaduct** | A narrow railway ledge climbs above a turquoise river between tall, faceted cliffs. Glowstone Tunnel is a continuous arched bore through a snowy mountain, with stone portals, warm lamps and crystals. The camera-facing lower wall fades while the train passes; the summit stays solid. A high timber Waterfall Viaduct crosses a ravine beside falling water. |
| Starlight Carnival | **Rainbow Midway**, **Marquee Loop**, **Carousel Climb** | A night-time funfair with ticket/candy-floss booths, bunting, garlands, chasing bulbs, soft sweeping stage beams, coloured fountains, a rotating carousel and Ferris wheels with upright cabins. The loop wears a glowing star; two rising turns circle the carousel. |
| Pumpkin Party | **Pumpkin Hops**, **Pumpkin Portal**, **Witch’s Hat** | Three distinct crests, a giant cutaway pumpkin, and a climb followed by three descending spirals around a crooked hat. Amber lanterns, rosy-cheeked ghosts, fluttering bats, smiling pumpkins, vines and warm windows keep it friendly. |

World boundaries are near 900 / 1,900 / 3,000 course metres, at the next section start. Another adventure begins after 4,200 metres. Every world starts with its three signature pieces, separated by short breathers. Its remaining pieces are shuffled, with varied shapes/proportions and additional inversions unlocked on subsequent adventures. A long random element cannot displace a signature beyond the next world boundary.

Generative scale stops growing at 2×. Base-course height caps are 30 / 38 / 38 / 40 metres, with at most four turns. Sky lift retains its ability to raise the course further. Scenery is excluded from camera framing; the existing 3× zoom cap remains.

## Rendering and playability

Scenery uses baked vertex colours and merged material batches. Twelve fixed-capacity instance buffers cover creatures, rides, waterfall spray and stage beams. Each buffer holds at most 192 actors. Old scenery tiles and their geometry are released as the track scrolls past. Mirrored race formations share geometry and dispose it exactly once. The gorge uses one high wall behind both race lanes so it cannot hide the opponent, with separate solid ledges beneath each train. Tunnel wall materials are independent per rider, fade according to that rider’s position, and are released with the scenery tile.

Fairground bulbs use one shared shader with a baked phase per bulb. Their brightness travels smoothly around loops and garlands on an approximately 4.5-second cycle. Unmarked decorative lamps remain steady; track bulbs and mushroom lamps brighten near passing trains. Coloured fountain streams use the same material. Stage beams are translucent instanced geometry; they do not add shadow-casting spotlights or a full-screen bloom pass. Carousels rotate, wheel cabins remain upright, and the waterfall spray falls from a fixed location.

Animations use game time, so pausing freezes them. Reduced-motion mode holds both lighting and decorative rides still. The question panel and mobile keypad are unchanged; world welcomes fade to a small journey badge.

Both racers generate the same seeded course, with personal difficulties and consistent identity colours. Shared landscape sits behind both lanes. Track-specific structures and their animated parts appear on each mirrored lane. Protocol **7** separates this course generator from older protocol 5/6 builds; no additional per-frame network payload is needed.

The Canvas fallback includes recognisable world landmarks and all signature silhouettes. The track gallery filters by world and previews the actual attraction scenery and animation, with all original sections still available.

## Validation of this refinement

- Geometry tests cover all twelve signatures: finite frames, smooth tangents, perpendicular rail frames, upright joins and energy conservation without drag.
- An 80-seed test spans two complete adventures per seed, using different generation lookaheads. Every world includes all three unique signature pieces.
- Later-course tests retain bounded heights and turns while allowing encore inversions.
- A 9 km scenery lifecycle test checks bounded tiles/actors and exactly one disposal of each owned/shared geometry. Separate checks verify animation, pause and reduced-motion behaviour.
- Each world was developed and visually checked before continuing to the next. Desktop 1440×900 and phone 390×844 captures cover every attraction. Visual review corrected the bridge waterfall clipping, overly dense spiral supports, a dark witch’s hat, and a rail-origin offset in the new gallery previews.
- Nine full-game simulations used seeds 1, 42 and 73 with 4.8-second answers on Very easy, 3.2 seconds on Easy and 2 seconds on Medium, 94% answer success and ±20% timing jitter. All nine reached 4.4 km without ending, in 99–126 seconds. These are explicit design assumptions, not measured child performance.
- Real PeerJS desktop/phone races passed normal keyboard and touch answers, all twelve mirrored attractions, matching positions and colours, five independent powers, eight-box/TNT replication, simultaneous flooded splashes, shared pause, small/rotated phone layouts, results, rematch and leaving. Repeated with WebGL disabled on the phone, exercising the software renderer. Both opening races measured approximately 60 FPS; no page errors.
- The gallery was checked for all twelve previews, world filtering, previous/next navigation, pause, mobile layout and return to the original pieces. Browser checks also capture WebGL shader errors from the console.

Reproducible scripts:

- `npm test`
- `npx tsx scripts/playtest-worlds.ts` (`--distance=950` etc. for a single world checkpoint)
- `scripts/check-world-attractions-browser.js` — all twelve desktop/phone visual fixtures
- `scripts/check-world-gallery-browser.js` — world selector and decorated previews
- `scripts/check-mountain-landforms-browser.js` — closed tunnel, inside view and gorge on desktop/phone
- `scripts/check-worlds-browser.js` — six measured seconds per world/layout after warm-up
- `scripts/check-worlds-multiplayer-browser.js` — two actual connected clients, plus optional software phone
- `scripts/check-world-transitions-browser.js` — continuous 125-second ride, including streaming and transitions

Browser scripts run through `playwright-cli run-code` against Vite. Screenshots and measurement JSON are saved locally in `output/playwright/` (ignored by Git). Checkpoint screenshots are distinct from real-time performance tests. Frame measurements use Chromium / ANGLE Metal on an Apple M4; phone emulation does not replace testing on a physical low-end phone.

## World-wide performance baseline

All **135 tests** and the production build passed. Eight real-time world/layout measurements recorded a 16.7 ms median and 18.7 ms p99 (approximately 60 FPS), with no frame over 50 ms. Visible draw counts ranged from 73 to 132.

The continuous desktop ride ran 125 seconds, travelled 5.88 km and answered 77 questions. It covered all four worlds and returned to the mountains, ending still in play. Every world's p99 was 18.7 ms. The only frame over 50 ms was 98.1 ms at game time zero, during initial construction; there were none during the ride or world transitions. It finished with five scenery tiles and 85 geometry buffers.

Combined measurements, simulations and visual-check reports are saved in `output/playwright/world-refinement-validation.json`.

The gallery shows the closed tunnel exterior by default. **Inside tunnel** toggles its cutaway for inspection; this control is only present on Glowstone Tunnel. The gorge and tunnel also have matching silhouettes in the software renderer.

## Mountain gorge and tunnel refinement

All **139 tests** and the production build pass. New checks cover the unobstructed tunnel bore and enclosure, entry/exit reveal timing, independent race materials and disposal, the shared gorge wall behind both lanes, and solid ledges visible from either side.

Two ten-second real-time rides passed through Mountain Gorge, Glowstone Tunnel and Waterfall Viaduct on desktop and a DPR-2 phone layout, answering every 1.5 seconds on Easy. Both recorded 599 frame intervals with a 16.7 ms median, 17.6 ms p95 and 17.7 ms p99; no interval exceeded 50 ms. These are browser measurements on the same Apple M4, not physical phone benchmarks.

Real connected desktop/phone races were visually checked at all three mountain attractions, then repeated with WebGL disabled on the phone. Both versions retained player colours, matching positions, readable trains and working controls without browser errors. The gallery checks cover the opaque exterior and explicit inside view on both layouts. Detailed reports are in `output/playwright/mountain-refinement-validation.json`.

## Train-driven attractions and lights

Windmill sails and carousel horses now use a small flywheel driven by the train’s speed while it occupies the section. Rotation builds smoothly, remains capped, and coasts down after the train leaves. The Ferris wheel and upright cabins receive a smaller synchronized push; bridge ducks paddle aside. Each scenery tile owns separate rider states. Pause and reduced-motion preferences hold rotation, and teleport corrections cannot kick the mechanism.

Four render-space train positions (front and trailing point per rider) drive the shared light material. Nearby lamps grow almost white at their cores and gain soft additive coloured halos; lamps away from the train retain their ambient chase. Additional rail lamps connect the main fairground attractions. Halos use merged geometry and a shared material, never per-bulb lights or a full-screen bloom pass. Their geometry and material are disposed with the scenery. These effects do not affect camera framing or network payloads. The software renderer includes the same train-driven rotation and passing light glow.

Validation: `tests/attraction-drive.test.ts` covers speed response, coasting, pause, reduced motion, teleports, frame-rate independence, rider separation and render-origin changes. `scripts/check-reactive-attractions-browser.js` drives through the windmill, loop and carousel on desktop and phone layouts while checking response, layout and browser errors. Real-time night-world checks recorded 16.7 ms median and 18.7 ms p99 frame intervals on both layouts, with no frame over 50 ms (Chromium on Apple M4; phone emulation).

All 143 tests and the production build passed. Connected desktop/phone checks also passed with WebGL enabled and disabled on the phone. The light-position test includes Downhill Drift’s scene transform. Reports: `output/playwright/reactive-attractions-validation.json`.
