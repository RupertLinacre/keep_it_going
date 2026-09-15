/** Actual game simulation. Answer timings are explicit design assumptions, not user measurements. */
import { Mini } from '../src/games/mini';
import { adventureAt } from '../src/games/adventure-worlds';
import { seededRandom } from '../src/games/mini-rail';
import type { Host, Difficulty } from '../src/types';
class Headless extends Mini { setup() {} }
const profiles: {name:string;interval:number;difficulty:Difficulty}[]=[
 {name:'Learning',interval:4.8,difficulty:'very-easy'},
 {name:'Practising',interval:3.2,difficulty:'easy'},
 {name:'Fluent',interval:2,difficulty:'normal'},
];
const target=Number(process.argv.find(a=>a.startsWith('--distance='))?.split('=')[1]??4400);
for(const profile of profiles) for(const seed of [1,42,73]) {
 const host:Host={stage:{} as HTMLElement,difficulty:profile.difficulty,panel(){},stats(){},feedback(){},sound(){},finish(){}};
 const game=new Headless(host,seed,{remixMode:true,tables:[2,5,10],questionSeed:17});
 const r=seededRandom(seed^1787),worlds:{name:string;at:number}[]=[];
 let next=profile.interval,last='',peak=0,frames=0;
 while(!game.ended&&game.elapsed<480&&game.travelled<target){
  if(game.elapsed>=next){
   if(r()<.94)for(const d of String(game.a*game.b))game.key(d);
   next=game.elapsed+profile.interval*(.8+r()*.4);
  }
  game.update(1/30);
  const world=adventureAt(game.track.sectionAt(game.physics.distance).start).world.id;
  if(world!==last){worlds.push({name:world,at:Math.round(game.elapsed)});last=world;}
  peak=Math.max(peak,game.physics.velocity);frames=Math.max(frames,game.track.sections.reduce((n,s)=>n+s.frames.length,0));
 }
 console.log(JSON.stringify({profile:profile.name,seed,worlds,seconds:Math.round(game.elapsed),metres:Math.round(game.travelled),answers:game.correct,
  ended:game.ended,cause:game.physics.crashed?'water':game.track.sectionAt(game.physics.distance).kind,peakKmh:Math.round(peak*3.6),frames}));
}
