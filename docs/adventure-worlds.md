# Adventure worlds — design and validation

Work branch: `feature/adventure-worlds`. Default Remix rides now follow four distance-based worlds. Classic remains available.

## 1. Baa Baa Meadows

Rolling low-poly hills, flower meadows, farm fences, gently animated sheep and windmills. Scenery is seeded, fixed in world space, batched by material, and excluded from camera framing. Both race lanes use the same course and scenery. The question and controls stay level and legible.

Validation: desktop 1440×900 and mobile 390×844 visual review. Opening scene: 82 draw calls, 224,382 triangles, 48 geometry buffers; no browser errors. All 127 existing tests passed. Nine actual-game simulations (seeds 1, 42, 73; 4.8s answers on Very easy, 3.2s on Easy, 2s on Medium; 94% answer probability and ±20% timing jitter) reached the mountains in 24–33 seconds. These are design assumptions, not measured child performance.

World announcements fade after 3.8 seconds; a small journey badge remains. No new controls are required.

## 2. Marmalade Mountains

Snow-capped peaks, alpine pools, pines, chalets, slowly travelling cable cars and a summit flag. The new Mountain Pass climbs a winding ridge built from its actual rail geometry. Lantern-lit tunnels have a camera-facing cutaway to keep the whole train readable. Tunnels follow the track when Sky lift raises it.

Validation: summit and tunnel desktop/phone screenshots inspected; opened the first roof further after it obscured coaches. Nine simulations reached Starlight in 48–64 seconds. New tests check world boundaries, deterministic signature pieces, bounded later elements, smooth upright joins and energy conservation for all four new shapes. All 130 tests pass.

## 3. Starlight Carnival

Cool night lighting with warm train illumination, luminous rails, scattered stars, fireflies, mushroom lamps, reflected lights, fairground pavilions and rotating illuminated wheels. Lantern Parade has seven pairs of lanterns tracing its rolling hills. Kept wheels occasional after the first visual check felt too crowded. World welcomes now sit low in the view to avoid covering the train.

Validation: actual browser game advanced through normal question/physics updates into night; desktop and phone captures checked. No browser errors; the initial scene was 100 draw calls and 160,426 triangles. Nine timing-profile simulations reached Pumpkin Party in 63–94 seconds.

## 4. Pumpkin Party

Glowing smiling pumpkins, gently bobbing ghosts with rosy cheeks, flapping bats, crooked lit cottages, candy lantern fences and a giant pumpkin tunnel. Pumpkin Hops puts three smaller crests through a pumpkin patch. No jump scares or flashing horror effects. The pumpkin tunnel and mountain tunnel are guaranteed just after each world's first landmark. The initial director could postpone a tunnel beyond the next border; this was caught in the artwork checks and corrected.

Validation: actual-game simulation through Halloween plus unpowered artwork fixtures for Pumpkin Hops and the tunnel, on desktop and phone. Corrected dark-world powerup tinting to preserve the night palette. All nine final timing-profile rides reached Halloween and travelled 4.4 km without ending; first-loop revisits occur at the next section boundary, which can be later than the nominal 4.2 km. Typical first entry into Halloween was around 62–92 seconds. Without answers, the seed-42 Medium ride stops after 23.4 seconds; with 8-second attempts it stopped at 20.3 seconds. With 4.8-second or 2-second attempts it remained running at the 180-second test limit, reaching 5.27 / 6.70 km. Powerups can make individual seeds more forgiving.

## Final integration and performance

- World transitions use section starts near 0 / 900 / 1,900 / 3,000 course metres. Beyond 4,200 metres the sequence repeats with different arrangements and extra silhouettes, including nested loops. Generative growth stops increasing after 2×; world height caps are 30 / 38 / 38 / 40 metres, with at most four helix turns. Sky lift still raises track above those base-course limits.
- The start screen introduces the four destinations. Brief welcomes fade; the compact journey badge remains. An inactive powerup panel with no gate is hidden. Decorative animation respects reduced-motion preferences and the game's paused clock.
- New scenery is vertex-colour batched, with seven fixed-capacity actor batches. Static backdrops sit behind both race lanes rather than being duplicated over the other track. Track-attached terrain, lantern parades and tunnels are mirrored per lane. Scenery extends over solid ground and cannot affect camera framing.
- Protocol 6 separates these seeded courses from older protocol-5 builds. No new snapshot fields or per-frame networking were needed. Classic remains available.
- All 133 automated tests pass, including geometry continuity/energy, guaranteed tunnels, late-course size limits and a 9 km scenery lifecycle check that verifies bounded tiles/actors and exactly one disposal per shared geometry.
- Browser measurements used Chromium / ANGLE Metal on an Apple M4. Each world was played for six measured seconds after settling, at desktop 1440×900 and phone-emulated 390×844 with DPR 2. Across eight runs, median frame time was 16.7 ms; p95 was 16.7–16.8 ms and p99 16.8 ms. No measured frame exceeded 50 ms. Visible draw counts ranged from 62 to 103. These measurements do not substitute for testing on a physical low-end phone.
- Two actual PeerJS clients passed normal keyboard/touch play, five world landmarks, matching seeds and role colours, scenery placement, five independent race powers, eight-box/TNT replication, simultaneous splashes, shared pause, rotated/small phone layouts, results agreement, rematch and leaving. Both clients averaged 60 FPS during the natural-play sample. Repeated with WebGL disabled on the phone, using the software world renderer; no page errors.

Reproducible browser scripts: `scripts/check-worlds-browser.js` and `scripts/check-worlds-multiplayer-browser.js`. Playtest profiles: `scripts/playtest-worlds.ts`. Local screenshots and JSON reports live under `output/playwright/` (ignored by Git). Browser checkpoint fixtures are deliberately distinguished from natural-play frame measurements.

The final continuous desktop test ran 125 seconds and 5.93 km with 77 answers, covering all four worlds and part of a second adventure. Each world's p99 frame time was 16.8 ms. The only frame above 50 ms was a 100 ms initial construction frame at game time zero; there were none during the ride or world transitions. It ended still running, with eight scenery tiles and 83 renderer geometry buffers. The combined local report is `output/playwright/world-validation.json`.
