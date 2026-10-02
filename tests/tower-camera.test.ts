import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { towerFraming } from '../src/games/mini-camera.ts';
import { StrengthTower } from '../src/games/strength-tower.ts';
import { MiniTrack } from '../src/games/mini-track.ts';

test('tower framing gradually widens at higher scores but keeps even an unlimited climb readable', () => {
  const head=new Vector3(50,100,-14),tail=new Vector3(50,88,-14);
  for(const compact of [false,true]) {
    const views=[0,50,150,500,1e6].map(peak=>towerFraming(head,tail,12,peak,compact));
    for(let i=1;i<views.length;i++) assert.ok(views[i].height>views[i-1].height);
    assert.ok(views[1].height-views[0].height<7,'early widening is gradual');
    assert.ok(views.at(-1)!.height<views[0].height*2,'an endless tower must not shrink the train to a dot');
  }
});

test('camera target follows the whole train continuously through climb, turnaround and descent', () => {
  const track=new MiniTrack(42,{generative:true,towerDemo:true});
  const section=track.sections.find(s=>s.kind==='strengthtower')!;
  const tower=new StrengthTower({} as HTMLElement,track,section,26,10);
  let previous:Vector3|undefined,maxStep=0;
  const phases=new Set<string>();
  for(let i=0;i<60*35 && tower.motion.phase!=='done';i++) {
    tower.update(1/60);phases.add(tower.motion.phase);
    const frame=towerFraming(tower.pose(0).position,tower.pose(9).position,tower.trainLength,tower.motion.peak,false);
    if(previous)maxStep=Math.max(maxStep,frame.focus.distanceTo(previous));
    previous=frame.focus;
  }
  assert.ok(phases.has('celebrate')&&phases.has('descend')&&phases.has('exit'));
  assert.ok(maxStep<1,`no phase transition jumps the camera target: ${maxStep}m/frame`);
});
