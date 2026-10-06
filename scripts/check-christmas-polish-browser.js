// Real physics and answers, screenshots at multiple parts of every route.
async page => {
 const kinds=['startree','snowmanscarf','snowglobe'],errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const kind of kinds){
  await page.setViewportSize({width:1440,height:960});await page.goto('http://localhost:5198/christmas.html?christmas=1&piece='+kind);
  await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
   window.christmasStep=step;Mini.prototype.update=function(dt){window.christmasGame=this;if(window.christmasHold)return;return step.call(this,dt);};
  });
  await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.christmasGame?.view);
  await page.evaluate(kind=>{window.christmasHold=true;const g=window.christmasGame;g.powerups.update=()=>{};g.powerups.gate=undefined;window.christmasSection=g.track.sections.find(s=>s.kind===kind);window.christmasNext=g.elapsed;},kind);
  for(const fraction of [.22,.52,.85,1]){
   const result=await page.evaluate(async fraction=>{
    const g=window.christmasGame,s=window.christmasSection;let frames=0;
    while(g.physics.distance<s.start+s.length*fraction&&!g.ended&&frames++<18000){if(g.elapsed>=window.christmasNext){for(const d of String(g.a*g.b))g.key(d);window.christmasNext=g.elapsed+1.8;}window.christmasStep.call(g,1/60);}
    for(let i=0;i<45;i++){g.draw(document.querySelector('.game-canvas').getContext('2d'));await new Promise(requestAnimationFrame);}
    return {fraction,ended:g.ended,distance:g.physics.distance,answers:g.correct,speed:g.physics.velocity,world:document.querySelector('.world-hud').dataset.world};
   },fraction);if(result.ended)throw Error(kind+' failed route '+JSON.stringify(result));report.push({kind,...result});
   if(fraction===.52){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:'output/playwright/christmas-polish/round-5-mobile-'+kind+'.png'});await page.setViewportSize({width:1440,height:960});await page.waitForTimeout(500);}
   if(fraction!==1)await page.screenshot({path:'output/playwright/christmas-polish/round-4-'+kind+'-'+Math.round(fraction*100)+'.png'});
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
  const overflow=await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight+1,keys:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight+1}));
  if(overflow.horizontal||overflow.vertical||!overflow.keys)throw Error('Phone overflow '+kind+' '+JSON.stringify(overflow));
  await page.screenshot({path:'output/playwright/christmas-polish/round-5-phone-'+kind+'.png'});
  // Preview the three spatial power effects on the actual piece at its exit;
  // distance never jumps, the normal controller supplies all transformations.
  for(const power of ['reverse','lift','tilt']){
   const result=await page.evaluate(async power=>{
    const g=window.christmasGame;
    if(power==='lift'){g.track.raise(g.physics.distance);g.track.advance(.5);}
    else {g.powerups.active=power;g.powerups.age=3;g.powerups.remaining=17;}
    for(let i=0;i<30;i++){g.elapsed+=1/60;g.draw(document.querySelector('.game-canvas').getContext('2d'));await new Promise(requestAnimationFrame);}
    return {power,zoom:g.view.cameraRig.height,finite:g.view.camera.position.toArray().every(Number.isFinite)};
   },power);if(!result.finite)throw Error('Non-finite power camera '+kind);report.push({kind,...result});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));const result={report,errors};await page.evaluate(result=>window.christmasCheck=result,result);return result;
}
