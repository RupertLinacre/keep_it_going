# Seeded courses and ride power-ups

The default game is **Remix**, a solo ride or two-player race through a fresh course with timed surprises. Answers normally give the established speed boost. `?mode=remix` and the old `?mode=height` link both select it. `?mode=classic` retains the original solo/multiplayer game. Remix invite links carry `mode=remix`; older bare invite links select Classic until the host supplies the round mode. Records are stored separately under `remix` and still separated by difficulty.

## Courses and replay

The start screen's **Course seed & ride surprises** section accepts an optional number or word. A blank seed uses `crypto.getRandomValues` for a fresh seed on every new ride, including the result screen's restart. An explicit seed stays fixed on restart. Numeric zero is valid. Words map to a stable unsigned 32-bit seed. **Copy ride** makes a URL containing the actual numeric seed.

The track, questions and power-up director have independent seeded random streams. The same seed reproduces the course and power-up order with the same version of the generator. Gate positions after the first pickup depend on how far the train travels during timed effects, so a seed is not a recording of the rider's actions. Times tables and difficulty remain personal start-screen choices and are not encoded in the course link.

The existing 25-element library is joined by a flooded **Splash zone**, giving 26 pieces. The opening hill varies from 80–108 metres wide and 22–28 metres high. The six coaches still start gently at 2 m/s, just beyond its crest. A randomly chosen gentle element replaces the fixed opening sequence. After that, the director alternates shuffled recovery sections with challenges drawn across the element library. Water jumps are excluded from a challenge bag assembled inside the opening 350 route metres. The fantasy nested loop enters after the first progression chapter.

Individual elements vary from roughly 0.76–1.30 times their progression scale. Hills vary in width and height independently; compound inversions retain linked dimensions so their lanes and clearances survive scaling. Opening challenges have a smaller scale. Rising spirals vary their turn count as well as their dimensions, within the existing two-to-eight-turn limit. Distance still increases overall height and difficulty. Elements join with a continuous rail position and heading and keep the course moving broadly forward.

The track remains a sliding window. Seeded assembly does not prebuild an unlimited world, and old geometry, lift fields and visual effects are pruned.

## Seven timed effects

Drive through a coloured ring to collect its effect. A small HUD card previews the next gate, then shows the active name, countdown and progress bar. Desktop adds a short instruction; phones keep the card compact beside the game, with the question and touch keypad below or alongside it.

Each effect lasts **20 seconds of active game time**. Pausing freezes the timer. Effects do not stack or replace one another early. After expiry there is a three-second breather, then the next gate is placed 28–58 route metres ahead, searching for rail with a moderate slope. The first gate starts 65 metres ahead. The shuffled bag includes all seven effects before refilling and avoids identical consecutive effects at bag boundaries.

| Effect | Gameplay | Visual treatment |
| --- | --- | --- |
| Ice glide | Rolling resistance and air resistance fall to 25% of the selected difficulty's usual values. | Snow, icy blue rails and pale ground. |
| Gravity flip | Climbs receive a 2g upward pull; descents use normal 1g downward gravity. Loose cargo and detached coaches rise with 2g reversed gravity. | Violet scene, upward rain and floating, rotating rocks. |
| Cargo carnival | Open wagons fill with eight parcels, including red TNT bundles. Refills take 0.8 seconds and cargo spills more readily. | Tall stacks, red dynamite with fuses, gold confetti and fiery bursts. |
| Sky lift | Each correct answer raises the current track section by 30 metres over one second. An uphill train that cannot coast over the next crest also receives just enough extra speed to help, capped at one normal answer boost. | Green rising motes, rising rails/supports and a next-section height cue. |
| Heavy metal | Gravity resists uphill travel at normal 1g and accelerates downhill travel at 3g. Guided jumps also use 1g on ascent and 3g on descent; loose cargo falls with 3g. | Amber rails and ground, fast-falling streaks and rocks. |
| Tailwind | Adds a steady 3.2 m/s² forward acceleration along the rail. | Horizontal wind streaks and a teal scene. |
| Downhill drift | Tips the whole board 22° downhill, adding about 3.7 m/s² from gravity on a forward flat. Switchbacks instead become uphill. | The entire board, course and landscape rotate smoothly. Fine board inlays reveal the slope even when its edges are outside the view; warm golden rails, a downhill-arrow gate and a level question/HUD. |

Physics settings are derived from the rider's base difficulty on every update. They restore exactly on expiry and are never repeatedly multiplied. Ending a ride clears the active modifier. Weather and terrain colours ease in and out. The lead coach remains attached to the railway, and the existing restrained vertical lift of following coaches is retained.

