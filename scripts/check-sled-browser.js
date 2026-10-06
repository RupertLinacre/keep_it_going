// Playwright CLI run-code: production Frosty Lake geometry in the running game.
async page => {
  const errors=[],base=new URL("/",page.url()).href;
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+'?mode=remix&seed=42');
  await page.evaluate(async()=>{
    const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
    const {Mini}=await import(url);
    window.sledStep=Mini.prototype.update;
    Mini.prototype.update=function(dt){window.sledGame=this;if(!window.sledHold)return window.sledStep.call(this,dt);};
  });
  await page.locator('#ride-difficulty').selectOption('easy');
  await page.locator('[data-single]').click();
  await page.waitForFunction(()=>window.sledGame?.view);
  const geometry=await page.evaluate(()=>{
    const g=window.sledGame;window.sledHold=true;
    let next=g.elapsed;
    while(g.physics.distance<4320&&!g.ended){
      if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.2;}
      window.sledStep.call(g,1/30);
    }
    if(g.ended)throw Error('Ride failed before Frosty Lake Fair');
    // Frame a real game position halfway around the first alpine hairpin.
    g.track.ensure(g.physics.distance);
    const s=g.track.sections.find(s=>s.kind==='sledswitchbacks');
    if(!s)throw Error('Missing alpine signature');
    g.physics.relocate(s.start+s.distances[Math.round(s.resolution*3/9)],16);
    g.powerups.finish(g.physics,g.carriages);
    window.sledStep.call(g,1/120);
    // The scripted simulation skips rendered frames. Let the production camera
    // and world colours settle using the real render loop before capture.
    const ctx=document.querySelector('.game-canvas').getContext('2d');
    for(let i=0;i<180;i++){g.elapsed+=1/60;g.draw(ctx);}
    g.hud();
    return {kind:s.kind,width:s.width,height:s.amplitude,length:s.length};
  });
  await page.waitForTimeout(650);
  await page.screenshot({path:'output/playwright/sled-v2-game-desktop.png'});
  const desktop=await page.evaluate(()=>({world:document.querySelector('.world-hud')?.dataset.world,overflow:document.documentElement.scrollWidth>innerWidth,draws:window.sledGame.view.renderer.info.render.calls}));
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(400);
  await page.screenshot({path:'output/playwright/sled-v2-game-phone.png'});
  const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,ended:window.sledGame.ended}));
  if(errors.length||desktop.overflow||mobile.overflow||mobile.ended)throw Error(JSON.stringify({errors,desktop,mobile}));
  return {geometry,desktop,mobile,errors};
}
