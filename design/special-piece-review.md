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

## Third refinement pass

All 36 designs have received another individual pass. The emphasis is on
readable action and connected mechanisms: anticipation, contact, release and
settling, rather than adding more particle effects. The three alternatives for
each ride still have distinct identities.

| Ride | A refinement | B refinement | C refinement |
| --- | --- | --- | --- |
| Sheep Shuffle | Larger flowers stretch, bow and wave from their leaf shoes | Anchored trampoline rims with elastic centres and sheep somersaults | Visible yarn feed, scarf tassels and scarf-wearing sheep |
| Lily Pad Bridge | Larger duck-captain boats, working paddle wheels and a covered jetty | Frog throats puff during their musical performances | Hinged lower beaks quack as duck wings flap |
| Windmill Loop | Conveyor packing presses tap passing flour bags | Feathered cuckoo hops from a landing shelf; carved roof and chains | Courier bees carry satchels past a gently pulsing sunflower |
| Mountain Pass | Backpacked goats crouch, hop and land with a smaller skip | Dressed marmot organists tap the keys | Starting gate releases in time with actual snowballs |
| Glowstone Tunnel | Braced bell towers with cable-driven clockwork signals | Dragon wakes, blinks and breathes crystal puffs; curled horns and rosy cheeks | Open buckets unload gems into a chute, return empty and refill at a ground hopper |
| Waterfall Viaduct | Waterwheel-driven duck pond with an island duck house | Working pressure gauges connected to the weather tanks | Penguins follow the S-bend, flap their flippers and leave icy spray |
| Lantern Parade | Independently hinged butterfly wings respond to the passing train | Gantry arms release before ignition and close after landing | Animated pearl tentacles; lighter geometry replaces expensive rings |
| Marquee Loop | Sun rays rotate and spread at the apex | Pinball actually contacts each whiskered cat bumper | Visible pinned winding cylinder turns with the music-box key |
| Carousel Climb | Twelve unicorns have articulated galloping legs | Tea pours from the correctly transformed spout; rabbits rest their paws on cups | Independently rotating smiling planets, comet trails and brighter saucer exhaust |
| Pumpkin Hops | Musical notes bounce above the striking drums | Visible side bellows pump pressure before corks pop | Washer doors open before ghosts launch and hang up to dry |
| Pumpkin Portal | Pennants cheer above the candy castle | Eyes follow the approaching train | Supported stages, connected marionette strings and grounded dancing boots |
| Witch's Hat | Spectacled kittens read fluttering spellbooks near dormer balconies | Charge-up shake, launch collar and a higher cork-rocket arc | Blooms linger while moths swoop in to visit them |

Two visual reviews cover all nine designs in each world, with additional
close inspection of contact and hinge timing. Cross-review found and corrected
puppet boot/platform intersections. Tests now exercise paddle and jaw hinges,
unicorn hips, rocket gantry timing, pinball contacts, teapot spout alignment,
washer-door timing, marionette strings and boots, and spellbook attachment.
The gallery reserves headroom for the potion rocket once, keeping a stable
camera throughout its launch. Physics, track geometry and saved selections are
unchanged. The immutable original reference remains available.

The added movement stays in fixed instance pools. All B/C attractions still
use at most seven draw batches; Jellyfish Dreamway drops from 35,128 to 25,048
triangles despite its new moving tentacles. There are no new shadow passes or
realtime lights. Halloween's original animations also reuse scratch vectors
rather than allocating them for every sparkle on every frame.

Final validation: **277 tests pass**, production build passes. Mobile review at
390px has no horizontal overflow. Three complete tours retain identical GPU
geometry/texture counts, saved-choice behaviour passes and no browser errors
were reported. The older Meadow budget assertion was updated specifically to
allow the fourth fixed batch for working paddles and packing presses; the
flower scene remains capped at three.

The third-round 48-case 4K run (same warmup, framebuffer cap and synthetic
opponent described above) measured:

| Design | Frame median | Frame p95 range | CPU submission p95 range | Frames above 25 ms |
| --- | --- | --- | --- | --- |
| A | 16.7 ms | 17.8–18.3 ms | 3.8–4.8 ms | 0 |
| B | 16.7 ms | 17.8–18.4 ms | 4.1–4.6 ms | 0 |
| C | 16.7 ms | 17.7–18.4 ms | 4.0–4.5 ms | 0 |

Raw local measurements: `output/playwright/round3-performance.json` (ignored,
not a shipped asset). These warmed local samples support no sustained frame
rate regression; they do not promise 60 fps on every device. No merge or deploy
is part of this refinement pass.

## Fourth refinement pass

This pass gives each of the 36 alternatives a clearer performance: preparation,
contact, a playful reaction and a controlled return. Most changes reuse the
existing character geometry or animation pools rather than filling the scene
with extra decoration. Names and saved choice identifiers remain unchanged.