Gravity flip has one deliberate arcade exception: the lead train's intentional water jump keeps a normal downward landing arc. Earlier testing with fully reversed gravity left it airborne far beyond the useful game view. Rail-bound gravity and loose objects still reverse; the jump guide keeps the train's flight short and readable. Heavy gravity uses 1g during the water-jump ascent and 3g during descent. Downhill drift uses the same tilted gravity for rail motion, jumps, detached coaches, cargo and debris. It eases in and out over 1.4 seconds at either end of its 20-second duration. Geometry stays in board coordinates; a rigid world transform rotates the scene around a nearby pivot, with gravity projected into that coordinate system. This deliberately omits angular inertial forces during the gentle tilt.

Eight parcels are a temporary exception to the usual four-per-wagon cap. On Cargo carnival expiry, attached wagons return to at most four. Existing TNT among those remaining parcels stays TNT until spilled; later normal refills contain ordinary parcels. TNT bursts on its first ground impact or 1.6–2.2 seconds after spilling. It never explodes while attached, and its burst is visual rather than a train-damaging chain reaction. Ordinary loose parcels retain their strong air resistance. The ten-coach cap, 64 loose-parcel cap, bounded explosions and 3× maximum camera zoom-out remain.

Sky lift retains the geometry and physical-spacing implementation described in [the height experiment notes](height-experiment.md). Earned height stays in the track after the effect ends. Answers return to speed boosts; they do not undo earlier lifts. A lift earned during a water jump waits until landing, even if the timer expires in flight. Raising a section gives potential energy for its descent; it does not reduce the remaining climb within that same section, so answering early is useful.

The camera prioritises the train. Loose coaches get up to four seconds of nearby attention, parcels 1.6 seconds, and carriage impacts a brief centre-point cue. Water spray, TNT fragments and weather do not request framing. Loose objects can gently widen the normal view by at most 30%; only the train can use the existing 3× maximum. Sky lift measures structure size relative to the lifted section rather than treating altitude as a reason to zoom out. The world tilt rotates framing subjects around the same local pivot as the rendered scene, keeping both camera roll and the HUD level.

## Flooded splash-zone track

Splash zone is a permanent section of track, independent of the seven power-ups. Each shuffled group of six challenges contains one flooded section at a seeded position, with a recovery piece on either side. Its 66–88 metre trough gets slightly longer later in a ride, while its depth remains shallow. Continuous rails descend smoothly into a rounded pool, travel about 55 cm below the water surface, then climb back to their entry elevation. The pool is also available in the track gallery as `tracks.html?element=splash`.

The train loses momentum through additional quadratic water resistance, blended by rail immersion. There is no pickup penalty, timed slowdown or water-jump death on this piece. Water drag ceases as the engine climbs out. The active power-up continues normally. Sky lift can raise the rails clear of the stationary pool, removing water contact and drag.

Entry creates two broad sheets of spray and 56 blue/white droplets. Smaller bursts follow every six metres while the engine or tail is in the pool. Foam rings expand across the surface, and falling spray settles back into the water. Effects remain bounded by the existing six-burst limit. Translucent water makes the submerged rails visible; the pool has a basin, rim, surface glints and entry markers. The mobile canvas fallback draws the same flooded route and splash.

## Verification

```sh
npm test
npm run build
npx tsx scripts/playtest-remix.ts --quick
npx tsx scripts/playtest-remix.ts
```

The automated suite has 127 tests, including repeatable generation, varied but joined geometry across seeds, power-up timing and bag order, exact physics restoration, switching answer mechanisms, continuous flooded rails, immersion-based drag, water-exit restoration, Sky lift clearing a stationary pool, bounded bow spray, cargo/TNT behaviour, reversed loose-body gravity, and a bounded water-jump landing during gravity flip. Existing classic, multiplayer, height geometry and performance regressions also pass.

`scripts/check-tilt-browser.js` isolates camera behaviour at the same position on desktop and an emulated touch phone. All seven effects retained the normal 45.8-metre view height. Injecting 64 distant parcels plus water/TNT debris did not widen it; lifting the occupied section by 150 metres also preserved view height and the engine's screen position. The original tilt angles and physics agreed at 12°; the board pitch has since been strengthened to 22° for a clearer visual effect. Portrait, landscape and WebGL-disabled fallback checks had no overflow or page errors. A rendered ten-answer downhill-drift ride covered 636 metres in about 18 seconds at 60.0 fps (16.8 ms 99th-percentile frame intervals). These are local Chrome/emulated-phone measurements, not physical-phone benchmarks. The stronger 22° board tilt was subsequently verified against the board mesh’s world transform on desktop and phone. With that angle the ten-answer ride covered about 676 metres at 60 fps; phone framing stayed at 45.8 metres and desktop framing opened slightly to 48.1 metres to contain the tilted train. Surface inlays stay at fixed world spacing when the ground expands.

