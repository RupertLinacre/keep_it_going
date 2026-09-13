// Run via playwright-cli against the Vite development server. Injects receive-side
// jitter into two real WebRTC peers, then checks both views and late-game ground.
async page => {
  const base=page.url().split(/[?#]/)[0];
  const assert=(value,message)=>{if(!value)throw new Error(message)};
  const instrument=async p=>p.evaluate(async()=>{
    const resources=performance.getEntriesByType('resource');
    const {Mini}=await import(resources.find(r=>/\/src\/games\/mini\.ts/.test(r.name)).name);
    const setup=Mini.prototype.setup;
    Mini.prototype.setup=function(){window.renderGame=this;return setup.call(this)};
    const {RaceSession}=await import(resources.find(r=>/\/src\/multiplayer\/session\.ts/.test(r.name)).name);
    const open=RaceSession.prototype.open;
    RaceSession.prototype.open=function(...args){window.renderSession=this;return open.apply(this,args)};
    const receive=RaceSession.prototype.receive;let packet=0;
    RaceSession.prototype.receive=function(message){
      if(message.kind==='state'){const delay=[35,100,50,140,40,110][packet++%6];setTimeout(()=>receive.call(this,message),delay)}
      else receive.call(this,message);
    };
  });
  await page.goto(base);await instrument(page);
  await page.locator('#ride-difficulty').selectOption('very-easy');
  await page.locator('[data-two]').click();await page.locator('[data-create]').click();
  await page.getByText('Invite ready. Waiting for your friend…',{exact:true}).waitFor({timeout:25000});
  const code=await page.locator('.invite-code').innerText();
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const other=await context.newPage();
  const errors=[];for(const p of [page,other])p.on('pageerror',e=>errors.push(e.message));
  try{
    await other.goto(base+'?join='+code);await instrument(other);
    await other.locator('#multiplayer-difficulty').selectOption('very-easy');
    await other.getByRole('button',{name:'Join →',exact:true}).click();
    await page.locator('[data-start-race]:not([disabled])').waitFor();
    await other.evaluate(()=>renderSession.connection.on('data', data=>{if(data?.renderProbe)window.probeBytes=data.renderProbe.length}));
    await page.evaluate(()=>renderSession.connection.send({renderProbe:'x'.repeat(40000)}));
    await other.waitForFunction(()=>window.probeBytes===40000);
    await page.locator('[data-start-race]').click();await page.locator('.game-overlay[hidden]').waitFor({state:'attached'});
    await other.locator('.game-overlay[hidden]').waitFor({state:'attached'});
    for(const p of [page,other])await p.evaluate(()=>{
      window.motionSamples=[];let last;
      function sample(now){const g=window.renderGame;if(!g)return;
        const remote=g.opponent.sample(now);
        window.motionSamples.push({dt:last?now-last:0,time:g.elapsed,x:remote?.bodies[0]?.position[0],p:remote?.bodies[0]?.position,speed:remote?.speed,rail:!!remote?.bodies[0]?.rail,s:remote?.distance,offset:g.view.spacing.offset});last=now;
        window.checkRaf=requestAnimationFrame(sample);
      }window.checkRaf=requestAnimationFrame(sample);
    });
    for(let i=0;i<18;i++){
      for(const p of [page,other]){
        const answer=await p.evaluate(()=>String(renderGame.a*renderGame.b));
        await p.keyboard.type(answer,{delay:50});
      }
      if(i===6){await page.screenshot({path:'output/playwright/network-desktop.png'});await other.screenshot({path:'output/playwright/network-mobile.png'});}
      await page.waitForTimeout(1650);
    }
    const report={errors,chunkedBytes:40000,views:[]};
    for(const p of [page,other])report.views.push(await p.evaluate(()=>{
      cancelAnimationFrame(window.checkRaf);
      const rows=window.motionSamples.filter(r=>r.time>3&&r.dt>0&&r.speed>0.1);
      const steps=rows.slice(1).map((r,i)=>r.s-rows[i].s);
      const ratios=rows.slice(1).flatMap((r,i)=>r.rail&&rows[i].rail&&r.dt<25 ? [Math.hypot(...r.p.map((v,j)=>v-rows[i].p[j]))/(Math.max(10,r.speed)*r.dt/1000)] : []);
      return {railMotionMaxRatio:Math.max(...ratios),frames:rows.length,fps:1000/(rows.reduce((sum,r)=>sum+r.dt,0)/rows.length),repeated:steps.filter(d=>d===0).length,maxStep:Math.max(...steps),correct:renderGame.correct};
    }));
    // Inspect much larger real generated elements without modifying the saved game.
    await page.keyboard.press('p');
    await page.evaluate(()=>{
      const g=renderGame;g.draw=()=>{};g.track.ensure(9000);g.physics.distance=9000;g.physics.previousDistance=9000;g.physics.velocity=35;
      g.view.spacing.offset=0;g.view.cameraRig.height=0;
      document.querySelector('.game-overlay').hidden=true;
      g.view.render(9000,35,0,false,6,undefined,g.elapsed+1,1);
    });
    await page.screenshot({path:'output/playwright/large-ground.png'});
    assert(!errors.length,errors.join('\n'));
    await page.evaluate(report=>{window.networkRenderReport=report},report);
    return report;
  }finally{await context.close()}
}
