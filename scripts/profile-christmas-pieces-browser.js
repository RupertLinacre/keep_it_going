// Run via playwright-cli run-code --filename. Measures real RAF gameplay;
// phone CPU throttling is a stress test, not a physical-device benchmark.
async page => {
 const kinds=['startree','snowmanscarf','ribbonreel','snowglobe'];
 const errors=[],report=[],layout=await page.evaluate(()=>new URL(location.href).searchParams.get('profile')??'4k');
 page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);
 try{for(const kind of kinds){
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  await page.setViewportSize(layout==='phone'?{width:390,height:844}:{width:3840,height:2160});
  await page.goto('http://localhost:5198/christmas.html?piece='+kind);
  await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
   window.christmasStep=step;Mini.prototype.update=function(dt){window.christmasGame=this;if(window.christmasHold)return;if(this.elapsed>=window.christmasNext){for(const d of String(this.a*this.b))this.key(d);window.christmasNext=this.elapsed+1.8;}return step.call(this,dt);};
   window.christmasNext=0;
  });
  await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.christmasGame?.view);
  await page.evaluate(kind=>{
   window.christmasHold=true;const g=window.christmasGame;g.powerups.update=()=>{};g.powerups.gate=undefined;
   const section=g.track.sections.find(s=>s.kind===kind);let next=0;
   for(let i=0;i<10000&&g.physics.distance<section.start+section.length*.18&&!g.ended;i++){if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.8;}window.christmasStep.call(g,1/60);}
   const v=g.view;window.christmasTimes=[];const render=v.render.bind(v);v.render=(...args)=>{const start=performance.now();const result=render(...args);if(window.christmasMeasure)window.christmasTimes.push(performance.now()-start);return result;};
   window.christmasNext=g.elapsed+1.8;
   window.christmasTarget=section.end;
  },kind);
  if(layout==='race')await page.evaluate(async()=>{
   const g=window.christmasGame,{snapshotRide}=await import('/src/multiplayer/ghost.ts');g.multiplayer=true;g.view.multiplayer=true;
   g.opponent={track:g.track,sample:()=>{const state=snapshotRide(g,1);state.distance-=15;state.power=undefined;state.parcels=[];state.impacts=[];
    for(const b of state.bodies){const f=g.track.sample((b.rail?.distance??state.distance)-15);b.position=f.position.toArray();b.rotation=f.rotation.toArray();}
    state.links=state.bodies.slice(1).map((b,i)=>({start:b.position,end:state.bodies[i].position,stress:0}));return state;}};
  });
  if(layout==='phone')await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>{window.christmasFrames=[];window.christmasMeasure=true;window.christmasHold=false;let last;function frame(now){if(!window.christmasMeasure)return;if(last)window.christmasFrames.push(now-last);last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  await page.waitForTimeout(5000);
  const result=await page.evaluate(()=>{
   window.christmasMeasure=false;window.christmasHold=true;
   const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)]??0,max:a.at(-1),over25:a.filter(t=>t>25).length,over50:a.filter(t=>t>50).length};};
   const g=window.christmasGame,v=g.view,gl=v.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return{frame:stats(window.christmasFrames),cpu:stats(window.christmasTimes),ended:g.ended,distance:g.physics.distance,answers:g.correct,draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,pixels:gl.drawingBufferWidth*gl.drawingBufferHeight,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
  });report.push({kind,layout,...result});
  await page.screenshot({path:'output/playwright/christmas-attractions/profile-'+layout+'-'+kind+'.png'});
 }}finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}
 const result={report,errors};await page.evaluate(result=>window.christmasProfile=result,result);return result;
}
