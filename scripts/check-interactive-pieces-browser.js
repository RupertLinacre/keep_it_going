// Four interactions at controlled checkpoints, plus real-time portal play.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const mobile of [false,true]){
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});await page.goto(base+'?mode=remix&seed=42');
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
   const {Mini}=await import(url),update=Mini.prototype.update;
   Mini.prototype.update=function(dt){window.worldGame=this;if(!window.worldHold)return update.call(this,dt)};
  });
  await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-single]').click();await page.waitForFunction(()=>window.worldGame?.view);
  await page.evaluate(()=>{window.worldHold=true;const g=window.worldGame;g.track.ensure(g.physics.distance,4600);window.interactionSections=g.track.sections.slice()});
  for(const kind of ['carouselhelix','tunnel','sheepbank','pumpkintunnel']){
   const stages=await page.evaluate(kind=>{
    const g=window.worldGame,s=window.interactionSections.find(s=>s.kind===kind);
    g.track.sections.splice(0,g.track.sections.length,...window.interactionSections.filter(p=>p.end>s.start-180));
    const mid=s.start+s.length/2,stages=kind==='carouselhelix'?[.15,.4,.68].map(t=>s.start+s.distances[Math.round(s.resolution*t)])
     :kind==='sheepbank'?[s.start+s.length*.16-32,s.start+s.length*.16-18,s.start+s.length*.16+10]
     :kind==='tunnel'?[mid-21,mid,mid+30]:[mid-23,mid+10,mid+45];
    g.powerups.finish(g.physics,g.carriages);g.powerups.gate={kind:'wind',distance:s.end+2000,id:99};g.elapsed=100;
    g.physics.distance=stages[0];g.physics.previousDistance=stages[0];g.physics.velocity=28;g.physics.flight=undefined;
    g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
    g.view.adventureScene?.destroy();g.view.adventureScene=undefined;g.view.cameraRig.height=0;
    const ctx=document.querySelector('.game-canvas').getContext('2d');
    for(let i=0;i<180;i++){g.elapsed+=1/60;g.carriages.update(1/60,g.physics.distance,0,false);g.draw(ctx)}
    window.interactionSection=s;return stages;
   },kind);
   for(let stage=0;stage<stages.length;stage++){
    const info=await page.evaluate(to=>{
     const g=window.worldGame,ctx=document.querySelector('.game-canvas').getContext('2d');
     while(g.physics.distance<to){const dt=Math.min(1/60,(to-g.physics.distance)/28);g.elapsed+=dt;g.physics.previousDistance=g.physics.distance;g.physics.distance+=28*dt;g.carriages.update(dt,g.physics.distance,28,false);g.draw(ctx)}
     g.hud();const s=window.interactionSection,tile=g.view.adventureScene.tiles.get(s.id);
     return {distance:g.physics.distance,portal:tile?.portals?.map(p=>({age:p.age,hits:p.hits})),draws:g.view.renderer.info.render.calls,
      actors:tile?.actors.filter(a=>a.sheepDistance!==undefined||a.liftCable||a.portalIndex!==undefined).length,
      overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
    },stages[stage]);
    if(info.overflow)throw Error('Layout overflow');
    if(kind==='pumpkintunnel'&&stage>0&&info.portal[0].hits!==1)throw Error('Portal must burst exactly once');
    await page.screenshot({path:`output/playwright/interactive-${kind}-${mobile?'mobile':'desktop'}-${stage}.png`});
    report.push({kind,mobile,stage,...info});
   }
  }
  await page.evaluate(()=>{
   const g=window.worldGame,s=window.interactionSection;
   g.physics.distance=s.start+s.length/2-28;g.physics.previousDistance=g.physics.distance;g.physics.velocity=30;
   g.view.adventureScene?.destroy();g.view.adventureScene=undefined;g.elapsed+=1;window.worldHold=false;
   window.frameTimes=[];let last;window.interactionDone=false;
   requestAnimationFrame(function frame(t){if(last)window.frameTimes.push(t-last);last=t;if(!window.interactionDone)requestAnimationFrame(frame)});
  });
  for(let i=0;i<4;i++){
   const text=await page.locator('.prompt h2').innerText(),m=text.match(/(\d+)\s*×\s*(\d+)/);
   await page.keyboard.type(String(Number(m[1])*Number(m[2])));await page.waitForTimeout(1300);
  }
  report.push(await page.evaluate(mobile=>{
   window.worldHold=true;window.interactionDone=true;const a=window.frameTimes.sort((a,b)=>a-b),g=window.worldGame;
   return {mobile,realtime:true,frames:a.length,p50:a[Math.floor(a.length*.5)],p99:a[Math.floor(a.length*.99)],over50:a.filter(x=>x>50).length,alive:!g.ended};
  },mobile));
 }
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
