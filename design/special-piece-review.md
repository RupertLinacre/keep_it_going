# Special-piece workshop

Branch: `codex/special-piece-polish`. Based on main `b346bfc`.

Run `npm run dev -- --port 5198` and open
<http://localhost:5198/piece-review.html>.

This branch proposes improvements to all twelve current world signature pieces.
The original and updated versions run side by side with the same track, train,
lighting and camera. Drag either view to orbit both, replay the train, or use the
timeline. The tunnel has a cutaway. The extra time after each traversal shows
lingering animation, including the carousel slowing down.

Choose **Keep original** or **Use this update** for each piece, then **Copy my
choices**. Choices stay in browser local storage; they do not alter gameplay or
merge anything. The branch's game runs all proposals until selections are made.

| Piece | Proposed change |
| --- | --- |
| Sheep Shuffle | Terraced farm, hut, hay cart, waving flowers and butterflies around the escaping sheep |
| Lily Pad Bridge | Layered flowering pond, sailboat regatta, ripples and turning waterwheel |
| Windmill Loop | Lattice sails, detailed mill facade, gearwork, pinwheels and grain |
| Mountain Pass | Snow and crystal gorge, with a chorus of reacting alpine goats |
| Glowstone Tunnel | Chalet ropeway stations, moving pulleys and cabins, glowstone details |
| Waterfall Viaduct | Foreground waterfall, turning wheel, rainbow and glittering spray |
| Lantern Parade | Ornate lantern arches and seven bobbing bunny lanterns |
| Marquee Loop | Smiling sun, orbiting stars and a richer illuminated frame |
| Carousel Climb | Three decks, eighteen bobbing unicorns, striped canopies and mirrored core; follows the train's angular speed, then coasts with exponential decay |
| Pumpkin Hops | Smiling drums and mallets that beat as the train crosses each crest, with green spark showers |
| Pumpkin Portal | Crooked candy pillars, illuminated arch and tumbling sweets alongside the pumpkin burst |
| Witch's Hat | Patchwork stitching, bubbling cauldrons and cats riding broomsticks |

## Review and performance

Each world received a design pass and a visual/geometry correction pass. Review
found and corrected an exposed pond shoreline, a waterfall hidden behind the
bridge, insufficiently legible carousel decks and goats, particle colour,
mallet contact, broom clearance, and animation group/GPU buffer disposal.

Static detail is merged into existing batches. New animated props use bounded
instance pools: no new shadow passes, realtime lights or per-particle meshes.
An isolated piece adds only 1–3 draw calls. New animation modules are separate
from shared scenery; the immutable original modules in `src/review/before/`
are imported only by the review entry point, never by the game.

Browser checks on this Mac at a 3840×2160 viewport used the game's existing
resolution cap (3401×1763 framebuffer). Identical controlled traversals compared
the frozen original scene and the new scene, with surrounding generated pieces:

- All 12 single-player pieces: median frame interval 16.6–16.7 ms for both
  versions, p95 18.4–18.7 ms. No measured frame exceeded 25 ms.
- Four mirrored two-track scenes (windmill, tunnel, carousel, witch's hat):
  median 16.7 ms; no measured frame exceeded 25 ms.
- Updated CPU update/render submission p95 was 3.9–4.5 ms in these samples.
- Two-track measurements use a synthetic opponent to isolate rendering cost;
  they do not test a network connection. Each sample measures 89 frames after
  warmup, so these are comparative checks, not guarantees for every device or
  cold geometry build.

`scripts/profile-special-pieces-browser.js` reproduces these checks using the
existing Playwright CLI `run-code` workflow. The gallery check script exercises
390px mobile layout, choice persistence, filtering, tunnel cutaway and three
complete selection cycles. GPU geometry/texture counts were identical across
repeated cycles. Screenshots and raw local QA output belong in ignored
`output/playwright/`.

The final run passed all 232 tests and the production build. Desktop and mobile
gameplay each accepted five answers, stayed playable and showed no layout
overflow or browser errors.

Automated checks cover clearance, deterministic replay, reduced motion, fixed
instance limits, geometry disposal, independent multiplayer height changes,
carousel direction/speed and frame-rate-independent spin-down. Run `npm test`
and `npm run build` before selecting or merging proposals.
