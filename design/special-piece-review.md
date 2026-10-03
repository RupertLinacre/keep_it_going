# Special-piece workshop

Branch: `codex/special-piece-polish`. Based on main `b346bfc`.

Run `npm run dev -- --port 5198` and open
<http://localhost:5198/piece-review.html>.

## Three designs for each of twelve rides

The workshop now contains 36 proposals: the first improvement is option A,
with two complete alternative attractions, B and C, for every piece. The
original game is also available as a reference. All versions share the same
rails, train, lighting and camera so the differences are easy to judge.

Select A, B or C, then compare against the original or another option. Drag
either view to orbit both, replay the train, or scrub the timeline. Tunnels
have a cutaway. Playback continues after the train leaves so you can inspect
lingering animations, including all three carousel designs coasting to rest.

Use **Choose A/B/C**, **Keep original**, or **Decide later**, then **Copy my
choices**. Selections stay in this browser; browsing another design does not
change your choice. Saved choices from the first workshop migrate to A or
original. Selection does not alter gameplay or merge anything.

| Piece | A — first proposal | B — new direction | C — new direction |
| --- | --- | --- | --- |
| Sheep Shuffle | Meadow Flower Show: terraced farm, hay cart, flowers and butterflies | Bouncy Baa Circus: sheep spring from trampolines through star hoops | Woolly Jumper Factory: a giant loom, knitting needles, reels and a long scarf |
| Lily Pad Bridge | Lily Pad Regatta: flowering pond, boats and waterwheel | Frog Pond Orchestra: frog musicians, bobbing conductor and musical notes | Rubber Duck Wash: a giant bath, copper tap, ducks and floating foam |
| Windmill Loop | Storybook Flour Mill: lattice sails, detailed facade, gears and grain | Cuckoo Clock Loop: turning hands, pendulum, opening doors and a cuckoo | Sunflower Honey Factory: giant sunflower, circling bees and jars filling with honey |
| Mountain Pass | Alpine Goat Chorus: snow and crystal gorge with reacting goats | Yodel Peak Orchestra: alphorns, pumping bellows and floating notes | Snowball Switchback: rolling snowballs, a mountain chute and return lift |
| Glowstone Tunnel | Glowstone Ropeway: chalet stations, moving pulleys and cabins | Crystal Dragon Cave: ride through a friendly dragon's crystal-lined mouth | Gemstone Mining Works: timber mine, crystal seams, drill and bucket conveyor |
| Waterfall Viaduct | Waterwheel Rainbow: waterfall, wheel, rainbow and spray | Rainbow Weatherworks: a cloud factory with sunshine, rain and a rainbow turbine | Penguin Plunge: penguins slide through an icy circuit and return to the top |
| Lantern Parade | Bunny Lantern Parade: ornate arches and bobbing bunny lanterns | Rocket Rally: sequential launchpads, rockets and star exhaust | Jellyfish Dreamway: a giant glowing jellyfish canopy, coral and bubble rings |
| Marquee Loop | Starlight Marquee: smiling sun, orbiting stars and illuminated frame | Pinball Parade: the train drives a silver ball, flippers, bumpers and live score | Wind-up Wonderland: a music box with a dancing fairy, organ and floating notes |
| Carousel Climb | Unicorn Palace: three decks of unicorns and striped canopies | Twirling Tea Party: three china decks of bunny teacups beneath a steaming teapot | Planet Parade: orbiting alien saucers, planets and a Saturn crown |
| Pumpkin Hops | Pumpkin Drumline: smiling drums, striking mallets and green sparks | Potion Pop Laboratory: bubbling cauldrons, copper pipes and popping corks | Ghost Laundry Day: pastel washing machines, clotheslines and bouncing sheet ghosts |
| Pumpkin Portal | Candy Castle Portal: crooked candy pillars, arch and tumbling sweets | Monster Munch: a friendly giant raises its head to swallow the train and spits sweets | Haunted Puppet Theatre: opening curtains and bowing skeleton puppets on a checkerboard stage |
| Witch's Hat | Broomstick Academy: patchwork hat, cauldrons and broom-riding cats | Potion Rocket Tower: stacked smiling vats, stirrers, plumbing and a cork rocket | Moon Moth Conservatory: a moonflower, glowing tree, open brass greenhouse and moths |

Both new carousel directions preserve the train-matched rotation and
frame-rate-independent coast after departure. Alternatives are complete
replacements, rather than extra props piled on the first proposal. Rails and
physics are unchanged.

## Architecture and review

The game still uses option A on this branch. B/C and the immutable original
modules are imported only by the workshop entry point. A factory hook in
`AdventureScene` allows the alternatives to share the real game lifecycle,
mirrored rider placement and independent height transforms. Only the selected
two designs are resident in the gallery.

Static detail is merged; animated props use fixed instance pools. Individual
B/C attractions use 3–7 draw calls and fewer than 40,000 triangles, without new
shadow passes, realtime lights, transparent glass or unbounded particle meshes.

Each world received implementation, visual review and geometry corrections.
The second pass enlarged frogs and the music-box fairy; improved bath depth,
cuckoo visibility and honey streams; closed the penguin slide circuit; moved
mine conveyors into view; corrected cave interior faces; improved dragon wings;
and fixed puppet headroom, monster readability and the greenhouse frame.
Independent clearance checks covered the monster mouth and puppet theatre.

Automated checks cover mirrored layouts, clearance, deterministic replay,
reduced motion, fixed instance limits, geometry disposal and carousel spin-down.
The gallery browser check exercises a 390px mobile layout, saved-choice
migration and persistence, comparison controls, filtering, tunnel cutaway and
three complete tours through all 36 designs. GPU geometry/texture counts stay
identical on repeated tours; no browser errors or horizontal overflow occurred.

The final full suite passed all 245 tests and the production build. Local
screenshots and raw QA output belong in ignored `output/playwright/`.

## Performance checks

The original A-versus-baseline review measured all twelve pieces plus four
mirrored two-track scenes at a 3840×2160 viewport: median frame intervals were
16.6–16.7 ms, with no sampled frame above 25 ms. See
`scripts/profile-special-pieces-browser.js` for that comparison.

`scripts/profile-piece-alternatives-browser.js` compares A, B and C through the
actual game renderer, with surrounding generated scenery, at the same 4K
viewport. It tests all twelve single-player pieces plus mirrored windmill,
tunnel, carousel and witch's-hat scenes. Each case measures 89 frames after
warmup. Two-track scenes use a synthetic opponent to isolate rendering cost;
this is not a network test or a guarantee for every device or cold scene build.

The 3 October A/B/C run used a 3401×1763 framebuffer under the game's existing
resolution cap. All 48 cases completed without browser errors:

| Design | Frame interval median across cases | Frame interval p95 across cases | CPU update/render submission p95 | Frames above 25 ms |
| --- | --- | --- | --- | --- |
| A | 16.6–16.7 ms | 18.0–18.5 ms | 3.7–6.9 ms | 0 |
| B | 16.6–16.7 ms | 17.9–18.5 ms | 3.9–6.0 ms | 0 |
| C | 16.7 ms | 17.7–18.6 ms | 3.8–5.7 ms | 0 |

These warmed samples show no sustained frame-rate regression from the new
alternatives on this Mac. Run `npm test`, `npm run build` and the browser
comparisons again when selecting or integrating proposals into gameplay.
