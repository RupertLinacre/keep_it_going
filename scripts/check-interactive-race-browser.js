// Vite + playwright-cli run-code: a real WebRTC desktop/phone race, followed by
// all four interactive attractions at different speeds on the two clients.
// Set window.checkSoftwareRenderer=true first to use Canvas on the phone.
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
        if(window.raceFixture){this.step(dt);this.physics.previousDistance=this.physics.distance;this.physics.distance+=(window.raceVelocity||0)*dt;this.physics.velocity=window.raceVelocity||0;this.powerups.update(dt,this.track,this.physics,this.carriages);this.carriages.update(dt,this.physics.distance,window.raceVelocity||0,false);return;}
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
    for(let i=0;i<3;i++){await Promise.all([answer(page),answer(phone,true)]);await page.waitForTimeout(1600)}
    report.performance=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
      const a=[...window.raceFrames].sort((a,b)=>a-b),mean=a.reduce((a,b)=>a+b,0)/a.length;
      return{frames:a.length,fps:1000/mean,p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)};
    })));
    report.natural=await Promise.all([inspect(page),inspect(phone)]);
    check(report.natural.every(g=>g.answers===3&&!g.ended&&g.received>20&&!g.overflow),'Natural race remains connected and playable: '+JSON.stringify(report.natural));
    // Place controlled checkpoints while retaining game time, effects and real
    // network transmission. These fixtures are separate from the FPS sample.
    for(const p of [page,phone])await p.evaluate(()=>{
      const g=window.raceGame;window.raceFixture=true;g.powerups.finish(g.physics,g.carriages);
      const section=g.track.sections.find(s=>s.kind==='station')??g.track.sections[0];
      g.physics.distance=section.start+section.length*.5;g.physics.previousDistance=g.physics.distance;g.physics.velocity=0;g.physics.flight=undefined;g.physics.traces=[];
      g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
    });
    for(const p of [page,phone])await p.evaluate(async()=>{
      const {MiniTrack}=await import('/src/games/mini-track.ts');
      const track=new MiniTrack(window.raceGame.track.seed,{generative:true,multiplayer:true});track.ensure(0,5000);
      window.worldRaceSections=track.sections.slice();
    });
    report.worlds=[];
    for(const [kind,min,max]of [['carouselhelix',1900,3000],['tunnel',900,1900],['sheepbank',0,900],['pumpkintunnel',3000,4200]]){      for(const p of [page,phone])await p.evaluate(({kind,min,max})=>{
        const g=window.raceGame;
        const route=window.worldRaceSections;
        g.track.sections.splice(0,g.track.sections.length,...route.filter(s=>s.end>=min-180));
        const s=g.track.sections.find(s=>s.kind===kind&&s.start>=min&&s.start<max);
        if(!s)throw Error('Missing world section '+kind+' at '+min);window.interactionS=s;
        g.physics.distance=kind==='carouselhelix'?s.start+s.distances[Math.round(s.resolution*.15)]:kind==='sheepbank'?s.start+s.length*.16-28:s.start+s.length/2-22;g.physics.previousDistance=g.physics.distance;g.physics.velocity=0;g.physics.flight=undefined;g.physics.traces=[];
        g.powerups.finish(g.physics,g.carriages);g.powerups.gate={kind:'wind',distance:s.end+1000,id:99};window.raceVelocity=0;if(g.view){g.view.adventureScene?.destroy();g.view.adventureScene=undefined}
        g.carriages.coaches.forEach(c=>{c.lift=0;c.liftSpeed=0});if(g.view)g.view.cameraRig.height=0;
      },{kind,min,max});
      await page.waitForTimeout(1000);
      await page.evaluate(()=>{window.raceVelocity=12});await phone.evaluate(()=>{window.raceVelocity=5});
      await page.waitForTimeout(2800);
      const views=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
        const g=window.raceGame,v=g.view,s=window.interactionS,tile=v?.adventureScene.tiles.get(s.id);
        return{world:document.querySelector('.world-hud').dataset.world,kind:s.kind,position:g.physics.distance,remote:g.opponent.latest?.distance,
          portal:tile?.portals?.map(p=>({age:p.age,hits:p.hits})),mirror:!v||!!tile.mirrorFormation,colors:v?[v.railMaterial(0).color.getHexString(),v.railMaterial(0,true).color.getHexString()]:[],
          backdrop:!v||tile.root.children.filter(m=>!m.userData.front).every(m=>Math.abs(m.position.z+v.laneOffset+2*s.origin.z)<.001),
          overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
      })));
      check(views[0].world===views[1].world&&views.every(v=>v.mirror&&v.backdrop&&!v.overflow),'World race sync/layout: '+JSON.stringify(views));
      check(softwareRenderer||views[0].colors[0]===views[1].colors[1]&&views[0].colors[1]===views[1].colors[0],'World keeps player colours');
      if(kind==='pumpkintunnel'){
        check(views[0].portal?.[0].hits===1&&views[0].portal?.[1].hits===0,'Host hits its own stack first: '+JSON.stringify(views));
        if(!softwareRenderer)check(views[1].portal?.[0].hits===0&&views[1].portal?.[1].hits===1,'Guest sees only the rival stack burst');
      }
      report.worlds.push(views);
      await page.screenshot({path:`output/playwright/interactive-race-${views[0].world}-${kind}-desktop${suffix}.png`});
      await phone.screenshot({path:`output/playwright/interactive-race-${views[0].world}-${kind}-mobile${suffix}.png`});
    }
    report.errors=errors;check(!errors.length,errors.join('\n'));
  }finally{await context.close();await page.evaluate(()=>{window.raceDone=true})}
  return report;
}
