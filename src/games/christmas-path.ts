import * as T from 'three';

export type PathPiece={point:(u:number)=>T.Vector3;length:number};
type Jet={p:T.Vector3;t:T.Vector3;k:T.Vector3};
const clamp=T.MathUtils.clamp;
/** Numerical endpoint jets are converted to metre-scale unit tangents and
 * curvature. Connectors therefore meet analytic coils in direction AND bend. */
function jet(piece:PathPiece,u:number):Jet{
  const e=.0001,p=piece.point(u),a=piece.point(u-e),b=piece.point(u+e);
  const velocity=b.clone().sub(a).multiplyScalar(1/(2*e)),speed=velocity.length(),t=velocity.divideScalar(speed);
  const second=b.add(a).addScaledVector(p,-2).multiplyScalar(1/(e*e));
  return{p,t,k:second.addScaledVector(t,-second.dot(t)).divideScalar(speed*speed)};
}
export function segment(point:(u:number)=>T.Vector3):PathPiece{
  let length=0,previous=point(0);for(let i=1;i<=128;i++){const p=point(i/128);length+=p.distanceTo(previous);previous=p;}
  return{point,length};
}
export function straight(a:T.Vector3,b:T.Vector3){return segment(u=>a.clone().lerp(b,u));}
/** Quintic Hermite position, tangent and curvature match both endpoint jets.
 * This avoids the tiny hooked bends produced by uneven Catmull control points. */
export function connect(before:PathPiece,after:PathPiece,reach=1):PathPiece{
  const a=jet(before,1),b=jet(after,0),length=a.p.distanceTo(b.p)*reach;
  const v0=a.t.clone().multiplyScalar(length),v1=b.t.clone().multiplyScalar(length);
  const a0=a.k.clone().multiplyScalar(length*length),a1=b.k.clone().multiplyScalar(length*length);
  const c0=a.p,c1=v0,c2=a0.clone().multiplyScalar(.5);
  const delta=b.p.clone().sub(a.p),c3=delta.clone().multiplyScalar(10).addScaledVector(v0,-6).addScaledVector(v1,-4).addScaledVector(a0,-1.5).addScaledVector(a1,.5);
  const c4=delta.clone().multiplyScalar(-15).addScaledVector(v0,8).addScaledVector(v1,7).addScaledVector(a0,1.5).sub(a1);
  const c5=delta.clone().multiplyScalar(6).addScaledVector(v0,-3).addScaledVector(v1,-3).addScaledVector(a0,-.5).addScaledVector(a1,.5);
  return segment(u=>c0.clone().addScaledVector(c1,u).addScaledVector(c2,u*u).addScaledVector(c3,u**3).addScaledVector(c4,u**4).addScaledVector(c5,u**5));
}
export class ChristmasPath extends T.Curve<T.Vector3>{
  readonly points:T.Vector3[];
  private stops:number[]=[];
  constructor(readonly pieces:PathPiece[]){
    super();this.arcLengthDivisions=8192;const total=pieces.reduce((n,p)=>n+p.length,0);let at=0;
    for(const p of pieces){at+=p.length/total;this.stops.push(at);}
    this.stops[this.stops.length-1]=1;
    this.points=Array.from({length:129},(_,i)=>this.getPoint(i/128));
  }
  override getPoint(t:number,target=new T.Vector3()){
    t=clamp(t,0,1);const index=this.stops.findIndex(s=>t<=s),i=index<0?this.stops.length-1:index,from=i?this.stops[i-1]:0;
    return target.copy(this.pieces[i].point((t-from)/(this.stops[i]-from)));
  }
}
/** Assemble major curves with short analytic flats at both ends. All junctions
 * are C2 in space; bank targets are derived from their signed lateral bend. */
