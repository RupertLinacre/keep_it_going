# Frosty Lake Fair — Sled Mountain Switchbacks

Merged into the sixth adventure world, Frosty Lake Fair, from 5,400 to 6,600
course metres alongside Frozen Waterfall Stairway. Its signature is available at
`tracks.html?element=sledswitchbacks&world=winterfair`. The first version was an original alpine design. A reference image was then
provided, and the scene was rebuilt around its penguin sleds, mountain tunnel,
timber trestles, surrounding lake and sunset atmosphere.

The production route uses twelve cubic Bezier segments: a rear ascent, two broad
banked hairpins and three downhill traverses. Entrance and exit are level, upright,
and forward-facing. Geometry is shared between the game, gallery and race lanes.
The gallery has five colourful coaches and three separate penguin sleds; the game uses the Christmas sleigh train in both winter worlds.

Faceted snow slopes are carved beneath the real rails and the separate snow runs, with clearance below the sleepers.
The scene includes faceted snowy peaks, red fences and lamps, a summit lodge,
cocoa court, bunting, a frozen lake, scarfed skating penguins and snowfall.
Animations use game time and respect pause and reduced motion.

## Visual reviews

Local images are in the Git-ignored `output/playwright/` directory. Thirteen numbered
captures were inspected; capture 03 revealed a stale development-server render and
was excluded from the twelve substantive reviews below. The server was refreshed
before reviewing subsequent geometry edits.

| Review | Capture | Finding and response |
| --- | --- | --- |
| 1 | sled-review-01.png | Initial desktop perspective: route reads clearly; blocky snow terraces and tiny pines needed refinement. |
| 2 | sled-review-02.png | Initial top view: entry, ascent, hairpins and exit occupy separate corridors. Exposed the coarse grid-like terrain. |
| 3 | sled-review-04.png | Refined desktop: smooth terraced snow, varied larger pines, articulated sled cars and tighter composition. |
| 4 | sled-review-05.png | Side profile: continuous descent and supports visible. Summit backdrop needed more height and character. |
| 5 | sled-review-06.png | Taller snow peaks, cocoa hut, bunting, snowflake marker and skating penguins give the fair an identity. |
| 6 | sled-review-07.png | Portrait phone: clear controls and text, no horizontal overflow. Snow base corners were clipped. |
| 7 | sled-review-08.png | Corrected portrait framing includes the entire snow base; page remains free of horizontal overflow. |
| 8 | sled-review-09.png | Phone landscape: complete mountain visible, no horizontal overflow. |
| 9 | sled-review-10.png | Top view at 20 km: separated corridors and bounded footprint; 26.6 m elevation and 303 m of rail for gallery seed 71. |
| 10 | sled-review-11.png | Reverse orbit: solid peaks, clear rear ascent and lodge supports; no hidden crossing. |
| 11 | sled-review-12.png | Production desktop game: camera settles on the normal train and rails. Found and corrected hard-coded “WORLD 5 OF 4” to use world count. |
| 12 | sled-review-13.png | Production phone game: train visible, controls fit, scenery coherent, no overflow or JavaScript errors. |

The game captures use a scripted simulation to reach the fifth world, then settle
the actual camera and world colours before capture. They are visual fixtures,
not a measurement of real-time performance. Desktop capture used 98 draw calls.

## Verification

- Full suite: **259 tests passed**.
- Production build passed.
- Dedicated geometric checks cover both hands, race generation, tangent and bank
  continuity, inward banking, broad turn radii and separated passenger corridors.
- A gravity-driven train traverses the complete section while conserving mechanical
  energy with drag and rolling resistance disabled.
- Raycasts against the baked scenery verify clearance directly below the rails.
- Pause, reduced motion, bounded animation buffers and geometry disposal pass.
- Five-world progression and signature guarantees pass across 80 seeds over two laps.
- `scripts/check-sled-browser.js` reproduces desktop and phone game captures.


## Reference-based revision — ten fresh improvement rounds

The second request supplied the reference illustration. Each round below included
an implementation improvement, a fresh browser capture and visual inspection.
All screenshots are local in `output/playwright/`.

