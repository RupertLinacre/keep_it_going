/** Numeric seeds round-trip in links; words are useful memorable course names. */
export function courseSeed(text: string): number | undefined {
  const value = text.trim();
  if (!value) return;
  if (/^\d+$/.test(value)) return Number(value) >>> 0;
  let seed = 2166136261;
  for (const c of value) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export const freshCourseSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
