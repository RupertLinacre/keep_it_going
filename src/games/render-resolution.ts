// Bound total 3D work as well as density: a scaled external display can otherwise
// request 13 million pixels. DOM text and controls retain native resolution.
export const MAX_SCENE_PIXELS = 6_000_000;
export function scenePixelRatio(width: number, height: number, deviceRatio: number) {
  const density = Math.min(Math.max(deviceRatio || 1, .1), 1.7);
  return width > 0 && height > 0
    ? Math.min(density, Math.sqrt(MAX_SCENE_PIXELS / (width * height)))
    : density;
}
