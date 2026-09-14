// Visual and animation inspection of every signature piece, on both layouts.
// Set window.attractionWorld = 'meadow' (etc.) before running to check one world.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href);
 const requested='all';
 const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const mobile of [false,true]){
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
  await page.goto(base+'?mode=remix&seed=42');
  await page.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
   const {Mini}=await import(url);window.worldStep=Mini.prototype.update;
   Mini.prototype.update=function(dt){window.worldGame=this;if(!window.worldHold)return window.worldStep.call(this,dt)};
  });
  await page.locator('[data-single]').click();await page.waitForFunction(()=>window.worldGame?.view);
  const pieces=await page.evaluate(async requested=>{
   window.worldHold=true;const g=window.worldGame;g.track.ensure(g.physics.distance,4800);
   const {WORLDS}=await import('/src/games/adventure-worlds.ts');
   window.attractionSections=g.track.sections.slice();
   return WORLDS.filter(w=>requested==='all'||w.id===requested).flatMap(w=>w.pieces.filter(kind=>['windmillloop','mountainpass','tunnel','midwayloop','carouselhelix'].includes(kind)).map(kind=>({world:w.id,kind,start:w.start,end:w.end})));
  },requested);
  for(const piece of pieces){
   const info=await page.evaluate(({world,kind,start,end})=>{
    const g=window.worldGame,s=window.attractionSections.find(s=>s.kind===kind&&s.start>=start&&s.start<end);
    if(!s)throw Error('Missing '+world+' '+kind);
    // Keep only the immediately surrounding track, as during ordinary play.
    g.track.sections.splice(0,g.track.sections.length,...window.attractionSections.filter(p=>p.end>s.start-180));
    g.physics.distance=s.start+s.length*.48;g.physics.previousDistance=g.physics.distance;g.physics.velocity=28;
    g.powerups.finish(g.physics,g.carriages);g.powerups.gate=undefined;g.powerups.activate('tilt',g.physics,g.carriages);g.powerups.age=2;g.powerups.remaining=18;g.powerups.apply(g.physics,g.carriages);g.elapsed=100;g.hud();
    const ctx=document.querySelector('.game-canvas').getContext('2d');g.view.cameraRig.height=0;
    for(let i=0;i<300;i++){g.elapsed+=1/60;g.draw(ctx)}
    const v=g.view;const railError=Math.max(0,...[...v.pieces.values()].flatMap(p=>{const expected=v.scene.matrix.clone().multiply(p.matrix);return p.matrixWorld.elements.map((n,i)=>Math.abs(n-expected.elements[i]));}));if(railError>1e-7)throw Error('Rails did not tilt: '+railError);
    return {railError,at:s.start,length:s.length,height:Math.max(...s.frames.map(f=>f.position.y)),draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,
     overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
   },piece);
   if(info.overflow)throw Error('Layout overflow');
   await page.screenshot({path:`output/playwright/drift-${piece.kind}-${mobile?'mobile':'desktop'}.png`});
   report.push({...piece,mobile,...info});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
 return {report,errors};
}
