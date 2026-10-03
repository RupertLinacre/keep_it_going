// Real desktop/phone WebRTC race: answers and independent Confetti Clouds.
async page => {
 const errors=[],base='http://localhost:5198/',report={};
 const bind=async(p,url)=>{
  p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
  await p.evaluate(async()=>{
   const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
   const {Mini}=await import(url),update=Mini.prototype.update;
   Mini.prototype.update=function(dt){window.selectionGame=this;if(window.selectionHold){this.step(dt);this.powerups.update(dt,this.track,this.physics,this.carriages);this.carriages.update(dt,this.physics.distance,0,false);return;}return update.call(this,dt)};
  });
 };
 await page.setViewportSize({width:1440,height:900});await bind(page,base+'?mode=remix&seed=42');
 await page.locator('#ride-difficulty').selectOption('easy');await page.locator('[data-two]').click();
 await page.locator('#rider-name').fill('Parent');await page.locator('[data-create]').click();
 await page.getByText('Invite ready. Waiting for your friend…',{exact:true}).waitFor({timeout:25000});
 const code=(await page.locator('.invite-code').innerText()).trim();
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 try {
  const phone=await context.newPage();await bind(phone,base+`?mode=remix&join=${code}`);
  await phone.locator('#rider-name').fill('Child');await phone.locator('#multiplayer-difficulty').selectOption('easy');
  await phone.locator('[data-join-form] button').click();
  await page.locator('[data-start-race]:not([disabled])').waitFor({timeout:25000});await page.locator('[data-start-race]').click();
  for(const p of [page,phone])await p.waitForFunction(()=>window.selectionGame?.multiplayer&&window.selectionGame.opponent.latest);
  for(let i=0;i<6;i++) {
   await Promise.all([page,phone].map(async p=>{
    const answer=await p.evaluate(()=>String(window.selectionGame.a*window.selectionGame.b));
    if(p===phone)for(const digit of answer)await p.locator(`[data-action="digit:${digit}"]`).tap();else await p.keyboard.type(answer);
   }));await page.waitForTimeout(950);
  }
  report.answers=await Promise.all([page,phone].map(p=>p.evaluate(()=>({correct:window.selectionGame.correct,ended:window.selectionGame.ended,received:window.selectionGame.opponent.latest.seq}))));
  if(report.answers.some(v=>v.correct!==6||v.ended||v.received<10))throw Error('Race answer flow failed');
  for(const p of [page,phone])await p.evaluate(()=>{window.selectionHold=true;const g=window.selectionGame;g.physics.velocity=0;g.physics.flight=undefined;g.powerups.finish(g.physics,g.carriages);g.powerups.answers=0;g.carriages.parcels.length=0;g.carriages.flights.length=0;});
  await page.evaluate(()=>{const g=window.selectionGame;g.powerups.activate('confetti',g.physics,g.carriages)});
  await phone.evaluate(()=>{const g=window.selectionGame;g.powerups.activate('wind',g.physics,g.carriages)});
  await phone.waitForFunction(()=>window.selectionGame.opponent.latest?.power?.active==='confetti'&&window.selectionGame.view?.opponentSmoke?.effect.group.getObjectByName('smoke-stars')?.count>0);
  await page.waitForFunction(()=>window.selectionGame.opponent.latest?.power?.active==='wind'&&window.selectionGame.view?.trainSmoke.effect.group.getObjectByName('smoke-stars')?.count>0);
  report.powers=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
   const g=window.selectionGame,v=g.view;return {own:g.powerups.active,remote:g.opponent.latest.power.active,ownStars:v.trainSmoke.effect.group.getObjectByName('smoke-stars').count,remoteStars:v.opponentSmoke.effect.group.getObjectByName('smoke-stars').count,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
  })));
  if(report.powers.some(v=>v.overflow))throw Error('Race layout overflow');
  await page.screenshot({path:'output/playwright/selected-confetti-desktop.png'});await phone.screenshot({path:'output/playwright/selected-confetti-phone.png'});
  await page.waitForFunction(()=>!window.selectionGame.powerups.active,undefined,{timeout:23000});
  await phone.waitForFunction(()=>!window.selectionGame.opponent.latest.power.active&&window.selectionGame.view.opponentSmoke.effect.group.getObjectByName('smoke-stars').count===0,undefined,{timeout:5000});
  report.expired=true;if(errors.length)throw Error(errors.join('\n'));return {...report,errors};
 } finally {await context.close();}
}
