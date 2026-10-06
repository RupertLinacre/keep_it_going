// Real RAF gameplay; screenshot readback is kept outside the timed sample.
async page => {
 const base=new URL('/',page.url()).href,errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
 for(const kind of ['frozenwaterfall','sledswitchbacks']){
  await page.setViewportSize({width:3840,height:2160});await page.goto(base+'christmas.html?piece='+kind);
  await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/games/mini.ts')).name,{Mini}=await import(url),step=Mini.prototype.update;
   window.mergeNext=2;window.mergeHold=false;Mini.prototype.update=function(dt){window.mergeGame=this;if(window.mergeHold)return;
    if(this.elapsed>=window.mergeNext){for(const d of String(this.a*this.b))this.key(d);window.mergeNext=this.elapsed+1.8;}
    return step.call(this,dt);
   };
  });
  await page.locator('.tower-retry').click();await page.waitForFunction(()=>window.mergeGame?.view);
  await page.evaluate(async kind=>{
   const g=window.mergeGame;g.powerups.update=()=>{};g.powerups.gate=undefined;
   if(kind==='sledswitchbacks'){
    const {snapshotRide}=await import('/src/multiplayer/ghost.ts');g.multiplayer=true;g.view.multiplayer=true;
    g.opponent={track:g.track,sample:()=>{const s=snapshotRide(g,1);s.power=undefined;s.parcels=[];s.impacts=[];return s;}};
   }
   window.mergeFrames=[];window.mergeMeasure=true;let last;
   const frame=now=>{if(!window.mergeMeasure)return;if(last)window.mergeFrames.push(now-last);last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  },kind);
  await page.waitForFunction(()=>window.mergeGame.physics.distance>window.mergeGame.track.sections.find(s=>s.id===0).end,{timeout:45000});
  const data=await page.evaluate(()=>{
   window.mergeMeasure=false;window.mergeHold=true;const a=window.mergeFrames.slice().sort((a,b)=>a-b),g=window.mergeGame;
   return {n:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)],over25:a.filter(t=>t>25).length,over50:a.filter(t=>t>50).length,ended:g.ended,answers:g.correct};
  });report.push({kind,layout:kind==='sledswitchbacks'?'4k mirrored tracks':'4k single',...data});
  if(data.ended)throw Error('Ride failed');await page.screenshot({path:'output/playwright/winter-worktree-merge/'+kind+'-4k-landed.png'});
 }
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
