import * as T from 'three';
import type { ElementShape } from './mini-elements';

/** Three alpine traverses connected by broad, tangent-continuous hairpins.
 * The rear ascent, downhill terraces and exit occupy separate corridors. */
export function sledSwitchbacks(width: number, height: number, hand: number): ElementShape {
  const p = (x: number, y: number, z: number) => new T.Vector3(x * width, y * height, z * width * hand);
  const curves: T.CubicBezierCurve3[] = [];
  const add = (...a: [T.Vector3, T.Vector3, T.Vector3, T.Vector3]) => curves.push(new T.CubicBezierCurve3(...a));
  // Ease into a rear mountain ascent with flat, forward-facing connectors.
  add(p(0,0,0),p(.12,0,0),p(.08,.08,-.24),p(.22,.32,-.24));
  add(p(.22,.32,-.24),p(.36,.56,-.24),p(.56,1,-.24),p(.75,1,-.24));
  // Two half circles, each split into quarter-circle Beziers. Their radius
  // is 8% of the footprint; the vertical handles flatten at each join.
  const r=.08, k=.5522847498;
  add(p(.75,1,-.24),p(.75+k*r,1,-.24),p(.75+r,.95,-.24+(1-k)*r),p(.75+r,.9,-.16));
  add(p(.75+r,.9,-.16),p(.75+r,.85,-.24+(1+k)*r),p(.75+k*r,.8,-.08),p(.75,.8,-.08));
  add(p(.75,.8,-.08),p(.58,.8,-.08),p(.42,.64,-.08),p(.25,.64,-.08));
  add(p(.25,.64,-.08),p(.25-k*r,.64,-.08),p(.25-r,.59,-.08+(1-k)*r),p(.25-r,.54,0));
  add(p(.25-r,.54,0),p(.25-r,.49,-.08+(1+k)*r),p(.25-k*r,.44,.08),p(.25,.44,.08));
  add(p(.25,.44,.08),p(.42,.44,.08),p(.61,.12,.08),p(.78,.12,.08));
  // A gentle low-level bend enters the front-facing tunnel, then sweeps
  // behind the mountain and returns to a level +X exit. Crossings are grade
  // separated from the upper traverses, not spliced through existing rails.
  const exitCurves=[
    new T.CubicBezierCurve3(p(.78,.12,.08),p(.86,.12,.08),p(.855,.07,.035),p(.855,.07,-.015)),
    new T.CubicBezierCurve3(p(.855,.07,-.015),p(.855,.07,-.045),p(.855,.035,-.075),p(.855,.035,-.105)),
    new T.CubicBezierCurve3(p(.855,.035,-.105),p(.855,.035,-.155),p(.88,0,-.15),p(.9,0,-.15)),
    new T.CubicBezierCurve3(p(.9,0,-.15),p(.99,0,-.15),p(.91,0,0),p(1,0,0)),
  ];
  const exitPoint=(u:number)=>{const i=Math.min(3,Math.floor(u*4));return exitCurves[i].getPoint(u*4-i);};
  const slot = (t:number) => { const i=Math.min(8,Math.floor(t*9));return {i,u:t*9-i}; };
  return {
    point(t) { const {i,u}=slot(t);return i===8?exitPoint(u):curves[i].getPoint(u); },
    up(t,tangent) {
      const {i,u}=slot(t);
      // Bank toward each hairpin's centre, easing on and off over its approach.
      const smooth=(v:number)=>{v=T.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
      const bank=i===1?-.45*smooth((u-.65)/.35):i===2||i===3?-.45:
        i===4?-.45*(1-smooth(u/.3))+.45*smooth((u-.7)/.3):
        i===5||i===6?.45:i===7?.45*(1-smooth(u/.3)):0;
      return new T.Vector3(0,1,0).addScaledVector(tangent,-tangent.y).normalize().applyAxisAngle(tangent,-hand*bank);
    },
  };
}
