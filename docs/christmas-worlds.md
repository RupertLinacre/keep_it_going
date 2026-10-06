# Two Christmas worlds

Work is on `codex/christmas-world`. Both worlds are scenery foundations, with
ordinary existing track geometry. Their signature-attraction lists are empty;
world-specific pieces will be designed separately.

The lighting refinement adds soft window/lantern/tree halos and warm snow spill,
with deeper blue-hour contrast in Lapland and peach/lilac sunlit ridges at the fair.
Glow geometry shares at most two additional draw calls per streamed tile and is
bounded to fewer than 56 small quads per scenery bay. The glow shader needs no texture, render target or camera subject.
Two nearby unshadowed warm lights complement the halos in Lapland. Ground pools are depth-tested;
both landscapes retain their front/back race-lane separation and cleanup.

## Visual direction

The selected references are **02 A/B — Lapland at blue hour** and **10 A/B —
Frozen-lake winter fair**. Four further built-in imagegen images were generated
for each, concentrating on scenery rather than new rides.

- **Twilight Lapland:** lavender-blue snow, faceted blue hills, dark tiered firs
  with wide snow caps, cranberry timber cabins, amber windows, star garlands,
  warm lamp/window clearings, reindeer, wooden gift sleds and frozen ponds.
- **Frosty Lake Fair:** pink/apricot sunset, pale blue/turquoise ice, ivory snow islands,
  coral/teal striped cocoa stalls, bunting, lantern piers, benches, snowmen and
  small scarf-wearing penguins skating on loops in the foreground.

These translate the references into the game's existing untextured low-poly
style and natural camera. Ice uses opaque colour facets and pale crack marks;
warm windows have camera-facing soft halos and feathered amber light pools on snow.
Faceted 3D mountain ridges are restored behind the village and lake. A layered
2D sky peeps above and between their peaks, with a peach sun or a quiet crescent moon
and sparse stars. Near firs, cabins, islands and lanterns remain 3D. Only the
extended board is clipped at a world-space boundary behind all scenery and both
race lanes, independent of camera height or zoom; the sky never writes depth over a
distant player, track or cabin. Low faceted snow banks join the mountain foothills. The restored range is still
part of the static vertex-colour scenery batches.
There are no reflection passes, per-window shadow lights, fullscreen bloom or dense snowfall. The existing train models stay intact.

The full reference prompts and input-image paths are in
`design/christmas-aesthetics/selected-worlds.json`. Eight generated PNGs and
their provenance are in `output/imagegen/christmas-worlds/`. The local comparison
gallery also contains original selected references and actual game captures:

<http://localhost:5198/output/imagegen/christmas-worlds/index.html>

## Journey and previews

The original four stages retain their original boundaries. Lapland covers
4,200–5,400 metres; the fair covers 5,400–6,600 metres. The tower now celebrates
a complete six-world adventure, then the journey repeats. The world HUD and
ride-complete text use the number of configured worlds.

Direct solo previews use the same start screen, questions, physics, powers,
scenery and transitions as the main game:

- <http://localhost:5198/?mode=remix&world=lapland&seed=42>
- <http://localhost:5198/?mode=remix&world=winterfair&seed=42>

Click **1 player**. The preview starts on the normal opening hill inside that
world and continues into the next stage. Preview offsets are ignored in
multiplayer and the standalone tower demo. Ordinary multiplayer games reach
both new stages through the shared seeded route.

The track gallery's winter collections show their ordinary track choices,
with winter scenery, instead of assuming every world has signature pieces.

## Implementation and performance safeguards

- `background-winter.ts`: shared snow/cabin/fir/lamp/market primitives and
  three seeded scenery compositions per world. Each bay is below 2,400 static
  triangles; background and foreground each use a solid/glow material batch.
- `winter-atmosphere.ts`: a single two-triangle sky layer, with smooth blue-hour
  haze or a pink-orange sunset and sun halo, layered distant hills and slow parallax. It never enters camera
  subject bounds. Its opaque render queue prevents it overlaying the train.
- `AdventureScene`: skating penguins share one fixed 192-instance buffer. All
  actors follow game time, freeze during pause, and obey reduced-motion settings.
- Existing streamed section disposal, landscape separation between race lanes,
  renderer pixel budget, shadows and camera zoom caps are retained.

## Validation

`tests/winter-worlds.test.ts` checks journey order, scenery-only track selection,
solo preview isolation, geometry budgets, finite normals, the rail/race corridor,
bounded skating, pause/reduced motion and sky transitions/render order. Existing
world, tower and background tests cover the extended journey and its disposal.

`scripts/check-winter-worlds-browser.js` checks desktop/mobile scene layouts,
two-track render fixtures, Gravity Flip, Sky Lift, Downhill Drift, the real
Halloween → Lapland → fair → tower → meadow lifecycle, and winter track-gallery
collections. Its two-track fixtures test graphics, not a WebRTC connection.

`scripts/profile-winter-worlds-browser.js` measures live requestAnimationFrame
gameplay at a 4K viewport and at a phone layout with 4× CPU throttling, with
Starlight Carnival as an existing-world comparison. It also profiles two moving
train render fixtures at 4K. The phone case runs on this Mac's GPU; it is not a
claim about a physical low-end phone. Build/render timings measure CPU submission,
while the frame samples measure observed presentation cadence.

Screenshots and machine-readable results are saved under
`output/playwright/winter-worlds/`.

### Measured on this Mac (Apple M4 / Metal)

Illustrated sky and warm-light run (`sky-performance.json`): eight-second samples after warm-up, seed 42, Easy difficulty, a correct answer
every 1.8 seconds. Random power gates were suppressed to isolate scenery.

| Scene | Layout | FPS | Frame p99 | Max frame | Frames >25 ms | Render CPU mean |
|---|---|---:|---:|---:|---:|---:|
| night | 4k | 60.0 | 17.6 ms | 17.7 ms | 0 | 1.25 ms |
| lapland | 4k | 60.0 | 17.7 ms | 17.7 ms | 0 | 2.44 ms |
| winterfair | 4k | 60.0 | 17.7 ms | 17.7 ms | 0 | 2.04 ms |
| night | phone | 60.0 | 17.7 ms | 17.7 ms | 0 | 2.33 ms |
| lapland | phone | 60.0 | 17.7 ms | 17.8 ms | 0 | 2.15 ms |
| winterfair | phone | 60.0 | 17.7 ms | 17.7 ms | 0 | 2.00 ms |
| lapland | race-4k | 60.0 | 17.7 ms | 17.7 ms | 0 | 2.43 ms |
| winterfair | race-4k | 60.0 | 17.7 ms | 17.7 ms | 0 | 2.34 ms |

The 4K cases rendered about 6 million scene pixels under the existing pixel
budget. Both winter worlds remained at roughly 60 FPS, including two moving
trains. The phone layout used 4× CPU throttling and the same Apple GPU; no
physical-phone performance guarantee is inferred from it. No JavaScript errors
or layout overflows were reported. All **264 tests** passed, and the production
build succeeded.
