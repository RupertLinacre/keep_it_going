import * as T from 'three';
import type { ElementShape } from './mini-elements';

export const CHIMNEY = { ramp: .24, pause: .26, mouth: .38, landing: .60, delay: .7 } as const;
/** A hidden rising hearth rail, then a virtual guide across an empty jump gap.
 * Only the entrance and landing are rendered. The virtual guide is not flight physics. */
export function chimneyPoint(t:number,w:number,h:number) {
  let y=0;
  if(t>CHIMNEY.ramp&&t<=CHIMNEY.mouth){
    const u=(t-CHIMNEY.ramp)/(CHIMNEY.mouth-CHIMNEY.ramp);y=h*u*u*u*(2-u);
  }else if(t>CHIMNEY.mouth&&t<CHIMNEY.landing){
    const u=(t-CHIMNEY.mouth)/(CHIMNEY.landing-CHIMNEY.mouth);
    const slope=2*h*(CHIMNEY.landing-CHIMNEY.mouth)/(CHIMNEY.mouth-CHIMNEY.ramp);
    y=h*(2*u**3-3*u*u+1)+slope*(u**3-2*u*u+u);
  }
  return new T.Vector3(w*t,y,0);
}
export function chimneyShape(w:number,h:number):ElementShape {
  return {point:t=>chimneyPoint(t,w,h),up:(_t,tangent)=>new T.Vector3(-tangent.y,tangent.x,0).normalize()};
}
/** The chimney's magic guarantees a cheerful small jump, while extra entry
 * kinetic energy buys more height. No cap or velocity discontinuity at a threshold. */
export function chimneyLaunchSpeed(entrySpeed:number) {return Math.sqrt(20*20+Math.max(0,entrySpeed)**2*.65);}
