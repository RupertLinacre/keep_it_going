// Gravity-flip scenery fixtures, followed by a real-time ride on both layouts.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const mobile of [false,true]){
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
  await page.goto(base+'?mode=remix&seed=42');
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
   const {Mini}=await import(url);window.worldStep=Mini.prototype.update;
   Mini.prototype.update=function(dt){window.worldGame=this;if(!window.worldHold)return window.worldStep.call(this,dt)};
  });
  await page.getByRole('button',{name:'1 1 player Jump straight in'}).click();await page.waitForFunction(()=>window.worldGame?.view);
  await page.evaluate(()=>{window.worldHold=true;const g=window.worldGame;g.track.ensure(g.physics.distance,4000);window.flightSections=g.track.sections.slice()});
  for(const kind of ['sheepbank','pumpkinhop']){
   const before=await page.evaluate(kind=>{
    const g=window.worldGame,s=window.flightSections.find(s=>s.kind===kind);
    if(!s)throw Error('Missing '+kind);
    g.track.sections.splice(0,g.track.sections.length,...window.flightSections.filter(p=>p.end>s.start-180));
    g.physics.distance=s.start+s.length*.5;g.physics.previousDistance=g.physics.distance;g.physics.velocity=28;
    g.powerups.finish(g.physics,g.carriages);g.powerups.gate=undefined;g.elapsed=100;g.hud();
    const ctx=document.querySelector('.game-canvas').getContext('2d');g.view.cameraRig.height=0;
    for(let i=0;i<300;i++){g.elapsed+=1/60;g.draw(ctx)}
    return {camera:g.view.cameraRig.height,distance:g.physics.distance};
   },kind);
   await page.screenshot({path:`output/playwright/scenery-${kind}-${mobile?'mobile':'desktop'}-grounded.png`});
   const airborne=await page.evaluate(()=>{
    const g=window.worldGame,ctx=document.querySelector('.game-canvas').getContext('2d');
    g.powerups.activate('reverse',g.physics,g.carriages);g.hud();
    for(let i=0;i<180;i++){g.elapsed+=1/60;g.draw(ctx)}
    const a=g.view.adventureScene;
    const bodies=[...a.tiles.values()].flatMap(t=>t.actors).filter(a=>a.flights);
    const kinds=[...new Set(bodies.map(a=>a.kind))];
    for(const kind of kinds)if(!bodies.some(a=>a.kind===kind&&a.flights[0].height>10))throw Error(kind+' did not fly');
    if(bodies.some(a=>a.flights[0].height>30))throw Error('Unbounded flight');
    if(a.pumpkins.count!==a.pumpkinFaces.count)throw Error('Missing pumpkin faces');
    for(let i=0;i<a.pumpkins.count*16;i++)if(a.pumpkins.instanceMatrix.array[i]!==a.pumpkinFaces.instanceMatrix.array[i])throw Error('Detached pumpkin face');
    return {kinds,height:Math.max(...bodies.map(a=>a.flights[0].height)),camera:g.view.cameraRig.height,draws:g.view.renderer.info.render.calls};
   });
   if(Math.abs(airborne.camera-before.camera)>.1)throw Error('Scenery changed camera framing');
   await page.screenshot({path:`output/playwright/scenery-${kind}-${mobile?'mobile':'desktop'}-airborne.png`});
   const settled=await page.evaluate(()=>{
    const g=window.worldGame,ctx=document.querySelector('.game-canvas').getContext('2d');g.powerups.finish(g.physics,g.carriages);
    for(let i=0;i<600;i++){g.elapsed+=1/60;g.draw(ctx)}
    const bodies=[...g.view.adventureScene.tiles.values()].flatMap(t=>t.actors).filter(a=>a.flights);
    if(bodies.some(a=>a.flights[0].height!==0))throw Error('Scenery did not settle');
    return bodies.length;
   });
   report.push({mobile,kind,before,airborne,settled});
  }
  await page.evaluate(()=>{
   const g=window.worldGame;g.powerups.activate('reverse',g.physics,g.carriages);g.physics.velocity=30;window.worldHold=false;
   window.flightFrames=[];window.flightLast=undefined;
   window.flightRaf=requestAnimationFrame(function tick(t){if(window.flightLast!==undefined)window.flightFrames.push(t-window.flightLast);window.flightLast=t;window.flightRaf=requestAnimationFrame(tick)});
  });
  await page.waitForTimeout(6000);
  report.push(await page.evaluate(mobile=>{
   window.worldHold=true;cancelAnimationFrame(window.flightRaf);
   const frames=window.flightFrames.sort((a,b)=>a-b),g=window.worldGame;
   return {mobile,realtime:true,frames:frames.length,median:frames[Math.floor(frames.length*.5)],p99:frames[Math.floor(frames.length*.99)],over50:frames.filter(x=>x>50).length,distance:g.physics.distance,alive:g.physics.velocity>0};
  },mobile));
 }
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