| Ride | A refinement | B refinement | C refinement |
| --- | --- | --- | --- |
| Sheep Shuffle | Travelling flower cheer wave and rising butterfly escorts | Volume-preserving squash and stretch, with star applause around the trampoline somersault | Woolly loom face and scarf-model sheep bows |
| Lily Pad Bridge | Curved striped catamaran sails and more playful rocking | Fuller croaks and a conductor wand attached to its moving hand | Sequential duck dips, quacks and flaps, with rising soap bubbles |
| Windmill Loop | Cheerful flour sacks squash beneath precisely timed packing heads | A mouse rides the cheese pendulum; cuckoo gives a head-cocking greeting | Bees deliver between sunflower and hives along smooth banked circuits |
| Mountain Pass | Articulated hooves tuck, kick and extend for landing | Brass organ valves pop in sequence with the marmot players | Cheering mittened snowmen and a ringing snowball finish bell |
| Glowstone Tunnel | Travelling portal crystal lights and independently swinging bell clappers | Puffed cheeks, sneeze anticipation, recoil and wing stretch | Toothed gem-sorting machinery turns with the bucket conveyor |
| Waterfall Viaduct | Waterwheel spray and small wakes behind the ducks | Candy-striped windsocks visibly inflate beside the pressure tanks | Tall ice hoops and continuous belly-slide/standing transitions |
| Lantern Parade | Bunny anticipation crouch, stronger spring, settling bounce and star passengers | Banking rockets with flame and star exhaust attached to their nozzles | Contracting jellyfish bells and clams that lift pearls only after opening |
| Marquee Loop | Smiling cheer stars perform complete hopping cartwheels | Rolling mouse pinball makes cat bumpers recoil and tilt | More expressive fairy costume and a closing bow from her slippers |
| Carousel Climb | Feathered unicorns prepare, crouch and rear | Staggered teacup toasts and a curved tea stream landing in a receiving cup | Saucers have landing feet and launch in a banking ripple around each deck |
| Pumpkin Hops | Alternating drum strokes, larger notes and scalloped bandstands | Frog stoppers somersault and land upright in their bottles | Attached ghost skirts billow in flight and flutter on the line |
| Pumpkin Portal | Sweets launch continuously from the lollipop orbits, then refill gently | Moving lids give the monster a playful wink | Tasselled curtains gather as three puppets take turns dancing |
| Witch's Hat | Broad fitted patchwork panels on the academy roof | Vats charge in sequence; the rocket completes a turn and bounces on landing | Smiling flower centres, local pollen sparkles and moths that slow their wings while visiting |

Two visual passes per world inspect the nine individual designs at different
animation times and camera angles, including the mountain tunnel cutaways.
Reviews and regression checks address these specific details:

- Bee delivery routes have a depth offset so headings turn continuously at the
  top and bottom of their circuits. Their wing roots follow the banking bodies.
- Packing-head contact keeps sacks on their belt and preserves their volume;
  trampoline deformation also keeps the sheep and mat in contact at take-off.
- The snowball starting snowman stands on its glacier instead of intersecting
  it. Organ valve caps rest on their rims, sorter normals follow the rotating
  geometry, and penguin bodies and flippers share continuous transitions.
- Rocket exhaust follows the nozzle; clam pearls wait for the shells to open;
  the tea stream reaches its receiving cup, and the fairy bow preserves her
  pedestal clearance.
- Potion bottle pipework and gauges move behind the frog launch shafts so the
  stoppers have an unobstructed flight. Ghost cloth keeps a fixed shoulder hinge;
  gathering curtains retain their outer anchors; puppet strings and shoes use
  the same limb transforms as the sequential dances.
- The carousel's **Closer look** bounds now frame the attraction itself rather
  than its long line of exit-track bulbs. The full-track view remains available.

Animations use bounded instance pools and shared geometry, with no per-frame
object spawning, extra shadow passes or new realtime lights. B/C attractions
remain capped at seven draw batches. Articulated mountain hooves and bell
clappers use a fourth fixed animation batch; existing Meadow and Carnival draw
counts do not increase. The jellyfish revision reduces its geometry again,
from 25,048 to 23,328 triangles. The original reference, track physics, carousel
train matching and decaying coasting remain intact.

Final validation: **295 tests pass**, along with the production build. The
gallery passes at 390px with no horizontal overflow, saved choices persist,
and three full tours of all 36 options retain stable GPU geometry/texture
counts. No browser errors were reported. Separate close-up inspection confirms
the new carousel framing for A, B and C.

The fourth-round 48-case comparison uses the actual game renderer at a
3840×2160 viewport, with its normal resolution cap producing a 3401×1763
framebuffer. It covers all 36 designs plus two-track scenes for four pieces,
using the same warmed, synthetic-opponent procedure described above:

| Design | Frame median | Frame p95 range | CPU submission p95 range | Frames above 25 ms |
| --- | --- | --- | --- | --- |
| A | 16.7 ms | 17.5–18.5 ms | 3.9–4.5 ms | 0 |
| B | 16.7 ms | 17.3–18.7 ms | 4.1–4.5 ms | 0 |
| C | 16.7 ms | 17.6–18.5 ms | 4.0–4.7 ms | 0 |

Across 4,272 sampled frames the maximum interval was 18.8 ms, with no browser
errors. Raw local results are `output/playwright/round4-performance.json`
(ignored). These samples show no sustained regression on this machine; they
do not establish performance on every device or under real network load.
The refinement remains on the workshop branch, with no merge or deployment.
