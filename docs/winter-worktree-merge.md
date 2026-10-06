# Winter attraction worktree integration

Both worktrees were snapshotted without changing their files or indexes:

- `codex/import-frozen-waterfall` (`c0efdc5`): Frozen Waterfall Stairway,
  glittering ice, lanterns, and the rear-entrance/front-exit mountain tunnel.
- `codex/import-sled-switchbacks` (`f0241f5`): Sled Mountain Switchbacks,
  stone tunnel, and train-driven penguin towing, release, racing and replay.

They are merged into `codex/christmas-world`. The six-world order and 6,600-metre
adventure remain intact. Both attractions belong to `winterfair`; the older
gallery `world=frosty` links redirect to that collection. The rebuilt Alpine
chimney house, sleigh models and magical contrails remain unchanged.

Conflict resolutions combined the rail factories, attraction dispatch, world
signatures, gallery lighting/framing and tests. The playable Christmas preview
now includes both pieces, with concept numbers 30 and 40. Multiplayer protocol
11 separates this seeded six-world course from older clients using protocol 10.

Validation: all 295 tests and the production build pass. Desktop and 390×844
phone gameplay checks traverse both pieces with no browser errors or keyboard
overflow. Gallery checks observe penguins towing, racing and landing and verify
the replay button. The original attraction modules match their source snapshots.

Local Chrome/Apple M4 real-time checks at 3840×2160 averaged 16.67 ms per frame
for the waterfall and 16.71 ms for mirrored sled tracks, approximately 60 FPS.
The waterfall had no frames >25 ms; the mirrored sled run had two, with none
>50 ms. The mirrored check uses local opponent snapshots rather than a live
network connection. Screenshots are taken after the timed samples, to avoid
readback stalls. Phone checks use a viewport on this Mac, not a physical phone.

Reproducible browser scripts: `scripts/check-winter-merge-browser.js` and
`scripts/profile-merged-winter-browser.js`. Saved checks and screenshots:
`output/playwright/winter-worktree-merge/`.
