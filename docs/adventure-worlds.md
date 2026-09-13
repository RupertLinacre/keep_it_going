# Adventure worlds — design and validation

Work branch: `feature/adventure-worlds`. Default Remix rides now follow four distance-based worlds. Classic remains available.

## 1. Baa Baa Meadows

Rolling low-poly hills, flower meadows, farm fences, gently animated sheep and windmills. Scenery is seeded, fixed in world space, batched by material, and excluded from camera framing. Both race lanes use the same course and scenery. The question and controls stay level and legible.

Validation: desktop 1440×900 and mobile 390×844 visual review. Opening scene: 82 draw calls, 224,382 triangles, 48 geometry buffers; no browser errors. All 127 existing tests passed. Nine actual-game simulations (seeds 1, 42, 73; 4.8s answers on Very easy, 3.2s on Easy, 2s on Medium; 94% answer probability and ±20% timing jitter) reached the mountains in 24–33 seconds. These are design assumptions, not measured child performance.

World announcements fade after 3.8 seconds; a small journey badge remains. No new controls are required.
