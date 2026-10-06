# 30 · Frozen Waterfall Stairway

Source found at `/Users/robinlinacre/Documents/repos/tiny_tracks/output/imagegen/christmas-pieces/30-winterfair.png`.
Implemented in this worktree on top of the existing, uncommitted Christmas-world baseline copied from the main checkout. The main checkout was not edited.

Playable: `christmas.html?piece=frozenwaterfall`. Gallery: `tracks.html?world=winterfair&element=frozenwaterfall`. Frosty Lake Fair introduces this attraction in its normal seeded course.

## Visual review record

Screenshots are retained under `output/playwright/frozen-waterfall/` (ignored artifacts).

1. Initial whole-model silhouette: three ice terraces, chalet and looping railway.
2. Support density review: discovered upper trestles can intersect lower passes.
3. Approach review: corrected approach/lower-route proximity; geometry checks guided changes.
4. Revised whole-model view: closer descending horseshoe and clearance-safe supports.
5. Larger desktop composition: identified the hidden waterfall on the mirrored model.
6. Palette and orientation: fixed front-facing orientation; added two lower falls.
7. Real moving train on the lower climb: continuous rail, coach clearance and landmark readability.
8. Summit gameplay: warm chalet, deck and three separated circuits.
9. Phone at 390 × 844: visible keypad, readable climbing train, no horizontal overflow.
10. Low tunnel passage: train clears the dry gallery behind the frozen curtain.
11. Final whole-model review: timber trim, window crossbars, eave icicles, wreath and train-lit hanging ice.
12. Side view: three rising terraces and the dry low return remain distinct.
13. Top view: route bends, open approach, descending horseshoe and grade-separated passes.
14. Final gameplay after chalet/light polish: the whole train curves around the upper terrace.
15. Exit: ordinary answer-driven physics traverses the complete attraction and joins the following railway.

The development server required restarts to serve changes reliably; the final gallery and gameplay reviews use restarted server builds.

## Validation

Production build succeeds and the final full test run passes all 280 tests, including parametrized waterfall geometry, ordinary physics, crossings, scene clearance, race lane rejoining, fixed animation pools, pause, reduced motion and disposal.

Four seeds cover the attraction with solo and multiplayer rail layouts. Attraction geometry remains within the existing 12-batch / 30,000-triangle budget. Actual desktop gameplay answered every 1.8 seconds and crossed the exit after eight correct answers, with finite camera coordinates and no page errors. The phone review used an emulated viewport, not a physical handset. No deployment was performed.

## Ice, tunnel and lantern polish

Follow-up to the user's attached reference: replaced rectangular ice strips with projecting triangular facets; extended the curtains and exposed them in front of the rock faces; added fixed surface glints with independent shader phases. A brass-framed lantern chain follows the actual railway, with larger hanging lanterns on the waterfall and grotto. The cave has open side portals, a dark vaulted lining and a camera-facing arched opening; its front cutaway keeps the train visible behind the frozen curtain. The lower cascade is broader and offset beside the grotto, seated on a snowy rock shelf.

Seven further desktop/gameplay/phone captures are in `output/playwright/frozen-waterfall-polish/`. Visual review corrected an obscured tunnel opening and ice facets buried in the original rock surface. Clearance checks then caught snow caps near two climbing passes; smaller, recessed caps preserve the exposed curtain without clipping the coaches.

The production build and all eight attraction tests pass, including four-seed roof-to-triangle clearance, race-lane rejoining, bounded geometry, disposal and a new test for the glitter shader's pause/reduced-motion state and material ownership. Full normal-physics browser traversal and the phone layout pass without page errors. The previous full-suite result remains 280 passes; the new sparkle regression adds one test and was run with the focused attraction suite.


## Rear summit entry → front emergence: ten new iterative reviews

The external descending horseshoe and sideways lower gallery have been replaced by a continuous descending tunnel. The entrance is behind the summit chalet; the train emerges forward through the low front waterfall. Terrain is cut around the actual sampled railway, and an inward-facing lining follows the complete descent. A rock flank keeps the rail enclosed rather than exposing a decorative tube between terraces. Both portal collars follow the rail's real orientation. Exterior trestles and hanging lanterns stop at the underground section; small warm interior lamps take over.

Artifacts: `output/playwright/waterfall-through-hill/`.

1. **Top route review:** verified the new rear-to-front path and removed the old external descent. Adjusted the entrance controls to separate the return from the earlier climbing railway, including race layouts.
2. **Crest composition:** found an oversized, detached-looking rear snow shelf. Reduced its footprint and joined it to the upper hill.
3. **Connected hill:** reviewed the new rear ridge and its relationship to the chalet. Clearance checks guided the carved approach.
4. **Open bore:** reviewed the real openings and exposed descending segment. This led to a continuous rocky flank enclosing the underground rail.
5. **Rear entrance:** orbited behind the house to inspect the actual mouth and the last climbing rail. Corrected the flank's outward-facing facets and extended its upper connection.
6. **Enclosed descent:** reviewed the front silhouette again; the train's underground segment stays behind rock until the front portal. Added a regression checking actual mountain occlusion along the descent.
7. **Moving summit entry:** ordinary arithmetic boosts and carriage physics carry the train behind the chalet into the hill.
8. **Moving front emergence:** the train comes directly through the front mouth, then makes a broad rightward turn. Added small snow-dusted firs to the rear crest.
9. **Phone emergence:** detected a cropped chalet roof at the low exit. Increased the landmark allowance and added a gradual upward pan for the low portrait view.
10. **Finished phone view:** verified the complete chalet roof, rear firs, front mouth, emerging train and accessible keypad. Final desktop capture and complete exit traversal followed.

The production build passes. The full suite passed all 282 tests. After the final portrait-framing adjustment, the eleven focused attraction/camera tests pass; desktop and phone browser checks verify the actual final view. Four seeds cover the high rear entry, low forward mouth and genuinely enclosed descending track. The existing triangle-level coach-clearance, fixed-buffer, material-disposal and rail-lifecycle checks pass. No deployment was performed.
