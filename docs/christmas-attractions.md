# Selected Christmas attractions

Implemented on `codex/christmas-world`. The four selected attractions and Santa’s Chimney Delivery are Twilight Lapland pieces;
Frosty Lake Fair introduces Frozen Waterfall Stairway alongside its winter scenery.

| Concept | Attraction | Playable preview | Route and response |
| --- | --- | --- | --- |
| 01 | Star Tree Spiral | `christmas.html?piece=startree` | Three narrowing circuits around a tiered fir; an outside descent. Train proximity wakes ornament lights; crown pulses and passage sparkles. |
| 06 | Snowman Scarf Slalom | `christmas.html?piece=snowmanscarf` | Climbs along a striped scarf around the snowballs and hat, returns through a genuine bored snowball tunnel. Hat nods, tassels dance and snow stars burst. |
| 14 | Elf’s Ribbon-Reel Roll | `christmas.html?piece=ribbonreel` | The rails themselves draw both lobes of a giant ribbon bow, with ten-metre depth separation at its knot. Train-driven reels coast to a stop; elves dance. |
| 30 | Frozen Waterfall Stairway | `christmas.html?piece=frozenwaterfall` | Climbs icy terraces, enters behind the summit chalet, descends through a carved mountain bore and emerges through the front waterfall. |
| 17 | Snow-Globe Shake-Up | `christmas.html?piece=snowglobe` | Climbs the globe rim, enters an open gate and circles the little clock-tower village. Bounded snow swirls and its star shakes gently. |

Use `tracks.html?world=lapland` to orbit each attraction. The playable playground
uses the same opening hill, arithmetic, carriage physics and renderer as the game;
the attraction is the first piece after the opening descent. It is not autoplay.

## Course director

The normal game introduces Star Tree Spiral first, then shuffles the remaining
selected attractions with the shared course seed. Long Christmas pieces stay
inside their world: a piece that cannot fit yields to a gentle snowy recovery
hill. Not all four fit in every visit; different seeds and return visits vary the
tour. Existing world order and the 6,600 m adventure cycle are unchanged.

Pieces 05 (Reindeer Antler Adventure) and 18 (Aurora Lantern Bridges) were removed from the course and previews.

## Original visual reviews per attraction

Screenshots are in `output/playwright/christmas-attractions/`.

1. **Whole-route 3D review:** silhouettes, route/model relationships, tunnel and
   crossings. Tightened the bow knot, opened the globe ribs and reduced its rim,
   added reel supports and lined the snowman bore.
2. **Landscape and lighting review:** placed each model in its winter landscape;
   reviewed its ornaments, lamps, snowy details and warm glow. Corrected approach
   and exit directions and separated overlapping circuits found by the geometry
   checks. Switched rail sampling to arc length so very different control-point
   spacings do not create a sudden change in frame direction.
3. **Actual gameplay review:** controlled answers at 1.4 s, ordinary physics and
   complete carriage poses. Identified backward-facing characters, narrow scarf
   strips, clipped crowns and dense support posts.
4. **Revised gameplay review:** characters face the local camera for both handed
   routes; broader continuous scarf, smoother crown framing, sparse supports and
   cheaper bulbs. Reviewed all six again. Follow-up full-route checks used 1.8 s
   answers, three capture positions per route, mobile layouts, spatial powers and
   triangle-level coach/scenery clearance. Snowman arms were moved clear of the
   climbing railway; the lantern petals use their own local hinge axes.

## Performance and lifecycle

Static vertex-colour batches, sparse glow quads and fixed instance pools. No
attraction adds a real-time light, shadow map, transmission/refraction pass, bloom pass or unbounded
particle emitter. Snow, sparkles and auroras are not camera subjects. Shared
materials remain owned by the scene; the attraction releases its own buffers and
glow material. Pause and reduced motion are tested.

Browser profiling script: `scripts/profile-christmas-pieces-browser.js`.
All six measured about 60 FPS on this Mac's Apple M4, with a 4K viewport and the
existing six-million-pixel render ceiling; no sampled frame exceeded 25 ms.
The same held for the two-train rendering fixture. A phone viewport with 4x CPU
throttling also held about 60 FPS; that is a local stress test, not a physical
low-end-phone benchmark or a multiplayer networking measurement.

Artifacts: `profile-4k.log`, `profile-race.log`, `profile-phone.log`,
`gameplay-check.log`, plus their screenshot sets. The phone run initially found
an overflowing demo selector; its compact header was fixed and all six layouts
then passed the route checker with every keyboard key visible.


