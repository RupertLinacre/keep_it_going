import test from 'node:test';
import assert from 'node:assert/strict';
import { AttractionDrive } from '../src/games/attraction-drive';

const ride=(velocity:number,hz=60)=>{
 const drive=new AttractionDrive();
 for(let i=0;i<=hz*3;i++)drive.update(i/hz,10+velocity*i/hz,0,200);
 return drive;
};
test('a moving train spins an attraction faster, with a bounded flywheel speed',()=>{
 const parked=ride(0),slow=ride(12),fast=ride(40),extreme=ride(150);
 assert.ok(slow.angle>parked.angle*3);assert.ok(fast.angle>slow.angle*2);
 assert.ok(extreme.speed<=2.8 && fast.speed>2);
});
test('attractions coast after the train leaves and preserve position through pause',()=>{
 const drive=ride(40),before=drive.angle,speed=drive.speed;
 drive.update(3,130,0,200);assert.equal(drive.angle,before);
 for(let i=1;i<=180;i++)drive.update(3+i/60,500,0,200);
 assert.ok(drive.angle>before);assert.ok(drive.speed<speed*.2);
 const still=drive.angle;drive.update(7,510,0,200,true);assert.equal(drive.angle,still);
});
test('teleports cannot kick an attraction and rotation is stable across frame rates',()=>{
 const drive=new AttractionDrive();drive.update(0,0,0,200);drive.update(1/60,1000,900,1200);
 assert.equal(drive.speed,0);
 assert.ok(Math.abs(ride(30,30).angle-ride(30,120).angle)<.08);
 const other=ride(0);assert.equal(other.speed,0,'The other rider does not inherit the first flywheel');
});

test('mirrored scenery follows each rider and light positions survive render-origin shifts',async()=>{
 const {Scene,Vector3}=await import('three');
 const {AdventureScene}=await import('../src/games/adventure-scene');
 const {MiniTrack}=await import('../src/games/mini-track');
 const track=new MiniTrack(42,{generative:true});track.ensure(0,700);
 const s=track.sections.find(s=>s.kind==='windmillloop')!;
 const world=new Scene(),scene=new AdventureScene(world);
 for(let i=0;i<=120;i++)scene.render(track,s.start+10+i/60*25,0,30,i/60,s.start-50);
 const drives=scene.tiles.get(s.id)!.drives;
 assert.ok(drives[0].speed>1);assert.equal(drives[1].speed,0);
 const lights=(scene as any).luminous;
 const own=lights.trains.value[0].clone(),remote=lights.trains.value[2].clone();
 assert.ok(own.z>0 && remote.z<0);
 scene.render(track,s.start+60,250,30,2,s.start-50);
 assert.ok(lights.trains.value[0].distanceTo(own.sub(new Vector3(250,0,0)))<1e-6);
 assert.ok(lights.trains.value[2].distanceTo(remote.sub(new Vector3(250,0,0)))<1e-6);
 const beforeTilt=lights.trains.value[0].clone();
 world.rotation.z=-.2;world.position.set(2,3,0);world.updateMatrixWorld(true);
 scene.render(track,s.start+60,250,30,2,s.start-50);
 assert.ok(lights.trains.value[0].distanceTo(beforeTilt.applyMatrix4(world.matrixWorld))<1e-6);
 scene.destroy();
});
