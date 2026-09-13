import { drawAdventureFallback } from "../games/adventure-fallback";
import { adventureAt } from "../games/adventure-worlds";
import { drawTailwindSail, sailDeployment } from "../games/tailwind-sails";
import { riderColor } from "./identity";
import { Quaternion, Vector3 } from "three";
import { gradient, line, roundRect, circle } from "../draw";
import { clamp } from "../math";
import type { Mini } from "../games/mini";
import { isParcelWagon, parcelPresentation } from "../games/mini-config";
import { lanePosition, mirrorRotation, snapshotRide } from "./ghost";
import { weatherPoint } from "../games/powerup-weather";
import { POWERUPS } from "../games/ride-powerups";

/** A small software-rendered two-lane view keeps the race playable without WebGL. */
export function drawRaceFallback(game: Mini, ctx: CanvasRenderingContext2D) {
  const world=game.remixMode?adventureAt(game.track.sectionAt(game.physics.distance).start).world:undefined;
  gradient(ctx, world?.sky ?? "#e5eee6", world?.ground ?? "#f3efd9");
  const lead = game.physics.sample(game.physics.distance).position;
  const offset = game.raceSpacing.updateAt(game.track, game.elapsed);
  const baseScale = game.close ? 28 : 19;
  const scale = clamp(410 / (30 + Math.abs(lead.z + offset) * .8), baseScale / 3, baseScale);
  const centerY = lead.y * .55;
  const project = (point: Vector3, opponent: boolean): [number, number] => {
    const p = lanePosition(point, offset, opponent);
    return [500 + (p.x - lead.x - p.z * .17) * scale, 320 - (p.y - centerY - p.z * .38) * scale];
  };
  const local = snapshotRide(game, 0), remote = game.opponent?.sample();
  for (const rival of [true, false]) {
    const state = rival ? remote : local;
    if(game.remixMode)drawAdventureFallback(ctx,game.track,game.physics.distance,state?.time??game.elapsed,p=>project(p,rival),scale);
    for (const section of game.track.sections) {
      if (section.kind === "splash" || section.kind === "jump") {
        const flooded = section.kind === "splash", y = flooded ? section.waterLevel : .4;
        const from = flooded ? .14 : .2, to = flooded ? .86 : .64, width = flooded ? 6.8 : 6;
        const points = [[from,-width],[to,-width],[to,width],[from,width]].map(([x,z]) =>
          project(new Vector3(section.origin.x + section.width*x, y, section.origin.z+z),rival));
        ctx.save();ctx.globalAlpha=.7;ctx.fillStyle="#55bccc";ctx.strokeStyle="#d7c7a3";ctx.lineWidth=5;ctx.beginPath();
        points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      }
      let points: [number, number][] = [];
      const flush = () => {
        if (points.length > 1) { line(ctx, points, riderColor(game.riderRole, rival), 6); line(ctx, points, "#fff1cf", 1); }
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
    if (!state) continue;
    const kind = state.power?.active, leader = state.bodies[0];
    if (kind && leader && Math.abs(leader.position[0]-lead.x)<130) {
      const info=POWERUPS[kind];ctx.save();ctx.globalAlpha=.35;
      for(let i=0;i<120;i++) {
        const point=weatherPoint(i,game.track.seed,kind,state.time,{x:leader.position[0],y:leader.position[1],z:leader.position[2]});
        const p=new Vector3(point.x,point.y,point.z),q=p.clone().add(new Vector3(point.dx,point.dy,point.dz));
        line(ctx,[project(p,rival),project(q,rival)],info.color,2);
      }
      ctx.restore();
    }
    const gate=state.power?.gate;
    if(gate && gate.distance>=game.track.sections[0].start && gate.distance<=game.track.end) {
      const f=game.track.sample(gate.distance),[x,y]=project(f.position.clone().addScaledVector(f.up,2.4),rival);
      ctx.save();ctx.strokeStyle=POWERUPS[gate.kind].color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,scale*1.7,scale*2.5,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;ctx.font="bold 22px Arial";ctx.textAlign="center";ctx.fillText(POWERUPS[gate.kind].icon,x,y-scale*2.7);ctx.restore();
    }
    for (const link of state.links) line(ctx, [project(new Vector3(...link.start), rival), project(new Vector3(...link.end), rival)], "#688278", 2);
    for (const body of [...state.bodies].reverse()) {
      const position = new Vector3(...body.position);
      const [x, y] = project(position, rival);
      if (x < -50 || x > 1150 || y < -60 || y > 630) continue;
      const rotation = new Quaternion(...body.rotation);
      const forward = new Vector3(0, 0, -1).applyQuaternion(rival ? mirrorRotation(rotation) : rotation);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(-forward.y + forward.z * .38, forward.x - forward.z * .17)); ctx.scale(scale / 19, scale / 19);
      const open = isParcelWagon(body.color);
      roundRect(ctx, -18, open ? -14 : -25, 36, open ? 11 : 22, 4, riderColor(game.riderRole, rival), "#6c8e80");
      if (!open) roundRect(ctx, -19, -28, 38, 5, 2, "#fff0ca");
      for (const [i,parcel] of parcelPresentation(body.cargo, body.cargoAge, game.remixMode ? 8 : undefined).entries()) {
        const px = parcel.z > 0 ? 2 : -15, py = -27 - (parcel.y - 1) * 20;
        ctx.save(); ctx.translate(px + 6.5, py + 6.5); ctx.scale(parcel.scale, parcel.scale);
        roundRect(ctx, -6.5, -6.5, 13, 13, 1, (body.bombs??0)&(1<<i) ? "#c94b40" : "#c89560"); roundRect(ctx, -1.5, -6.5, 3, 13, 0, "#f9e8b9"); ctx.restore();
      }
      if (body.id.startsWith("coach-")) drawTailwindSail(ctx, sailDeployment(state.power), state.time, body.color, riderColor(game.riderRole, rival));
      circle(ctx, -10, 0, 4, "#567970"); circle(ctx, 10, 0, 4, "#567970"); ctx.restore();
    }
    for (const impact of state.impacts) {
      if(impact.flood && impact.age<1.1) {
        const [x,y]=project(new Vector3(...impact.position),rival),rise=Math.sin(Math.PI*impact.age/1.1)*impact.flood.strength;
        ctx.save();ctx.globalAlpha=.5;ctx.fillStyle="#bdeef3";
        for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+side*2*scale,y-rise*10*scale,x+side*6*scale,y);ctx.closePath();ctx.fill();}ctx.restore();
      }
      if (impact.age < .3 && !impact.water) {
        const [x, y] = project(new Vector3(...impact.position), rival);
        circle(ctx, x, y, 2.2 * scale * (1 - impact.age / .3), "#ffe6a6");
      }
      for (const p of impact.particles) {
        const [x, y] = project(new Vector3(...p.position), rival);
        const size = p.size * scale * 2 * Math.max(0, 1 - impact.age / 2);
        roundRect(ctx, x - size / 2, y - size / 2, size, size, 1, impact.water ? "#58b9c9" : impact.dynamite ? "#f39145" : riderColor(game.riderRole, rival));
      }
    }
    for (const parcel of state.parcels) {
      const [x, y] = project(new Vector3(...parcel.position), rival);
      const size = .68 * scale;
      roundRect(ctx, x - size / 2, y - size / 2, size, size, 1, parcel.dynamite ? "#c94b40" : "#c89560");
      roundRect(ctx, x - size / 10, y - size / 2, size / 5, size, 0, "#f9e8b9");
    }
  }
}
