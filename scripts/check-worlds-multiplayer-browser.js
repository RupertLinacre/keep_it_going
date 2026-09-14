// Vite + playwright-cli run-code: real WebRTC race, normal answers, then bounded
// fixtures for every power and simultaneous cargo/splash rendering.
async page => {
  const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report={};
  const softwareRenderer=await page.evaluate(()=>!!window.checkSoftwareRenderer);
  const suffix=softwareRenderer?'-software':'';report.softwareRenderer=softwareRenderer;
  const check=(ok,message)=>{if(!ok)throw new Error(message)};
  const bind=async(p,url)=>{
    p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
    await p.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url),update=Mini.prototype.update;
      Mini.prototype.update=function(dt){
        window.raceGame=this;
        if(window.raceFixture){this.step(dt);this.powerups.update(dt,this.track,this.physics,this.carriages);this.carriages.update(dt,this.physics.distance,0,false);return;}
        return update.call(this,dt);
      };
      window.raceFrames=[];let last;
      const frame=now=>{if(last&&window.raceGame&&!window.raceGame.ended)window.raceFrames.push(now-last);last=now;if(!window.raceDone)requestAnimationFrame(frame)};requestAnimationFrame(frame);
      navigator.clipboard.writeText=async text=>{window.copiedInvite=text};
    });
  };
  const answer=async(p,touch=false)=>{
    const value=await p.evaluate(()=>String(window.raceGame.a*window.raceGame.b));
    for(const d of value)if(touch)await p.locator(`[data-action="digit:${d}"]`).tap();else await p.keyboard.type(d);
  };
  const waitRace=async p=>{await p.locator('.game-overlay[hidden]').waitFor({state:'attached',timeout:30000});await p.waitForFunction(()=>window.raceGame?.multiplayer)};
  const inspect=async p=>p.evaluate(()=>{
    const g=window.raceGame,v=g.view,s=g.opponent.latest;
    return {seed:g.track.seed,generative:g.track.options.generative,mode:g.remixMode,difficulty:g.host.difficulty,role:g.riderRole,answers:g.correct,ended:g.ended,
      ownPower:g.powerups.active,remotePower:s?.power?.active,received:s?.seq,remoteCargo:s?.bodies.map(b=>({cargo:b.cargo,bombs:b.bombs})),
      railColors:v?[v.railMaterial(0).color.getHexString(),v.railMaterial(0,true).color.getHexString()]:[],
      localWeather:v?.powerScene?.group.position.z,remoteWeather:v?.opponentPowerScene?.group.position.z,
      splashSheets:v?.splashSheets.count,drops:v?.waterDroplets.count,webgl:!!v,
      ownFlood:g.carriages.explosions.some(e=>e.flood),remoteFlood:s?.impacts.some(e=>e.flood),
      overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
  });
  await page.setViewportSize({width:1440,height:900});await bind(page,base+'?mode=remix&seed=42');
  check(await page.locator('[data-two]').isVisible(),'Remix exposes 2 players');
  await page.locator('#ride-difficulty').selectOption('easy');
  await page.locator('[data-two]').click();await page.locator('#rider-name').fill('Parent');await page.locator('[data-create]').click();
  await page.getByText('Invite ready. Waiting for your friend…',{exact:true}).waitFor({timeout:25000});
  const code=(await page.locator('.invite-code').innerText()).trim();
  await page.locator('[data-copy="link"]').click();
  const invite=await page.evaluate(()=>window.copiedInvite);check(invite.includes('mode=remix'),'Invite includes Remix mode');
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  if(softwareRenderer)await context.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:original.call(this,type,...args)};
  });
  try{
    const phone=await context.newPage();
    // A code must also join the host's mode if the guest started on Classic.
    await bind(phone,base+`?mode=classic&join=${code}`);await phone.locator('#rider-name').fill('Child');await phone.locator('#multiplayer-difficulty').selectOption('normal');
    await phone.locator('[data-join-form] button').click();
    await page.locator('[data-start-race]:not([disabled])').waitFor({timeout:25000});
    await phone.getByText('You’re connected. Your friend will start the ride.',{exact:true}).waitFor({timeout:25000});
    check((await phone.locator('.lobby-mode').innerText()).includes('Remix'),'Host determines lobby mode');
    await page.locator('[data-start-race]').click();await Promise.all([waitRace(page),waitRace(phone)]);
    const begin=await Promise.all([inspect(page),inspect(phone)]);
    check(begin.every(g=>g.seed===42&&g.generative&&g.mode),'Both generate the same Remix course');
    check(begin[0].difficulty==='easy'&&begin[1].difficulty==='normal','Personal difficulties retained');
    check(softwareRenderer||begin[0].railColors[0]===begin[1].railColors[1]&&begin[0].railColors[1]===begin[1].railColors[0],'Track identity colours match');
    check(begin[1].webgl!==softwareRenderer,'Requested phone renderer is active');
    for(const p of[page,phone])await p.evaluate(()=>{window.raceFrames=[]});
    for(let i=0;i<10;i++){await Promise.all([answer(page),answer(phone,true)]);await page.waitForTimeout(1600)}
    report.performance=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
      const a=[...window.raceFrames].sort((a,b)=>a-b),mean=a.reduce((a,b)=>a+b,0)/a.length;
      return{frames:a.length,fps:1000/mean,p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)};
    })));
    report.natural=await Promise.all([inspect(page),inspect(phone)]);
    check(report.natural.every(g=>g.answers===10&&!g.ended&&g.received>80&&!g.overflow),'Natural race remains connected and playable: '+JSON.stringify(report.natural));
    // Freeze route positions on an ordinary flat, but advance simulation time,
    // power clocks, effects and real network transmission independently.
    for(const p of [page,phone])await p.evaluate(()=>{
      const g=window.raceGame;window.raceFixture=true;g.powerups.finish(g.physics,g.carriages);
      const section=g.track.sections.find(s=>s.kind==='station')??g.track.sections[0];
      g.physics.distance=section.start+section.length*.5;g.physics.previousDistance=g.physics.distance;g.physics.velocity=0;g.physics.flight=undefined;g.physics.traces=[];
      g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
    });
    for(const p of [page,phone])await p.evaluate(async()=>{
      const {MiniTrack}=await import('/src/games/mini-track.ts');
      const track=new MiniTrack(window.raceGame.track.seed,{generative:true});track.ensure(0,5000);
      window.worldRaceSections=track.sections.slice();
    });
    report.worlds=[];
    for(const [kind,min,max]of [['sheepbank',0,900],['pondbridge',0,900],['windmillloop',0,900],['mountainpass',900,1900],['tunnel',900,1900],['ravinebridge',900,1900],['lanternrun',1900,3000],['midwayloop',1900,3000],['carouselhelix',1900,3000],['pumpkinhop',3000,4200],['pumpkintunnel',3000,4200],['witchhat',3000,4200]]){
      for(const p of [page,phone])await p.evaluate(({kind,min,max})=>{
        const g=window.raceGame;
        const route=window.worldRaceSections;
        g.track.sections.splice(0,g.track.sections.length,...route.filter(s=>s.end>=min-180));
        const s=g.track.sections.find(s=>s.kind===kind&&s.start>=min&&s.start<max);
        if(!s)throw Error('Missing world section '+kind+' at '+min);
        g.physics.distance=s.start+s.length*.48;g.physics.previousDistance=g.physics.distance;g.physics.velocity=0;g.physics.flight=undefined;g.physics.traces=[];
        g.powerups.finish(g.physics,g.carriages);g.powerups.gate=undefined;
        g.carriages.coaches.forEach(c=>{c.lift=0;c.liftSpeed=0});if(g.view)g.view.cameraRig.height=0;
      },{kind,min,max});
      await page.waitForTimeout(1800);
      const views=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
        const g=window.raceGame,v=g.view,s=g.track.sectionAt(g.physics.distance),tile=v?.adventureScene.tiles.get(s.id);
        return{world:document.querySelector('.world-hud').dataset.world,kind:s.kind,position:g.physics.distance,remote:g.opponent.latest?.distance,
          mirror:!v||!!tile.mirrorFormation,colors:v?[v.railMaterial(0).color.getHexString(),v.railMaterial(0,true).color.getHexString()]:[],
          backdrop:!v||tile.root.children.filter(m=>!m.userData.front).every(m=>Math.abs(m.position.z+v.laneOffset+2*s.origin.z)<.001),
          overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
      })));
      check(views[0].world===views[1].world&&views.every(v=>v.kind===kind&&Math.abs(v.position-v.remote)<.1&&v.mirror&&v.backdrop&&!v.overflow),'World race sync/layout: '+JSON.stringify(views));
      check(softwareRenderer||views[0].colors[0]===views[1].colors[1]&&views[0].colors[1]===views[1].colors[0],'World keeps player colours');
      report.worlds.push(views);
      await page.screenshot({path:`output/playwright/world-race-${views[0].world}-${kind}-desktop${suffix}.png`});
      await phone.screenshot({path:`output/playwright/world-race-${views[0].world}-${kind}-mobile${suffix}.png`});
    }
    for(const p of [page,phone])await p.evaluate(async()=>{
      const {MiniTrack}=await import('/src/games/mini-track.ts'),g=window.raceGame;
      const track=new MiniTrack(g.track.seed,{generative:true});track.ensure(g.physics.distance,600);
      g.track=track;g.physics.track=track;g.carriages.track=track;g.opponent.track=track;if(g.view)g.view.track=track;
    });
    report.powers=[];
    const kinds=['ice','reverse','cargo','heavy','wind'];
    for(let i=0;i<kinds.length;i++){
      for(const [p,kind]of[[page,kinds[i]],[phone,kinds[(i+1)%kinds.length]]])await p.evaluate(kind=>{const g=window.raceGame;g.powerups.activate(kind,g.physics,g.carriages)},kind);
      await page.waitForFunction(kind=>window.raceGame.opponent.latest?.power?.active===kind,kinds[(i+1)%kinds.length]);
      await phone.waitForFunction(kind=>window.raceGame.opponent.latest?.power?.active===kind,kinds[i]);
      await page.waitForTimeout(700);
      const pair=await Promise.all([inspect(page),inspect(phone)]);report.powers.push(pair);
      check(pair.every(g=>!g.overflow&&(!g.webgl||g.localWeather>0&&g.remoteWeather<0)),'Powers stay in their respective lanes');
      check(pair[0].railColors.join()===begin[0].railColors.join()&&pair[1].railColors.join()===begin[1].railColors.join(),'Powers preserve track identity');
      if(kinds[i]==='cargo')check(pair[1].remoteCargo.some(c=>c.cargo===8&&c.bombs),'Eight boxes and TNT reach the opponent');
    }
    await page.screenshot({path:`output/playwright/remix-race-desktop${suffix}.png`,scale:'css'});await phone.screenshot({path:`output/playwright/remix-race-mobile${suffix}.png`,scale:'css'});
    await page.keyboard.press('p');await phone.getByRole('heading',{name:'Parent paused.'}).waitFor();
    const before=await Promise.all([page.evaluate(()=>[window.raceGame.powerups.remaining,window.raceGame.view?.adventureScene.luminous.clock.value]),phone.evaluate(()=>[window.raceGame.powerups.remaining,window.raceGame.view?.adventureScene.luminous.clock.value])]);
    await page.waitForTimeout(500);const after=await Promise.all([page.evaluate(()=>[window.raceGame.powerups.remaining,window.raceGame.view?.adventureScene.luminous.clock.value]),phone.evaluate(()=>[window.raceGame.powerups.remaining,window.raceGame.view?.adventureScene.luminous.clock.value])]);
    check(JSON.stringify(before)===JSON.stringify(after),'Pause freezes both power clocks');await page.locator('[data-overlay="resume"]').click();
    for(const p of [page,phone])await p.evaluate(()=>{
      const g=window.raceGame;g.track.ensure(g.physics.distance,2500);const pool=g.track.sections.find(s=>s.kind==='splash');
      if(!pool)throw new Error('No flooded piece');
      window.raceFixture=false;g.powerups.finish(g.physics,g.carriages);g.powerups.gate={kind:'wind',distance:pool.end+1000,id:99};
      g.physics.distance=pool.start-15;g.physics.previousDistance=g.physics.distance;g.physics.velocity=34;g.physics.flight=undefined;g.physics.traces=[];g.carriages.explosions.length=0;
      g.carriages.floodEntries=0;window.pool=pool;if(g.view)g.view.cameraRig.height=0;
    });
    await page.waitForFunction(()=>window.raceGame.carriages.floodEntries>0);await phone.waitForFunction(()=>window.raceGame.carriages.floodEntries>0);
    await page.waitForTimeout(300);
    report.splash=await Promise.all([inspect(page),inspect(phone)]);
    check(report.splash.every(g=>g.ownFlood&&g.remoteFlood&&(!g.webgl||g.drops>0&&g.splashSheets>0)),'Both lanes render large splashes: '+JSON.stringify(report.splash));
    await phone.screenshot({path:`output/playwright/remix-race-splash-mobile${suffix}.png`,scale:'css'});
    await page.waitForFunction(()=>window.raceGame.physics.distance>window.pool.end);
    await phone.waitForFunction(()=>window.raceGame.physics.distance>window.pool.end);
    for(const size of[{width:844,height:390},{width:320,height:568}]){
      await phone.setViewportSize(size);await phone.waitForTimeout(200);
      check(await phone.evaluate(()=>{const k=document.querySelector('.number-pad').getBoundingClientRect();return k.bottom<=innerHeight+1&&k.top>=0&&document.documentElement.scrollWidth<=innerWidth}),'Keypad fits rotated/small phone');
    }
    for(const p of [page,phone])await p.evaluate(()=>{window.raceFixture=false;const g=window.raceGame;g.endRide(false)});
    await page.getByText('RACE COMPLETE',{exact:true}).waitFor();await phone.getByText('RACE COMPLETE',{exact:true}).waitFor();
    const a=await page.locator('.race-results strong').allInnerTexts(),b=await phone.locator('.race-results strong').allInnerTexts();check(a[0]===b[1]&&a[1]===b[0],'Results agree');
    await page.locator('[data-overlay="rematch"]').click();await phone.getByText('Your friend is ready for another ride.',{exact:true}).waitFor();await phone.locator('[data-overlay="rematch"]').click();
    await Promise.all([waitRace(page),waitRace(phone)]);
    const rematch=await Promise.all([inspect(page),inspect(phone)]);check(rematch.every(g=>g.mode&&g.seed===42&&g.answers===0),'Rematch retains Remix and specified seed');report.rematch=rematch;
    await phone.locator('[data-menu]').click();await page.getByRole('heading',{name:'We lost the connection.'}).waitFor({timeout:20000});
    report.invite=invite;report.errors=errors;check(!errors.length,errors.join('\n'));
  }finally{await context.close();await page.evaluate(()=>{window.raceDone=true})}
  return report;
}
