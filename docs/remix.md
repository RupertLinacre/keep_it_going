# Seeded courses and ride power-ups

The default game on `experiment/height-powered-coaster` is **Remix**, a solo ride through a fresh course with timed surprises. Answers normally give the established speed boost. `?mode=remix` and the old `?mode=height` link both select it. `?mode=classic`, and multiplayer invite links, retain the original solo/multiplayer game. Records are stored separately under `remix` and still separated by difficulty.

## Courses and replay

The start screen's **Course seed & ride surprises** section accepts an optional number or word. A blank seed uses `crypto.getRandomValues` for a fresh seed on every new ride, including the result screen's restart. An explicit seed stays fixed on restart. Numeric zero is valid. Words map to a stable unsigned 32-bit seed. **Copy ride** makes a URL containing the actual numeric seed.

The track, questions and power-up director have independent seeded random streams. The same seed reproduces the course and power-up order with the same version of the generator. Gate positions after the first pickup depend on how far the train travels during timed effects, so a seed is not a recording of the rider's actions. Times tables and difficulty remain personal start-screen choices and are not encoded in the course link.

The existing 25-element library is retained. The opening hill varies from 80–108 metres wide and 22–28 metres high. The six coaches still start gently at 2 m/s, just beyond its crest. A randomly chosen gentle element replaces the fixed opening sequence. After that, the director alternates shuffled recovery sections with challenges drawn across the element library. Water jumps are excluded from a challenge bag assembled inside the opening 350 route metres. The fantasy nested loop enters after the first progression chapter.

Individual elements vary from roughly 0.76–1.30 times their progression scale. Hills vary in width and height independently; compound inversions retain linked dimensions so their lanes and clearances survive scaling. Opening challenges have a smaller scale. Rising spirals vary their turn count as well as their dimensions, within the existing two-to-eight-turn limit. Distance still increases overall height and difficulty. Elements join with a continuous rail position and heading and keep the course moving broadly forward.

The track remains a sliding window. Seeded assembly does not prebuild an unlimited world, and old geometry, lift fields and visual effects are pruned.

## Seven timed effects

Drive through a coloured ring to collect its effect. A small HUD card previews the next gate, then shows the active name, countdown and progress bar. Desktop adds a short instruction; phones keep the card compact beside the game, with the question and touch keypad below or alongside it.

Each effect lasts **20 seconds of active game time**. Pausing freezes the timer. Effects do not stack or replace one another early. After expiry there is a three-second breather, then the next gate is placed 28–58 route metres ahead, searching for rail with a moderate slope. The first gate starts 65 metres ahead. The shuffled bag includes all seven effects before refilling and avoids identical consecutive effects at bag boundaries.

| Effect | Gameplay | Visual treatment |
| --- | --- | --- |
| Ice glide | Rolling resistance and air resistance fall to 25% of the selected difficulty's usual values. | Snow, icy blue rails and pale ground. |
| Gravity flip | Gravity changes to −7.2 m/s². Climbs accelerate the train and descents slow it. Loose cargo and detached coaches rise. | Violet scene, upward rain and floating, rotating rocks. |
| Cargo carnival | Open wagons fill with eight parcels, including red TNT bundles. Refills take 0.8 seconds and cargo spills more readily. | Tall stacks, red dynamite with fuses, gold confetti and fiery bursts. |
| Splash zone | Pickup removes 16% of speed; air resistance rises to 1.5× base, with an extra 0.35 m/s² rolling loss. It creates spray without ending the ride. | Wet rail ribbon, rain and repeated large water splashes. |
| Sky lift | Each correct answer raises the current track section by 30 metres over one second, with no speed impulse. | Green rising motes, rising rails/supports and a next-section height cue. |
| Heavy metal | Gravity becomes 1.65× normal: stronger downhill acceleration, harder climbs and quicker falling cargo. | Amber rails and ground, fast-falling streaks and rocks. |
| Tailwind | Adds a steady 3.2 m/s² forward acceleration along the rail. | Horizontal wind streaks and a teal scene. |

Physics settings are derived from the rider's base difficulty on every update. They restore exactly on expiry and are never repeatedly multiplied. Ending a ride clears the active modifier. Weather and terrain colours ease in and out. The lead coach remains attached to the railway, and the existing restrained vertical lift of following coaches is retained.

Gravity flip has one deliberate arcade exception: the lead train's intentional water jump keeps a normal downward landing arc. Earlier testing with fully reversed gravity left it airborne far beyond the useful game view. Rail-bound gravity and loose objects still reverse; the jump guide keeps the train's flight short and readable. Heavy gravity does affect the water-jump arc.

