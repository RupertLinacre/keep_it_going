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
