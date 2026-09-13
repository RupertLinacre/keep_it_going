# Height-powered coaster experiment

Historical implementation notes for commit `1203750` on `experiment/height-powered-coaster`, based on `5a3f2d8`. The branch now defaults to [Remix](remix.md), where this mechanic is the 20-second **Sky lift** power-up. The geometry implementation below is still used. The browser measurements below describe the earlier always-height version, which remains available in that commit.

The original experiment was a solo variant of Keep it going. A correct answer raises the current track section by **30 metres**, with a smooth one-second animation. It does not change the train's speed directly. Raising the train supplies potential energy; descending turns that height into speed to clear subsequent structures. Answer before the next climb: lifting an entire loop while already struggling uphill does not make its remaining climb disappear.

The start screen explains the different mechanic. Desktop shows the height added beneath the train. A short cue beside the question estimates whether the current height and speed will carry the train through the next section, allowing for resistance. This is a coasting estimate for the current geometry, not a guarantee about future answers. It avoids claiming that an energy estimate certifies a water landing.

The gentle hilltop start, five resistance-based difficulties, table selection, automatic answer acceptance, 350 ms answer display, mobile keypad, Escape-to-clear, parcels, controlled carriage lift, ten-coach cap, track progression and camera's 3× maximum zoom-out remain. Height-mode records are separate from classic records. The camera includes the attached train while its track rises.

The experiment is currently **solo**. `?mode=classic` opens the original solo and multiplayer game; the start screen links to it. Invite links also select the original game. Multiplayer in this branch therefore still uses the established speed-boost mechanic. Synchronising independently deforming courses would be a separate extension.

## Moving railway

`HeightTrack` extends the seeded track generator and stores independent lift regions. The occupied section translates upwards without changing its internal shape. A 26-metre extension behind its entry includes the full train. Smooth transitions over adjacent rail keep the route joined at both ends; those neighbouring connecting portions deform as the section rises. Repeated answers on one section accumulate height and retarget the animation from its current position.

The original rail frames are retained as the reference geometry. Animated vertical displacement changes position, tangent, bank and curvature consistently. Physics accounts for the actual stretched path length via the physical-metres/route-metres ratio. Coach spacing also uses physical metres along the deformed path. The stable route coordinate remains the game's distance measure, so moving track does not itself award travelled distance or shift section IDs.

Rails update existing vertex buffers and sleeper instance matrices. Support columns extend from the ground; they do not float up with the rail. The experiment uses individual support columns instead of the classic decorative spiral tower. Ground-bound caches follow section revisions. Completed regions and old track are pruned as the ride advances.

Before a water jump, a lift extends past the takeoff lip so the joining slope cannot accidentally turn the launch ramp downwards. Launch position and landing clearance use the raised geometry. While the train is in free flight, track motion pauses and further correct answers save lifts for landing. They cannot magically accelerate or elevate an airborne train. Once the train lands, saved lifts raise the section now beneath it.

Primary files:

- `src/games/height-track.ts`: lift regions, animation, geometry and physical coach spacing.
- `src/games/height-guide.ts`: next-section coasting advice.
- `src/games/mini.ts`: answer routing, queued lifts, feedback and separate records.
- `src/games/mini-physics.ts`: physical distance integration and raised jump geometry.
- `src/games/mini-view.ts`, `src/games/mini-mesh.ts`: moving rails/supports and camera subjects.
- `src/main.ts`, `src/start.ts`: branch-default experiment and classic-game route.

## Verification and tuning

```sh
npm test
npm run build
npx tsx scripts/playtest-height.ts
```

The regression suite has 93 passing tests, including new checks that answers do not apply a speed impulse, lifts animate, section joins remain continuous, rail frames remain orthonormal, bounds update, stretched rail conserves energy with resistance disabled, coach spacing remains physical, raised takeoffs stay upward, airborne answers wait for landing, classic records remain separate, and generating new track after a long raised piece keeps its joins connected.

The height playtest uses the real physics on seeds 1, 18 and 42, with a two-minute limit. It assumes perfectly correct answers at fixed intervals including thinking and input time. With no answers, rides stopped after roughly 9–14 seconds. One answer every 4.8 seconds reached about 2.34–2.67 km; every 3.2 seconds reached about 2.84–2.91 km; every 2 seconds reached about 3.05–3.08 km. All answering profiles reached the test's two-minute limit. These are initial model-based balance checks, not measured human performance or claims of eventual survival.

At commit `1203750`, `scripts/check-height-browser.js` was run through Playwright CLI against Vite for actual desktop/phone input, answer feedback, Escape, no-speed-impulse assertions, overflow checks and screenshots. Desktop at 1440×900 and an emulated 390×844 touch phone each accepted eight answers and continued through the opening water jump, at approximately 60 fps with 99th-percentile frame intervals of 16.8 ms and no page errors. Landscape at 844×390 also fitted the viewport. These measurements come from browser contexts on the development Mac, not physical phone hardware. Use `scripts/check-remix-browser.js` for the current branch; the old browser script expects the earlier always-height start screen.

`scripts/profile-browser.js` also works on the default height page. An 18-answer desktop run measured 16.67 ms mean frame intervals, 16.8 ms at the 99th percentile, and no frames above 25 ms during the measured interval. Rail buffers are refreshed rather than recreating scene geometry on every lift frame.

The production publishing command is unchanged. Deploying this branch would publish the experiment as the default page, so it has been kept local for review rather than replacing the live game.