Eight parcels are a temporary exception to the usual four-per-wagon cap. On Cargo carnival expiry, attached wagons return to at most four. Existing TNT among those remaining parcels stays TNT until spilled; later normal refills contain ordinary parcels. TNT bursts on its first ground impact or 1.6–2.2 seconds after spilling. It never explodes while attached, and its burst is visual rather than a train-damaging chain reaction. Ordinary loose parcels retain their strong air resistance. The ten-coach cap, 64 loose-parcel cap, bounded explosions and 3× maximum camera zoom-out remain.

Sky lift retains the geometry and physical-spacing implementation described in [the height experiment notes](height-experiment.md). Earned height stays in the track after the effect ends. Answers return to speed boosts; they do not undo earlier lifts. A lift earned during a water jump waits until landing, even if the timer expires in flight. Raising a section gives potential energy for its descent; it does not reduce the remaining climb within that same section, so answering early is useful.

## Verification

```sh
npm test
npm run build
npx tsx scripts/playtest-remix.ts --quick
npx tsx scripts/playtest-remix.ts
```

The automated suite has 103 tests, including repeatable generation, varied but joined geometry across seeds, power-up timing and bag order, exact physics restoration, switching answer mechanisms, cargo/TNT behaviour, reversed loose-body gravity, and a bounded water-jump landing during gravity flip. Existing classic, multiplayer, height geometry and performance regressions also pass.

The full Remix balance run uses the real game simulation for eight seeds at each of three answering intervals, with a three-minute limit. It assumes 96% accuracy and ±20% variation in the interval, including thinking and input time, on Medium difficulty. A simulated failed answer opportunity is skipped. These are modeled assumptions, not observed human performance.

| Average time between answers | Mean distance | Mean ride time | Reached three minutes |
| --- | ---: | ---: | ---: |
| 4.8 seconds | 1,467 m | 63.5 s | 0 / 8 |
| 3.2 seconds | 4,134 m | 148.7 s | 4 / 8 |
| 2.0 seconds | 5,306 m | 156.4 s | 5 / 8 |

All 24 simulations remained finite and within object limits. Some riders stopped on a climb; answering faster improved average survival but does not guarantee a longer ride on every seed, because the timed Sky lift effect can catch riders on different sections. Seed 731, for example, exposed that timing trade-off. Easier difficulties remain available for more thinking time. Early tests also exposed an opening water jump that arrived too soon and an excessively long reverse-gravity flight; the opening filter and controlled water-jump arc address those cases.

Run `scripts/check-remix-browser.js` via Playwright CLI's `run-code` against the Vite development server. It plays an 18-answer ride using normal keyboard input, checks pause timing, collects each of the seven effects through a nearby gate fixture, checks speed-versus-height answers, and plays a touch-phone ride in portrait and landscape. It also checks the canvas fallback with WebGL disabled. `scripts/check-remix-seeds.js` checks named/zero/fresh seeds, restart behaviour, the link generated by Copy ride, classic solo input, its two-player setup screen and invite routing. It does not establish a new WebRTC race.

Measured on the development Mac in Chrome, the natural desktop ride at 1440×900 averaged **59.7 fps**, and the emulated 390×844 phone averaged **60.0 fps**, both with 99th-percentile frame intervals of **16.8 ms**. The short Sky lift fixture averaged 59.3 fps with a 33.3 ms 99th percentile. Other effect fixtures were approximately 60 fps. Phone landscape at 844×390 fitted the viewport. No page errors or overflow were found. These are browser measurements on a Mac, not measurements from physical phone hardware.

`scripts/check-remix-long-browser.js` adds a sustained rendered ride using actual keyboard answers about every two seconds. The final run on seed 18 lasted 177.5 seconds, answered 88 questions and travelled 6.38 km, collecting all seven kinds of power-up. Each active effect averaged approximately 60 fps with a 16.8 ms 99th-percentile frame interval; the normal intervals averaged 59.9 fps with one frame above 33.5 ms. The ride retained only six loaded sections, ten coaches and 19 loose parcels at the end, with no page errors or overflow.

The visual layer uses one reusable gate, a fixed weather buffer, instanced rocks/water, instanced TNT and bounded impact particles. It does not create geometry every frame or use a full-screen postprocessing pass. Rail lift animation updates the existing rail and support buffers. Browser screenshots are generated under the ignored `output/playwright/` directory.

## Main implementation files

- `src/games/mini-track.ts`: seeded element assembly and shape variation, with classic generation retained behind the option.
- `src/games/course-seed.ts`, `src/main.ts`, `src/start.ts`: seed entry, fresh/repeated rides, shared links and mode selection.
- `src/games/ride-powerups.ts`: bag, gates, duration and physics modifiers.
- `src/games/mini.ts`: answer routing, deferred lifts, HUD and ride lifecycle.
- `src/games/mini-carriages.ts`: extra cargo, dynamite, gravity and water spray.
- `src/games/powerup-scene.ts`, `src/games/powerup-hud.ts`, `src/games/mini-view.ts`: weather, gates, cargo visuals and compact status.

This work is local to the experiment branch. Publishing it would make Remix the default game; it has not been deployed.
