// Visual/renderer fixtures, not a networking test. Run after the performance
// comparison: includes two trains, independent gravity and the rigid board tilt.
async page => {
  const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  for(const [world,target]of[['meadow',300],['mountain',1440],['night',2440],['halloween',3470]]) {
    await page.goto(base+'?mode=remix&seed=42');
    await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url);window.backgroundUpdate=Mini.prototype.update;
      Mini.prototype.update=function(dt){window.backgroundGame=this;if(!window.backgroundFreeze)return window.backgroundUpdate.call(this,dt)};
    });
    await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-single]').click();
    await page.waitForFunction(()=>window.backgroundGame?.view);
    await page.evaluate(async target=>{
      const g=window.backgroundGame;window.backgroundFreeze=true;let next=g.elapsed;
      g.powerups.update=()=>{};g.powerups.gate=undefined;
      while(g.physics.distance<target&&!g.ended){if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.5}window.backgroundUpdate.call(g,1/30)}
      if(g.ended)throw Error('Fixture did not reach world');
      g.physics.flight=undefined;g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
      const {snapshotRide}=await import('/src/multiplayer/ghost.ts');
      const remote=snapshotRide(g,1),offset=32;remote.distance-=offset;
      for(const body of remote.bodies){
        const at=(body.rail?.distance??remote.distance)-offset,frame=g.track.sample(at);
        body.position=frame.position.toArray();body.rotation=frame.rotation.toArray();
      }
      remote.links=remote.bodies.slice(1).map((b,i)=>({start:b.position,end:remote.bodies[i].position,stress:0}));
      remote.parcels=[];remote.impacts=[];remote.power=undefined;
      window.backgroundRemote=remote;
      g.multiplayer=true;g.view.multiplayer=true;g.opponent={track:g.track,sample:()=>remote};
      g.view.cameraRig.height=0;
      for(let i=0;i<90;i++){g.elapsed+=1/60;g.draw(document.querySelector('.game-canvas').getContext('2d'))}
    },target);
    await page.waitForTimeout(350);
    const inspect=()=>page.evaluate(()=>{
      const g=window.backgroundGame,v=g.view;let shared=0,front=0;
      for(const tile of v.adventureScene.tiles.values())for(const mesh of tile.root.children){
        if(mesh.userData.front)front++;else{shared++;if(Math.abs(mesh.position.z+v.laneOffset+2*tile.section.origin.z)>.001)throw Error('Backdrop enters race aisle')}
      }
      if(!v.laneOffset||!shared||!front)throw Error('Missing scenery/race lanes');
      return{world:document.querySelector('.world-hud').dataset.world,laneOffset:v.laneOffset,draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,shared,front,
        instances:v.adventureScene.group.children.filter(m=>m.isInstancedMesh&&m.count).map(m=>m.count)};
    });
    report.push({world,mode:'race',...await inspect()});
    await page.screenshot({path:`output/playwright/background-race-${world}-desktop.png`});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
    await page.screenshot({path:`output/playwright/background-race-${world}-narrow.png`});
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{
      const g=window.backgroundGame;g.carriages.gravity=-19.62;
      for(let i=0;i<75;i++){g.elapsed+=1/60;g.draw(document.querySelector('.game-canvas').getContext('2d'))}
      const floats=[...g.view.adventureScene.tiles.values()].flatMap(t=>t.actors).filter(a=>a.flights);
      if(floats.length&&!floats.some(a=>a.flights[0].height>1&&a.flights[1].height<.01))throw Error('Gravity must remain independent for each rider');
    });
    report.push({world,mode:'independent-gravity',...await inspect()});
    await page.evaluate(()=>{
      const g=window.backgroundGame;g.multiplayer=false;g.opponent=undefined;g.carriages.gravity=9.81;
      // Mode switches in the app create a new renderer; do the same here so a
      // previous race's cached remote rails cannot contaminate this solo fixture.
      const View=g.view.constructor;g.view.destroy();g.view=new View(g.host.stage,g.track);
      g.powerups.activate('tilt',g.physics,g.carriages);g.powerups.age=3;g.powerups.remaining=17;
      for(let i=0;i<60;i++){g.elapsed+=1/60;g.draw(document.querySelector('.game-canvas').getContext('2d'))}
      const v=g.view;
      if(!v.adventureScene.group.parent)throw Error('Landscape detached during tilt');
      if(!Array.from(v.adventureScene.group.matrixWorld.elements).every(Number.isFinite))throw Error('Invalid scene transform');
      if(Math.abs(v.scene.rotation.z+22*Math.PI/180)>.001)throw Error('The complete scene must follow the downhill board');
    });
    await page.screenshot({path:`output/playwright/background-drift-${world}.png`});
  }
  if(errors.length)throw Error(errors.join('\n'));
  return{report,errors};
}
