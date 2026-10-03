// Playwright CLI run-code: compare the same 4K game scenes with/without smoke.
// This uses real game rendering and a synthetic opponent, not network performance.
async page => {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:3840,height:2160});
 await page.goto('http://localhost:5198/?mode=remix&seed=42');
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
  const {Mini}=await import(url),update=Mini.prototype.update,draw=Mini.prototype.draw;
  window.drawGame=draw;
  Mini.prototype.update=function(dt){window.worldGame=this;if(!window.worldHold)return update.call(this,dt)};
  Mini.prototype.draw=function(ctx){if(!window.worldHold)return draw.call(this,ctx)};
  const smokeURL=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/train-smoke.ts')).name;
  const {TrainSmoke}=await import(smokeURL),smokeUpdate=TrainSmoke.prototype.update;
  TrainSmoke.prototype.update=function(...args){if(window.smokePreviewVariant)args[4]=window.smokePreviewVariant;smokeUpdate.apply(this,args);this.group.visible=!window.hideTrainSmoke;};
 });
 await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-single]').click();
 await page.waitForFunction(()=>window.worldGame?.view);
 await page.evaluate(async()=>{
  window.worldHold=true;const g=window.worldGame;g.track.ensure(g.physics.distance,6500);
  window.smokeSections=g.track.sections.slice();
  window.snapshotRide=(await import('/src/multiplayer/ghost.ts')).snapshotRide;
 });
 const results=[];
 const cases=[];
 const kinds=['sheepbank','pondbridge','windmillloop','honeyfactory','pancakemill','mountainpass','tunnel','ravinebridge','penguinplunge','lanternrun','midwayloop','carouselhelix','bigtopjuggle','pumpkinhop','pumpkintunnel','witchhat','silkspindle'];
 for(const race of [false,true])for(const kind of kinds)cases.push({kind,race,smoke:true,variant:'normal'});
 for(const kind of ['honeyfactory','penguinplunge','carouselhelix','silkspindle'])for(const variant of ['normal','confetti'])cases.push({kind,race:true,smoke:variant==='confetti',variant});
 for(const {kind,race,smoke,variant} of cases){
  const result=await page.evaluate(async({kind,race,smoke,variant})=>{
   const g=window.worldGame,s=window.smokeSections.find(s=>s.kind===kind);if(!s)throw Error('Missing '+kind);
   window.hideTrainSmoke=!smoke;window.smokePreviewVariant=variant;
   g.track.sections.splice(0,g.track.sections.length,...window.smokeSections.filter(p=>p.end>s.start-180));
   g.powerups.finish(g.physics,g.carriages);g.powerups.gate={kind:'wind',distance:s.end+2000,id:99};
   g.elapsed=100;g.physics.distance=s.start+s.length*.28;g.physics.previousDistance=g.physics.distance;g.physics.velocity=28;g.physics.flight=undefined;
   g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
   g.view.multiplayer=race;g.opponent=race?{track:g.track,sample:()=>window.snapshotRide(g,1)}:undefined;
   g.view.cameraRig.height=0;
   const ctx=document.querySelector('.game-canvas').getContext('2d');
   const tick=()=>{g.elapsed+=1/60;g.physics.previousDistance=g.physics.distance;g.physics.distance+=28/60;g.carriages.update(1/60,g.physics.distance,28,false);window.drawGame.call(g,ctx)};
   for(let i=0;i<60;i++){g.elapsed+=1/60;g.carriages.update(1/60,g.physics.distance,0,false);window.drawGame.call(g,ctx)}
   const intervals=[],cpu=[];let last;
   for(let i=0;i<95;i++){const t=await new Promise(requestAnimationFrame);if(last&&i>20)intervals.push(t-last);last=t;const begin=performance.now();tick();if(i>20)cpu.push(performance.now()-begin)}
   const summary=a=>{a.sort((x,y)=>x-y);return {p50:+a[Math.floor(a.length*.5)].toFixed(2),p95:+a[Math.floor(a.length*.95)].toFixed(2),max:+a.at(-1).toFixed(2)}};
   return {kind,race,smoke,variant,frames:intervals.length,intervals:summary(intervals),cpu:summary(cpu),over25:intervals.filter(n=>n>25).length,draws:g.view.renderer.info.render.calls,triangles:g.view.renderer.info.render.triangles,buffer:{width:g.view.renderer.domElement.width,height:g.view.renderer.domElement.height}};
  },{kind,race,smoke,variant});results.push(result);
  if(smoke&&((variant==='normal'&&!race)||(variant==='confetti'&&race)))await page.locator('.mini-canvas').screenshot({path:`output/playwright/smoke-game-${kind}-${variant}-${race?'two':'one'}.png`});
 }
 if(errors.length)throw Error(errors.join('\n'));const report={results,errors};await page.evaluate(report=>window.selectionPerformance=report,report);return report;
}
