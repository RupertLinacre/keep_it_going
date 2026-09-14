// Run with playwright-cli against Vite. Real game updates + real-time frame pacing.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href),report=[],errors=[];
 const requested=await page.evaluate(()=>window.attractionWorld||'all');
 const phone=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 try {
  for(const mobile of [false,true]) {
   const p=mobile?await phone.newPage():page;
   p.on('pageerror',e=>errors.push(e.message));
   if(!mobile)await p.setViewportSize({width:1440,height:900});
   for(const [world,target]of [['meadow',180],['mountain',1120],['night',2120],['halloween',3220]].filter(([w])=>requested==='all'||w===requested)) {
    await p.goto(base+'?mode=remix&seed=42');
    await p.evaluate(async()=>{
     const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
     const {Mini}=await import(url);window.worldStep=Mini.prototype.update;
     Mini.prototype.update=function(dt){
      window.worldGame=this;if(window.worldHold)return;
      if(window.worldAuto && this.elapsed>=window.worldNext){for(const d of String(this.a*this.b))this.key(d);window.worldNext=this.elapsed+1.5}
      return window.worldStep.call(this,dt);
     };
    });
    await p.locator('#ride-difficulty').selectOption('easy');await p.locator('[data-single]').click();
    await p.waitForFunction(()=>window.worldGame?.view);
    await p.evaluate(target=>{
     const g=window.worldGame;window.worldHold=true;let next=g.elapsed;
     while(g.physics.distance<target&&!g.ended){if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.5}window.worldStep.call(g,1/30)}
     if(g.ended)throw Error('Failed to reach world '+target);
     g.draw(document.querySelector('.game-canvas').getContext('2d'));
     window.worldNext=g.elapsed+1.5;window.worldAuto=true;window.worldHold=false;
    },target);
    await p.waitForTimeout(1600);
    await p.evaluate(()=>{
     window.worldFrames=[];window.worldMeasure=true;let last;
     function frame(now){if(!window.worldMeasure)return;if(last)window.worldFrames.push(now-last);last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
    });
    await p.waitForTimeout(6000);
    const result=await p.evaluate(()=>{
     window.worldMeasure=false;window.worldHold=true;
     const g=window.worldGame,v=g.view,a=window.worldFrames.sort((a,b)=>a-b),gl=v.renderer.getContext();
     const debug=gl.getExtension('WEBGL_debug_renderer_info');
     return {samples:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],p99Ms:a[Math.floor(a.length*.99)],over50Ms:a.filter(n=>n>50).length,
      draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,tiles:v.adventureScene.tiles.size,
      world:document.querySelector('.world-hud').dataset.world,ended:g.ended,answers:g.correct,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',
      overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1,
      cameraHeight:v.cameraRig.height};
    });
    if(result.ended||result.overflow)throw Error(JSON.stringify(result));
    await p.screenshot({path:`output/playwright/adventure-${world}-${mobile?'mobile':'desktop'}.png`});
    report.push({requestedWorld:world,mobile,...result});
   }
  }
 }finally{await phone.close()}
 if(errors.length)throw Error(errors.join('\n'));
 return{report,errors};
}