`scripts/check-flood-browser.js` drives a real train through the new flooded piece with no active power-up, on desktop, an emulated touch phone, and the WebGL-disabled fallback. In the Medium fixture, speed fell from about 30.3 m/s at water entry to 12.7 m/s after the exit climb, with normal drag restored immediately on exit. No crash or timed effect occurred. The updated splash measured 59.8 fps on desktop and 60.0 fps on the emulated phone/fallback, with 16.8 ms 99th-percentile frame intervals, no page errors and no overflow. It also verifies the gallery entry and landscape layout. Water shaders are prepared during game setup to avoid compiling them during the first splash.

The full Remix balance run uses the real game simulation for eight seeds at each of three answering intervals, with a three-minute limit. It assumes 96% accuracy and ±20% variation in the interval, including thinking and input time, on Medium difficulty. A simulated failed answer opportunity is skipped. These are modeled assumptions, not observed human performance.

| Average time between answers | Mean distance | Mean ride time | Reached three minutes |
| --- | ---: | ---: | ---: |
| 4.8 seconds | 986 m | 43.5 s | 0 / 8 |
| 3.2 seconds | 3,588 m | 128.3 s | 4 / 8 |
| 2.0 seconds | 5,346 m | 163.2 s | 6 / 8 |

All 24 simulations remained finite and within object limits. Some riders stopped on a climb; answering faster improved average survival but does not guarantee a longer ride on every seed, because the timed Sky lift effect can catch riders on different sections. Easier difficulties remain available for more thinking time. Early tests also exposed an opening water jump that arrived too soon and an excessively long reverse-gravity flight; the opening filter and controlled water-jump arc address those cases.

Run `scripts/check-remix-browser.js` via Playwright CLI's `run-code` against the Vite development server. It plays an 18-answer ride using normal keyboard input, checks pause timing, collects each of the seven effects through a nearby gate fixture, checks speed-versus-height answers, and plays a touch-phone ride in portrait and landscape. It also checks the canvas fallback with WebGL disabled. `scripts/check-remix-seeds.js` checks named/zero/fresh seeds, restart behaviour, the link generated by Copy ride, classic solo input, its two-player setup screen and invite routing. It does not establish a new WebRTC race.

Before moving splash zones into the track (commit `e2bc562`), measured on the development Mac in Chrome, the natural desktop ride at 1440×900 averaged **59.7 fps**, and the emulated 390×844 phone averaged **60.0 fps**, both with 99th-percentile frame intervals of **16.8 ms**. The short Sky lift fixture averaged 59.3 fps with a 33.3 ms 99th percentile. Other effect fixtures were approximately 60 fps. Phone landscape at 844×390 fitted the viewport. No page errors or overflow were found. These are browser measurements on a Mac, not measurements from physical phone hardware.

`scripts/check-remix-long-browser.js` adds a sustained rendered ride using actual keyboard answers about every two seconds. The run at commit `e2bc562` on seed 18 lasted 177.5 seconds, answered 88 questions and travelled 6.38 km, collecting all seven kinds of power-up. Each active effect averaged approximately 60 fps with a 16.8 ms 99th-percentile frame interval; the normal intervals averaged 59.9 fps with one frame above 33.5 ms. The ride retained only six loaded sections, ten coaches and 19 loose parcels at the end, with no page errors or overflow.

The visual layer uses one reusable gate, a fixed weather buffer, instanced rocks, instanced TNT, fixed pool geometry, reusable spray sheets and instanced water droplets and bounded impact particles. It does not create geometry every frame or use a full-screen postprocessing pass. Rail lift animation updates the existing rail and support buffers. Browser screenshots are generated under the ignored `output/playwright/` directory.

## Main implementation files

- `src/games/mini-track.ts`: seeded element assembly and shape variation, with classic generation retained behind the option.
- `src/games/course-seed.ts`, `src/main.ts`, `src/start.ts`: seed entry, fresh/repeated rides, shared links and mode selection.
- `src/games/ride-powerups.ts`: bag, gates, duration and physics modifiers.
- `src/games/mini.ts`: answer routing, deferred lifts, HUD and ride lifecycle.
- `src/games/mini-carriages.ts`: extra cargo, dynamite, gravity and water-contact spray.
- `src/games/flooded-track.ts`: shared pool geometry for the game/gallery and the spray-sheet model.
- `src/games/powerup-scene.ts`, `src/games/powerup-hud.ts`, `src/games/mini-view.ts`: weather, gates, cargo visuals and compact status.

Remix, developed on `experiment/height-powered-coaster`, is now the default game on `main`; Classic remains available through its start-screen link.

## Two-player Remix

