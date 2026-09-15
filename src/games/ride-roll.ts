import { Quaternion } from 'three';
import type { RailFrame } from './mini-rail';
const ease = (v:number) => { const t=Math.max(0,Math.min(1,v)); return t*t*(3-2*t); };
/** Half turn in/out, with zero angular speed at each end. */
export const gravityRoll = (active:string|undefined, age:number, remaining:number) =>
  active==='reverse' ? Math.PI*ease(age/1.2)*ease(remaining/1.2) : 0;
/** One barrel roll, completed at the far lip. The ballistic path is unchanged. */
export const jumpRoll = (x:number, start:number, landing:number) =>
  Math.PI*2*ease((x-start)/Math.max(.01,landing-start));
export function rollFrame(frame:RailFrame, angle:number) {
  if (!angle) return frame;
  const q=new Quaternion().setFromAxisAngle(frame.tangent,angle);
  frame.right.applyQuaternion(q);frame.up.applyQuaternion(q);
  frame.rotation.premultiply(q);
  return frame;
}

/** GPU rail rotation: one uniform per rider, not a course-wide CPU rebuild.
 * Sleepers rotate in their own local frame; tubes carry their centreline/axis. */
export const rollShader = (sleepers:boolean) => ({
  header: `uniform float rideRoll;\n${sleepers?'':'attribute vec3 railCenter; attribute vec3 railAxis;'}
vec3 rideRotate(vec3 p) {
  vec3 axis=${sleepers?'vec3(0.0,0.0,-1.0)':'railAxis'};
  float c=cos(rideRoll), s=sin(rideRoll);
  return p*c+cross(axis,p)*s+axis*dot(axis,p)*(1.0-c);
}`,
  position: sleepers?'transformed=rideRotate(transformed);':'transformed=railCenter+rideRotate(transformed-railCenter);',
});
