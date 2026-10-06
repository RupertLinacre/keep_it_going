# Santa’s Chimney Delivery

Playable preview: `http://localhost:5198/christmas.html?piece=chimneyhouse`.
The piece is also in Twilight Lapland’s seeded attraction/challenge selection.

The train enters a cosy red family cottage, pauses inside for 0.7 seconds,
then emerges from its hollow chimney in a fountain of gold, pink and mint
magic sparkles. The windows reveal a sofa, Christmas tree and delivered gifts.
The house has an open doorway, a genuine roof/chimney opening, a wreath,
snowy gables, garden lamps and a fence. Rear windows keep the mirrored race
lane welcoming too.

Launch speed is `sqrt(400 + 0.65 * entrySpeed²)` metres per second. The magical
minimum gives slow entries a safe small leap; additional entry energy increases
height continuously. Normal jump gravity then takes over, including the existing
directional-gravity power rules. The sleigh stays upright instead of performing
the water jump’s barrel roll. Answers during the delivery pause still add energy.
The pause does not count as a stopped train or end the ride.

Rails and sleepers stop at the chimney mouth and resume beyond the open-air
gap. Followers use distance along the actual ballistic arc, including the
transition out of the hidden chimney rail, to preserve 2.4-metre coupler spacing.
Peer snapshots hold their displayed coaches still during the delivery wait.
Sky lift uses the same protected take-off transition as the ordinary water jump.

Rendering uses merged solid/emissive geometry, two shared interactive-light
batches and one preallocated 320-spark billboard batch. No additional scene
lights, shadow maps, runtime object spawning or bloom pass. Only the cottage
landmark affects framing; sparkles do not affect zoom. The existing 3× maximum
zoom-out remains in force.

## Visual reviews

1. **Initial approach, wait, launch, peak and landing:** identified a shed-like
   roof/window silhouette and stretched coaches on the descent.
2. **Gabled cottage and flight spacing:** added a round loft window, front door,
   wreath and a smaller chimney; converted follower spacing to flight arc length.
3. **Roof, interior, magic and framing:** tightened the actual roof opening,
   furnished the glowing living-room window, enlarged the burst and kept the
   chimney in the launch/flight composition. Reviewed continuous drawn physics.
4. **Phone, 18 and 45 m/s entries:** reviewed wait, launch, peak and landing at
   390×844. No overflow or obscured keyboard. Caught and fixed the short slow-entry
   spacing gap at the rail-to-flight transition; added continuous ten-coach tests.
5. **Natural gameplay and performance:** played from the opening hill with
   correct answers at 2.4-second intervals, through delivery, take-off and landing.
   Captured desktop, phone and mirrored two-track views. Corrected the profiling
   method to capture screenshots after measurement: 4K image readback itself
   creates a roughly 150-ms artificial RAF interruption.
6. **Final house and mirrored lane polish:** added rear windows, a rear gable
   and wreath, then repeated the complete desktop visual pass.

Screenshots and verification logs: `output/playwright/chimney-house/`.
The initial first-pass screenshots were superseded during the cottage redesign;
the inspected first-pass issues are recorded above. Rounds 2–6 are saved.

## Performance evidence

Local Chrome/Metal, Apple M4. Each uninterrupted real-time sample included the
starting hill, entry, delivery wait, launch, complete flight and landing, with
about 780 RAF samples. Phone is a viewport check on this Mac, not a physical
low-end-phone benchmark. Race uses the production mirrored renderer and an
in-process opponent snapshot, not an internet-connection benchmark.

| View | Mean frame | p95 frame | Frames >25 ms | Mean render CPU | p95 render CPU |
|---|---:|---:|---:|---:|---:|
| 3840×2160 desktop | 16.67 ms | 17.70 ms | 0 | 1.38 ms | 2.00 ms |
| 390×844 phone viewport | 16.67 ms | 17.60 ms | 0 | 1.41 ms | 2.00 ms |
| 3840×2160 mirrored race | 16.67 ms | 17.60 ms | 0 | 1.83 ms | 2.60 ms |

