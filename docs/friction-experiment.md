# Adaptive resistance experiment

Branch: `codex/friction-experiments`. Production is unchanged.

Medium uses drag 0.0016 and a rolling-resistance ceiling of 1.02 m/s².
`rollingResistance()` in `src/games/ride-resistance.ts` preserves the previous
combined resistance exactly from rest through 8 m/s. From 8 to 20 m/s a smoothstep
blend transitions the replacement drag into constant resistance. At 20 m/s total
resistance is again identical to the previous model. Above 20 m/s the rolling term
stays constant and air resistance is 40% of its previous strength.

The transition is continuous and monotonic. Between 8 and 20 m/s total resistance
is somewhat greater than before; this is the balancing cost of faster descents.
Difficulty multipliers and Ice glide scale both coefficients together. Water drag,
boost energy, gravity, airborne jump physics and parcel drag remain unchanged.
Multiplayer prediction uses the same rail acceleration. Jump and height estimates
now evaluate rolling resistance at their predicted speed rather than assuming the
high-speed ceiling applies throughout a slow climb.

## Verification

The matched-run results below describe the initial 0.002 / 0.86 tuning. The
subsequent checkpoint uses 0.0016 / 1.02; the low-speed and 20 m/s equivalence
are unchanged, with a higher vertical terminal speed.

172 tests pass, including low-speed equivalence at all five difficulties,
transition continuity/monotonicity, vertical terminal speed, and Ice glide scaling.
Production build passes.

Run `npx tsx scripts/playtest-friction.ts` to compare 15 matched pairs of seeded,
headless adventure games over at most 180 seconds each. The harness restores old
on-rail resistance for the baseline, with current game code otherwise retained;
it is not a checkout of the old release. Timings include deterministic jitter and
94% answer success, and are assumptions rather than measurements of real players.

On seeds 1, 42 and 73, Learning (4.8 seconds, Very easy), Practising (3.2 seconds,
Easy) and Fluent (2 seconds, Medium) all survived 180 seconds under both models.
Learning travelled 17–21% farther and Practising 15–26% farther. Low-speed time
remained about two seconds in those profiles.

With seven-second answers on Medium, both models stopped on all three seeds.
Previous versus adaptive distances were 889/776, 526/528 and 1323/1370 metres.
At 4.8-second answers on Medium one previously failing seed survived the time cap.
Higher speeds alter obstacle arrival times and power pickup timing, so these runs
support broadly comparable challenge, not identical survival rates. Real-player
feedback and longer runs are still useful before release.

An unpowered, dry, vertical Medium descent has net acceleration 6.23 m/s² at
40 m/s (previously 3.35). Its theoretical terminal speed rises from 178 to 267 km/h (about 50% higher).
