import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {MiniSection} from '../src/games/mini-track';
import {carouselCenter,carouselRotation} from '../src/games/world-night';
import {mountainCablePoint,MOUNTAIN_CABLE_LENGTH,tunnelCableTravel,mountainGondolaPosition} from '../src/games/mountain-gondolas';
import {SHEEP_STOPS,trackSheepPose} from '../src/games/world-meadow';
import {PortalImpact,portalHitDistance,portalPumpkin,PORTAL_PUMPKINS} from '../src/games/pumpkin-portal';

test('carousel motion has the exact angular position and speed of either-handed train',()=>{
 for(const hand of [-1,1]){
  const s=new MiniSection(1,'carouselhelix',0,new Vector3(80,4,2),62,24,0,hand,2),c=carouselCenter(s);
  let previous:number|undefined,total=0;
  for(let i=Math.ceil(s.resolution*.12);i<s.resolution*.76;i++){
   const at=s.start+s.distances[i],p=s.sample(at).position;
   const a=carouselRotation(s,at),direction=new Vector3(Math.sin(a),0,Math.cos(a));
   const train=new Vector3(p.x-s.origin.x-c.x,0,p.z-s.origin.z-c.z).normalize();
   assert.ok(direction.distanceTo(train)<1e-8);
   if(previous!==undefined){const change=Math.atan2(Math.sin(a-previous),Math.cos(a-previous));assert.ok(change*hand<0);total+=change}
   previous=a;
  }
  assert.ok(Math.abs(total)>Math.PI*3);
  assert.equal(carouselRotation(s,s.start-50),carouselRotation(s,s.start));
  assert.equal(carouselRotation(s,s.end+50),carouselRotation(s,s.end));
 }
});
test('every sheep is clear before the engine arrives and stays aside for the entire train',()=>{
 const s=new MiniSection(1,'sheepbank',0,new Vector3(0,4,0),74,8,0,1);
 for(const [i,t]of SHEEP_STOPS.entries()){
  const at=s.start+s.length*t,phase=i*.83+.4,f=s.sample(at);
  const idle=trackSheepPose(s,at,at-50,phase,0);assert.equal(idle.escape,0);
  for(let gap=8;gap>-50;gap-=.25){
   const pose=trackSheepPose(s,at,at-gap,phase,1);
   assert.ok(Math.abs(pose.position.clone().sub(f.position).dot(f.right))>5,'The ten-coach train always has clearance');
   assert.equal(pose.escape,1);
  }
  const a=trackSheepPose(s,at,at-16,phase,1),b=trackSheepPose(s,at,at-16,phase,1);
  assert.deepEqual(a,b,'Pause holds the leap');
 }
});
test('a pumpkin stack bursts once per passing train, resets for gallery replay and ignores old scenery',()=>{
 const s=new MiniSection(1,'pumpkintunnel',3000,new Vector3(0,4,0),52,1.1,0,1),hit=portalHitDistance(s);
 const own=new PortalImpact(),remote=new PortalImpact();
 own.update(0,hit-10,hit);remote.update(0,hit-10,hit);
 own.update(.1,hit+2,hit);remote.update(.1,hit-8,hit);
 assert.equal(own.hits,1);assert.ok(own.age>=0);assert.equal(remote.age,-1);
 const age=own.age;own.update(.1,hit+2,hit);assert.equal(own.age,age);
 for(let i=1;i<60;i++)own.update(.1+i/60,hit+2+i,hit);
 assert.equal(own.hits,1);
 own.update(2,hit-20,hit);assert.equal(own.age,-1);own.update(2.1,hit+1,hit);assert.equal(own.hits,2);
 const old=new PortalImpact();old.update(10,hit+40,hit);assert.equal(old.hits,0);assert.equal(old.age,6);
 remote.update(1,hit+1,hit,true);assert.equal(remote.age,6,'Reduced motion clears the stack without a flash');
});
test('pumpkins scatter across both sides of the track, stay bounded, fall and fade',()=>{
 const s=new MiniSection(1,'pumpkintunnel',0,new Vector3(0,4,0),52,1.1,0,1);
 let left=0,right=0;
 for(let i=0;i<PORTAL_PUMPKINS;i++){
  const before=portalPumpkin(s,i,-1),flying=portalPumpkin(s,i,.8),landed=portalPumpkin(s,i,4),gone=portalPumpkin(s,i,6);
  assert.ok(flying.position.y>before.position.y);assert.ok(flying.position.distanceTo(before.position)<20);
  if(flying.position.z>before.position.z)left++;else right++;
  assert.ok(landed.position.y<.3);assert.equal(gone.size,0);
  assert.ok(portalPumpkin(s,i,1,-19.62).position.y>flying.position.y,'Released pumpkins obey reversed gravity');
 }
 assert.ok(left>4&&right>4);
});
test('the mountain cable is continuous and moves one metre per train metre inside the tunnel',()=>{
 const s=new MiniSection(1,'tunnel',1000,new Vector3(0,4,0),52,1.1,0,1),mid=s.start+s.length/2;
 assert.equal(tunnelCableTravel(s,mid-30),0);assert.equal(tunnelCableTravel(s,mid+30),28);
 assert.equal(tunnelCableTravel(s,mid+1)-tunnelCableTravel(s,mid),1);
 for(let d=0;d<MOUNTAIN_CABLE_LENGTH;d+=.1){
  const step=mountainCablePoint(d).distanceTo(mountainCablePoint(d+.001));
  assert.ok(Math.abs(step-.001)<1e-7,'No jumps or speed changes at station turnarounds');
 }
 for(const phase of [0,.2,.5,.8]){
  assert.ok(Math.abs(mountainGondolaPosition(s,mid,phase).distanceTo(mountainGondolaPosition(s,mid+.001,phase))-.001)<1e-7);
 }
});
