import { Quaternion, Vector3 } from 'three';
import { MINI_CART_SPACING } from './mini-config';
import { StrengthTowerMotion } from './strength-tower-motion';
import { towerCurveFrame, towerEntrance, towerExit, towerExitFrame, towerFrame } from './strength-tower-rail';
import type { MiniTrack, MiniSection } from './mini-track';

/** Bonus state, real carriage frames and a small HUD. Rendering belongs to MiniView. */
export class StrengthTower {
  readonly motion:StrengthTowerMotion;
  readonly root?:HTMLDivElement;
  readonly origin:Vector3;
  readonly trainLength:number;
  private saved=false;
  private best=0;
  private score?:HTMLElement;
  private result?:HTMLElement;
  constructor(stage:HTMLElement,readonly track:MiniTrack,readonly section:MiniSection,speed:number,coaches:number) {
    this.origin=section.sample(section.start).position.clone();
    this.motion=new StrengthTowerMotion(speed,towerEntrance.getLength(),towerExit.getLength());
    this.trainLength=(coaches-1)*MINI_CART_SPACING;
    if(typeof document==='undefined')return;
    this.root=document.createElement('div');
    try{this.best=Number(localStorage.getItem('keep-going-tower-best'))||0;}catch{/* Optional storage. */}
    this.root.className='tower-hud';
    this.root.innerHTML='<div class="tower-height"><span>SKY STRIKER</span><strong>0</strong><small></small></div><div class="tower-result" hidden><span></span><strong></strong><p></p></div>';
    this.score=this.root.querySelector('.tower-height strong')!;this.result=this.root.querySelector('.tower-result')!;
    this.root.querySelector('.tower-height small')!.textContent=this.best?`Best ${this.best.toLocaleString()}`:'How high can you go?';stage.append(this.root);
  }
  get exitDistance(){return this.section.end+this.trainLength;}
  get cameraBlend(){const m=this.motion;return m.phase==='approach'?Math.min(1,m.progress/.8):m.phase==='exit'?1-Math.min(1,Math.max(0,(m.progress-.35)/.65)):m.phase==='done'?0:1;}
  pose(index:number) {
    const m=this.motion,offset=index*MINI_CART_SPACING;
    const descending=m.phase==='descend';
    const height=m.height-(descending?this.trainLength-offset:offset);
    let frame;
    if(m.phase==='exit'||m.phase==='done'||(descending&&height<0)){
      const distance=descending?-height:m.progress*towerExit.getLength()+this.trainLength-offset;
      if(distance>towerExit.getLength())return this.track.sample(this.section.end+distance-towerExit.getLength());
      frame=towerExitFrame(distance,this.section.sample(this.section.end).position.y-this.origin.y);
    } else if(m.phase==='approach'||height<0){
      const distance=m.phase==='approach'?m.progress*towerEntrance.getLength()-offset:towerEntrance.getLength()+height;
      if(distance<0)return this.track.sample(this.section.start+distance);
      frame=towerCurveFrame(towerEntrance,distance);
    }else frame=towerFrame(new Vector3(50,8+height,-14),new Vector3(0,descending?-1:1,0));
    if(m.phase==='celebrate'){
      const t=Math.min(1,Math.max(0,(m.time-.6)/1.9)),angle=(t*t*(3-2*t))*Math.PI;
      const turn=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),angle),pivot=new Vector3(50,8+m.height-this.trainLength/2,-14);
      frame.position.sub(pivot).applyQuaternion(turn).add(pivot);frame.rotation.premultiply(turn);
      frame.tangent.applyQuaternion(turn);frame.up.applyQuaternion(turn);frame.right.applyQuaternion(turn);
    }
    frame.position.add(this.origin);return frame;
  }
  update(dt:number){
    this.motion.update(dt);const m=this.motion;
    if(!this.root||!this.score||!this.result)return;
    this.score.textContent=m.score.toLocaleString();
    if(m.phase==='celebrate'&&!this.saved){
      this.saved=true;const record=m.score>this.best;
      this.result.hidden=false;
      this.result.querySelector('span')!.textContent=record?'NEW TOWER RECORD!':'WHAT A CLIMB!';
      this.result.querySelector('strong')!.textContent=m.score.toLocaleString();
      this.result.querySelector('p')!.textContent=`${m.peak.toFixed(1)} metres`;
      try{if(record)localStorage.setItem('keep-going-tower-best',String(m.score));}catch{/* Optional storage. */}
    }
    if(m.phase==='descend')this.result.hidden=true;
    if(m.phase==='descend'||m.phase==='exit')this.root.querySelector('.tower-height small')!.textContent=m.banked?`Exit boost +${m.banked} m/s`:'Answers boost your exit';
  }
  destroy(){this.root?.remove();}
}