export function assemble(w:number,major:PathPiece[],hand:number){
  const first=straight(new T.Vector3(),new T.Vector3(w*.035,0,0));
  const last=straight(new T.Vector3(w*.965,0,0),new T.Vector3(w,0,0));
  const sources=[first,...major,last],pieces:PathPiece[]=[];
  // Replace a direct straight/arc seam with a short curvature-matched blend.
  // Direction alone is insufficient: an instant bend changes lateral force.
  for(let i=1;i<sources.length;i++)if(sources[i-1].point(1).distanceTo(sources[i].point(0))<=.001){
    const before=sources[i-1],after=sources[i];sources[i-1]=segment(u=>before.point(u*.97));sources[i]=segment(u=>after.point(.03+u*.97));}

  for(let i=0;i<sources.length;i++){if(i&&sources[i-1].point(1).distanceTo(sources[i].point(0))>.001)pieces.push(connect(sources[i-1],sources[i]));pieces.push(sources[i]);}
  // Handedness is applied once, including to the C2 connectors.
  return new ChristmasPath(pieces.map(part=>segment(u=>{const p=part.point(u);p.z*=hand;return p;})));
}
const ease=(u:number)=>u*u*u*(10+u*(-15+6*u));
export function refinedLayout(kind:'startree'|'snowmanscarf'|'snowglobe',w:number,h:number,hand:number){
  const center=new T.Vector3(w*.42,0,kind==='snowglobe'?19:17),radius=kind==='snowglobe'?w*.145:w*.125;
  const x=center.x,z=center.z,TAU=Math.PI*2,landmarks:T.Vector3[]=[];
  let main:PathPiece[]=[];
  if(kind==='startree'){
    const coil=segment(u=>{const r=radius*(1-.44*ease(u)),a=TAU*3*u;return new T.Vector3(x+r*Math.sin(a),2+h*.88*u,z-r*Math.cos(a));});
    main=[coil];for(const u of [.28,.62,.94])landmarks.push(coil.point(u));
  }else if(kind==='snowmanscarf'){
    const coil=segment(u=>{const r=radius*(1-.31*ease(u)),a=TAU*2.125*u;return new T.Vector3(x+r*Math.sin(a),8+(h-8)*u,z-r*Math.cos(a));});
    // Leave the hat in a natural tangent direction, crest away from its brim,
    // and descend outside the snowballs before a low, wide return turn.
    const landing=segment(u=>{const a=-Math.PI/2+Math.PI*u,r=8;return new T.Vector3(w*.77+r*Math.cos(a),0,z+8+r*Math.sin(a));});
    const tunnel=straight(new T.Vector3(x+8.8,0,z+6.6),new T.Vector3(x-8.8,0,z-6.6));
    const exitPoint=tunnel.point(1),returnRadius=16,arcCenter=exitPoint.clone().add(new T.Vector3(returnRadius*.6,0,-returnRadius*.8));
    const from=Math.atan2(.8,-.6),to=3*Math.PI/2;
    const returnArc=segment(u=>{const a=from+(to-from)*u;return new T.Vector3(arcCenter.x+returnRadius*Math.cos(a),0,arcCenter.z+returnRadius*Math.sin(a));});
    main=[coil,landing,tunnel,returnArc];landmarks.push(coil.point(.95),tunnel.point(.5));
  }else{
    center.x=w*.48;const cx=center.x;
    // The outer turn is a gently climbing rim route. A wide descending turn
    // feeds the west gate; the low interior circle leaves through the east.
    const outer=segment(u=>{const a=TAU*.75*u,r=radius+1.5;return new T.Vector3(cx+r*Math.sin(a),6+h*.60*ease(u),z-r*Math.cos(a));});
    const dropRadius=9,outerEnd=outer.point(1);
    const descent=segment(u=>{const a=-Math.PI*1.5*u;return new T.Vector3(outerEnd.x-dropRadius+dropRadius*Math.cos(a),outerEnd.y-(outerEnd.y-3)*ease(u),z+dropRadius*Math.sin(a));});
    const gate=straight(descent.point(1),new T.Vector3(cx-radius*.7,3,z+dropRadius));
    // A broad shallow horseshoe wraps around the village's front square.
    // Quartic sine gives straight, zero-curvature mouths for both portals.
    const inside=segment(u=>new T.Vector3(cx+radius*.7*(2*u-1),3,z+dropRadius+1.4*Math.sin(Math.PI*u)**4));
    const exit=straight(inside.point(1),new T.Vector3(cx+radius+7,3,z+dropRadius));
    main=[outer,descent,gate,inside,exit];landmarks.push(outer.point(.78),gate.point(.85),inside.point(.65));
  }
  const curve=assemble(w,main,hand);center.z*=hand;for(const p of landmarks)p.z*=hand;
  return{curve,center,radius,height:h,landmarks};
}
/** Static design-speed banking follows curvature, eased over several metres.
 * Coils lean into their turn; straights and the tunnel return fully upright. */
