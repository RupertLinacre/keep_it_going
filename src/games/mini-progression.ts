import type { MiniKind } from "./mini-track";

/** Distance, not elapsed time or answer accuracy, determines the next challenge.
 * Scaling is continuous; the opening kilometre introduces the ride's vocabulary. */
export function rideProgress(distance: number) {
  const kilometres = Math.max(0, distance - 700) / 1000;
  return {
    scale: 1 + kilometres * 0.22,
    turns: Math.min(8, 2 + Math.floor(kilometres / 1.8)),
    chapter: Math.min(4, Math.floor(kilometres / 1.6)),
  };
}

// Each chapter introduces a new silhouette. The director shuffles within the
// groups, then alternates demanding pieces and lower recovery elements.
export const RECOVERY: readonly MiniKind[] = ["hill", "dip", "heartline", "waveturn", "doubledip", "corkscrew"];
export const CHALLENGES: readonly (readonly MiniKind[])[] = [
  ["loop", "ascendinghelix", "zerogstall", "immelmann", "noninvertingloop", "interlockingloops"],
  ["loop", "ascendinghelix", "diveloop", "tophat", "cobraroll", "interlockingloops"],
  ["nestedloop", "ascendinghelix", "tophat", "immelmann", "pretzelknot", "zerogstall"],
  ["nestedloop", "ascendinghelix", "verticalhill", "diveloop", "cobraroll", "invertedhill"],
  ["nestedloop", "ascendinghelix", "tophat", "verticalhill", "pretzelknot", "noninvertingloop"],
];

export const ELEMENT_NAMES: Record<MiniKind, string> = {
  sheepbank: "SHEEP SHUFFLE", pondbridge: "LILY PAD BRIDGE", windmillloop: "WINDMILL LOOP",
  ravinebridge: "WATERFALL VIADUCT",
  midwayloop: "MARQUEE LOOP", carouselhelix: "CAROUSEL CLIMB",
  pumpkintunnel: "PUMPKIN PORTAL", witchhat: "WITCH’S HAT",
  mountainpass: "MOUNTAIN GORGE", tunnel: "GLOWSTONE TUNNEL", lanternrun: "RAINBOW MIDWAY", pumpkinhop: "PUMPKIN HOPS",
  noninvertingloop: "NON-INVERTING LOOP", pretzelknot: "PRETZEL KNOT", cobraroll: "COBRA ROLL",
  station: "BREATHER", firsthill: "FIRST DROP", hill: "AIRTIME HILL", skyhill: "SKY-HIGH CLIMB",
  dip: "VALLEY RUN", loop: "VERTICAL LOOP", corkscrew: "CORKSCREW", helix: "HELIX",
  triplehelix: "HELTER SKELTER", invertedhill: "INVERTED CREST", verticalhill: "VERTICAL CLIMB", jump: "WATER JUMP",
  splash: "SPLASH ZONE",
  heartline: "HEARTLINE ROLL", zerogstall: "ZERO-G STALL", waveturn: "WAVE TURN", doubledip: "DOUBLE DIP",
  tophat: "TOP HAT", immelmann: "IMMELMANN & TURN", diveloop: "DIVE LOOP", ascendinghelix: "SKY SPIRAL",
  interlockingloops: "INTERLOCKING LOOPS", nestedloop: "LOOP WITHIN A LOOP",
};
