// Playwright CLI run-code: actual arithmetic, carriage physics and renderer.
async page => {
 const errors=[],base=new URL("/",page.url()).href;page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:960});
 await page.goto(base+'christmas.html?piece=frozenwaterfall');
 await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
  window.waterfallStep=step;Mini.prototype.update=function(dt){window.waterfallGame=this;if(window.waterfallHold)return;return step.call(this,dt);};
 });
 await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.waterfallGame?.view);
 await page.evaluate(()=>{window.waterfallHold=true;const g=window.waterfallGame;g.powerups.update=()=>{};g.powerups.gate=undefined;window.waterfallSection=g.track.sections.find(s=>s.kind==='frozenwaterfall');window.waterfallNext=g.elapsed;
 window.waterfallAdvance=async fraction=>{const g=window.waterfallGame,s=window.waterfallSection;let frames=0;
 while(g.physics.distance<s.start+s.length*fraction&&!g.ended&&frames++<20000){if(g.elapsed>=window.waterfallNext){for(const d of String(g.a*g.b))g.key(d);window.waterfallNext=g.elapsed+1.8;}window.waterfallStep.call(g,1/60);}
 for(let i=0;i<30;i++){g.draw(document.querySelector('.game-canvas').getContext('2d'));await new Promise(requestAnimationFrame);}
 if(g.ended||frames>=20000)throw Error('Failed traversal');return{fraction,distance:g.physics.distance,speed:g.physics.velocity,answers:g.correct,finite:g.view.camera.position.toArray().every(Number.isFinite)};};
 });
 const result=await page.evaluate(()=>window.waterfallAdvance(.22));
 await page.screenshot({path:'output/playwright/frozen-waterfall/round-07-game-climb.png'});
 const report=[result];
 for(const fraction of [.53,.88,1.04]){report.push(await page.evaluate(f=>window.waterfallAdvance(f),fraction));await page.screenshot({path:`output/playwright/frozen-waterfall/validation-${fraction}.png`});}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
 const phone=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,keys:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight}));
 if(phone.overflow||!phone.keys)throw Error('Phone layout failed');
 if(errors.length)throw Error(errors.join('\n'));return {report,phone,errors};
}
