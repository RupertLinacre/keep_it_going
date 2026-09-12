export const W = 1100,
  H = 570;
export const palette = {
  ink: "#1c2946",
  lime: "#dcff80",
  blue: "#3462f3",
  white: "#ffffff",
};
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
export function label(
  ctx: CanvasRenderingContext2D,
  text: string | number,
  x: number,
  y: number,
  size = 20,
  color = palette.ink,
  align: CanvasTextAlign = "center",
  weight = 600,
) {
  ctx.font = `${weight} ${size}px Outfit, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(String(text), x, y);
}
export function line(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  color: string,
  width = 3,
) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}
export function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
export function gradient(
  ctx: CanvasRenderingContext2D,
  top: string,
  bottom: string,
) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
export function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
  color = "#ffffffbb",
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 80, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, -27, -14, 25, color);
  circle(ctx, 8, -26, 35, color);
  circle(ctx, 40, -8, 23, color);
  ctx.restore();
}
export function block(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  n: number,
  rows: number,
  size = 22,
  color = "#dfff80",
  rotation = 0,
  jets = true,
) {
  const cols = Math.ceil(n / rows),
    w = cols * size,
    h = rows * size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = "#23314a15";
  ctx.beginPath();
  ctx.ellipse(w / 2, h + 22, w * 0.6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (jets) {
    ctx.shadowColor = "#e4ff70";
    ctx.shadowBlur = 14;
    for (let i = 0; i < cols; i++)
      roundRect(
        ctx,
        i * size + 4,
        h + 4,
        size - 8,
        12 + Math.sin(x + y + i) * 5,
        5,
        "#e5ff91cc",
      );
    ctx.shadowBlur = 0;
  }
  roundRect(ctx, 5, -6, w, h, 4, "#27365d");
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (r * cols + c < n)
        roundRect(ctx, c * size, r * size, size, size, 1, color, "#25355336");
    }
  const face = Math.min(1, size / 19);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(face, face);
  roundRect(ctx, -19, -13, 16, 23, 7, "white");
  roundRect(ctx, 3, -13, 16, 23, 7, "white");
  circle(ctx, -8, 0, 3.5, palette.ink);
  circle(ctx, 14, 0, 3.5, palette.ink);
  ctx.beginPath();
  ctx.arc(0, 12, 7, 0.15, Math.PI - 0.15);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  roundRect(ctx, w / 2 - 22, -39, 44, 27, 10, "#ffffffed");
  label(ctx, n, w / 2, -25, 19);
  ctx.restore();
}
export function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const d = i % 2 ? r * 0.3 : r;
    const px = x + Math.cos(a) * d,
      py = y + Math.sin(a) * d;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
