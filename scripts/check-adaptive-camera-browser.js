// Playwright CLI run-code: play complete inversions and a tunnel with live rendering.
async page => {
 const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
 for(const piece of ['loop','noninvertingloop','corkscrew','tunnel']){
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://localhost:5198/first-person.html?piece='+piece);
  await page.locator('.tower-retry').waitFor();
  await page.evaluate(async piece=>{
   const {Mini}=await import('/src/games/mini.ts'),step=Mini.prototype.update;
   window.cameraNext=0;window.cameraFrames=[];window.cameraLast=performance.now();
   Mini.prototype.update=function(dt){
    window.cameraGame=this;
    if(this.elapsed>=window.cameraNext){for(const d of String(this.a*this.b))this.key(d);window.cameraNext=this.elapsed+1.6;}
    return step.call(this,dt);
   };
   window.cameraPiece=piece;
  },piece);
  await page.locator('.tower-retry').click();
  await page.waitForFunction(()=>window.cameraGame?.view);
  await page.evaluate(()=>{
   const r=window.cameraGame.view.renderer,render=r.render.bind(r);
   r.render=function(...args){const now=performance.now();window.cameraFrames.push(now-window.cameraLast);window.cameraLast=now;return render(...args);};
  });
  for(const fraction of [.05,.25,.52,.8]){
   await page.waitForFunction(fraction=>{
    const g=window.cameraGame,s=g.track.sections.find(s=>s.kind===window.cameraPiece);
    if(g.ended)throw Error('Test ride stopped');return g.physics.distance>=s.start+s.length*fraction;
   },fraction);
   const state=await page.evaluate(()=>{
    const g=window.cameraGame,v=g.view,f=g.ridePoses()[0].frame;
    const forward=f.tangent.clone().set(0,0,-1).applyQuaternion(v.riderCamera.quaternion);
    return {piece:window.cameraPiece,elapsed:g.elapsed,seat:v.firstPersonRig.seatBlend,facing:forward.dot(f.tangent),finite:v.riderCamera.matrixWorld.elements.every(Number.isFinite),active:g.powerups.active};
   });
   if(state.seat<.98||state.facing<.94||!state.finite||state.active!=='firstperson')throw Error('Lost the rails: '+JSON.stringify(state));
   report.push({fraction,...state});await page.screenshot({path:'output/playwright/adaptive-camera-'+piece+'-'+fraction+'.png'});
  }
  await page.waitForFunction(()=>{
   const g=window.cameraGame,s=g.track.sections.find(s=>s.kind===window.cameraPiece);
   if(g.ended)throw Error('Test ride stopped on exit');
   return g.physics.distance>=s.end+(g.cartCount-1)*2.4+70;
  });
  report.push(await page.evaluate(()=>{
   const g=window.cameraGame,t=window.cameraFrames.slice(5).sort((a,b)=>a-b);
   return {piece:window.cameraPiece,after:g.view.firstPersonRig.seatBlend,answers:g.correct,p50:t[Math.floor(t.length*.5)],p95:t[Math.floor(t.length*.95)]};
  }));
  if(piece==='loop'){
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
   const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,keys:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight+1}));
   if(mobile.overflow||!mobile.keys)throw Error('Mobile layout '+JSON.stringify(mobile));report.push({mobile});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
