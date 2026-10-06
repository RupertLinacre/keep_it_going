// Render fixtures check two lanes and solo powers; they do not mock or test a
// network connection. Route transitions run through the real gameplay update.
async page => {
  const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
  async function start(world) {
    await page.goto('http://localhost:5198/?mode=remix&world='+world+'&seed=42');
    await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url);window.winterStep=Mini.prototype.update;
      Mini.prototype.update=function(dt){window.winterGame=this;if(!window.winterHold)return window.winterStep.call(this,dt)};
    });
    await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-single]').click();
    await page.waitForFunction(()=>window.winterGame?.view);
    await page.evaluate(()=>{window.winterHold=true;const g=window.winterGame;g.powerups.update=()=>{};g.powerups.gate=undefined;});
  }
  for(const world of ['lapland','winterfair']) {
    await page.setViewportSize({width:1600,height:1000});await start(world);
    await page.evaluate(async()=>{
      const g=window.winterGame;let next=g.elapsed;
      for(let i=0;i<240;i++){if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.8;}window.winterStep.call(g,1/60);}
      g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
      const {snapshotRide}=await import('/src/multiplayer/ghost.ts'),remote=snapshotRide(g,1),gap=18;
      remote.distance-=gap;remote.power=undefined;remote.parcels=[];remote.impacts=[];
      for(const b of remote.bodies){const f=g.track.sample((b.rail?.distance??remote.distance)-gap);b.position=f.position.toArray();b.rotation=f.rotation.toArray();}
      remote.links=remote.bodies.slice(1).map((b,i)=>({start:b.position,end:remote.bodies[i].position,stress:0}));
      g.multiplayer=true;g.view.multiplayer=true;g.opponent={track:g.track,sample:()=>remote};
      for(let i=0;i<100;i++){g.elapsed+=1/60;g.draw(document.querySelector('.game-canvas').getContext('2d'));}
    });
    const inspect=()=>page.evaluate(()=>{
      const g=window.winterGame,v=g.view;
      for(const tile of v.adventureScene.tiles.values())for(const mesh of tile.root.children)
        if(Math.abs(mesh.position.z-(v.laneOffset?(mesh.userData.front?v.laneOffset:-v.laneOffset-2*tile.section.origin.z):0))>.001)throw Error('Scenery crossed the race aisle');
      if(document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1)throw Error('Layout overflow');
      return{world:document.querySelector('.world-hud').dataset.world,draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,cameraHeight:v.cameraRig.height,lane:v.laneOffset};
    });
    report.push({mode:'race',...await inspect()});
    await page.screenshot({path:'output/playwright/winter-worlds/'+world+'-race-desktop.png'});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
    await page.screenshot({path:'output/playwright/winter-worlds/'+world+'-race-mobile.png'});await page.setViewportSize({width:1600,height:1000});
    for(const power of ['reverse','lift','tilt']) {
      await start(world);
      await page.evaluate(power=>{
        const g=window.winterGame;g.powerups.activate(power,g.physics,g.carriages);g.powerups.age=3;g.powerups.remaining=17;
        if(power==='lift'){g.track.raise(g.physics.distance);g.track.advance(1);}
        for(let i=0;i<100;i++){g.elapsed+=1/60;g.draw(document.querySelector('.game-canvas').getContext('2d'));}
        const v=g.view;if(!v.adventureScene.group.parent||!v.scene.matrixWorld.elements.every(Number.isFinite))throw Error('Invalid world transform');
        if(power==='tilt'&&Math.abs(v.scene.rotation.z+22*Math.PI/180)>.001)throw Error('Board did not tilt with scenery');
        if(v.cameraRig.height>150)throw Error('Scenery/power pulled camera far away');
      },power);
      report.push({mode:power,...await inspect()});await page.screenshot({path:'output/playwright/winter-worlds/'+world+'-'+power+'.png'});
    }
  }
  await start('halloween');
  const transitions=await page.evaluate(()=>{
    const g=window.winterGame;let next=g.elapsed;const seen=[];let previous;
    for(let i=0;i<60*180&&!g.ended;i++) {
      if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.5;}
      window.winterStep.call(g,1/60);
      if(i%12===0){g.draw(document.querySelector('.game-canvas').getContext('2d'));const world=document.querySelector('.world-hud').dataset.world;if(world!==previous){seen.push({world,distance:g.physics.distance,tower:!!g.tower});previous=world;}}
      if(seen.some(s=>s.tower)&&document.querySelector('.world-hud').dataset.world==='meadow')break;
    }
    if(g.ended||!['halloween','lapland','winterfair','meadow'].every(w=>seen.some(s=>s.world===w))||!seen.some(s=>s.tower))throw Error('Journey failed: '+JSON.stringify(seen));
    return seen;
  });
  await page.goto('http://localhost:5198/tracks.html?world=lapland&element=hill');
  if(await page.locator('#element option').count()!==6)throw Error('Empty winter collection');
  await page.locator('#collection').selectOption('winterfair');if(await page.locator('#element option').count()!==6)throw Error('Empty winter fair collection');
  if(errors.length)throw Error(errors.join('\n'));const result={report,transitions,errors};await page.evaluate(result=>window.winterValidation=result,result);return result;
}
