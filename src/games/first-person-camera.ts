import * as THREE from 'three';
import type { RailFrame } from './mini-rail';
import type { MiniTrack, MiniKind } from './mini-track';
import { attractionRail } from './attraction-kinds';
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

// A long chase boom cannot see through an inversion or fit inside a tunnel.
// Include both the approach and the tail's exit, not just the engine's section.
const confined=new Set<MiniKind>([
 'loop','windmillloop','midwayloop','noninvertingloop','nestedloop','interlockingloops',
 'pretzelknot','cobraroll','diveloop','immelmann','corkscrew','heartline','zerogstall',
 'verticalhill','invertedhill','tophat','tunnel','pumpkintunnel','chimneyhouse',
 'frozenwaterfall','snowglobe',
]);
export function cameraSeatNeed(track:MiniTrack,distance:number,trainLength:number,speed:number) {
  const preview=THREE.MathUtils.clamp(Math.abs(speed)*1.6+18,24,100);
  let need=0;
  for(const s of track.sections){
    if(s.end<distance-trainLength-12||s.start>distance+preview)continue;
    if(!confined.has(attractionRail(s.kind)))continue;
    // Arrive in the seat before the curved rail starts; stay until every coach
    // and the trailing camera position have cleared it.
    if(distance>=s.start)return 1;
    need=Math.max(need,THREE.MathUtils.smoothstep(preview-(s.start-distance),0,preview*.55));
  }
  const f=track.sample(distance),behind=track.sample(Math.max(track.sections[0].start,distance-trainLength-9));
  // Geometry-based protection for tight helices and future element designs.
  need=Math.max(need,
    THREE.MathUtils.smoothstep(Math.abs(f.tangent.y),.78,.94),
    THREE.MathUtils.smoothstep(1-f.up.y,.7,1),
    THREE.MathUtils.smoothstep(1-f.tangent.dot(behind.tangent),.65,1.1));
  return need;
}

/** Open track: above the tail. Tight track: above the engine, using the rail's
 * complete orientation rather than a world-up lookAt that flips at vertical.
 * All coordinates remain in world space, independent of scene rebasing. */
export class TrainChaseCameraRig {
  readonly eye=new THREE.Vector3();
  readonly orientation=new THREE.Quaternion();
  seatBlend=0;
  private target=new THREE.Vector3();
  private matrix=new THREE.Matrix4();
  private destination=new THREE.Quaternion();
  private seatOrientation=new THREE.Quaternion();
  private seatEye=new THREE.Vector3();
  private readonly seatPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.1);
  private initialized=false;
  update(frame:RailFrame,behind:RailFrame,dt:number,need=0,festive=false) {
    this.seatBlend+=(need-this.seatBlend)*(1-Math.exp(-Math.max(0,dt)*(need>this.seatBlend?8:2.2)));
    if(this.seatBlend>.995&&need===1)this.seatBlend=1;
    if(this.seatBlend<.001&&need===0)this.seatBlend=0;
    this.eye.copy(behind.position);this.eye.y+=8;
    this.seatEye.copy(frame.position).addScaledVector(frame.up,festive?3.25:2.65).addScaledVector(frame.tangent,.4);
    this.seatOrientation.copy(frame.rotation).multiply(this.seatPitch);
    if(this.seatBlend===1)this.destination.copy(this.seatOrientation);
    else {
      this.target.copy(frame.position).lerp(behind.position,.35).addScaledVector(frame.tangent,4);this.target.y+=1.5;
      this.matrix.lookAt(this.eye,this.target,THREE.Object3D.DEFAULT_UP);
      this.destination.setFromRotationMatrix(this.matrix).slerp(this.seatOrientation,this.seatBlend);
    }
    this.eye.lerp(this.seatEye,this.seatBlend);
    if(!this.initialized){this.orientation.copy(this.destination);this.initialized=true;}
    else this.orientation.slerp(this.destination,1-Math.exp(-Math.max(0,dt)*THREE.MathUtils.lerp(14,90,this.seatBlend)));
    return this;
  }
}