| Round | Capture | Improvement and review finding |
| --- | --- | --- |
| 1 | sled-v2-review-01.png | Rebuilt faceted snow island, surrounding lake, timber decks, three colourful penguin sleds and an open stone vault. Reviewed placement and found the upper turn and tunnel needed better integration. |
| 2 | sled-v2-review-02.png | Warmer world palette, more frontal camera, filled summit knoll and larger sled riders. Removed the rectangular snow floor. |
| 3 | sled-v2-review-03.png | Filled the mountain beneath the upper turn, corrected vault winding, and integrated snow-covered rocks beside its openings. |
| 4 | sled-v2-review-04.png | Added a code-painted sunset/alpine panorama, gentler tone mapping, timber cross braces and a string of warm rail bulbs. |
| 5 | sled-v2-review-05.png | Rounded and extended the snow shore, added icy islets, more pines and larger lanterns. |
| 6 | sled-v2-review-06.png | Rebuilt the low exit into a front-facing tunnel followed by a separate, level forward exit. Enlarged the lodge and added its porch, flag and smoke. |
| 7 | sled-v2-review-07.png | Widened the tunnel opening, smoothed the exit, added sled powder trails, and used the production train model in the preview. |
| 8 | sled-v2-review-08.png | Top-view review after replacing sparse parameter-spaced supports with timber bents every 7.5 track metres. Removed duplicate metal supports in the game. Verified separated route corridors. |
| 9 | sled-v2-review-09.png | Naturalised tree placement, added skating traces and checked portrait-phone layout. Found that the backdrop sun stretched with the viewport. |
| 10 | sled-v2-review-10-final.png | Corrected backdrop aspect, tightened phone framing, made sled trails flat and ski-contact coherent, closed tunnel-wall cracks, raised tunnel lanterns, kept trees clear of snow runs, improved rider visibility and made preview train faces readable. Final game inspection reduced sled scale to fit their 2.8m snow trails. |

The reference illustration's tunnel is now part of the real coaster route: a
low bend enters from the front, the track passes through a swept stone bore, and
an independent low sweep restores the level +X exit. It does not cross any other
rail at the same elevation. The track remains shared by the game and gallery.
The preview bodies are taller for legibility, while the game retains its normal
train. Penguin sleds use separate snow runs, and their skis rest on flat trails.

Final verification: **259 tests passed**, and the production build passed.
Additional raycasts check the snow from above to detect buried rails and check
inside the tunnel for side and overhead clearance. Animation pause, reduced
motion, disposal, seeded progression and both rail hands remain covered.
`scripts/check-sled-browser.js` captured the updated real game on desktop and
phone with no JavaScript errors or horizontal overflow; the desktop fixture used
103 draw calls. These captures are visual checks, not performance measurements.
The sunset panorama is specific to the gallery; the game's world scenery and
camera continue to use the shared adventure renderer.


## Train-driven penguin interaction — ten new review rounds

Each round included a change, browser capture and visual inspection. Captures
are `output/playwright/sled-haul-review-01.png` through `-10.png`.

| Round | Improvement and visual review |
| --- | --- |
| 1 | Replaced independent timer loops with a distance-triggered haul and release controller. Added a parallel snowy tow ledge, full-length downhill routes and replay control. Reviewed the uphill phase. |
| 2 | Enlarged riders, moved the ledge farther from the train and strengthened the gold tow chain. Checked all three sleds climbing together. |
| 3 | Added a lit summit launch gate and colour-matched route pennants. Reviewed the staggered release with two racers and one sled still being hauled. |
| 4 | Lowered and separated ski routes beneath the rails; added gentle rider banking and stronger powder wakes. Reviewed the simultaneous descent. |
| 5 | Enlarged faces, eyes and beaks; added trailing scarves and tapered, spreading snow wakes. Reviewed midway down the mountain. |
| 6 | Added three flat landing pads, checkered finish flags and fading braking snow. Moved the red finish away from the skating penguins. Reviewed all three completed runs. |
| 7 | Widened snow lanes and cleared timber cross braces at ski underpasses. Inspected a side view. Final geometry checks refined the supports to splayed feet and lowered headers. |
| 8 | Smoothed ski-route tangent joins and wrapped replay/playback controls for phones. Reviewed a 390px portrait viewport with no horizontal overflow. |
| 9 | Added ride-phase captions and corrected the remaining tow-chain anchor after each release. Replayed from the landed state and verified pause keeps the riders fixed. |
| 10 | Added summit release snow bursts. Clearance checks caught a support header and a blue snow lane entering the rail bed. Corrected both, and brought the blue run inside the section after the real game inspection exposed a neighboring-track conflict. Rechecked the final summit and downhill views on desktop and phone. |

Final captures: `sled-haul-final-desktop.png` and `sled-haul-final-phone.png`.
The actual game was also reviewed using `scripts/check-sled-browser.js`:
no JavaScript errors, no desktop or phone horizontal overflow, and 105 draw calls
in the desktop fixture. This is a visual smoke check, not a performance benchmark.

The train distance drives all three releases; the race clock only starts after
a rider reaches the summit. The runs take 4.4–4.8 seconds, decelerate into flat
finish pads, and do not restart while the train is stationary. Rewind and replay
restore the tow queue. Reduced motion uses fixed scenery poses, and the gallery
starts paused for that preference. Buffers remain bounded at 14 scene meshes.

Added tests cover release ordering, stationary trains, single releases, late
creation, replay/rewind, pause, reduced motion and frame-rate independent timing
at 30/60/120 fps. Route checks cover the shared start, tangent joins, downhill
motion, flat braking areas and separation from rail corridors across four seeds.
The existing raycasts still check the entire rail bed, terrain and tunnel bore.
Final verification: **263 tests passed**, and the production build passed.
