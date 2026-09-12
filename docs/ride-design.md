# Track expansion and balance

The pre-expansion game is preserved at `v1.1`. This expansion adds ten original, game-scale interpretations of elements from [Coasterpedia's element list](https://coasterpedia.net/wiki/List_of_roller_coaster_elements). The loop within a loop is a deliberate fantasy extension.

## Elements

| Element | What the player experiences |
| --- | --- |
| Heartline roll | A low, complete roll around a point above the rails; an opportunity to build momentum. |
| Wave turn | An airtime hill that bends and banks almost onto its side. |
| Double dip | Three shrinking crests with two intervening dips, producing a quick rise-and-fall rhythm. |
| Zero-g stall | A climbing half-roll, an extended upside-down crown, and a roll back upright. |
| Top hat | A vertical ascent, broad crown, and vertical plunge. |
| Immelmann and turn | A half loop into a half roll, followed by a banked return curve and a descending exit. |
| Dive loop | The reverse composition: climb and turn, roll over, then dive through the half loop. |
| Sky spiral | A continuous rising helix around a central tower, followed by a large drop. |
| Interlocking loops | Two overlapping loop silhouettes on separated rail lanes, followed by a curve back to the main corridor. |
| Loop within a loop | A large loop with a smaller complete inversion inserted into its crown. |

The [Immelmann](https://coasterpedia.net/wiki/Immelmann), [dive loop](https://coasterpedia.net/wiki/Dive_loop), and [zero-g stall](https://coasterpedia.net/wiki/Zero-g_stall) descriptions informed their inversion order. The numerical geometry, connecting curves, proportions, support structures and fantasy combination are original to this game.

Every complete piece finishes upright, facing forward, at the same four-metre base elevation. Temporary reversals and lateral excursions stay local to the element. The compound loops separate crossing rails by more than a carriage's clearance envelope; the rising coils maintain spacing at their first and last turns too.

## Progression

The opening six-coach hilltop start remains gentle: 2 m/s above a 22-metre drop. The initial set introduces gravity, small inversions, cargo, a shorter practice water jump, vertical rail and the helter skelter.

After the opening, the director alternates a recovery element and a challenge. Seeded shuffles vary their order, with an occasional water jump or descending triple helix. The first chapter introduces rising spirals and interlocking loops; subsequent chapters introduce top hats, dive loops and nested loops. Heights increase continuously with distance, so a chapter boundary does not suddenly change the energy of the train.

The main height multiplier is `1 + 0.22 × kilometres beyond 700 metres`. Hills grow vertically faster than horizontally. Loops preserve their round proportions as they enlarge. Recovery hills grow at a quarter of the main rate. Rising spirals add a turn every 1.8 kilometres, starting at two and reaching eight; their height also increases with turn count. Heights continue to grow after the eighth turn.

No answer boost is weakened. Each correct answer still supplies 300 joules per kilogram, with smaller speed gains when the train is already fast. Gravity and drag determine whether that stored momentum lasts through a climb. Longer towers require repeated answers; steep top hats and nested loops reward keeping enough energy in reserve.

The first water gap is approximately 26–28 metres rather than the later 31–34 metres. This adjustment followed simulations in which one early mistake could otherwise end a learning-speed run before 20 seconds. A 320-metre flat landing runout follows each jump: fast flights no longer intercept a later climb high above the ground and bypass its challenge. An additional audit covered 728 landings across 40 seeds at four answering rates, including one answer per second; all landed on their runouts.

## Answering assumptions and results

Intervals include reading, thinking, entering digits and submitting. They are design assumptions, not measured human performance. Jitter varies the interval, incorrect attempts cost correction time, and occasional longer hesitations break a perfect rhythm. Arithmetic difficulty and boost energy remain unchanged throughout a run.

The final simulation used 40 track seeds per profile, 160 rides in total, with a ten-minute limit per ride. It used the real track generator and fixed-step gravity, drag, impulse and jump physics.

| Profile | Typical interval | Accuracy assumption | Median run | Median distance |
| --- | ---: | ---: | ---: | ---: |
| Learning | 4.8 s ±25% | 90% | 2 min 39 s | 3.55 km |
| Steady | 3.2 s ±25% | 94% | 4 min 01 s | 6.48 km |
| Fluent | 2.0 s ±18% | 97% | At least 10 min | 18.72 km at stop or test limit |
| Expert | 1.25 s ±15% | 99% | At least 10 min | 22.61 km at test limit |

159 of 160 simulated rides survived the first minute, including 39 of the 40 learning runs. The shortest learning run stopped after 32.8 seconds on an inverted hill. All learning and steady runs eventually stopped on a climb; 24 fluent runs and all 40 expert runs were still moving at the ten-minute limit. Those surviving durations are lower bounds, not predicted final run lengths. This leaves room for highly fluent players to build long runs rather than imposing an unavoidable loss.

Across these runs, track storage retained at most 13 sections and 23,348 sampled rail frames. Individual sections cap their rail sampling at 16,385 frames. Rendering caps tube tessellation for very large pieces and shares instanced coach, cargo and support meshes. Large seeks prune expired sections during generation as well as at the end.

Run `npm run playtest -- --quick` for eight seeds per profile, or `npm run playtest` for the complete 160-ride report. [The saved summary](balance-results.json) includes assumptions and the seed pattern. Full output includes each run's stopping element, mistakes, height reached, jumps and storage bounds.

## Playtesting and regression checks

Desktop browser play used actual digit and Enter input at roughly three-second intervals, passed two kilometres, cleared the opening water jump, and traversed the new track with arriving coaches. In one 44-second measurement window, the 95th-percentile animation-frame interval was 18.5 ms with no intervals above 50 ms on the development machine; this is not a phone hardware benchmark. A further 20-second animated check after ten minutes of simulated play ran with 147 coaches, a 95th-percentile interval of 18.7 ms and no intervals above 50 ms in mobile emulation on the same machine.

Phone checks cover touch input, deleting a digit, submitting, minimal HUD, large late-game structures and responsive camera framing. Full game simulations were also rendered at two, five and ten minutes, with the ten-minute run accumulating 141 coaches. The camera follows the head of a long train without zooming back to every new arrival; detached coaches and loose cargo still widen the view. The camera follows the engine up tall structures and keeps a fixed horizon. A quiet amber cue in the question warns of an imminent stall, including on high-speed vertical climbs. Existing detailed physics messages remain hidden on mobile.

The production bundle also passed an actual keyboard-input smoke test: eight submitted answers, a completed 94.6-metre jump, and no page errors or failed asset requests. Phone layouts were checked at 320×568, 390×844, 844×390 and 1024×768, with no document overflow.

Automated regressions check position and orientation continuity, finite orthonormal rail frames, forward exits, crossing clearance, actual inversions and vertical sections, conservative gravity when resistance is disabled, progression and recovery order, answer-profile outcomes, bounded track storage, mobile framing, and the existing carriage, parcel, jump, restart and record behavior.
