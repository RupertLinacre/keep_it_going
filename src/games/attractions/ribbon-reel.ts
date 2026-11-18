import { wrappedParcel, WRAP_HALF_WIDTH, WRAP_TOP } from './gift-wrap';
import * as T from 'three';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import type { MiniSection } from '../mini-track';
import { C, gift, nearest, railLights, sparkles, star, type ChristmasBuilder } from './christmas-builder';

const red = '#c92748';
const gold = '#ffe098';
const green = '#16765c';
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const clamp = T.MathUtils.clamp;
const reelCylinder = new T.CylinderGeometry(1, 1, 1, 32);

type RibbonRow = { center: T.Vector3; across: T.Vector3 };

function satinRibbon(v: ChristmasBuilder, rows: RibbonRow[]) {
  // The selvedges and narrow highlight bands are part of the same sheet of
  // geometry, so they follow the twist and share the moving leading edge.
  const across = [-1, -.84, -.77, -.45, 0, .45, .77, .84, 1];
  const shades = [gold, gold, '#960e37', red, '#ff6578', red, '#960e37', gold, gold].map(c => new T.Color(c));
  const stride = across.length;
  const positions = new Float32Array(rows.length * stride * 3);
  const colors = new Float32Array(positions.length);
  const indices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { center, across: edge } = rows[i];
    for (let j = 0; j < stride; j++) {
      const offset = (i * stride + j) * 3;
      const point = center.clone().addScaledVector(edge, across[j]);
      point.toArray(positions, offset);
      shades[j].toArray(colors, offset);
      if (i && j) {
        const b = i * stride + j;
        indices.push(b - stride - 1, b - stride, b, b - stride - 1, b, b - 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  const moving = positions.slice();
  const attribute = new T.BufferAttribute(moving, 3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const strip = v.effect(geometry, new T.MeshStandardMaterial({
    vertexColors: true, side: T.DoubleSide, roughness: .35, metalness: .12,
    emissive: '#7d1628', emissiveIntensity: .35,
  }));
  strip.name = 'unwinding-bow-ribbon';

  let previousTip = -1;
  let previousLength = -1;
  return (length: number) => {
    if (length === previousLength) return;
    if (previousTip >= 0) {
      const offset = previousTip * stride * 3;
      moving.set(positions.subarray(offset, offset + stride * 3), offset);
      attribute.addUpdateRange(offset, stride * 3);
    }
    const last = Math.floor(length);
    const mix = length - last;
    previousTip = mix > 0 ? last + 1 : -1;
    if (previousTip >= 0) {
      const offset = last * stride * 3;
      attribute.addUpdateRange(offset + stride * 3, stride * 3);
      for (let i = 0; i < stride * 3; i++) {
        moving[offset + stride * 3 + i] = T.MathUtils.lerp(positions[offset + i], positions[offset + stride * 3 + i], mix);
      }
    }
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, Math.ceil(length) * (stride - 1) * 6);
    previousLength = length;
  };
}

export function ribbonPiece(v: ChristmasBuilder, s: MiniSection) {
  const m = new WorldModel(), spool = new WorldModel(), silk = new WorldModel(), elf = new WorldModel();
  const { width: w, amplitude: h, hand } = s;
  const x = w * .5, z = 19 * hand;
  const y = Math.max(0, s.origin.y - 5);
  const presentHeight = Math.min(8.2, s.origin.y - y + 5.3), lid = y + presentHeight;
  // The first crossing is outside the parcel. Feed along that same side
  // in either handed layout so the ribbon stays clear even below lid height.
  const reel = V(x - 22, y + 3.55, 6 * hand);
  const cylinderRotation = [Math.PI / 2, 0, 0];
  const knotY = s.origin.y + h * .65;
  const firstKnot = nearest(s, V(x, knotY, 6 * hand));
  const lastKnot = nearest(s, V(x, knotY, 26 * hand));

  // The ribbon sits beneath the train's wheels. Roll the sheet towards the
  // camera on the flanks so it reads as fabric even from the ride camera.
  const trackRow = (distance: number): RibbonRow => {
    const frame = s.sample(distance);
    const center = frame.position.sub(V(s.origin.x, 0, s.origin.z)).addScaledVector(frame.up, -1.95);
    const phase = (distance - firstKnot) / (lastKnot - firstKnot) * Math.PI * 2;
    const fold = Math.abs(Math.sin(phase));
    const twist = .18 + .64 * Math.sin(phase * 2);
    const across = frame.up.clone().multiplyScalar(Math.cos(twist))
      .addScaledVector(frame.right, Math.sin(twist)).multiplyScalar(.6 + 1.14 * fold);
    return { center, across };
  };
  const start = trackRow(firstKnot), end = trackRow(lastKnot);
  const feed = new T.CubicBezierCurve3(reel.clone().add(V(0, 1.12, 0)),
    reel.clone().add(V(6, 1.12, 0)), start.center.clone().add(V(-5, -2, 0)), start.center);
  // Land flat on the intersection of the lid bands, travelling along the wrap.
  const join = V(x, lid + WRAP_TOP, z);
  const tail = new T.CubicBezierCurve3(end.center, end.center.clone().add(V(3, -.4, .6 * hand)),
    join.clone().add(V(0, 0, 4.5 * hand)), join);
  const flatEdge = (curve: T.CubicBezierCurve3, t: number) => {
    const tangent = curve.getTangent(t);
    return V(-tangent.y, tangent.x, 0).normalize().multiplyScalar(1.14);
  };
  const rows: RibbonRow[] = [];
  const feedRows = 24, bowRows = Math.ceil((lastKnot - firstKnot) / .65), tailRows = 26;
  for (let i = 0; i < feedRows; i++) {
    const t = i / feedRows;
    const edge = flatEdge(feed, t);
    if (edge.dot(start.across) < 0) edge.negate();
    rows.push({ center: feed.getPoint(t), across: edge.lerp(start.across, t ** 3) });
  }
  for (let i = 0; i <= bowRows; i++) rows.push(trackRow(T.MathUtils.lerp(firstKnot, lastKnot, i / bowRows)));
  for (let i = 1; i <= tailRows; i++) {
    const t = i / tailRows;
    const blend = T.MathUtils.smoothstep(t, 0, 1);
    const across = end.across.clone().lerp(V(Math.sign(end.across.x || 1) * WRAP_HALF_WIDTH, 0, 0), blend);
    rows.push({ center: tail.getPoint(t), across });
  }
  const payOut = satinRibbon(v, rows);
  const knot = new WorldModel();
  knot.add(G.round, '#a91c3d', [0, 0, 0], [1.65, 1.32, .64], [0, 0, -.35]);
  knot.add(G.round, gold, [0, 0, .16 * hand], [.53, 1.34, .64], [0, 0, -.35]);
  star(knot, .03, .02, .85 * hand, .55, C.cream, false, .13);
  const bowKnot = v.batch(knot);
  bowKnot.position.copy(join);

  wrappedParcel(m, x, y, z, presentHeight);

  // A brass and candy-red reel with a visible, depleting roll of satin.
  const radius = 2.83;
  for (const side of [-1, 1]) {
    const flange = side * 1.57;
    spool.add(reelCylinder, '#b97945', [0, 0, flange], [radius, .27, radius], cylinderRotation);
    spool.add(G.ring, gold, [0, 0, flange + side * .17], [radius * .91, radius * .91, .88]);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const rim = V(Math.sin(angle) * 2.35, Math.cos(angle) * 2.35, flange + side * .19);
      spool.beam('#843429', V(0, 0, rim.z), rim, .13);
      star(spool, rim.x, rim.y, rim.z, .25, C.cream, false, angle);
    }
    star(spool, 0, 0, flange + side * .21, .75, gold, false);
    m.add(G.box, C.dark, [reel.x, y + .63, reel.z + side * 1.91], [3, 1.26, .54]);
    m.beam(C.wood, V(reel.x, y + .6, reel.z + side * 1.91), V(reel.x, reel.y, reel.z + side * 1.91), .29);
  }
  silk.add(reelCylinder, red, [0, 0, 0], [1, 2.8, 1], cylinderRotation);
  for (const edge of [-1.29, 1.29]) silk.add(reelCylinder, gold, [0, 0, edge], [1.01, .1, 1.01], cylinderRotation);
  const reelFaces = v.batch(spool), reelFill = v.batch(silk);
  reelFaces.position.copy(reel);
  reelFill.position.copy(reel);

  for (const [i, size] of [1.3, 1.8, 2.2, 1.35].entries()) {
    gift(m, x + 18.5 + i * 1.6, y, z + (i % 2 ? 1 : 5) * hand, size, i % 2 ? C.green : red);
  }
  elf.add(G.round, '#ffd5b1', [0, 1.3, 0], [.36, .43, .35]);
  elf.add(G.cone, red, [0, 1.93, 0], [.62, .86, .62], [0, 0, -.18]);
  elf.add(G.round, C.cream, [.24, 2.32, 0], [.13, .13, .13]);
  elf.add(G.box, green, [0, .6, 0], [.69, .95, .55]);
  elf.add(G.box, gold, [0, .59, .29], [.18, .18, .06]);
  for (const dx of [-.21, .21]) {
    elf.add(G.round, C.dark, [dx, 1.4, .32], [.055, .08, .045]);
    elf.add(G.box, red, [dx, .09, .15], [.3, .18, .5]);
  }
  const elves = v.pool(elf, 3);
  railLights(m, s);
  v.festive(m);

  const sparkleStops = [firstKnot, (firstKnot + lastKnot) / 2, lastKnot];
  const sparkle = sparkles(v, s, sparkleStops.map(d => trackRow(d).center.clone().sub(V(0, s.origin.y, 0))));
  v.animate((time, distance, reduced) => {
    const progress = clamp((distance - firstKnot) / (lastKnot - firstKnot), 0, 1);
    const tie = clamp((distance - lastKnot) / Math.min(16, s.end - lastKnot), 0, 1);
    payOut(feedRows + progress * bowRows + tie * tailRows);
    bowKnot.visible = tie > .88;
    bowKnot.scale.setScalar(T.MathUtils.smoothstep(tie, .88, 1));
    const used = .9 * progress + .1 * tie;
    const fill = T.MathUtils.lerp(2.48, 1.06, used);
    reelFill.scale.set(fill, fill, 1);
    reelFaces.rotation.z = reduced ? 0 : -used * (lastKnot - firstKnot) / 2;
    const active = distance >= firstKnot && tie < 1;
    for (let i = 0; i < 3; i++) {
      const hop = active && !reduced ? Math.max(0, Math.sin(time * 5 + i * 2)) * .48 : 0;
      v.place(elves, i, x + (i - 1) * 2.45, y + hop, z + 8, 1.25, 0, 0);
    }
    sparkle(time, distance, reduced);
  });
}