All rides landed and continued, with no browser errors. Renderer resolution
adaptation limited the desktop/race framebuffer to about six million pixels.
Final rear-window polish adds fewer than 500 baked triangles and no draw calls.

Automated coverage includes the delivery delay, speed-dependent safe landings,
boosts while waiting, cancellation on relocation, empty rail gap, upright ends,
burst replay/pause/disposal, bounded batches, all ten coupler gaps throughout the
flight, and stationary opponent snapshots during delivery. Existing height and
water-jump physics checks continue to pass.

## Christmas chalet polish: five further reviews

The house now has a steeper gable, a thick faceted snow blanket with a real
chimney opening, timber framing, green shutters and a snow-topped balcony.
Garlands, bows, icicles, potted Christmas trees and shared glowing roofline
lights tie it into Twilight Lapland. The loft window and chimney bulbs were
raised so the balcony and snow caps do not obscure them. The launch sparkle
function and all flight physics are unchanged.

1. Reviewed the snowy roof silhouette and chimney opening during delivery and
   launch; added more recognisable chalet details.
2. Reviewed the balcony, shutters and warm windows; identified the obscured loft
   window and chimney bulbs.
3. Corrected those details and reviewed icicles and roof lights. Reduced the
   less-visible rear bulbs to keep the existing geometry budget intact.
4. Reviewed delivery, launch, peak and landing at 390×844 with 18 and 45 m/s
   entries. The keyboard remained visible with no overflow or stopped rides.
5. Played complete real-time rides on desktop, phone-size and mirrored race
   views, then inspected the final chalet during delivery with the intro faded.

Screenshots and logs: `output/playwright/chimney-chalet/`. Seven focused tests
and the production build pass. The attraction stays at seven batches and below
the existing 15,000-triangle limit, with no added scene lights or shadow passes.

On the local Apple M4/Chrome Metal setup, uninterrupted 4K, phone-size and
mirrored-race samples averaged 16.67 ms per frame (about 60 FPS), with no frames
above 25 ms. Render CPU means were 1.50, 1.30 and 1.91 ms respectively. Phone-size
checks use this Mac, not a physical phone; mirrored race checks use local
snapshots, not a network benchmark.

## Alpine chalet rebuild

Replaced the previous house architecture completely with `alpine-chalet.ts`.
The house is narrower and taller, with a 24.8-metre ridge, steep snowy roof,
deep eaves, exposed rafters, a stone ground floor and horizontal timber walls.
Smaller shuttered windows, paired attic windows and a wraparound wooden balcony
replace the shop-like picture-window frontage. Snow drifts, icicles, fir
garlands, bells, skis and firewood complete the mountain-home setting. The
exposed cream masonry chimney now continues down to a stone footing.

The shaft opening, pause, launch origin, flight physics and 320-star launch
effect are preserved. The sparkle function is byte-identical to the previous
version. Square timber beams and simpler wreath/carving geometry keep the
rebuilt attraction within its original seven batches and <15,000 triangles.

Five review passes are saved in `output/playwright/alpine-chalet/`:

1. Complete approach, delivery, launch, peak and landing: assessed the new gable
   silhouette and domestic window proportions.
2. Repeated the ride after adding roof snow pillows and stone flue footings.
3. Inspected the front and orbited the 3D gallery to check the bore and balcony;
   continued the chimney side walls to the ground after that inspection.
4. Reviewed phone-size delivery, launch, peak and landing at 18 and 45 m/s.
   No overflow, covered keyboard, crashes or excessive coupler gaps.
5. Played uninterrupted real-time desktop, phone-size and mirrored-race rides,
   then reviewed the final cream chimney palette during natural gameplay.

The build and seven focused chimney tests pass. Apple M4/Chrome Metal real-time
samples averaged 16.67 ms per frame in all three layouts, with no frames >25 ms.
Mean render CPU was 1.45 ms at 4K, 1.27 ms at phone size and 1.77 ms for the
mirrored two-track view. Phone checks remain viewport tests on this Mac; race
checks use the production renderer with local opponent snapshots.
