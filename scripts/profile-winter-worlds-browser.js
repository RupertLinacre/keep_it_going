// playwright-cli run-code --filename scripts/profile-winter-worlds-browser.js
// Real RAF gameplay on this Mac: 4K viewport, then phone layout with 4x CPU
// throttling. The latter is a stress test, not a measurement on a physical phone.
async page => {
  const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await page.context().newCDPSession(page);
  try {
    for(const layout of ['4k','phone','race-4k'])for(const world of layout==='race-4k'?['lapland','winterfair']:['night','lapland','winterfair']) {
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      await page.setViewportSize(layout==='phone'?{width:390,height:844}:{width:3840,height:2160});
      await page.goto('http://localhost:5198/?mode=remix&world='+world+'&seed=42&christmas=1');
      await page.evaluate(async()=>{
        const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
        const {Mini}=await import(url);window.winterStep=Mini.prototype.update;
        Mini.prototype.update=function(dt){
          window.winterGame=this;if(window.winterHold)return;
          if(window.winterAuto&&this.elapsed>=window.winterNext){for(const d of String(this.a*this.b))this.key(d);window.winterNext=this.elapsed+1.8;}
          return window.winterStep.call(this,dt);
        };
      });
      await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-single]').click();
      await page.waitForFunction(()=>window.winterGame?.view);
      await page.evaluate(()=>{
        const g=window.winterGame;window.winterHold=true;g.powerups.update=()=>{};g.powerups.gate=undefined;
        let next=g.elapsed;
        for(let i=0;i<60*4;i++){if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.8;}window.winterStep.call(g,1/60);}
        const v=g.view;
        for(const [o,method,label] of [[v,'render','render'],[v.adventureScene,'render','scenery'],[v.adventureScene,'build','build']]){
          const original=o[method];o[method]=function(...args){const start=performance.now();const result=original.apply(this,args);if(window.winterMeasure)window.winterTimes[label].push(performance.now()-start);return result;};
        }
        window.winterNext=g.elapsed+1.8;window.winterAuto=true;window.winterHold=false;
      });
      if(layout==='race-4k')await page.evaluate(async()=>{
        const g=window.winterGame,{snapshotRide}=await import('/src/multiplayer/ghost.ts');
        // Two moving trains exercise the renderer. Transport latency belongs
        // to the separate WebRTC tests, not these scenery measurements.
        g.multiplayer=true;g.view.multiplayer=true;g.opponent={track:g.track,sample:()=>{
          const remote=snapshotRide(g,1);remote.distance-=18;remote.power=undefined;
          remote.parcels=[];remote.impacts=[];
          for(const b of remote.bodies){const f=g.track.sample((b.rail?.distance??remote.distance)-18);b.position=f.position.toArray();b.rotation=f.rotation.toArray();}
          remote.links=remote.bodies.slice(1).map((b,i)=>({start:b.position,end:remote.bodies[i].position,stress:0}));return remote;
        }};
      });
      await page.waitForTimeout(1200);
      if(layout==='phone')await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await page.evaluate(()=>{
        window.winterFrames=[];window.winterTimes={render:[],scenery:[],build:[]};window.winterMeasure=true;
        let last;function frame(now){if(!window.winterMeasure)return;if(last)window.winterFrames.push(now-last);last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
      });
      await page.waitForTimeout(8000);
      const result=await page.evaluate(()=>{
        window.winterMeasure=false;window.winterHold=true;
        const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((a,b)=>a+b,0)/(a.length||1),p95:a[Math.floor(a.length*.95)]??0,p99:a[Math.floor(a.length*.99)]??0,max:a.at(-1)??0,over25:a.filter(t=>t>25).length,over50:a.filter(t=>t>50).length};};
        const g=window.winterGame,v=g.view,gl=v.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
        return{frame:stats(window.winterFrames),cpu:Object.fromEntries(Object.entries(window.winterTimes).map(([k,a])=>[k,stats(a)])),world:document.querySelector('.world-hud').dataset.world,distance:g.physics.distance,answers:g.correct,ended:g.ended,
          draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,tiles:v.adventureScene.tiles.size,
          pixels:gl.drawingBufferWidth*gl.drawingBufferHeight,pixelRatio:v.renderer.getPixelRatio(),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',
          overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
      });
      if(result.ended||result.overflow||result.world!==world)throw Error(JSON.stringify(result));
      report.push({layout,requestedWorld:world,...result});
      await page.screenshot({path:'output/playwright/winter-worlds/profile-'+world+'-'+layout+'.png'});
    }
  }finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}
  if(errors.length)throw Error(errors.join('\n'));const result={report,errors};await page.evaluate(result=>window.winterProfileReport=result,result);return result;
}