The start screen offers solo or a real two-player invite race. The host supplies the mode, shared course seed and question seed, including when a guest enters the code from the Classic start screen. Invite links preserve the mode. Each rider retains their own difficulty, with host/guest colours fixed across both screens and the local rider always in front. A supplied course seed (including zero) persists across rematches; a blank seed creates a fresh course for each round.

Races use immutable generated `MiniTrack` geometry. Sky lift and Downhill drift are excluded from both the shuffled race bag and direct activation; their power kinds are rejected in network packets. Solo still has all seven effects. Both racers get the same seeded five-power order (Ice glide, Gravity flip, Cargo carnival, Heavy metal, Tailwind), collecting each gate independently. The first gate shares a route position; later gate positions depend on each rider's travel during the 20-second effects and three-second breathers. Flooded sections are shared permanent course geometry.

Protocol 5 includes the current power, age, remaining time, collection count and next gate. It carries up to eight boxes per wagon, TNT masks and loose TNT flags, and full 56-droplet bow splashes with spray orientation and strength. Impact IDs are stable per explosion, including water events. Packet and instance-buffer limits cover simultaneous bursts on both tracks. Invalid or disallowed effect data is rejected. The original bounded, smooth opponent playback remains: short rail predictions now use the same power modifiers and water drag as local physics, and loose-object prediction respects reversed/heavy gravity. Local inputs never wait for network delivery.

Each lane renders its own gates and weather. Rails retain the rider's identity colour throughout every effect. Active powers and countdowns appear inside the two existing race cards, avoiding an additional overlay on phones. The software fallback includes both pools, power gates, weather, extra cargo, TNT and splash fans. Shared pause freezes power clocks; rematches reset powers, effects, trains and results while keeping the selected mode and personal difficulties.

`tests/remix-multiplayer.test.ts` covers seeded geometry with different generation horizons, permitted power bags, disabled track mutations, richer packet validation, stable splash IDs and power-aware opponent prediction. Session tests cover mode/seed negotiation and rematches across different entry screens. `scripts/check-remix-multiplayer-browser.js` exercises real WebRTC between desktop Chrome and a touch-phone context, normal answers, all five independent powers, cargo/TNT replication, two-lane splashes, pause, results, rematches and disconnect recovery.

The real-browser Remix workflow passed with both WebGL clients and again with WebGL disabled on the touch-phone client, with no page errors. It also checked 844×390 landscape and 320×568 portrait. The mixed-renderer run delivered 1,041 frames per client over the natural answering portion at 60.0 fps, with a 16.7 ms 95th-percentile frame interval. These are two Chrome contexts running on this Mac, not measurements on physical phones. To repeat the fallback variant, set `window.checkSoftwareRenderer = true` before running the script. The browser run also caught BinaryPack converting explicitly undefined fields into null; absent power/gate/splash properties are now omitted, and a transport regression test covers this.

The Classic browser regression also passed after these changes: solo entry, selected tables, two real peers completing 16 answers each, shared pause, matching results, mutual rematch and disconnect recovery. Both WebGL contexts averaged 60.0 fps across 1,756 frames, with no page errors.

Cargo now spills in short, staggered bursts from the top of each stack. Each box inherits its wagon’s velocity with at most 1.5 m/s of gentle slip, and its total launch speed stays capped at 1.04× the wagon’s. Seeded differences in spin, lateral drift and drag separate the arcs without launching cargo far ahead. Remaining slots and TNT identities stay in place; refills begin once the wagon is empty. Detached wagons release any remaining load immediately. Tests cover release timing, speed bounds, slot order, repeatability and eight-box refills; `scripts/check-parcel-browser.js` provides desktop/mobile crest fixtures.

The parcel change passed all 122 automated tests and the production build. Desktop/mobile crest fixtures showed staggered releases over roughly half a second with no excessive launch speeds. The real two-player Remix workflow passed again with both WebGL clients averaging 60.0 fps, including all five powers, splash effects, pause, results and rematches, with no page errors. Spill notifications are limited to one per burst.

Weather and rocks are anchored to deterministic world cells. Moving through a cell leaves every particle’s world position unchanged at the same time; new cells replace only those at the edge of the bounded neighbourhood. Rain/snow still fall, reverse rain rises, and wind drifts independently of train motion. The same field is used in both software fallback layouts. The Sky lift rescue uses a resistance-aware, frozen-track estimate through the next crest, applies only on an uphill rail, and leaves descents, sufficiently fast trains and in-flight answers unchanged.

The gravity/weather revision passes 127 tests, including rail forces in both directions, asymmetric water-jump gravity, full and partial Sky lift rescue boosts, and stable weather cells while moving across cell boundaries. The browser anchoring check also changes the render origin by 1,000 metres and verifies unchanged world positions; its Sky lift fixture raised the track and boosted a struggling train from 2 to 12.6 m/s.
