# Background graphics review

Branch: `codex/background-world-polish`. Baseline: `82ab4f2` on `main`.

This changes the scenery surrounding the course. Track geometry, special-piece
models, gameplay, camera framing and multiplayer networking are unchanged.

## Visual changes

- **Meadow:** layered hills, an orchard edge, grazing pockets and grouped
  five-petal wildflowers. The background windmill has a tapered tower, a door
  following its wall, and a hub that places the sails in front of the building.
- **Mountains:** asymmetric faceted peaks with snow and rock sharing the same
  boundary vertices, tiered firs, snow clearings, shaped pools and gabled chalets.
  Chalets sit on clear ground instead of disappearing into the foothills.
- **Starlight Carnival:** lower hills, readable star glints, striped pavilions,
  ticket kiosks, paved courts, lanterns, benches and smaller geometric fountains.
  The pavilion and tree placement leaves clear ground around each building.
- **Halloween:** varied connected tree branches, planted pumpkin gardens,
  wandering lantern fences and crooked cottages whose roof, door and windows
  follow the same transform.

The review included desktop and touch/mobile views, then a second pass correcting
buried paths/flower beds, pavilion clearance, and the tapered windmill door. Ground
detail is placed above the existing turf surface at y=.075. Background builders
now live in separate `background-*.ts` modules; special-piece builders remain in
their existing files.

## Rendering budget

Static geometry still merges into the existing front/back material batches. No
textures, real-time lights, postprocessing, animated-object types or transparent
layers were added. Small flowers/stars use purpose-built low-poly shapes instead
of spheres. Generated mountain face orientation avoids temporary vector objects.

Creature instance buffers now upload only their populated prefix, and empty
batches skip uploads. Capacity, independent rider gravity and pause/reduced-motion
behaviour remain unchanged.

Background geometry at the end of the seeded mobile comparison window:

| World | Before | After (approximately) | Reduction |
| --- | ---: | ---: | ---: |
| Meadow | 48,624 triangles | 19,000 | 61% |
| Mountains | 34,238 | 20,700 | 39% |
| Carnival | 62,684 | 21,600 | 66% |
| Halloween | 15,466 | 11,800 | 24% |

These are retained background meshes, excluding track-piece geometry and animated
actors. Windows can contain adjacent-world tiles. The final windmill door frame
adds 12 triangles per background mill, within the rounded totals above.

## Frame-time comparison

Measured with headed Chromium/ANGLE Metal on an Apple M4. Desktop: 1440×900.
Mobile: an actual mobile browser context, 390×844, DPR 2, touch enabled, **4× CPU
throttling** during measurement. This does not emulate a low-end phone GPU.

Both versions used seed 42, Easy difficulty, a correct answer every 1.5 seconds,
random power gates suppressed, the same four world entry distances, 1.6 seconds
settling, and eight seconds of normal moving gameplay per world. No builds or
test suites ran concurrently with measurement. Desktop was measured again after
the visual corrections.

| World | Desktop FPS before → after | Mobile FPS before → after | Mobile p95 frame interval before → after |
| --- | --- | --- | --- |
| Meadow | 59.99 → 60.00 | 59.99 → 60.00 | 17.5 → 17.6 ms |
| Mountains | 60.00 → 60.00 | 59.87 → 59.87 | 17.6 → 17.5 ms |
| Carnival | 59.99 → 59.99 | 59.88 → 60.00 | 17.7 → 17.5 ms |
| Halloween | 60.00 → 60.00 | 60.01 → 60.00 | 17.6 → 17.6 ms |

Mobile frames over 25 ms: meadow 0→0, mountains 1→1, carnival 1→0,
Halloween 0→0. No frames exceeded 50 ms. Render CPU/submission p95 after the
change was 3.8–4.6 ms under throttling; this includes the complete game view,
not just backgrounds. Individual CPU readings vary between runs; these short
comparisons support preserved frame pacing, not a universal hardware FPS claim.

Total mobile draw calls at the sampled endpoints were 74→74, 80→81, 82→75,
77→76 respectively. The slightly different distribution of visible scenery and
shadows can change endpoint counts; no new background material passes were added.

## Validation and reproduction

- `npm test`: 183 tests passed, including bounded lifetime/disposal, scenery
  gravity, reduced motion, light transforms and camera/board tilt checks.
- `npm run build`: passes TypeScript and production compilation.
- `tests/background-scenery.test.ts`: 32 seeds per world; triangle/batch budgets,
  finite vertices/normals, ground clearance, race aisle/board bounds, stable
  origin rebasing, shared far scenery and bounded instance uploads.
- `scripts/check-backgrounds-browser.js`: two rendered trains in each world,
  desktop/narrow layouts, independent scenery gravity and solo downhill drift.
  These are renderer fixtures, not a new network connectivity test. No page errors.

Start Vite, then use Playwright CLI with a headed browser:

```sh
playwright-cli open http://127.0.0.1:5198/ --headed
playwright-cli eval "() => { window.backgroundPass='after'; window.backgroundMobile=false; }"
playwright-cli run-code --filename scripts/profile-backgrounds-browser.js
playwright-cli eval "() => { window.backgroundPass='after'; window.backgroundMobile=true; }"
playwright-cli run-code --filename scripts/profile-backgrounds-browser.js
playwright-cli run-code --filename scripts/check-backgrounds-browser.js
```

Before/after screenshots and raw measurements are in ignored
`output/playwright/background-*`. Restart Vite after switching versions if its
file watcher retains old transforms; the profiler checks for the new modules.
