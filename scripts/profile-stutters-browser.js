// Playwright CLI run-code. Set window.stutterConfig first. Actual rAF gameplay;
// scripted answers take 80ms/digit, every 1.6s. Never changes physics or pacing.
async page => {
  const config=await page.evaluate(()=>({seed:42,seconds:80,throttle:4,mobile:false,pass:'before',...window.stutterConfig}));
  const base=await page.evaluate(()=>location.origin);
  const mobile=config.mobile||config.dpr?await page.context().browser().newContext({viewport:config.mobile?{width:390,height:844}:{width:config.width??2560,height:config.height??1440},deviceScaleFactor:config.dpr??2,isMobile:!!config.mobile,hasTouch:!!config.mobile}):null;
  const p=mobile?await mobile.newPage():page,errors=[];
  const cdp=await p.context().newCDPSession(p);
  const onError=e=>errors.push(e.message);
  p.on('pageerror',onError);
  let peerContext,peer;
  try {
  if(!mobile)await p.setViewportSize({width:config.width??1440,height:config.height??900});
  await p.goto(base+'/?mode=remix&seed='+config.seed);
  await p.evaluate(async()=>{
    const loaded=name=>performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/'+name+'.ts'))?.name??'/src/games/'+name+'.ts';
    const [{Mini},{MiniView},{AdventureScene},{MiniTrack},{HeightTrack},{MiniCarriages},{PowerupScene},{LoopFireworks}]=await Promise.all(
      ['mini','mini-view','adventure-scene','mini-track','height-track','mini-carriages','powerup-scene','loop-fireworks'].map(async name=>import(loaded(name))));
    const data=window.stutterData={frames:[],long:[],events:[],measuring:false,totals:{},builds:[]};
    const wrap=(prototype,key,label,detail)=>{
      const original=prototype[key];if(!original)return;
      prototype[key]=function(...args){
        const start=performance.now();const result=original.apply(this,args);const duration=performance.now()-start;
        if(data.measuring){data.totals[label]=(data.totals[label]??0)+duration;if(detail)data.builds.push({type:label,ms:duration,...detail(this,args)})}
        return result;
      };
    };
    const original=Mini.prototype.update;
    Mini.prototype.update=function(dt){window.stutterGame=this;if(window.stutterHold)return;return original.call(this,dt)};
    wrap(Mini.prototype,'update','update');wrap(Mini.prototype,'hud','hud');
    wrap(MiniTrack.prototype,'ensure','ensure');wrap(MiniTrack.prototype,'append','generate',(s)=>({kind:s.sections.at(-1)?.kind,id:s.sections.at(-1)?.id}));
    wrap(HeightTrack.prototype,'refresh','deform');wrap(MiniCarriages.prototype,'update','carriages');
    wrap(MiniView.prototype,'build','rails',(s,args)=>({kind:args[0].kind,id:args[0].id,rival:!!args[1]}));
    wrap(AdventureScene.prototype,'build','sceneryBuild',(s,args)=>({kind:args[0].kind,id:args[0].id}));
    wrap(AdventureScene.prototype,'render','scenery');wrap(PowerupScene.prototype,'render','powerCost');wrap(LoopFireworks.prototype,'update','fireworks');
    wrap(MiniView.prototype,'render','view');
    const draw=Mini.prototype.draw;
    let previous;
    Mini.prototype.draw=function(...args){
      const start=performance.now();const result=draw.apply(this,args);
      if(data.measuring){
        const v=this.view,now=performance.now(),section=this.track.sectionAt(this.physics.distance);
        const context={distance:+this.physics.distance.toFixed(1),world:document.querySelector('.world-hud')?.dataset.world,
          kind:section.kind,power:this.powerups?.active??'none',moving:!!this.track.moving,
          pieces:v.pieces.size,frames:this.track.sections.reduce((n,s)=>n+s.frames.length,0),
          draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,
          spills:this.carriages.parcels.length,coaches:this.carriages.coaches.length};
        data.frames.push({at:start,interval:previous?start-previous:0,draw:now-start,...data.totals,builds:data.builds,...context});
        if(!data.lastKind||data.lastKind!==section.kind||data.lastPower!==context.power){
          data.events.push({...context,elapsed:+this.elapsed.toFixed(1),neighbours:this.track.sections.map(s=>s.kind)});
          data.lastKind=section.kind;data.lastPower=context.power;
        }
        previous=start;data.totals={};data.builds=[];
      }
      return result;
    };
    new PerformanceObserver(list=>{if(data.measuring)data.long.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration})))}).observe({type:'longtask',buffered:false});
  });
  await p.locator('#ride-difficulty').selectOption('easy');
  if(config.race){
    await p.locator('[data-two]').click();await p.locator('#rider-name').fill('Profile host');await p.locator('[data-create]').click();
    await p.getByText('Invite ready. Waiting for your friend…',{exact:true}).waitFor({timeout:35000});
    const code=(await p.locator('.invite-code').innerText()).trim();
    peerContext=await page.context().browser().newContext({viewport:{width:390,height:844}});peer=await peerContext.newPage();
    await peer.goto(base+'/?mode=remix&join='+code);
    await peer.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url),update=Mini.prototype.update;
      // The other device's GPU should not contaminate measurements on this Mac.
      // Physics, input and actual WebRTC transmission still run normally.
      Mini.prototype.setup=function(){};Mini.prototype.draw=function(){};
      Mini.prototype.update=function(dt){window.remoteGame=this;return update.call(this,dt)};
    });
    await peer.locator('#rider-name').fill('Profile guest');await peer.locator('#multiplayer-difficulty').selectOption('easy');
    await peer.locator('[data-join-form] button').click();
    await p.locator('[data-start-race]:not([disabled])').waitFor({timeout:35000});await p.locator('[data-start-race]').click();
    await p.waitForFunction(()=>window.stutterGame?.multiplayer,null,{timeout:30000});await peer.waitForFunction(()=>window.remoteGame?.multiplayer,null,{timeout:30000});
  }else await p.locator('[data-single]').click();
  await p.waitForFunction(()=>window.stutterGame?.view);
  await p.evaluate(()=>{
    const renderer=window.stutterGame.view.renderer,original=renderer.render,gl=renderer.getContext();
    const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];let tick=0;
    window.stutterData.gpu=[];window.stutterData.glStalls=[];
    for(const method of ['getProgramParameter','getShaderParameter','getUniformLocation','getAttribLocation','bufferData','bufferSubData','texImage2D','drawElements','drawElementsInstanced','drawArrays','useProgram']){
      const call=gl[method].bind(gl);gl[method]=function(...args){const start=performance.now();const result=call(...args);const ms=performance.now()-start;
        if(ms>2&&window.stutterData.measuring){const g=window.stutterGame;window.stutterData.glStalls.push({method,ms,distance:g.physics.distance,power:g.powerups.active??'none',parameter:method.includes('Parameter')?args[1]:undefined})}return result;};
    }
    renderer.render=function(...args){
      const data=window.stutterData;
      while(pending.length&&gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE)){
        const {query,...context}=pending.shift();
        if(!gl.getParameter(ext.GPU_DISJOINT_EXT))data.gpu.push({...context,ms:gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6});
        gl.deleteQuery(query);
      }
      const query=ext&&data.measuring&&++tick%4===0&&pending.length<8?gl.createQuery():null;
      const g=window.stutterGame;
      if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
      const start=performance.now();const r=original.apply(this,args);
      if(data.measuring)data.totals.gpuSubmit=(data.totals.gpuSubmit??0)+performance.now()-start;
      if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,distance:g.physics.distance,kind:g.track.sectionAt(g.physics.distance).kind,power:g.powerups.active??'none'})}
      return r;
    };
  });
  if(config.start)await p.evaluate(target=>{
    const g=window.stutterGame;let next=g.elapsed;
    while(g.physics.distance<target&&!g.ended){if(g.elapsed>=next){for(const d of String(g.a*g.b))g.key(d);next=g.elapsed+1.6}g.update(1/30)}
  },config.start);
  await p.waitForTimeout(1000);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:config.throttle});
  await p.evaluate(()=>{window.stutterData.measuring=true});
  const start=Date.now();let ended=false;
  try {
    while(Date.now()-start<config.seconds*1000){
      const answer=await p.evaluate(()=>{const g=window.stutterGame;return g.ended?null:String(g.a*g.b)});
      if(answer===null){ended=true;break}
      if(config.mobile)for(const digit of answer){await p.locator(`[data-action="digit:${digit}"]`).tap();await p.waitForTimeout(80)}
      else await p.keyboard.type(answer,{delay:80});
      if(peer){const other=await peer.evaluate(()=>window.remoteGame.ended?null:String(window.remoteGame.a*window.remoteGame.b));if(other)await peer.keyboard.type(other,{delay:50})}
      await p.waitForTimeout(1400);
    }
  }finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:1})}
  const report=await p.evaluate(()=>{
    const d=window.stutterData;d.measuring=false;window.stutterHold=true;
    const stats=a=>{a=a.slice().sort((a,b)=>a-b);return{n:a.length,mean:a.reduce((s,v)=>s+v,0)/(a.length||1),p95:a[Math.floor(a.length*.95)]??0,p99:a[Math.floor(a.length*.99)]??0,max:a.at(-1)??0,over25:a.filter(v=>v>25).length,over50:a.filter(v=>v>50).length}};
    const buckets={};for(const f of d.frames){const key=f.world+':'+f.power+':'+f.kind;(buckets[key]??=[]).push(f)}
    const hot=Object.entries(buckets).map(([key,a])=>({key,n:a.length,frame:stats(a.map(f=>f.interval).filter(Boolean)),draw:stats(a.map(f=>f.draw)),update:stats(a.map(f=>f.update??0)),deform:stats(a.map(f=>f.deform??0)),worst:a.slice().sort((a,b)=>b.draw+(b.update??0)-a.draw-(a.update??0)).slice(0,2)}));
    const g=window.stutterGame,v=g.view,gl=v.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    const report={frames:stats(d.frames.map(f=>f.interval).filter(Boolean)),cpu:Object.fromEntries(['draw','update','deform','gpuSubmit','scenery','powerCost','rails','sceneryBuild','generate'].map(k=>[k,stats(d.frames.map(f=>f[k]??0))])),
      // An interval includes the previous draw, so retain that work alongside
      // each hitch instead of blaming the section reached in the following frame.
      worst:d.frames.map((f,i)=>({...f,previous:d.frames[i-1]})).sort((a,b)=>b.interval-a.interval).slice(0,30),hot,events:d.events,long:d.long,
      glStalls:d.glStalls,gpuTimes:stats(d.gpu.map(x=>x.ms)),gpuWorst:d.gpu.slice().sort((a,b)=>b.ms-a.ms).slice(0,20),pixels:[v.renderer.domElement.width,v.renderer.domElement.height],distance:g.physics.distance,elapsed:g.elapsed,answers:g.correct,ended:g.ended,race: g.multiplayer?{received:g.opponent?.latest?.seq,otherDistance:g.opponent?.latest?.distance}:undefined,gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown'};
    window.stutterReport=report;return report;
  });
  await p.screenshot({path:`output/playwright/stutters-${config.pass}-${config.seed}-${config.mobile?'mobile':'desktop'}.png`});
  if(errors.length)throw Error(errors.join('\n'));
  return{config,ended,...report,errors};
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});
    await cdp.detach().catch(()=>{});
    p.off('pageerror',onError);
    if(peerContext)await peerContext.close();
    if(mobile)await mobile.close();
  }
}
