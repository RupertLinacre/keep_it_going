async page => {
 const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
 for(const layout of ['4k','phone','race']){
  await page.setViewportSize(layout==='phone'?{width:390,height:844}:{width:3840,height:2160});
  await page.goto('http://localhost:5198/christmas.html?piece=chimneyhouse&christmas=1');await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
   window.chimneyHold=false;window.chimneyNext=2;Mini.prototype.update=function(dt){window.chimneyGame=this;if(window.chimneyHold)return;
    if(this.elapsed>=window.chimneyNext&&!this.physics.flight&&!this.physics.chimneyPause){for(const d of String(this.a*this.b))this.key(d);window.chimneyNext=this.elapsed+2.4;}
    return step.call(this,dt);
   };
  });
  await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.chimneyGame?.view);
  await page.evaluate(async layout=>{
   const g=window.chimneyGame;g.powerups.update=()=>{};g.powerups.gate=undefined;window.chimneyFrames=[];window.chimneyCPU=[];window.chimneyBursts=[];window.chimneyCount=0;
   const render=g.view.render.bind(g.view);g.view.render=(...args)=>{const t=performance.now();const r=render(...args);window.chimneyCPU.push(performance.now()-t);return r;};
   if(layout==='race'){const {snapshotRide}=await import('/src/multiplayer/ghost.ts');g.multiplayer=true;g.view.multiplayer=true;g.opponent={track:g.track,sample:()=>{const state=snapshotRide(g,1);state.power=undefined;state.parcels=[];state.impacts=[];return state;}};}
   let last;window.chimneyMeasure=true;function frame(now){if(!window.chimneyMeasure)return;if(last)window.chimneyFrames.push(now-last);last=now;if(g.physics.flight)window.chimneyCount++;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  },layout);
  // Actual RAF-driven game, including the starting hill, delivery wait and launch.
  await page.waitForFunction(()=>window.chimneyGame.physics.flight,{timeout:45000});
  // Capture only AFTER measurement: 4K screenshot readback itself stalls RAF.
  await page.waitForTimeout(650);
  await page.waitForFunction(()=>window.chimneyGame.physics.jumps>0,{timeout:30000});await page.waitForTimeout(600);
  const result=await page.evaluate(()=>{
   window.chimneyMeasure=false;window.chimneyHold=true;
   const stats=arr=>{const a=arr.slice().sort((a,b)=>a-b);return {n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)],over25:a.filter(t=>t>25).length,over50:a.filter(t=>t>50).length,max:a.at(-1)};};
   const g=window.chimneyGame,v=g.view,gl=v.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {frames:stats(window.chimneyFrames),cpu:stats(window.chimneyCPU),flightFrames:window.chimneyCount,answers:g.correct,jumps:g.physics.jumps,ended:g.ended,draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,pixels:gl.drawingBufferWidth*gl.drawingBufferHeight,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
  });report.push({layout,...result});await page.screenshot({path:'output/playwright/chimney-house/round-5-'+layout+'-landed.png'});
 }
 return {report,errors};
}
