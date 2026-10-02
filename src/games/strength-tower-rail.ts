import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from 'three';
import type { RailFrame } from './mini-rail';
import { WorldModel, WORLD_SHAPES as G } from './world-models';

// Both ends meet the ordinary railway on its centreline and point forwards.
export const towerEntrance = new CatmullRomCurve3([
  new Vector3(0,0,0),new Vector3(12,0,0),new Vector3(28,-.5,0),
  new Vector3(43,0,-6),new Vector3(50,3,-14),new Vector3(50,8,-14),
]);
export const towerExit = new CatmullRomCurve3([
  new Vector3(50,8,-14),new Vector3(50,3,-14),new Vector3(57,-.5,-5),
  new Vector3(73,0,9),new Vector3(89,0,0),new Vector3(100,0,0),
]);
export function towerFrame(position:Vector3,tangent:Vector3):RailFrame {
  // On the vertical the roofs face +Z, towards the player.
  const up=new Vector3(0,1,0).lerp(new Vector3(0,0,1), Math.max(0,(Math.abs(tangent.y)-.7)/.3));
  up.addScaledVector(tangent,-up.dot(tangent)).normalize();
  const right=tangent.clone().cross(up).normalize();up.crossVectors(right,tangent).normalize();
  return {position,tangent,up,right,rotation:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,tangent.clone().negate())),curvature:new Vector3()};
}
export function towerCurveFrame(curve:CatmullRomCurve3,distance:number) {
  const length=curve.getLength(),t=Math.max(0,Math.min(1,distance/length));
  const tangent=curve.getTangentAt(t),position=curve.getPointAt(t);
  if(distance<0)position.addScaledVector(tangent,distance);
  if(distance>length)position.addScaledVector(tangent,distance-length);
  return towerFrame(position,tangent);
}
/** Carry a previously raised entrance back to the following rail's real height.
 * Zero endpoint derivatives preserve the vertical start and forward exit. */
export function towerExitFrame(distance:number,rise=0) {
  const frame=towerCurveFrame(towerExit,distance);
  if(!rise)return frame;
  const length=towerExit.getLength(),t=Math.max(0,Math.min(1,distance/length));
  const smooth=t*t*t*(10+t*(-15+6*t));
  const derivative=30*t*t*(1-t)*(1-t)/length;
  frame.position.y+=rise*smooth;
  frame.tangent.y+=rise*derivative;
  frame.tangent.normalize();
  return towerFrame(frame.position,frame.tangent);
}
export function towerJunctionModel(exitRise=0) {
  const model=new WorldModel();
  for(const curve of [towerEntrance,towerExit]) {
    const length=curve.getLength(),count=Math.ceil(length/.7);
    const sample=(distance:number)=>curve===towerExit?towerExitFrame(distance,exitRise):towerCurveFrame(curve,distance);
    for(let i=0;i<count;i++){
      const a=sample(i*length/count),b=sample((i+1)*length/count);
      for(const side of [-.57,.57])model.beam('#70e5df',a.position.clone().addScaledVector(a.right,side),b.position.clone().addScaledVector(b.right,side),.095);
      if(i%2===0)model.beam('#c8b395',a.position.clone().addScaledVector(a.right,-.79).addScaledVector(a.up,-.13),a.position.clone().addScaledVector(a.right,.79).addScaledVector(a.up,-.13),.085);
      if(i%9===0){const p=a.position;model.beam('#aebbb3',new Vector3(p.x,-3,p.z),p.clone().add(new Vector3(0,-.25,0)),.13);}
      if(i%4===0){const p=a.position.clone().addScaledVector(a.right,1);model.add(G.round,i%8?'#ed97c6':'#ffc876',p.toArray(),[.14,.14,.14],[],true,i*.25);}
    }
  }
  return model;
}
