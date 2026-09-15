// Real desktop/mobile connection and UI actions; fixed-speed fixtures make the
// winner/loser transitions repeatable without waiting for a naturally failed ride.
async page => {
  const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[];
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const phone=await context.newPage();
  const bind=async p=>{
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'?mode=remix&seed=42');
    await p.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url),update=Mini.prototype.update;
      Mini.prototype.update=function(dt){window.flowGame=this;if(window.flowFixture){this.elapsed+=dt;this.physics.previousDistance=this.physics.distance;this.physics.distance+=(window.flowSpeed||0)*dt;this.physics.velocity=20;return;}return update.call(this,dt);};
    });
  };
  const waitGame=async p=>{await p.locator('.game-overlay[hidden]').waitFor({state:'attached',timeout:25000});await p.waitForFunction(()=>window.flowGame?.multiplayer);};
  const stop=async(p,distance)=>p.evaluate(distance=>{const g=window.flowGame;g.physics.distance=g.track.startDistance+distance;g.physics.previousDistance=g.physics.distance;g.endRide(false);},distance);
  try {
    await page.setViewportSize({width:1280,height:900});await bind(page);await bind(phone);
    await page.screenshot({path:'output/playwright/multiplayer-start-desktop.png',fullPage:true});
    await phone.screenshot({path:'output/playwright/multiplayer-start-mobile.png',fullPage:true});
    await page.locator('[data-tables="easy"]').click();await page.locator('#ride-difficulty').selectOption('hard');
    await page.locator('[data-two]').click();
    if(await page.locator('[data-join-form]').isVisible())throw Error('Create flow exposes join form');
    await page.locator('#rider-name').fill('Parent');await page.locator('[data-create]').click();
    await page.getByText('Invite ready. Waiting for your friend…',{exact:true}).waitFor({timeout:35000});
    const code=(await page.locator('.invite-code').innerText()).trim();
    await phone.locator('[data-join-choice]').click();
    if(await phone.locator('[data-create]').isVisible())throw Error('Join flow exposes create button');
    await phone.locator('#rider-name').fill('Child');await phone.locator('#multiplayer-difficulty').selectOption('very-easy');
    await phone.locator('#invite-code').fill(code);await phone.locator('[data-join-form] button').click();
    await page.locator('[data-start-race]:not([disabled])').waitFor({timeout:35000});
    await phone.locator('[data-shared-tables]').waitFor();
    const tables=await phone.locator('[data-shared-tables] span').allTextContents();
    if(tables.join(',')!=='2×,5×,10×')throw Error('Host tables not shown: '+tables);
    await phone.screenshot({path:'output/playwright/multiplayer-shared-tables.png',fullPage:true});
    await page.locator('[data-start-race]').click();await waitGame(page);await waitGame(phone);
    for(const p of [page,phone])await p.evaluate(()=>{window.flowFixture=true;window.flowSpeed=0;});
    await page.evaluate(()=>{const g=window.flowGame;g.physics.distance=g.physics.previousDistance=g.track.startDistance+20;});
    await stop(phone,25);await page.waitForTimeout(300);
    if(await page.locator('[data-overlay="keep-going"]').count())throw Error('Victory before passing opponent');
    await page.evaluate(()=>{const g=window.flowGame;g.physics.distance=g.physics.previousDistance=g.track.startDistance+26;window.flowSpeed=10;});
    await page.locator('[data-overlay="keep-going"]').waitFor();
    const frozen=await page.evaluate(()=>window.flowGame.travelled);await page.waitForTimeout(350);
    if(await page.evaluate(()=>window.flowGame.travelled)!==frozen)throw Error('Choice does not pause winner');
    await page.screenshot({path:'output/playwright/multiplayer-winner-choice.png'});
    await page.locator('[data-overlay="keep-going"]').click();
    await phone.getByText(/They’re keeping going/).waitFor();await page.waitForTimeout(600);
    if(await page.evaluate(()=>window.flowGame.travelled)<=frozen)throw Error('Keep going did not resume');
    if(!await phone.evaluate(()=>window.flowGame.ended))throw Error('Loser resumed');
    for(const p of [page,phone])await p.evaluate(()=>{window.previousGame=window.flowGame;});
    await page.locator('[data-race-new]').click();
    for(const p of [page,phone]) {await p.waitForFunction(()=>window.flowGame!==window.previousGame,null,{timeout:20000});await waitGame(p);}
    // Reverse roles: the guest wins and can restart immediately, without host consent.
    for(const p of [page,phone])await p.evaluate(()=>{window.flowSpeed=0;});
    await phone.evaluate(()=>{const g=window.flowGame;g.physics.distance=g.physics.previousDistance=g.track.startDistance+50;});
    await stop(page,40);await phone.locator('[data-overlay="keep-going"]').waitFor();
    await phone.screenshot({path:'output/playwright/multiplayer-winner-mobile.png'});
    for(const p of [page,phone])await p.evaluate(()=>{window.previousGame=window.flowGame;});
    await phone.locator('[data-overlay="new-game"]').click();
    for(const p of [page,phone]){await p.waitForFunction(()=>window.flowGame!==window.previousGame,null,{timeout:20000});await waitGame(p);}
    const settings=await Promise.all([page,phone].map(p=>p.evaluate(()=>({difficulty:window.flowGame.host.difficulty,a:window.flowGame.a,b:window.flowGame.b,ended:window.flowGame.ended}))));
    if(settings[0].difficulty!=='hard'||settings[1].difficulty!=='very-easy'||settings.some(s=>s.ended))throw Error('Rematch lost settings');
    if(errors.length)throw Error(errors.join('\n'));
    return {tables,settings,hostContinueAndRestart:true,guestImmediateRestart:true,errors};
  }finally{await context.close();}
}