export function bankProfile(curve:T.Curve<T.Vector3>){
  const count=768,raw:number[]=[],banks:number[]=[],right=new T.Vector3(),up=new T.Vector3(0,1,0);
  for(let i=0;i<=count;i++){
    const t=i/count,a=curve.getPointAt(Math.max(0,t-.001)),b=curve.getPointAt(t),c=curve.getPointAt(Math.min(1,t+.001));
    const ta=b.clone().sub(a).normalize(),tc=c.clone().sub(b).normalize(),tangent=curve.getTangentAt(t);
    right.crossVectors(tangent,up).normalize();
    const curvature=tc.sub(ta).divideScalar(Math.max(.01,(b.distanceTo(a)+c.distanceTo(b))*.5));
    const roll=Math.atan(curvature.dot(right)*10.5**2/9.81);
    raw.push(clamp(roll,-.82,.82));
  }
  for(let i=0;i<=count;i++){
    let sum=0,weight=0;for(let j=-20;j<=20;j++){const w=21-Math.abs(j);sum+=raw[clamp(i+j,0,count)]*w;weight+=w;}
    banks.push(sum/weight*ease(clamp(i/16,0,1))*ease(clamp((count-i)/16,0,1)));
  }
  return(t:number)=>{const at=clamp(t,0,1)*count,i=Math.floor(at);return T.MathUtils.lerp(banks[i],banks[Math.min(count,i+1)],at-i);};
}

/** The summit rail dives into a rear mouth behind the chalet, descends
 * through the mountain, and emerges forward from its frozen-waterfall grotto. */
export function waterfallLayout(w:number,h:number,hand:number){
 const x=w*.48,z=17,r=17;
 const coil=segment(u=>{const radius=r-5*ease(u),a=Math.PI*5*u;return new T.Vector3(x+radius*Math.sin(a),10+(h-10)*u,z+radius*Math.cos(a));});
 const bore=new T.CubicBezierCurve3(new T.Vector3(x,h,z-12),new T.Vector3(x-6,h-4,z-8),new T.Vector3(x+5.5,5,z+3),new T.Vector3(x+5.5,5,z+18));
 const tunnel=segment(u=>bore.getPoint(u));
 const exitTurn=segment(u=>{const a=Math.PI*.5*u;return new T.Vector3(x+5.5+12*(1-Math.cos(a)),5,z+18+12*Math.sin(a));});
 const curve=assemble(w,[straight(new T.Vector3(w*.16,10,z+r),new T.Vector3(w*.29,10,z+r)),coil,tunnel,exitTurn],hand);
 const entrance=bore.getPoint(0),exit=bore.getPoint(1);entrance.z*=hand;exit.z*=hand;
 return{curve,center:new T.Vector3(x,0,z*hand),radius:r,height:h,entrance,exit,landmarks:[coil.point(.3),coil.point(.7),bore.getPoint(.99)].map(p=>{p.z*=hand;return p;})};
}
