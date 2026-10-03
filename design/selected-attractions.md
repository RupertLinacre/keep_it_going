# Selected attractions

Promoted from `codex/special-piece-polish` into the normal game. Only the chosen
models are built; rejected alternatives and the temporary `piece-review.html`
comparison page have been removed. Earlier workshop commits retain the proposals.
The existing production track collection remains at `tracks.html`.

## Replacements (option A)

| Existing rail identity | Selected attraction |
| --- | --- |
| pondbridge | Lily Pad Regatta |
| windmillloop | Storybook Flour Mill |
| mountainpass | Alpine Goat Chorus |
| tunnel | Glowstone Ropeway |
| ravinebridge | Waterwheel Rainbow |
| carouselhelix | Unicorn Palace |
| pumpkinhop | Pumpkin Drumline |
| pumpkintunnel | Candy Castle Portal |
| witchhat | Broomstick Academy |

Sheep Shuffle, Rainbow Midway and Marquee Loop retain their original main-branch
models. Unicorn Palace uses a three-storey carousel with train-matched rotation
and a decaying coast after the train leaves.

## Additional attractions

| World | Selected design | Course identity | Proven rail shape |
| --- | --- | --- | --- |
| Meadows | C: Sunflower Honey Factory | honeyfactory | windmillloop |
| Meadows | E: Pancake Mill | pancakemill | windmillloop |
| Mountains | C: Penguin Plunge | penguinplunge | ravinebridge |
| Carnival | D: Big Top Juggle Loop | bigtopjuggle | midwayloop |
| Halloween | E: Spider Silk Spindle | silkspindle | witchhat |

The extra attractions have separate identities, names, models and animation
buffers. Their immutable rail frames reuse the chosen gallery silhouettes,
including handedness, world height caps and multiplayer lane rejoining.
Each world's opening tour guarantees all of its attractions. A short connector
replaces a randomly drawn long inversion that would overrun the world boundary
and consume the next world's tour. The random challenge mixes remain unchanged.

## Steam and Confetti Clouds

Normal steam has doubled starting radius, doubled growth and doubled lifetime
(2.1–2.5 seconds), with the same emission rate. Confetti Clouds preserves the
chosen option E: pastel scalloped clouds and coloured star embers. It is part
of the normal earned power-up bag, lasts twenty seconds, changes no physics,
and respects the four-correct-answer requirement before the next gate.
Both riders have independent effects and synchronized power state. Protocol
10 prevents clients using the old course generator from racing this release.

Smoke uses two opaque instanced draws and a fixed 120-particle pool per train.
It follows world coordinates, funnel orientation and game time, never camera
bounds. Pausing, replaying, gravity inversion and origin rebasing are covered
by regression tests. No rejected smoke designs remain in production.

## Validation

- 257 automated tests pass; TypeScript and the production build pass.
- All seventeen attractions are guaranteed across eighty seeds and two laps.
- Additional models have at most seven draws and fewer than 20,000 triangles
  each, without real-time lights or decorative shadow passes. Tests cover
  traversable rails, lane rejoining, fixed pools, independent riders, pause,
  reduced motion, lift rebasing and exact geometry disposal.
- All seventeen production previews pass desktop (1440px) and phone (390px)
  checks without browser errors or horizontal overflow.
- Real desktop/phone WebRTC race: both riders answered six questions, retained
  smooth rendering and exchanged independent effects. Confetti stars appeared
  on the correct local and remote trains, expired after twenty seconds, and
  left no layout overflow or browser errors.
- Actual game renderer profiled at a 3840 × 2160 viewport: 42 scenarios,
  3,108 warmed frame intervals. Every scenario measured a 16.7ms median;
  worst p95 17.6ms, maximum 17.7ms, zero intervals above 25ms. Cases include
  every attraction with one and two trains, plus Confetti Clouds in four
  demanding scenes. Maximum p95 rendering CPU time was 7.2ms. The adaptive
  render buffer was 3401 × 1763. These are local Chromium measurements with
  a synthetic opponent, not a guarantee for all devices or networks.

Browser checks: `scripts/check-selected-attractions-browser.js`,
`scripts/check-selected-race-browser.js`, `scripts/profile-train-smoke-browser.js`.
Raw screenshots and performance data are ignored under `output/playwright/`.
