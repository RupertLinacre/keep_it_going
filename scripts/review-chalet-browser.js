async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:960});
 await page.goto('http://localhost:5198/christmas.html?piece=chimneyhouse&christmas=1');
 await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
  window.chimneyStep=step;Mini.prototype.update=function(dt){window.chimneyGame=this;if(window.chimneyHold)return;return step.call(this,dt);};
 });
 await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.chimneyGame?.view);
 await page.evaluate(()=>{
  window.chimneyHold=true;const g=window.chimneyGame;g.powerups.update=()=>{};g.powerups.gate=undefined;
  const s=g.track.sections.find(s=>s.kind==='chimneyhouse');window.chimneySection=s;
  g.physics.relocate(s.start-8,30);g.view.cameraRig.reset?.();
 });
 const states=[];
 for(const stage of ['approach','inside','launch','peak','landing']){
  const result=await page.evaluate(async stage=>{
   const g=window.chimneyGame,s=window.chimneySection;
   if(stage==='inside')for(let i=0;i<2400&&!g.physics.chimneyPause&&!g.ended;i++){window.chimneyStep.call(g,1/120);g.draw(document.querySelector('.game-canvas').getContext('2d'));}
   if(stage==='launch'){for(let i=0;i<2400&&!g.physics.flight&&!g.ended;i++){window.chimneyStep.call(g,1/120);g.draw(document.querySelector('.game-canvas').getContext('2d'));}for(let i=0;i<78&&!g.ended;i++){window.chimneyStep.call(g,1/120);g.draw(document.querySelector('.game-canvas').getContext('2d'));}}
   if(stage==='peak')for(let i=0;i<2400&&g.physics.flight?.velocity.y>0&&!g.ended;i++){window.chimneyStep.call(g,1/120);g.draw(document.querySelector('.game-canvas').getContext('2d'));}
   if(stage==='landing')for(let i=0;i<2400&&g.physics.flight&&!g.ended;i++){window.chimneyStep.call(g,1/120);g.draw(document.querySelector('.game-canvas').getContext('2d'));}
   for(let i=0;i<60;i++){g.draw(document.querySelector('.game-canvas').getContext('2d'));await new Promise(requestAnimationFrame);}
   return {stage,elapsed:g.elapsed,distance:g.physics.distance-s.start,speed:g.physics.velocity,paused:!!g.physics.chimneyPause,flight:!!g.physics.flight,height:g.physics.sample(g.physics.distance).position.y,ended:g.ended,jumps:g.physics.jumps,draws:g.view.renderer.info.render.calls,triangles:g.view.renderer.info.render.triangles};
  },stage);states.push(result);
  await page.screenshot({path:'output/playwright/chimney-chalet/round-3-'+stage+'.png'});
 }
 return {states,errors};
}
