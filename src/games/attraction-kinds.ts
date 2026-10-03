/** Additional attractions keep their own identity while sharing proven rails. */
export const ATTRACTION_RAILS = {
  honeyfactory: 'windmillloop',
  pancakemill: 'windmillloop',
  penguinplunge: 'ravinebridge',
  bigtopjuggle: 'midwayloop',
  silkspindle: 'witchhat',
} as const;
export type AdditionalAttraction = keyof typeof ATTRACTION_RAILS;
export function attractionRail<K extends string>(kind: K): K | typeof ATTRACTION_RAILS[AdditionalAttraction] {
  return ATTRACTION_RAILS[kind as AdditionalAttraction] ?? kind;
}
