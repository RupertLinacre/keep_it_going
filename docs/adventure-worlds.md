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
