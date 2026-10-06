import test from 'node:test';
import assert from 'node:assert/strict';
import { isChristmasSeason,christmasEnabled } from '../src/games/christmas-season';
import { adventureAt,BASE_WORLDS,CHRISTMAS_WORLDS,WORLDS } from '../src/games/adventure-worlds';
import { MiniTrack } from '../src/games/mini-track';
import { Mini } from '../src/games/mini';
import { christmasTrainAt } from '../src/games/christmas-sleigh';
import { OpponentGhost } from '../src/multiplayer/ghost';
import { parseWire } from '../src/multiplayer/protocol';
import type { Host } from '../src/types';

const local=(year:number,month:number,day:number,hour=0)=>new Date(year,month-1,day,hour,59,59);
const host:Host={difficulty:'normal',stage:{} as HTMLElement,panel(){},stats(){},feedback(){},sound(){},finish(){}};
class Headless extends Mini { setup() {} }

test('the annual Christmas season includes 15 November through the whole of 6 January',()=>{
 for(const [date,expected] of [
  [local(2026,11,14,23),false],[local(2026,11,15),true],
  [local(2026,12,31,23),true],[local(2027,1,1),true],
  [local(2027,1,6,23),true],[local(2027,1,7),false],
  [local(2027,7,1),false],[local(2027,11,14,23),false],
  [local(2027,11,15),true],[local(2028,1,6),true],
 ] as const)assert.equal(isChristmasSeason(date),expected,date.toString());
});

test('only the explicit christmas=1 parameter enables early access',()=>{
 const october=local(2026,10,6);
 for(const search of ['', '?world=lapland','?piece=chimneyhouse','?christmas=0','?christmas=true'])assert.equal(christmasEnabled(search,october),false,search);
 assert.equal(christmasEnabled('?christmas=1',october),true);
 assert.equal(christmasEnabled('?mode=remix&christmas=1&world=lapland',october),true);
 assert.equal(christmasEnabled('',local(2026,11,15)),true);
 assert.equal(christmasEnabled('',local(2027,1,7)),false);
});

test('disabled winter start and piece URLs cannot insert Christmas attractions',()=>{
 const normal=new MiniTrack(42,{generative:true,christmas:false});
 for(const startWorld of ['lapland','winterfair'] as const){
  const t=new MiniTrack(42,{generative:true,christmas:false,startWorld});assert.equal(t.startDistance,normal.startDistance);
 }
 for(const previewPiece of ['chimneyhouse','frozenwaterfall','sledswitchbacks'] as const){
  const t=new MiniTrack(42,{generative:true,christmas:false,previewPiece});assert.equal(t.startDistance,normal.startDistance);
  assert.ok(t.sections.every(s=>s.kind!==previewPiece));
 }
});

test('ordinary rides repeat four worlds, put the tower after 4200m, and never generate winter pieces',()=>{
 const winterKinds=new Set(WORLDS.slice(4).flatMap(w=>w.pieces));
 for(const seed of [1,42,71]){
  const t=new MiniTrack(seed,{generative:true,christmas:false});t.ensure(0,14500);
  assert.deepEqual(t.worlds,BASE_WORLDS);assert.equal(t.worldLap,4200);
  assert.ok(t.sections.every(s=>!winterKinds.has(s.kind)));
  const towers=t.sections.filter(s=>s.kind==='strengthtower');
  assert.ok(towers.length>=3);assert.ok(towers[0].start>=4200&&towers[0].start<4450);
  assert.equal(adventureAt(4200,t.worlds).world.id,'meadow');
  assert.equal(adventureAt(6100,t.worlds).world.id,'night');
  assert.equal(christmasTrainAt(t,4350),false);
 }
});

test('Christmas rides start with both winter worlds and retain the 6600m adventure finale',()=>{
 const t=new MiniTrack(42,{generative:true,christmas:true});t.ensure(0,7300);
 assert.equal(t.worldLap,6600);assert.equal(t.worlds.length,6);
 assert.ok(t.sections.some(s=>s.kind==='frozenwaterfall'));
 assert.ok(t.sections.some(s=>s.kind==='sledswitchbacks'));
 assert.ok(t.sections.find(s=>s.kind==='strengthtower')!.start>=6600);
 assert.deepEqual(t.worlds.map(w=>w.id),['lapland','winterfair','meadow','mountain','night','halloween']);
 assert.deepEqual(t.worlds.map(w=>[w.start,w.end]),[[0,1200],[1200,2400],[2400,3300],[3300,4300],[4300,5400],[5400,6600]]);
 assert.equal(adventureAt(0,t.worlds).world.id,'lapland');
 assert.equal(adventureAt(1200,t.worlds).world.id,'winterfair');
 assert.equal(adventureAt(2400,t.worlds).world.id,'meadow');
 assert.equal(christmasTrainAt(t,t.startDistance),true);
 assert.equal(christmasTrainAt(t,1500),true);
 assert.equal(christmasTrainAt(t,3000),false);
 assert.equal(adventureAt(6600,t.worlds).world.id,'lapland');
 for(const world of CHRISTMAS_WORLDS){
  const original=WORLDS.find(w=>w.id===world.id)!;
  assert.equal(world.end-world.start,original.end-original.start);
 }
 assert.equal(WORLDS[0].id,'meadow','the design catalogue remains unchanged');
});

test('a host-pinned course ignores the guest URL and opponent prediction uses the same selection',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?christmas=1'}});
 try{
  for(const enabled of [false,true]){
   const a=new Headless(host,42,{remixMode:true,multiplayer:true,christmas:enabled});
   const ghost=new OpponentGhost(a.track),b=ghost.track!;
   assert.equal(a.track.worlds.length,enabled?6:4);assert.equal(b.worldLap,a.track.worldLap);
   assert.notEqual(b,a.track);
   a.track.ensure(0,7300);b.ensure(0,7300);
   assert.deepEqual(b.sections.map(s=>[s.kind,s.start,s.end]),a.track.sections.map(s=>[s.kind,s.start,s.end]));
  }
 }finally{if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else delete (globalThis as any).location;}
});

test('network rounds require a boolean seasonal selection rather than trusting each device clock',()=>{
 const round={id:'season',seed:42,questionSeed:7,tables:[2],difficulty:'normal',guestDifficulty:'easy',mode:'remix'};
 for(const christmas of [true,false])assert.ok(parseWire({kind:'prepare',round:{...round,christmas}}));
 for(const christmas of [undefined,'true',1,null])assert.equal(parseWire({kind:'prepare',round:{...round,christmas}}),undefined);
});
