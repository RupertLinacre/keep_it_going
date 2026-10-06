// Playwright CLI run-code: real timed effect, return transition and phone input.
async page => {
 const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:960});
 await page.goto('http://localhost:5198/first-person.html');
 await page.locator('.tower-retry').waitFor();
 await page.evaluate(async()=>{
  const {Mini}=await import('/src/games/mini.ts'),step=Mini.prototype.update;
  window.frontSeatTimes=[];window.frontSeatNext=0;
  Mini.prototype.update=function(dt){
   window.frontSeatGame=this;
   if(!window.frontSeatHold){
    if(this.elapsed>=window.frontSeatNext){for(const d of String(this.a*this.b))this.key(d);window.frontSeatNext=this.elapsed+1.9;}
    return step.call(this,dt);
   }
  };
 });
 await page.locator('.tower-retry').click();
 await page.waitForFunction(()=>window.frontSeatGame?.elapsed>3);
 await page.evaluate(()=>{
  const r=window.frontSeatGame.view.renderer,render=r.render.bind(r);window.lastFrontSeatFrame=performance.now();
  r.render=function(...args){const now=performance.now();window.frontSeatTimes.push(now-window.lastFrontSeatFrame);window.lastFrontSeatFrame=now;return render(...args);};
 });
 report.push(await page.evaluate(()=>{
  const g=window.frontSeatGame,v=g.view,head=g.ridePoses()[0].frame;
  if(!document.querySelector('.power-copy strong').textContent.includes('Train chase'))throw Error('Stale camera build');
  const rear=v.firstPersonRig.eye.clone().sub(head.position).dot(head.tangent);
  if(v.firstPersonRig.seatBlend<.05&&rear>=-12)throw Error('Camera is not behind the train on open rail');
  return {seatBlend:v.firstPersonRig.seatBlend,behindMetres:-rear,cameraHeight:v.firstPersonRig.eye.y-head.position.y};
 }));
 await page.screenshot({path:'output/playwright/front-seat-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(500);
 const phone=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,keypad:document.querySelector('.number-pad').getBoundingClientRect().bottom<=innerHeight+1,power:window.frontSeatGame.powerups.active}));
 if(phone.overflow||!phone.keypad||phone.power!=='firstperson')throw Error('Mobile '+JSON.stringify(phone));
 report.push({phone});await page.screenshot({path:'output/playwright/front-seat-mobile.png'});
 await page.setViewportSize({width:1440,height:960});
 await page.waitForFunction(()=>window.frontSeatGame.elapsed>21);
 report.push(await page.evaluate(()=>{
  const g=window.frontSeatGame,times=window.frontSeatTimes.filter(t=>t<100).sort((a,b)=>a-b);
  if(g.ended||g.powerups.active==='firstperson'||g.view.renderCamera!==g.view.camera)throw Error('Timed camera failed to return');
  window.frontSeatHold=true;
  return {returnedToModel:true,answers:g.correct,frames:times.length,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],finite:g.view.riderCamera.matrixWorld.elements.every(Number.isFinite)};
 }));
 await page.screenshot({path:'output/playwright/front-seat-return.png'});
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
