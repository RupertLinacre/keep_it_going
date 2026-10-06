import { chimneyShape, chimneyPoint, CHIMNEY } from './chimney-jump';
import { refinedLayout, bankProfile, ChristmasPath, segment } from "./christmas-path";
import * as T from 'three';
import type { ElementShape } from './mini-elements';

export const CHRISTMAS_KINDS = ['startree','snowmanscarf','ribbonreel','snowglobe','chimneyhouse'] as const;
export type ChristmasKind = typeof CHRISTMAS_KINDS[number];
export const isChristmasKind = (kind:string):kind is ChristmasKind => (CHRISTMAS_KINDS as readonly string[]).includes(kind);
const TAU=Math.PI*2;
export interface ChristmasLayout {
  curve:T.CatmullRomCurve3 | ChristmasPath; center:T.Vector3; radius:number; height:number;
  landmarks:T.Vector3[];
}
/** Metre-scale layout shared by the rails and the attraction. Every route has
 * collinear entry/exit controls, and crossings are separated in depth/height. */
export function christmasLayout(kind:ChristmasKind,w:number,h:number,hand:number):ChristmasLayout {
  if(kind==='chimneyhouse'){const curve=new ChristmasPath([segment(t=>chimneyPoint(t,w,h))]);return {curve,center:new T.Vector3(w*.3,0,0),radius:w*.22,height:h,landmarks:[chimneyPoint(CHIMNEY.mouth,w,h)]};}
  if(kind==='startree'||kind==='snowmanscarf'||kind==='snowglobe')return refinedLayout(kind,w,h,hand);
  const p=(x:number,y:number,z:number)=>new T.Vector3(x,y,z*hand);
  const controls:T.Vector3[]=[p(0,0,0),p(w*.035,0,0)];
  const radius=w*.12;
  const center=p(w*.5,0,radius+2),landmarks:T.Vector3[]=[];
  const add=(x:number,y:number,z:number)=>{const v=p(x,y,z);controls.push(v);return v;};
  center.z=hand*10;
  add(w*.16,h*.05,0);add(w*.35,h*.32,3);
  // A continuous, grade-separated figure-eight is the actual giant bow.
  // At each knot crossing the rails are ten metres apart in depth.
  for(let i=0;i<=64;i++){
    const u=i/64,a=TAU*u;
    add(w*.5+w*.23*Math.sin(a),h*(.65+.30*Math.sin(2*a)),6+20*u);
    if(i===16||i===48)landmarks.push(controls.at(-1)!.clone());
  }
  add(w*.68,h*.83,29);add(w*.85,h*.32,30);add(w*.92,h*.015,2);
  controls.push(p(w*.965,0,0),p(w,0,0));
  const curve=new T.CatmullRomCurve3(controls,false,'centripetal');curve.arcLengthDivisions=4096;
  return {curve,center,radius,height:h,landmarks};
}
export function christmasShape(kind:string,w:number,h:number,hand:number):ElementShape|undefined {
  if(!isChristmasKind(kind))return;
  if(kind==='chimneyhouse')return chimneyShape(w,h);
  const {curve}=christmasLayout(kind,w,h,hand);
  const bank=["startree","snowmanscarf","snowglobe"].includes(kind)?bankProfile(curve):undefined;
  return {point:t=>curve.getPointAt(t),up:(t,tangent)=>{
    // Bow lobes have a continuous planar normal through their vertical faces.
    const up=kind==='ribbonreel'?new T.Vector3(-tangent.y,tangent.x,0):new T.Vector3(0,1,0);
    if(up.lengthSq()<.0001)up.set(0,1,0);
    up.addScaledVector(tangent,-up.dot(tangent)).normalize();
    if(bank)up.applyAxisAngle(tangent,bank(t));
    return up;
  }};
}
