# Live game performance — 13 September 2026

The train starts with six coaches and grows to at most ten, including any coach
approaching from behind. A detached coach frees a place for a replacement. Both
the logical train and its rendering allocation are bounded.

## Findings and changes

- **Motion was quantised to physics steps.** Physics runs at 120 Hz. Drawing only
  the last completed step repeats positions on faster displays and gives uneven
  movement when display timing doesn't divide evenly into 120 Hz. The view now
  interpolates distance and attached coach lift between completed steps. This
  adds at most one physics step (8.33 ms) of presentation latency and leaves
  gravity, boost energy, collisions and the carriage constraints unchanged.
- **Track construction caused spikes.** Each rail used TubeGeometry, separately
  resampling the curve and computing Frenet frames. Both rails now use the
  existing physics frames and preallocated typed buffers. Three longitudinal
  segments per metre replace five; cross-section size and six radial sides are
  unchanged. Rail-frame alignment is tested through loops and a pretzel knot.
- **Small parts caused many draw calls.** Wheels, blocks, ribbons, trees and
  other fixed parts are combined by material before instancing/rendering.
  Geometry and colours are retained. Empty effects aren't submitted, and only
  active portions of moving instance buffers are uploaded.
- **Static and hidden work ran every frame.** Track scenery transforms are now
  baked once and updated only when its floating origin changes. Coach poses are
  shared with coupling rendering. Desktop readouts refresh at 10 Hz; their
  hidden mobile counterparts don't refresh.

The CPU profile identified rendering, WebGL submission and readouts as larger
costs than ordinary carriage physics. Lowering the physics tick rate wasn't
needed.

## Measurements

These are live browser runs of the game, using its normal animation loop and
keyboard input, not video capture or accelerated simulation. Baseline source:
`620fe4c`. Chrome used the Apple M4 Metal renderer. Tests used a fixed random
seed, 1.5 seconds of warm-up and 18 correct answers, with 80 ms between digits
and a 1.75 second wait after each answer. CPU sampling was used for diagnosis;
the final comparison ran without the sampling profiler or concurrent tests.

