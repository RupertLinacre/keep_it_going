/** Shared deployment animation for both renderers and both players. */
export function sailDeployment(power?: { active?: string; age: number; remaining: number }) {
  if (power?.active !== "wind") return 0;
  const t = Math.max(0, Math.min(1, power.age / .5, power.remaining / .45));
  return t * t * (3 - 2 * t);
}

export function drawTailwindSail(ctx: CanvasRenderingContext2D, deployment: number, time: number, index: number, color: string) {
  if (!index || deployment <= 0) return;
  ctx.save(); ctx.translate(-12, -12); ctx.scale(1, deployment);
  ctx.strokeStyle = "#96764f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -51); ctx.stroke();
  const belly = 4 + Math.sin(time * 5 + index * 1.7) * 1.5;
  ctx.beginPath(); ctx.moveTo(0, -49); ctx.quadraticCurveTo(18 + belly, -29, 29, -12);
  ctx.quadraticCurveTo(16, -8, 0, -12); ctx.closePath();
  ctx.fillStyle = "#fff5d9"; ctx.fill(); ctx.strokeStyle = "#d5c49e"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, -49); ctx.lineTo(14, -44); ctx.lineTo(1, -40); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
