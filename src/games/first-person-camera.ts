import * as THREE from 'three';
import type { RailFrame } from './mini-rail';
import type { RidePowerups } from './ride-powerups';

export const FIRST_PERSON_FOV = 64;
export const FIRST_PERSON_TRANSITION = 1.8;

/** Ease in and out while the usual camera rig keeps following underneath. */
export function firstPersonBlend(power?: Pick<RidePowerups,'active'|'age'|'remaining'>) {
  if(power?.active!=='firstperson')return 0;
  const t=THREE.MathUtils.clamp(Math.min(power.age,power.remaining)/FIRST_PERSON_TRANSITION,0,1);
  return t*t*(3-2*t);
}

/** A continuous orthographic-to-perspective lens. At zero it exactly matches
 * the model view, so changing camera types never produces a one-frame pop.
 * At one it is a conventional 64-degree perspective projection. */
export function firstPersonProjection(out:THREE.Matrix4,blend:number,height:number,aspect:number,reference:number,near:number,far:number) {
  const depth=THREE.MathUtils.lerp(reference,4,blend);
  const viewHeight=THREE.MathUtils.lerp(height,2*depth*Math.tan(THREE.MathUtils.degToRad(FIRST_PERSON_FOV/2)),blend);
  const wNear=1-blend+blend*near/depth,wFar=1-blend+blend*far/depth;
  const a=-(wFar+wNear)/(far-near),b=-wNear+a*near;
  return out.set(2/(viewHeight*aspect),0,0,0, 0,2/viewHeight,0,0, 0,0,a,b, 0,0,-blend/depth,1-blend);
}

/** Follow the railway behind the whole train, above its roofline. Keep the
 * horizon upright and damp the gaze; world coordinates avoid anchor jumps. */
export class TrainChaseCameraRig {
  readonly eye=new THREE.Vector3();
  readonly orientation=new THREE.Quaternion();
  private target=new THREE.Vector3();
  private matrix=new THREE.Matrix4();
  private destination=new THREE.Quaternion();
  private initialized=false;
  update(frame:RailFrame,behind:RailFrame,dt:number) {
    this.eye.copy(behind.position);this.eye.y+=8;
    this.target.copy(frame.position).lerp(behind.position,.35).addScaledVector(frame.tangent,4);this.target.y+=1.5;
    this.matrix.lookAt(this.eye,this.target,THREE.Object3D.DEFAULT_UP);
    this.destination.setFromRotationMatrix(this.matrix);
    if(!this.initialized){this.orientation.copy(this.destination);this.initialized=true;}
    else this.orientation.slerp(this.destination,1-Math.exp(-Math.max(0,dt)*14));
    return this;
  }
}
