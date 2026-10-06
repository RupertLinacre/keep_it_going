import * as T from 'three';
import type { MiniSection } from './mini-track';

export const PENGUIN_SCALE=1.95;
export const TOW_GAPS=[7,13,19] as const;
export const RACE_SECONDS=[4.8,4.4,4.6] as const;
export type PenguinPhase='waiting'|'towing'|'racing'|'landed';
const UP=new T.Vector3(0,1,0);

/** Immutable route snapshot: scenery follows its parent when Sky lift raises
 * the section, so animated riders must not apply that lift a second time. */
export function penguinRoutes(section:MiniSection) {
  const positions=section.frames.map(f=>new T.Vector3(f.position.x-section.origin.x,f.position.y,f.position.z-section.origin.z));
  const distances=[...section.distances],summit=distances[Math.round(section.resolution*2/9)];
  const rail=(distance:number)=>{
    let a=0,b=distances.length-1;
    if(distance<0)return {position:positions[0].clone().addScaledVector(new T.Vector3(1,0,0),distance),tangent:new T.Vector3(1,0,0)};
    while(b-a>1){const i=(a+b)>>1;if(distances[i]<=distance)a=i;else b=i;}
    const mix=T.MathUtils.clamp((distance-distances[a])/Math.max(.001,distances[b]-distances[a]),0,1);
    return {position:positions[a].clone().lerp(positions[b],mix),tangent:positions[b].clone().sub(positions[a]).normalize()};
  };
  const tow=(distance:number)=>{
    const f=rail(Math.min(distance,summit)),right=f.tangent.clone().cross(UP).normalize();
    return {position:f.position.addScaledVector(right,5.8*section.hand),tangent:f.tangent};
  };
  const start=tow(summit).position,w=section.width,h=section.amplitude,hand=section.hand;
  const p=(x:number,y:number,z:number)=>new T.Vector3(x*w,y,z*w*hand);
  const paths:T.CurvePath<T.Vector3>[]=[];
  const add=(nodes:T.Vector3[][])=>{
    for(let i=1;i<nodes.length;i++) {
      const before=nodes[i-1],after=nodes[i],join=after[0];
      const direction=join.clone().sub(before[2]).normalize();
      const reach=Math.min(join.distanceTo(before[2]),join.distanceTo(after[1]));
      after[1]=join.clone().addScaledVector(direction,reach);
    }
    const path=new T.CurvePath<T.Vector3>();for(const n of nodes)path.add(new T.CubicBezierCurve3(n[0],n[1],n[2],n[3]));
    path.getLength();paths.push(path);
  };
  const r=p(.46,h*.55,-.13),r2=p(.29,h*.11,.11),r3=p(.25,.35,.31);
  add([[start,start.clone().add(new T.Vector3(4,0,0)),p(.63,h*.65,-.18),r],
    [r,p(.36,h*.36,-.08),p(.28,h*.19,.025),r2],
    [r2,p(.30,h*.045,.19),p(.28,.35,.27),r3]]);
  const c=p(.66,h*.40,-.08),c2=p(.52,h*.045,.13),c3=p(.65,.35,.31);
  add([[start,start.clone().add(new T.Vector3(4,0,0)),p(.73,h*.55,-.12),c],
    [c,p(.56,h*.08,.0),p(.52,h*.05,.075),c2],
    [c2,p(.55,1.1,.19),p(.64,.35,.27),c3]]);
  const g=p(.56,h*.32,-.04),g2=p(.44,h*.055,.13),g3=p(.48,.35,.32);
  add([[start,start.clone().add(new T.Vector3(4,0,0)),p(.65,h*.54,-.14),g],
    [g,p(.52,h*.16,.005),p(.45,h*.09,.075),g2],
    [g2,p(.41,1.6,.19),p(.44,.35,.28),g3]]);
  return {rail,tow,summit,paths};
}

/** A train-distance crossing launches each rider once. Interpolated release
 * times preserve the same race at different frame rates, on pause and replay. */
export class PenguinHaul {
  private previousTime=NaN;
  private previousDistance=-Infinity;
  readonly released:number[]=[];
  constructor(readonly releaseDistance:number) {}
  update(time:number,distance:number) {
    if(time<this.previousTime||distance<this.previousDistance-.25)this.released.length=0;
    for(let i=0;i<3;i++) {
      const stop=this.releaseDistance+TOW_GAPS[i];
      if(distance>=stop&&!Number.isFinite(this.released[i])) {
        const dt=Number.isFinite(this.previousTime)?Math.min(.25,Math.max(0,time-this.previousTime)):0;
        const mix=Number.isFinite(this.previousDistance)?T.MathUtils.clamp((stop-this.previousDistance)/Math.max(.001,distance-this.previousDistance),0,1):1;
        this.released[i]=time-dt*(1-mix);
      }
    }
    this.previousTime=time;this.previousDistance=distance;
  }
  sample(index:number,time:number,distance:number,reduced=false) {
    const released=this.released[index],age=time-released;
    if(!Number.isFinite(released))return {phase:(distance<0?'waiting':'towing') as PenguinPhase,progress:0,age:0};
    const t=reduced?1:T.MathUtils.clamp(age/RACE_SECONDS[index],0,1);
    return {phase:(t>=1?'landed':'racing') as PenguinPhase,progress:t*t*(3-2*t),age:Math.max(0,age)};
  }
}
