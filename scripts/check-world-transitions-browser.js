// Continuous natural simulation; includes world construction and transition frames.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href);
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'?mode=remix&seed=42');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
  const {Mini}=await import(url),update=Mini.prototype.update;
  window.tourFrames=[];window.tourNext=1.6;window.tourDone=false;let last;
  Mini.prototype.update=function(dt){
   window.tourGame=this;
   if(this.elapsed>=window.tourNext&&!this.ended){for(const d of String(this.a*this.b))this.key(d);window.tourNext=this.elapsed+1.6}
   return update.call(this,dt);
  };
  function frame(now){
   const g=window.tourGame;if(last&&g&&!g.ended)window.tourFrames.push({ms:now-last,world:document.querySelector('.world-hud')?.dataset.world,time:g.elapsed});last=now;
   if(!window.tourDone)requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
 });
 await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-single]').click();
 await page.waitForTimeout(125000);
 const report=await page.evaluate(()=>{
  window.tourDone=true;const g=window.tourGame,groups={};
  for(const row of window.tourFrames){(groups[row.world]??=[]).push(row.ms)}
  const worlds=Object.entries(groups).map(([world,a])=>{a.sort((a,b)=>a-b);return{world,frames:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1),over50:a.filter(ms=>ms>50).length}});
  return{worlds,seconds:g.elapsed,distance:g.travelled,answers:g.correct,ended:g.ended,geometries:g.view.renderer.info.memory.geometries,tiles:g.view.adventureScene.tiles.size};
 });
 if(errors.length||report.ended||report.worlds.length<4)throw Error(JSON.stringify({report,errors}));
 await page.screenshot({path:'output/playwright/adventure-continuous-ride.png'});
 return{...report,errors};
}