Mobile comparison: 390 × 664 CSS pixels, touch emulation, device scale factor 3
(the game's rendering cap remains 1.7), and Chrome's 4× CPU throttle.

| Measurement | Before | After |
| --- | ---: | ---: |
| Average render CPU time | 8.30 ms | 6.29 ms |
| 95th-percentile render CPU time | 16.5 ms | 9.9 ms |
| Average new section build | 16.51 ms | 11.58 ms |
| Slowest new section build | 35.9 ms | 20.7 ms |
| Average draw calls | 174.8 | 93.5 |
| Average rendered triangles | 108,806 | 75,601 |
| Average frame interval | 17.53 ms | 16.69 ms |
| 99th-percentile frame interval | 50.0 ms | 16.8 ms |
| Frames longer than 25 ms | 83 / 2,383 | 3 / 2,111 |

The final ride reached ten coaches. The mobile touch keypad was exercised and
the layout checked for horizontal overflow and hidden readouts. Desktop was
already approximately 60 fps in the initial measurement (16.67 ms mean, 16.8 ms
99th percentile); interpolation improves motion consistency even at that rate.
The final 1440 × 900 desktop run averaged 1.33 ms of render CPU time and 16.91 ms
between frames. It still recorded one 166.7 ms frame and a 33.3 ms frame-interval
99th percentile, despite no measured render call exceeding 6.4 ms. This work
doesn't establish that every browser/host stall has been eliminated.

Timing varied across runs on this shared Mac. These figures describe one
successive before/after pair, not a guarantee for physical phones. CPU throttle
doesn't emulate a phone's GPU, thermals or browser. The 60 Hz browser also can't
validate a physical high-refresh display: automated motion tests cover
60, 90, 120, 144 and 165 Hz. Render CPU timings include command submission, not
an independent GPU timer. Draw-call and triangle reductions were consistent
across the repeated runs.

All 62 tests and the TypeScript/production build pass. The tests include the
ten-coach limit, replacement arrivals, refresh-rate interpolation and rail mesh
geometry, alongside the existing physics, progression and track-element suite.

## Repeat the measurement

Start Vite, then open the game using Playwright CLI. Use separate browser
sessions for desktop and mobile, with only the session being measured running.
Adjust the example port to Vite's actual port.

```sh
npx @playwright/cli -s=perf open http://127.0.0.1:5174/index.html --browser chrome
npx @playwright/cli -s=perf resize 1440 900
npx @playwright/cli -s=perf run-code --filename scripts/profile-browser.js
npx @playwright/cli -s=perf eval 'JSON.stringify(window.profileResult)'
npx @playwright/cli -s=perf close
```

For mobile, open with `--device "iPhone 13"`, set the desired viewport, then set
CPU throttle before running the same script:

```sh
npx @playwright/cli -s=perf run-code 'async (page) => { const cdp = await page.context().newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", {rate: 4}); }'
```

The script requires the Vite development modules. It records frame intervals,
update/render/build costs, long tasks, draw calls, triangles and coach count in
`window.profileResult`. It changes the random seed only in the diagnostic
browser session. Run before and after sequentially, avoiding builds, recordings
and other load while measuring. All times in the result are milliseconds.

## Large external display investigation — 22 September 2026

Baseline: `2af785c`, branch `codex/background-world-polish`. The reported device
was this MacBook Air with a 4K monitor. Tests used the Apple M4 Metal renderer,
real animation frames and keyboard answers, first at native 3840 × 2160, then
with macOS-style scaled windows at DPR 2. The exact physical monitor scaling
was unavailable, so the larger window is a reproduction scenario, not a claim
about the user's display settings.

### Causes and fixes

1. **The old density cap did not cap total GPU work.** A 3008 × 1692 CSS window
   at DPR 2 produced a 5028 × 2544 game canvas: 12.79 million pixels, before
   antialiasing, shadows and transparent effects. GPU timer queries identified
   expensive combinations including pond/splash sections with cargo, tunnel
   and ravine scenery, and a heartline with tailwind. The worst recorded GPU
   sample was 41.4 ms. Native 4K was much less demanding and did not reproduce
   the same sustained pressure in that run.
2. **Building scenery allocated and transformed many temporary geometries.**
   New carnival sections, sometimes several entering the view together, made
   single-frame scenery construction particularly costly. `WorldModel` now
   expands immutable primitives once, snapshots each placement, and writes
   directly to final position/normal/colour buffers. It preserves the geometry,
   material batches, shadows, lamp phases and glow halos. Mirrored triangle
   winding and mutable custom shapes are covered by equivalence tests.

The 3D canvas now has a six-million-pixel budget in addition to the existing
1.7 density cap. The large reproduction window renders at 3443 × 1742 instead
of 5028 × 2544. This reduces scene resolution on very large windows; DOM text
and controls remain native-resolution. Ordinary desktop and phone sizes retain
their previous density. Resizing recalculates the budget. No scenery density,
particles, gameplay physics or multiplayer update rate was reduced.

### Live comparisons

One-player: seed 42, 70 seconds. Two-player: seed 6, 90 seconds, actual WebRTC
room and two independently answered games. Host viewport 3008 × 1692, DPR 2,
no CPU throttle. The guest ran normal input, physics and networking on the same
Mac, with rendering disabled to avoid benchmarking a second device's graphics
on the host GPU. Both sides used Easy, normal auto-accept and roughly 1.6–1.8
seconds per answer. No builds or other benchmarks ran concurrently.

| Measurement | Solo before | Solo after | Race before | Race after |
| --- | ---: | ---: | ---: | ---: |
| Measured frame intervals | 4,215 | 4,246 | 5,239 | 5,463 |
| Mean interval | 16.80 ms | 16.67 ms | 17.37 ms | 16.67 ms |
| 99th-percentile interval | 19.2 ms | 18.9 ms | 39.8 ms | 20.1 ms |
| Frames over 25 ms | 5 | 0 | 246 | 0 |
| Frames over 50 ms | 4 | 0 | 23 | 0 |
| 99th-percentile GPU time | 25.92 ms | 9.84 ms | 14.79 ms | 11.81 ms |
| Longest scenery build frame | 16.9 ms | 8.2 ms | 53.3 ms | 6.8 ms |

GPU measurements use asynchronous `EXT_disjoint_timer_query_webgl2` queries
on every fourth rendered frame, ignoring disjoint results. They measure GPU
work independently of JavaScript command submission. CPU timings are nested,
so their columns must not be added together. The instrumentation also records
individual WebGL stalls and correlates frames with track pieces, neighbours,
power-ups and world. Average FPS alone concealed the initial outliers.

An isolated four-pass scenery construction comparison (same seed and distances,
272 calls) reduced mean construction from 3.29 to 1.37 ms and p95 from 10.11 to
4.11 ms. Cold maximum timings varied; these are supporting measurements, not
an additional live-game FPS claim. Normal Sky Lift deformation was inexpensive
in the native-speed solo runs, so its physics was left alone.

These are successive browser runs on a shared Mac, with shader/cache/host timing
variation. They demonstrate improved headroom and fewer reproduced hitches,
not a guarantee that all stalls on every external display have disappeared.

### Reproduce a long live run

Start Vite, open the local page with Playwright CLI, then:

```sh
npx @playwright/cli -s=stutters eval '() => { window.stutterConfig = { seed: 6, seconds: 90, throttle: 1, width: 3008, height: 1692, dpr: 2, race: true, pass: "race-retina" }; }'
npx @playwright/cli -s=stutters run-code --filename scripts/profile-stutters-browser.js
```

`race: false` measures solo play. `mobile: true` uses a 390 × 844 touch viewport;
`throttle: 4` adds CPU stress without pretending to emulate a phone GPU. A
separate browser context is used for explicit DPR/mobile runs and closed on
completion. The returned JSON includes timing distributions, the worst frames,
GPU samples, WebGL stalls, scene counts, section/power transitions, and received
race snapshots. Screenshots go to ignored `output/playwright/`. Measure only one
active game at a time; close unrelated game windows first.

A warm-cache reversal check reinstated the original geometry builder and original
1.7 render density in a fresh race context: the same 90-second race then also
had zero intervals over 25 ms (p99 19.8 ms). GPU mean was 9.08 ms versus 7.42 ms
with the changes; maximum scenery build was 9.7 ms versus 6.8 ms. This is an
important limit on attribution: the initial 246-frame hitch count is not a
stable baseline, and the entire reduction must not be credited to these edits.
The fixes reduce measured work and add headroom; cold/driver/host stalls may
still occur.

The controlled 4× CPU-stress reversal comparison was a 60-second race with the
same seed and viewport. This reproduced construction hitches in the warm-cache
baseline. At approximately 1,562 m, building the next Lantern Run while the
train was on a jump took 36.1 ms; with direct baking it took 15.0 ms. Midway Loop
and carousel construction were other recurring costs. This explains why a
hitch can seem to belong to a particular combination: the expensive section
is often being prepared ahead of the currently ridden piece.

| 4× CPU stress, 60-second race | Original builder/density | Changes |
| --- | ---: | ---: |
| Mean frame interval | 16.77 ms | 16.68 ms |
| 99th-percentile frame interval | 23.2 ms | 21.8 ms |
| Frames over 25 ms | 26 / 3,652 | 5 / 3,625 |
| Frames over 50 ms | 4 | 0 |
| Longest frame interval | 65.1 ms | 36.5 ms |
| Longest scenery build | 36.1 ms | 15.0 ms |
| 95th-percentile draw CPU time | 8.7 ms | 6.9 ms |

The remaining stressed outliers include that 15 ms Lantern Run build plus rail
construction/rendering in the same frame, and a cargo frame with a 15.2 ms
WebGL submission. The work reduces these costs; it does not claim zero hitches
under CPU stress. All 189 tests and the TypeScript/production build pass.

The final mobile regression run used actual keypad taps at 390 × 844, DPR 2 and
4× CPU throttle. Over 65 seconds it answered 39 questions, traversed all four
worlds and exercised Sky Lift, Gravity Flip and cargo. It averaged 16.67 ms
between frames, with p99 19.4 ms, one interval over 25 ms (28 ms), and no page
errors. GPU p99 was 6.82 ms. The scene remained 625 × 742 pixels, its existing
mobile density; this is an emulated layout/CPU check on the M4, not physical
phone performance certification.
