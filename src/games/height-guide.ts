import { MINI_BOOST_ENERGY } from "./mini-config";
import type { MiniPhysics } from "./mini-physics";
import type { HeightTrack } from "./height-track";
import { ELEMENT_NAMES } from "./mini-progression";

/** A frozen-track coasting estimate, including resistance and the actual raised
 * path length. It is advice about the next piece, not an automatic speed grant. */
export function heightGuide(track: HeightTrack, physics: MiniPhysics) {
  if (physics.flight) return "In flight · answers save a lift for landing";
  const current = track.sectionAt(physics.distance);
  const next = track.sections.find(s => s.start >= current.end);
  if (!next) return "Answer early to raise your track";
  let budget = physics.velocity ** 2 / (2 * physics.options.gravity);
  let y = track.height(physics.distance), ready = true;
  for (let s = physics.distance; s < next.end;) {
    const end = Math.min(s + 1, next.end), nextY = track.height(end);
    const ds = (end - s) * track.metric((s + end) / 2);
    const drag = physics.dragAt((s + end) / 2), rolling = physics.options.rolling / physics.options.gravity;
    const resistance = (nextY - y) / ds + rolling;
    budget = drag > 0 ? budget * Math.exp(-2*drag*ds) - resistance * -Math.expm1(-2*drag*ds)/(2*drag)
      : budget - (nextY - y) - rolling*ds;
    if (budget <= 0) { ready = false; break; }
    s = end; y = nextY;
  }
  const name = ELEMENT_NAMES[next.kind].toLowerCase();
  // A rail-energy estimate cannot certify a ballistic water landing.
  if (next.kind === "jump") return "Water jump ahead · earn height before takeoff";
  return `${name[0].toUpperCase() + name.slice(1)} next · ${ready ? "enough height & speed" : "earn height before the climb"}`;
}

/** Minimum extra energy to coast over the next piece's crest, with a small
 * rolling reserve. Only uphill Sky lift answers qualify; normal boost is the cap. */
export function skyLiftBoostEnergy(track: HeightTrack, physics: MiniPhysics) {
  if (physics.flight || physics.crashed || track.slope(physics.distance) <= .02) return 0;
  const current = track.sectionAt(physics.distance);
  const next = track.sections.find(s => s.start >= current.end);
  let end = current.end;
  if (next) {
    let highest = -Infinity;
    for (let s = next.start; s <= next.end; s = Math.min(next.end, s+2)) {
      const y = track.height(s);
      if (y > highest) { highest = y; end = s; }
      if (s === next.end) break;
    }
  }
  let required = 1;
  for (let s = end; s > physics.distance;) {
    const start = Math.max(physics.distance, s-1), ds = (s-start)*track.metric((s+start)/2);
    const drag = physics.dragAt((s+start)/2);
    const resistance = physics.options.gravity*(track.height(s)-track.height(start))/ds + physics.options.rolling;
    required = Math.max(1, drag > 0 ? required*Math.exp(2*drag*ds) + resistance*Math.expm1(2*drag*ds)/drag
      : required + 2*resistance*ds);
    s = start;
  }
  return Math.min(MINI_BOOST_ENERGY, Math.max(0, (required-physics.velocity**2)/2));
}
