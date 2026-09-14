# Adventure worlds — design and validation

Work branch: `feature/adventure-worlds`. Remix progresses through four distance-based worlds. Classic remains available. This document describes the refined version with twelve signature attractions.

## The four worlds

| World | Three signature track pieces | Scenery and animation |
| --- | --- | --- |
| Baa Baa Meadows | **Sheep Shuffle**, **Lily Pad Bridge**, **Windmill Loop** | Track-shaped grassy banks, flower beds, hay bales, hopping sheep, ducks swimming amongst lilies, curved timber decking and turning sails inside the loop silhouette. |
| Marmalade Mountains | **Mountain Pass**, **Glowstone Tunnel**, **Waterfall Viaduct** | Snowy peaks, pines, cable cars and chalets. The summit has a lookout, flag and goat. Glowing crystals fill the cutaway tunnel; a high timber trestle crosses a turquoise ravine beside falling water. |
| Starlight Carnival | **Rainbow Midway**, **Marquee Loop**, **Carousel Climb** | A night-time funfair with ticket/candy-floss booths, bunting, garlands, chasing bulbs, soft sweeping stage beams, coloured fountains, a rotating carousel and Ferris wheels with upright cabins. The loop wears a glowing star; two rising turns circle the carousel. |
| Pumpkin Party | **Pumpkin Hops**, **Pumpkin Portal**, **Witch’s Hat** | Three distinct crests, a giant cutaway pumpkin, and a climb followed by three descending spirals around a crooked hat. Amber lanterns, rosy-cheeked ghosts, fluttering bats, smiling pumpkins, vines and warm windows keep it friendly. |

World boundaries are near 900 / 1,900 / 3,000 course metres, at the next section start. Another adventure begins after 4,200 metres. Every world starts with its three signature pieces, separated by short breathers. Its remaining pieces are shuffled, with varied shapes/proportions and additional inversions unlocked on subsequent adventures. A long random element cannot displace a signature beyond the next world boundary.

Generative scale stops growing at 2×. Base-course height caps are 30 / 38 / 38 / 40 metres, with at most four turns. Sky lift retains its ability to raise the course further. Scenery is excluded from camera framing; the existing 3× zoom cap remains.

## Rendering and playability

Scenery uses baked vertex colours and merged material batches. Twelve fixed-capacity instance buffers cover creatures, rides, waterfall spray and stage beams. Each buffer holds at most 192 actors. Old scenery tiles and their geometry are released as the track scrolls past. Mirrored race formations share geometry and dispose it exactly once.

Fairground bulbs use one shared shader with a baked phase per bulb. Their brightness travels smoothly around loops and garlands on an approximately 4.5-second cycle. Ordinary lamps remain steady. Coloured fountain streams use the same material. Stage beams are translucent instanced geometry; they do not add shadow-casting spotlights or a full-screen bloom pass. Carousels rotate, wheel cabins remain upright, and the waterfall spray falls from a fixed location.

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
- `scripts/check-worlds-browser.js` — six measured seconds per world/layout after warm-up
- `scripts/check-worlds-multiplayer-browser.js` — two actual connected clients, plus optional software phone
- `scripts/check-world-transitions-browser.js` — continuous 125-second ride, including streaming and transitions

Browser scripts run through `playwright-cli run-code` against Vite. Screenshots and measurement JSON are saved locally in `output/playwright/` (ignored by Git). Checkpoint screenshots are distinct from real-time performance tests. Frame measurements use Chromium / ANGLE Metal on an Apple M4; phone emulation does not replace testing on a physical low-end phone.

## Final performance results

All **135 tests** and the production build passed. Eight real-time world/layout measurements recorded a 16.7 ms median and 18.7 ms p99 (approximately 60 FPS), with no frame over 50 ms. Visible draw counts ranged from 73 to 132.

The continuous desktop ride ran 125 seconds, travelled 5.88 km and answered 77 questions. It covered all four worlds and returned to the mountains, ending still in play. Every world's p99 was 18.7 ms. The only frame over 50 ms was 98.1 ms at game time zero, during initial construction; there were none during the ride or world transitions. It finished with five scenery tiles and 85 geometry buffers.

Combined measurements, simulations and visual-check reports are saved in `output/playwright/world-refinement-validation.json`.