## Reference polish: six further reviews of 01, 06 and 17

Original concepts: `output/imagegen/christmas-pieces/01-lapland.png`,
`06-lapland.png` and `17-lapland.png`. Local comparison page:
`output/playwright/christmas-polish/index.html`.

1. **Model rebuild:** fuller overlapping fir skirts and substantial faceted gold
   stars; rounder snowballs, holly, lantern, broad scarf and diagonal bore; globe
   terrace, arched portals, clock tower, snowy houses and hanging snowflake.
   Whole-route screenshots exposed weak gallery framing and cluttered arms.
2. **Composition and silhouette:** added an attraction close-up while retaining
   full-route/side/top views, removed the gallery's conspicuous extra board for
   Christmas models and repositioned snowman details. Inspected all three again.
3. **Light and materials:** warmer light pools, larger gold ornaments, darker
   tunnel lining, low-poly gift bows and sparkle stars. Fixed the scarf to use
   the banked rail frame rather than an arbitrary tangent rotation. Added small
   shader twinkles to the glow, with the game's elapsed clock.
4. **Real moving-train review:** full traversals with ordinary physics and
   answers every 1.8 seconds; screenshots during climb, descent and exit.
   Broadened the snowman's framing fade to retain its hat on the descent.
5. **Phone and spatial effects:** 390 × 844 captures midway through each
   attraction, visible keyboard keys and no document overflow. Also checked
   gravity roll, Sky Lift and board tilt for finite, bounded cameras. Narrow
   phone views follow the train rather than squeezing the entire asset in.
6. **Final comparison and route review:** compared final models with references,
   inspected the wider globe descent, decorative portal stars, bells and fuller
   village. Added metre-based bend and banking checks. These caught a sharp
   globe entry that ordinary adjacent-frame continuity tests had missed; it was
   replaced with a broad descending horseshoe and the portals were moved to
   meet the rails. Final gameplay was captured again after these corrections.

These three routes use analytic coils and quintic connectors matching position,
unit tangent and spatial curvature. Banking follows signed lateral bend at a
static design speed, capped at about 47 degrees and smoothed over metres. Entry
and exit frames remain forward and upright. Tests exercise four seeds in solo
and race layouts, crossings, coach-to-scenery clearance and genuine traversal.
Additional checks reject bends tighter than seven metres and abrupt frame roll.

Each new landmark remains at most 12 material batches and below 40,000 triangles
including fixed particle pools (other Christmas attractions retain the 30,000
triangle budget). The globe has one faint low-poly glass shell with real portal
cutouts; it uses simple alpha blending, not physical transmission. The shader,
glass material and all attraction buffers have explicit disposal ownership.

Latest build/test and gameplay evidence: `build.log`, `tests.log`,
`gameplay-final.log`, `profile-4k.log`, `profile-race.log` and `profile-phone.log`
in `output/playwright/christmas-polish/`. Local desktop/phone/race render timings
are reported in `performance-summary.json`; phone CPU throttling and the race
fixture do not claim physical-phone or network testing.


## Glass and snowfall pass

Snow-Globe Shake-Up now uses a rounded glass sphere seated on a matching broad
base. Four cutouts follow the actual rail crossings; their gold lips are curved
circle/sphere intersections, with coach-roof clearance checked across seeds and
both race layouts. The high outer rail travels inside the globe before the
outside descent and low return through the village.

The clear glass has view-dependent curved highlights, blue rim reflections,
subtle amber light and tiny surface glints. Two inexpensive surface passes avoid
physical transmission, environment capture and postprocessing. The snowfall is
320 decorrelated, deterministic particles in one shader batch: small drifting
points and larger six-point crystals twinkle independently, with cool and warm
light accents. Passage through any opening gently stirs the snow; this motion is
integrated and decays smoothly. Shader time and motion freeze on pause/reduced
motion, and the effects remain inside the globe and outside camera subject lists.

Latest screenshots, gameplay checks and performance logs are in
`output/playwright/snowglobe-glass/`. All 271 tests pass; dedicated glass tests
check openings, bounds, paused shader state and disposal of the three materials.


## Santa’s Chimney Delivery

Added as `chimneyhouse` to Twilight Lapland and the Christmas playable preview. See [chimney-delivery.md](chimney-delivery.md) for the launch behaviour, rendering budget and visual reviews.
