// playwright-cli run-code --filename scripts/profile-backgrounds-browser.js
// Set window.backgroundPass ('before'/'after') and backgroundMobile beforehand.
// Measures actual gameplay at the same seeded route/answer cadence. CPU timing
// measures JS/render submission, not GPU completion. Phone is emulated, not hardware.
async page => {
  const config=await page.evaluate(()=>({pass:window.backgroundPass??'after',mobile:!!window.backgroundMobile}));
  const base=await page.evaluate(()=>new URL('/',location.href).href),report=[],errors=[];
  const context=config.mobile?await page.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}):undefined;
  const p=context?await context.newPage():page;
  const cdp=await p.context().newCDPSession(p);
  p.on('pageerror',e=>errors.push(e.message));
  if(!config.mobile)await p.setViewportSize({width:1440,height:900});
  try {
    for(const [world,target]of [['meadow',180],['mountain',1120],['night',2120],['halloween',3220]]) {
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      await p.goto(base+'?mode=remix&seed=42');
      await p.evaluate(async()=>{
        // Seed questions too, so the same number of digits/DOM updates are tested.
        let random=731;Math.random=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296};
        const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
        const {Mini}=await import(url);window.backgroundStep=Mini.prototype.update;
        Mini.prototype.update=function(dt){
          window.backgroundGame=this;if(window.backgroundHold)return;
          if(window.backgroundAuto&&this.elapsed>=window.backgroundNext){
            for(const d of String(this.a*this.b))this.key(d);window.backgroundNext=this.elapsed+1.5;
          }
          return window.backgroundStep.call(this,dt);
        };
      });
      await p.locator('#ride-difficulty').selectOption('easy');await p.locator('[data-single]').click();
      await p.waitForFunction(()=>window.backgroundGame?.view);
      if(config.pass==='after'&&!await p.evaluate(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('/background-meadow.ts'))))
        throw Error('Stale Vite transforms: restart the development server before measuring the new backgrounds');
      await p.evaluate(target=>{
        const g=window.backgroundGame;window.backgroundHold=true;
        // Powers affect camera/terrain; suppress random gates for a matched scenery comparison.
        g.powerups.finish(g.physics,g.carriages);g.powerups.update=()=>{};g.powerups.gate=undefined;
        let next=g.elapsed;
        while(g.physics.distance<target&&!g.ended){
          if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.5}
          window.backgroundStep.call(g,1/30);
        }
        if(g.ended)throw Error('Failed to reach '+target);
        const v=g.view,scene=v.adventureScene;
        for(const [object,method,label]of[[v,'render','render'],[scene,'render','scenery'],[scene,'build','build']]){
          const original=object[method];object[method]=function(...args){
            const start=performance.now();const result=original.apply(this,args);
            if(window.backgroundMeasure)window.backgroundTimes[label].push(performance.now()-start);
            return result;
          };
        }
        g.draw(document.querySelector('.game-canvas').getContext('2d'));
        window.backgroundNext=g.elapsed+1.5;window.backgroundAuto=true;window.backgroundHold=false;
      },target);
      await p.waitForTimeout(1600);
      await p.screenshot({path:`output/playwright/background-${config.pass}-${world}-${config.mobile?'mobile':'desktop'}.png`});
      if(config.mobile)await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await p.evaluate(()=>{
        window.backgroundFrames=[];window.backgroundTimes={render:[],scenery:[],build:[]};window.backgroundMeasure=true;
        let last;function frame(now){if(!window.backgroundMeasure)return;if(last)window.backgroundFrames.push(now-last);last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
      });
      await p.waitForTimeout(8000);
      const result=await p.evaluate(()=>{
        window.backgroundMeasure=false;window.backgroundHold=true;
        const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((a,b)=>a+b,0)/(a.length||1),median:a[Math.floor(a.length*.5)]??0,p95:a[Math.floor(a.length*.95)]??0,p99:a[Math.floor(a.length*.99)]??0,max:a.at(-1)??0,over25:a.filter(t=>t>25).length,over50:a.filter(t=>t>50).length}};
        const g=window.backgroundGame,v=g.view,gl=v.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
        let backgroundTriangles=0,backgroundMeshes=0;
        for(const tile of v.adventureScene.tiles.values())tile.root.traverse(m=>{if(m.isMesh){backgroundMeshes++;backgroundTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3}});
        return {frame:stats(window.backgroundFrames),cpu:Object.fromEntries(Object.entries(window.backgroundTimes).map(([k,a])=>[k,stats(a)])),
          draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,
          backgroundTriangles,backgroundMeshes,tiles:v.adventureScene.tiles.size,world:document.querySelector('.world-hud').dataset.world,
          distance:g.physics.distance,answers:g.correct,ended:g.ended,cameraHeight:v.cameraRig.height,
          gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable',
          overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
      });
      if(result.ended||result.overflow)throw Error(JSON.stringify(result));
      report.push({requestedWorld:world,...result});
    }
  } finally {await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();if(context)await context.close()}
  if(errors.length)throw Error(errors.join('\n'));
  return{...config,cpuThrottle:config.mobile?4:1,report,errors};
}
