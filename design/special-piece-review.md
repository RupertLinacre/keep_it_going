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
| Sheep Shuffle | Meadow Flower Show: terraced farm, hay cart, flowers and butterflies | Bouncy Baa Circus: sheep spring from trampolines through star hoops | Woolly Scarf Factory: a giant loom, knitting needles, reels and a long scarf |
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

## Second refinement pass

A, B and C have all been refined individually. This pass concentrates on larger
readable characters, coherent mechanisms and a stronger response to the train,
with the same fixed-batch rendering approach. The workshop adds **Closer look**
to frame the attractions without the long entry/exit track, and the pumpkin
portals use a more frontal initial view so their faces and stages are legible.

Halloween changes:

- **Pumpkin Drumline:** fan-shaped bandstands, marching-band ruffles, braided
  drums, character feet and striped mallets.
- **Potion Pop Laboratory:** a continuous copper pipe across the hills,
  readable pressure gauges with reacting needles, riveted feet and staggered
  cork launches.
- **Ghost Laundry Day:** scalloped machines, socks and pegs, with ghosts that
  launch continuously from the drum and settle into empty spaces on the line.
- **Candy Castle Portal:** biscuit turrets, battlements, shield windows,
  candy-cane sentries and wrapped sweets circling the lollipops before impact.
- **Monster Munch:** large eyebrows, waving articulated paws and a short candy
  burp after swallowing the train.
- **Haunted Puppet Theatre:** richer stage architecture and separate arms and
  legs, letting three marionettes wave and kick without blocking the railway.
- **Broomstick Academy:** glowing arched dormer windows, kitten tails and
  ribbons, plus a sparkling trail behind each broom.
- **Potion Rocket Tower:** connected copper pipework, moving pressure needles,
  a stronger rocket launch and a bounded bubble-exhaust plume.
- **Moon Moth Conservatory:** larger leaves, three sequentially blooming flower
  crowns and patterned moths with independently flapping wings.

Meadow changes:

- **Meadow Flower Show:** waving articulated flowers make an audience for the
  escaping sheep.
- **Bouncy Baa Circus:** clearer tent detailing and trampoline beds that compress
  with the sheep's feet before the bounce.
- **Woolly Scarf Factory:** visible knitted stitches, a travelling shuttle and a
  real output roller for the scarf.
- **Lily Pad Regatta:** duck captains, correctly steered hulls and trailing wakes.
- **Frog Pond Orchestra:** distinct conductor, brass and percussion players,
  with moving instruments and mallets meeting the keys.
- **Rubber Duck Wash:** independently flapping wings and more animated toy ducks.
- **Storybook Flour Mill:** meshing gears drive a visible flour-bag conveyor.
- **Cuckoo Clock Loop:** shaped wooden clock case, a proper hand ratio and staged
  opening doors, bird emergence and retreat.
- **Sunflower Honey Factory:** winged bees and an indexed line of open jars that
  stop under the honey outlet before moving on.

Mountain changes:

- **Alpine Goat Chorus:** stronger snowy rock ledges and articulated goat
  greetings, with clearer footing in the gorge.
- **Yodel Peak Orchestra:** more varied mountain profiles and broad rock
  buttresses give the instruments a convincing alpine stage.
- **Snowball Switchback:** a substantial glacier supports the snowball chute
  instead of leaving it hanging in space.
- **Glowstone Ropeway:** detailed chalet structures and pulleys, richer mountain
  rockwork and train-driven machinery.
- **Crystal Dragon Cave:** haunches, arms, claws, armour scales, curled tail and
  scalloped flexing wings turn the cave into a recognisable creature.
- **Gemstone Mining Works:** jagged strata, timber galleries and roofed
  workshops around the conveyor and drill.
- **Waterwheel Rainbow:** bucketed wheel, more legible water flow and reacting
  waterfall details.
- **Rainbow Weatherworks:** pumping weather towers and a more coherent cloud
  factory beneath the rainbow.
- **Penguin Plunge:** a sculpted ice foundation and more expressive sliding
  penguins support the full circuit.

Carnival changes:

- **Bunny Lantern Parade:** broad rainbow arches with butterfly-bunny lanterns
  that bow and inflate as the train arrives.
- **Rocket Rally:** orbit gates, staged countdowns and a distinct flame sequence
  for each launch.
- **Jellyfish Dreamway:** opening pearl clams and fish circling the jellyfish.
- **Starlight Marquee:** a larger sun, tower fans and six train-triggered star
  shields along the loop.
- **Pinball Parade:** a substantial control console and comic bumper impacts.
- **Wind-up Wonderland:** a train-played keyboard and theatrical music-box
  curtains around the dancing fairy.
- **Unicorn Palace:** scalloped gold arcades and twelve larger unicorns, with
  space between them and a rearing greeting.
- **Twirling Tea Party:** iced colonnades and a pouring teapot fill out the three
  decks without crowding the cups.
- **Planet Parade:** full saucer-deck pavilions and larger ships that lift off
  from each tier.


Final validation for this refinement: **262 tests and the production build
pass**. The gallery passes mobile layout, saved-choice migration/persistence,
closer-look/reset controls, tunnel cutaways and three full tours of all 36
options with stable GPU geometry/texture counts and no browser errors.
Cross-review additionally corrected radial flower hinges, overlapping waiting
ghosts, wing hinge orientation, cuckoo door timing and honey retention in jars.

The final 48-case 4K renderer comparison again had a **16.7 ms median frame
interval** for every A/B/C case. P95 intervals were **17.8–18.6 ms**, with **zero
sampled frames above 25 ms**. CPU update/render submission p95 ranged from
3.6–4.5 ms. The viewport, resolution cap, warmup and synthetic-opponent limits
are the same as the earlier comparison above. Raw results are in the ignored
`output/playwright/polish2-performance.json`.

A supplementary CPU-only first-tile construction check (three samples per
piece/version with warmed primitive templates) measured 0.1–4.6 ms for the
refined designs, including nearby scenery. This isolates geometry/actor setup;
it excludes GPU upload and shader compilation and is not a cold-start FPS
claim. Its local results are `output/playwright/polish2-build-cost.json`.
