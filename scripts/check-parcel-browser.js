// Visual crest fixture followed by normal simulation; run through playwright-cli.
async page => {
  const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const mobile of [false,true]) {
    await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
    await page.goto(base+'?mode=classic');
    await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url),update=Mini.prototype.update;
      Mini.prototype.update=function(dt){window.parcelGame=this;if(window.parcelHold)return;return update.call(this,dt)};
    });
    await page.locator('[data-single]').click();await page.waitForFunction(()=>window.parcelGame);
    await page.evaluate(()=>{
      const g=window.parcelGame,hill=g.track.sections.find(s=>s.kind==='skyhill');
      g.physics.distance=hill.start+hill.length*.46+2.4;g.physics.previousDistance=g.physics.distance;
      g.physics.velocity=27;g.physics.flight=undefined;g.physics.traces=[];
      for(const c of g.carriages.coaches)if(c.cargo)c.cargo=4;
      g.view.cameraRig.height=0;window.parcelStart=g.elapsed;
      window.parcelLaunches=[];
      const spill=g.carriages.spill;
      g.carriages.spill=function(c,f,v,all){const count=this.spilled;spill.call(this,c,f,v,all);for(const p of this.parcels.slice(-(this.spilled-count)))window.parcelLaunches.push({time:g.elapsed,coach:c.id,velocity:p.velocity.toArray(),speed:p.velocity.length(),carrier:c.velocity.length(),spin:p.angularVelocity.toArray()});};
    });
    await page.waitForFunction(()=>window.parcelGame.carriages.spilled>=4);
    await page.waitForTimeout(150);
    await page.evaluate(()=>{window.parcelHold=true});
    const state=await page.evaluate(()=>({launches:window.parcelLaunches,cargo:window.parcelGame.carriages.coaches.map(c=>c.cargo),flying:window.parcelGame.carriages.parcels.map(p=>({age:p.age,position:p.position.toArray(),rotation:p.rotation.toArray()}))}));
    if(!state.launches.every(p=>p.speed<=p.carrier*1.040001))throw new Error('Excess launch speed');
    if(new Set(state.launches.map(p=>p.time)).size<3)throw new Error('Spill timing did not vary');
    await page.screenshot({path:`output/playwright/parcel-spill-${mobile?'mobile':'desktop'}.png`,scale:'css'});
    report.push({mobile,...state});
    await page.evaluate(()=>{window.parcelHold=false});await page.waitForTimeout(1600);
  }
  if(errors.length)throw new Error(errors.join('\n'));
  return{report,errors};
}
