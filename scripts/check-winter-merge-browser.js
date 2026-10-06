// Playwright CLI run-code: merged production pieces, route traversal and phone UI.
async page => {
 const base=new URL('/',page.url()).href,errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['frozenwaterfall','sledswitchbacks','chimneyhouse']){
  await page.setViewportSize({width:1440,height:960});
  await page.goto(base+'christmas.html?christmas=1&piece='+kind);
  await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
   window.mergeStep=step;Mini.prototype.update=function(dt){window.mergeGame=this;if(!window.mergeHold)return step.call(this,dt);};
  });
  await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.mergeGame?.view);
  const info=await page.evaluate(kind=>{
   const g=window.mergeGame;window.mergeHold=true;g.powerups.update=()=>{};g.powerups.gate=undefined;
   window.mergeSection=g.track.sections.find(s=>s.kind===kind);window.mergeNext=g.elapsed;
   return {kind:g.track.sections.find(s=>s.id===0).kind,start:g.track.startDistance};
  },kind);
  for(const fraction of [.15,.44,.76,1.01]){
   const state=await page.evaluate(async fraction=>{
    const g=window.mergeGame,s=window.mergeSection;let steps=0;
    while((g.physics.distance<s.start+s.length*fraction||(fraction>1&&g.physics.flight))&&!g.ended&&steps++<20000){
     if(g.elapsed>=window.mergeNext){for(const d of String(g.a*g.b))g.key(d);window.mergeNext=g.elapsed+1.8;}
     window.mergeStep.call(g,1/60);
    }
    const ctx=document.querySelector('.game-canvas').getContext('2d');
    for(let i=0;i<40;i++){g.draw(ctx);await new Promise(requestAnimationFrame);}
    const phases=[...g.view.adventureScene.tiles.values()].map(t=>t.animations[0]?.group.userData.penguinPhases).filter(Boolean);
    if(g.ended||steps>=20000)throw Error('Failed merged '+s.kind+' traversal');
    return {fraction,ended:g.ended,answers:g.correct,jumps:g.physics.jumps,phases,finite:g.view.camera.position.toArray().every(Number.isFinite)};
   },fraction);
   report.push({kind,...state});await page.screenshot({path:'output/playwright/winter-worktree-merge/'+kind+'-'+fraction+'.png'});
   if(fraction===.44){
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
    const phone=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,keys:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight+1}));
    if(phone.overflow||!phone.keys)throw Error('Phone layout '+JSON.stringify(phone));
    report.push({kind,phone});await page.screenshot({path:'output/playwright/winter-worktree-merge/'+kind+'-phone.png'});
    await page.setViewportSize({width:1440,height:960});
   }
  }
  report.push(info);
 }
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
