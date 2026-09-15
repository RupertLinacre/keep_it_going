// Run through playwright-cli run-code on the Vite development server.
// Two real browser clients verify independent rail rolls and remote coach poses.
async page => {
  const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[];
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const phone=await context.newPage();
  const bind=async(p,url)=>{
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await p.goto(url);
    await p.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url),update=Mini.prototype.update;
      Mini.prototype.update=function(dt){window.fxGame=this;if(window.fxFreeze){this.elapsed+=dt;return;}return update.call(this,dt);};
    });
  };
  try {
    await page.setViewportSize({width:1280,height:800});await bind(page,base+'?mode=remix&seed=42');
    await page.locator('[data-two]').click();await page.locator('[data-create]').click();
    await page.getByText('Invite ready. Waiting for your friend…',{exact:true}).waitFor({timeout:35000});
    const code=(await page.locator('.invite-code').innerText()).trim();
    await bind(phone,base+'?mode=remix&join='+code);
    await phone.locator('[data-join-form] button').click();
    await page.locator('[data-start-race]:not([disabled])').waitFor({timeout:35000});
    await page.locator('[data-start-race]').click();
    for(const p of [page,phone]) {
      await p.waitForFunction(()=>window.fxGame?.view&&window.fxGame.multiplayer);
      await p.evaluate(()=>{window.fxFreeze=true;});
    }
    await page.waitForTimeout(1000);
    const before=await page.evaluate(()=>{
      const v=window.fxGame.view;
      return [...v.pieces.values()].flatMap(g=>g.children.filter(o=>o.geometry?.hasAttribute('railCenter')).map(o=>o.geometry.attributes.position.version));
    });
    await page.evaluate(()=>{const g=window.fxGame;g.powerups.activate('reverse',g.physics,g.carriages);g.powerups.age=2;g.powerups.remaining=18;});
    await phone.waitForFunction(()=>window.fxGame.view.rollUniforms[1].value>3.13,null,{timeout:15000});
    await page.waitForTimeout(500);
    const inspect=p=>p.evaluate(()=>{
      const g=window.fxGame,v=g.view,remote=g.opponent.sample(),body=remote?.bodies[0];
      const q=body?.rotation;
      // World up of a quaternion, without importing a second copy of Three.
      const up=q?[2*(q[0]*q[1]-q[2]*q[3]),1-2*(q[0]*q[0]+q[2]*q[2]),2*(q[1]*q[2]+q[0]*q[3])]:undefined;
      const base=body?.rail?g.opponent.track.sample(body.rail.distance).up:undefined;
      return {roll:v.rollUniforms.map(u=>u.value),remoteUpDot:up&&base?up[0]*base.x+up[1]*base.y+up[2]*base.z:null,
        positionVersions:[...v.pieces.values()].flatMap(g=>g.children.filter(o=>o.geometry?.hasAttribute('railCenter')).map(o=>o.geometry.attributes.position.version)),
        overflow:document.documentElement.scrollWidth>innerWidth,calls:v.renderer.info.render.calls};
    });
    const desktop=await inspect(page),mobile=await inspect(phone);
    if(desktop.roll[0]<3.13||desktop.roll[1]!==0||mobile.roll[0]!==0||mobile.roll[1]<3.13||mobile.remoteUpDot>-.99)throw Error(JSON.stringify({desktop,mobile}));
    if(JSON.stringify(before)!==JSON.stringify(desktop.positionVersions))throw Error('Roll rebuilt static rail buffers');
    await page.screenshot({path:'output/playwright/ride-effects-race-desktop.png'});
    await phone.screenshot({path:'output/playwright/ride-effects-race-mobile.png'});
    await page.evaluate(()=>{const g=window.fxGame;g.powerups.age=19.4;g.powerups.remaining=.6;});
    await phone.waitForFunction(()=>Math.abs(window.fxGame.view.rollUniforms[1].value-Math.PI/2)<.4,null,{timeout:10000});
    await page.evaluate(()=>{const g=window.fxGame;g.powerups.finish(g.physics,g.carriages);});
    await phone.waitForFunction(()=>window.fxGame.view.rollUniforms[1].value===0,null,{timeout:10000});
    if(errors.length)throw Error(errors.join('\n'));
    return {desktop,mobile,restored:true,errors};
  } finally {await context.close();}
}
