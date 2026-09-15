/** Compare matched seeded games. Timings are balancing assumptions, not measured
 * player performance. The baseline changes only resistance, including during powers. */
import { Mini } from '../src/games/mini';
import { seededRandom } from '../src/games/mini-rail';
import { railAcceleration } from '../src/games/mini-physics';
import { rollingResistance } from '../src/games/ride-resistance';
import type { Host, Difficulty } from '../src/types';
class Headless extends Mini { setup() {} }
const profiles: {name:string;interval:number;difficulty:Difficulty}[] = [
  {name:'Learning',interval:4.8,difficulty:'very-easy'},
  {name:'Practising',interval:3.2,difficulty:'easy'},
  {name:'Fluent',interval:2,difficulty:'normal'},
  {name:'Slow answers on Medium',interval:4.8,difficulty:'normal'},
  {name:'Long pauses on Medium',interval:7,difficulty:'normal'},
];
for (const profile of profiles) for (const seed of [1,42,73]) {
  const runs = [];
  for (const baseline of [true,false]) {
    const host:Host={stage:{} as HTMLElement,difficulty:profile.difficulty,panel(){},stats(){},feedback(){},sound(){},finish(){}};
    const game=new Headless(host,seed,{remixMode:true,tables:[2,5,10],questionSeed:17});
    if (baseline) {
      // A harness-only override restores the old on-rail resistance. Everything
      // else (track, power sequence, answers, jumps and scenery) remains shared.
      Object.assign(game.physics,{force:(s:number,v:number)=>{
        const o=game.physics.options;
        return railAcceleration(game.track,s,v,o)+rollingResistance(v,o.rolling)
          - o.drag*v*v - o.rolling*(.06/.86)*Math.tanh(v*5);
      }});
    }
    const r=seededRandom(seed^1787);
    let next=profile.interval,low=0;
    while(!game.ended&&game.elapsed<180) {
      if(game.elapsed>=next) {
        if(r()<.94)for(const digit of String(game.a*game.b))game.key(digit);
        next=game.elapsed+profile.interval*(.8+r()*.4);
      }
      game.update(1/30);
      if(game.physics.velocity<8)low+=1/30;
    }
    runs.push({model:baseline?'previous':'adaptive',seconds:Math.round(game.elapsed),metres:Math.round(game.travelled),answers:game.correct,
      peakKmh:Math.round(game.physics.peakSpeed*3.6),lowSpeedSeconds:Math.round(low),ended:game.ended,
      cause:game.ended?(game.physics.crashed?'water':'stopped'):'time limit'});
  }
  console.log(JSON.stringify({profile:profile.name,seed,runs}));
}
