async page => {
 const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
 for(const speed of [18,45]){
  await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:5198/christmas.html?piece=chimneyhouse');
  await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
  await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;window.chimneyStep=step;Mini.prototype.update=function(dt){window.chimneyGame=this;if(window.chimneyHold)return;return step.call(this,dt);};});
  await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.chimneyGame?.view);
  await page.evaluate(speed=>{window.chimneyHold=true;const g=window.chimneyGame;g.powerups.update=()=>{};g.powerups.gate=undefined;const s=g.track.sections.find(s=>s.kind==='chimneyhouse');window.chimneySection=s;g.physics.relocate(s.start+24,speed);},speed);
  for(const stage of ['inside','launch','peak','landing']){
   const result=await page.evaluate(async stage=>{
    const g=window.chimneyGame,s=window.chimneySection;
    const step=()=>{window.chimneyStep.call(g,1/120);g.draw(document.querySelector('.game-canvas').getContext('2d'));};
    if(stage==='inside')for(let i=0;i<1000&&!g.physics.chimneyPause&&!g.ended;i++)step();
    if(stage==='launch'){for(let i=0;i<1000&&!g.physics.flight&&!g.ended;i++)step();for(let i=0;i<72&&!g.ended;i++)step();}
    if(stage==='peak')for(let i=0;i<3000&&g.physics.flight?.velocity.y>0&&!g.ended;i++)step();
    if(stage==='landing')for(let i=0;i<3000&&g.physics.flight&&!g.ended;i++)step();
    for(let i=0;i<45;i++){g.draw(document.querySelector('.game-canvas').getContext('2d'));await new Promise(requestAnimationFrame);}
    const bodies=g.ridePoses(g.physics.renderDistance,g.physics.renderAlpha).slice(0,6);
    const pairs=bodies.slice(1).map((p,i)=>p.frame.position.distanceTo(bodies[i].frame.position));
    return {stage,ended:g.ended,peak:g.physics.sample(g.physics.distance).position.y,jumps:g.physics.jumps,maxGap:Math.max(...pairs),zoom:g.view.cameraRig.height,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,keys:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight+1};
   },stage);report.push({speed,...result});if(result.ended||result.overflow||!result.keys)throw Error(JSON.stringify(result));
   await page.screenshot({path:'output/playwright/chimney-house/round-4-phone-'+speed+'-'+stage+'.png'});
  }
 }
 return {report,errors};
}
