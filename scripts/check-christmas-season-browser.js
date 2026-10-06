// Playwright CLI run-code: real runtime selection at the seasonal boundaries.
async page => {
 const base='http://localhost:5198/',errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));
 const cases=[
  ['2026-10-06T12:00:00','?mode=remix',4,'meadow'],
  ['2026-10-06T12:00:00','?mode=remix&world=lapland',4,'meadow'],
  ['2026-10-06T12:00:00','?christmas=1',6,'lapland'],
  ['2026-10-06T12:00:00','?mode=remix&world=lapland&christmas=1',6,'lapland'],
  ['2026-11-15T12:00:00','?mode=remix',6,'lapland'],
  ['2027-01-06T23:59:00','?mode=remix',6,'lapland'],
  ['2027-01-06T23:59:00','?mode=remix&world=winterfair',6,'winterfair'],
  ['2027-01-07T00:01:00','?mode=remix&world=lapland',4,'meadow']
 ];
 for(const [date,query,count,world] of cases){
  await page.clock.setFixedTime(new Date(date));await page.goto(base+query);await page.locator('[data-single]').waitFor();
  await page.evaluate(async()=>{
   const url='/src/games/mini.ts';
   const {Mini}=await import(url),step=Mini.prototype.update;
   Mini.prototype.update=function(dt){window.seasonGame=this;return step.call(this,dt);};
  });
  await page.locator('[data-single]').click();await page.waitForFunction(()=>window.seasonGame?.view);
  const result=await page.evaluate(()=>{
   const g=window.seasonGame;return {worlds:g.track.worlds.length,lap:g.track.worldLap,world:g.adventureHud.element.dataset.world};
  });
  if(result.worlds!==count||result.world!==world)throw Error(JSON.stringify({date,query,result,count,world}));
  report.push({date,query,...result});
 }
 await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));
 for(const enabled of [false,true]){
  await page.goto(base+'tracks.html'+(enabled?'?christmas=1':''));
  await page.waitForSelector('#collection');
  const worlds=await page.locator('#collection option').evaluateAll(options=>options.map(o=>o.value));
  if(worlds.includes('lapland')!==enabled||worlds.includes('winterfair')!==enabled)throw Error('Gallery season '+worlds);
  report.push({gallery:enabled,worlds});
 }
 await page.goto(base+'christmas.html?piece=snowglobe');
 await page.getByRole('link',{name:'Preview Christmas worlds'}).waitFor();
 if(await page.locator('.game-canvas').count())throw Error('Winter demo bypassed seasonal gate');
 await page.getByRole('link',{name:'Preview Christmas worlds'}).click();
 await page.waitForSelector('.game-canvas');
 if(!page.url().includes('christmas=1'))throw Error('Preview lost override');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 const phone=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,keypad:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight+1}));
 if(phone.overflow||!phone.keypad)throw Error('Phone preview '+JSON.stringify(phone));
 await page.screenshot({path:'output/playwright/christmas-season-phone.png'});
 report.push({demo:page.url(),phone});
 if(errors.length)throw Error(errors.join('\n'));
 return {report,errors};
}
