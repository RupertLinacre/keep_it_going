import { Quaternion, Vector3 } from "three";
import { gradient, line, roundRect, circle } from "../draw";
import { clamp } from "../math";
import type { Mini } from "../games/mini";
import { isParcelWagon, parcelPresentation } from "../games/mini-config";
import { lanePosition, mirrorRotation, raceLaneOffset, snapshotRide } from "./ghost";

/** A small software-rendered two-lane view keeps the race playable without WebGL. */
export function drawRaceFallback(game: Mini, ctx: CanvasRenderingContext2D) {
  gradient(ctx, "#e5eee6", "#f3efd9");
  const lead = game.physics.sample(game.physics.distance).position;
  const offset = raceLaneOffset(game.track);
  const baseScale = game.close ? 28 : 19;
  const scale = clamp(410 / (30 + Math.abs(lead.z + offset) * .8), baseScale / 3, baseScale);
  const centerY = lead.y * .55;
  const project = (point: Vector3, opponent: boolean): [number, number] => {
    const p = lanePosition(point, offset, opponent);
    return [500 + (p.x - lead.x - p.z * .17) * scale, 320 - (p.y - centerY - p.z * .38) * scale];
  };
  const local = snapshotRide(game, 0), remote = game.opponent?.sample();
  for (const rival of [true, false]) {
    for (const section of game.track.sections) {
      let points: [number, number][] = [];
      const flush = () => {
        if (points.length > 1) { line(ctx, points, rival ? "#c69a82" : "#78a296", 6); line(ctx, points, "#f4d58e", 2); }
        points = [];
      };
      for (let i = 0; i < section.frames.length; i += 3) {
        const f = section.frames[i];
        if (!section.hasRail(section.start + section.distances[i])) { flush(); continue; }
        points.push(project(f.position, rival));
        if (i % 30 === 0 && f.up.y > .4 && Math.abs(f.position.x - lead.x) < 100)
          line(ctx, [project(new Vector3(f.position.x, 0, f.position.z), rival), project(f.position, rival)], "#a5b9a6", 2);
      }
      flush();
    }
    const state = rival ? remote : local;
    if (!state) continue;
    for (const link of state.links) line(ctx, [project(new Vector3(...link.start), rival), project(new Vector3(...link.end), rival)], "#688278", 2);
    for (const body of [...state.bodies].reverse()) {
      const position = new Vector3(...body.position);
      const [x, y] = project(position, rival);
      if (x < -50 || x > 1150 || y < -60 || y > 630) continue;
      const rotation = new Quaternion(...body.rotation);
      const forward = new Vector3(0, 0, -1).applyQuaternion(rival ? mirrorRotation(rotation) : rotation);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(-forward.y + forward.z * .38, forward.x - forward.z * .17)); ctx.scale(scale / 19, scale / 19);
      const open = isParcelWagon(body.color);
      roundRect(ctx, -18, open ? -14 : -25, 36, open ? 11 : 22, 4, rival ? "#e48670" : "#68bdb0", "#6c8e80");
      if (!open) roundRect(ctx, -19, -28, 38, 5, 2, "#fff0ca");
      for (const parcel of parcelPresentation(body.cargo, body.cargoAge)) {
        const px = parcel.z > 0 ? 2 : -15, py = -27 - (parcel.y - 1) * 20;
        ctx.save(); ctx.translate(px + 6.5, py + 6.5); ctx.scale(parcel.scale, parcel.scale);
        roundRect(ctx, -6.5, -6.5, 13, 13, 1, "#c89560"); roundRect(ctx, -1.5, -6.5, 3, 13, 0, "#f9e8b9"); ctx.restore();
      }
      circle(ctx, -10, 0, 4, "#567970"); circle(ctx, 10, 0, 4, "#567970"); ctx.restore();
    }
    for (const impact of state.impacts) {
      if (impact.age < .3 && !impact.water) {
        const [x, y] = project(new Vector3(...impact.position), rival);
        circle(ctx, x, y, 2.2 * scale * (1 - impact.age / .3), "#ffe6a6");
      }
      for (const p of impact.particles) {
        const [x, y] = project(new Vector3(...p.position), rival);
        const size = p.size * scale * 2 * Math.max(0, 1 - impact.age / 2);
        roundRect(ctx, x - size / 2, y - size / 2, size, size, 1, impact.water ? "#58b9c9" : "#e9a06f");
      }
    }
    for (const parcel of state.parcels) {
      const [x, y] = project(new Vector3(...parcel.position), rival);
      const size = .68 * scale;
      roundRect(ctx, x - size / 2, y - size / 2, size, size, 1, "#c89560");
      roundRect(ctx, x - size / 10, y - size / 2, size / 5, size, 0, "#f9e8b9");
    }
  }
}
