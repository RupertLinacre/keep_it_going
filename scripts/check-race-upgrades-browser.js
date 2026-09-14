// Vite + playwright-cli run-code: a real WebRTC desktop/phone race, followed by
// answer-earned gates, icicles and independent Sky lift animations.
// Set window.checkSoftwareRenderer=true first to use Canvas on the phone.
async page => {
  const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report={};
  const softwareRenderer=await page.evaluate(()=>!!window.checkSoftwareRenderer);
  const suffix=softwareRenderer?'-software':'';report.softwareRenderer=softwareRenderer;
  const check=(ok,message)=>{if(!ok)throw new Error(message)};
  const bind=async(p,url)=>{
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Error creating WebGL context'))errors.push(m.text())});await p.goto(url);
    await p.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
      const {Mini}=await import(url),update=Mini.prototype.update;
      Mini.prototype.update=function(dt){
        window.raceGame=this;
        if(window.raceFixture){this.step(dt);this.physics.previousDistance=this.physics.distance;this.physics.distance+=(window.raceVelocity||0)*dt;this.physics.velocity=window.raceVelocity||0;this.powerups.update(dt,this.track,this.physics,this.carriages);this.track.advance?.(dt);this.carriages.update(dt,this.physics.distance,window.raceVelocity||0,false);return;}
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

    for(const p of [page,phone])check(await p.evaluate(()=>!window.raceGame.powerups.gate&&!window.raceGame.powerups.active),'Three answers cannot reveal a gate');
    await Promise.all([answer(page),answer(phone,true)]);await page.waitForTimeout(100);
    report.earned=await Promise.all([page,phone].map(p=>p.evaluate(()=>({answers:window.raceGame.powerups.answers,gate:window.raceGame.powerups.gate}))));
    check(report.earned.every(p=>p.answers===4&&p.gate),'Fourth answers reveal each rider’s gate');
    // Hold a flat section at low speed to compare the same view before/after ice
    // and isolate each rider’s height animation from travel through the course.
    for(const p of[page,phone])await p.evaluate(()=>{
      const g=window.raceGame;window.raceFixture=true;window.raceVelocity=0;
      const s=g.track.sections.find(s=>s.kind==='station'&&s.start>0);
      g.physics.distance=s.start+s.length*.5;g.physics.previousDistance=g.physics.distance;g.physics.velocity=0;g.physics.flight=undefined;g.physics.traces=[];
      g.powerups.finish(g.physics,g.carriages);g.powerups.answers=0;
      g.carriages.parcels.length=0;g.carriages.flights.length=0;g.carriages.explosions.length=0;
    });
    await page.waitForTimeout(1600);
    const ground=await page.evaluate(()=>window.raceGame.view.material('#d5e3c3').color.toArray());
    await page.evaluate(()=>{const g=window.raceGame;g.powerups.activate('ice',g.physics,g.carriages)});
    await page.waitForTimeout(1400);
    report.ice=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
      const g=window.raceGame,v=g.view;
      return{power:g.powerups.active,remote:g.opponent.latest?.power?.active,icicles:v?.icicleParts?.[0].mesh.count,ground:v?.material('#d5e3c3').color.toArray(),spacing:v?.laneOffset};
    })));
    check(report.ice[0].icicles>=6&&report.ice[0].remote===undefined,'Only the powered train has icicles');
    check(report.ice[0].ground.every((x,i)=>Math.abs(x-ground[i])<.0001),'Ice leaves the earth colour unchanged');
    check(report.ice[1].remote==='ice','Guest receives host ice');
    await page.screenshot({path:`output/playwright/race-upgrades-ice-desktop${suffix}.png`});
    await phone.screenshot({path:`output/playwright/race-upgrades-ice-mobile${suffix}.png`});
    for(const p of[page,phone])await p.evaluate(()=>{const g=window.raceGame;g.powerups.activate('lift',g.physics,g.carriages)});
    const baseHeights=await Promise.all([page,phone].map(p=>p.evaluate(()=>window.raceGame.track.height(window.raceGame.physics.distance))));
    await answer(page);await page.waitForTimeout(450);await answer(page);await page.waitForTimeout(1500);
    const inspectHeights=async p=>p.evaluate(()=>{
      const g=window.raceGame,r=g.opponent.sample(),v=g.view,t=g.opponent.track;
      return {own:g.track.elevation(g.physics.distance),other:t.elevation(r.distance),received:g.opponent.latest.heights,
        trainError:Math.max(...r.bodies.filter(b=>b.rail).map(b=>Math.abs(b.position[1]-t.height(b.rail.distance)-b.rail.lift))),
        meshError:!v?0:Math.abs(v.opponentPieces.get(g.track.sectionAt(g.physics.distance).id).children[0].geometry.attributes.position.getY(0)
          -(t.height(g.track.sectionAt(g.physics.distance).start)-g.track.sectionAt(g.physics.distance).origin.y)),
        localSection:g.track.sectionAt(g.physics.distance).id,railBuffersSeparate:!v||v.pieces.get(g.track.sectionAt(g.physics.distance).id).children[0].geometry!==v.opponentPieces.get(g.track.sectionAt(g.physics.distance).id).children[0].geometry,
        overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1};
    });
    report.firstLift=await Promise.all([inspectHeights(page),inspectHeights(phone)]);
    check(report.firstLift[0].own===60&&report.firstLift[0].other===0&&report.firstLift[1].own===0&&report.firstLift[1].other===60,'Only host track rises: '+JSON.stringify(report.firstLift));
    check(report.firstLift.every(v=>v.railBuffersSeparate&&v.trainError<.001&&v.meshError<.01&&!v.overflow),'Coaches follow separate raised rail meshes');
    await page.screenshot({path:`output/playwright/race-upgrades-lift-host-desktop${suffix}.png`});
    await phone.screenshot({path:`output/playwright/race-upgrades-lift-host-mobile${suffix}.png`});
    await answer(phone,true);await page.waitForTimeout(1500);
    report.bothLift=await Promise.all([inspectHeights(page),inspectHeights(phone)]);
    check(report.bothLift[0].own===60&&report.bothLift[0].other===30&&report.bothLift[1].own===30&&report.bothLift[1].other===60,'Each player retains their own height');
    await page.screenshot({path:`output/playwright/race-upgrades-lift-both-desktop${suffix}.png`});
    await phone.screenshot({path:`output/playwright/race-upgrades-lift-both-mobile${suffix}.png`});
    // Real-time lifting and rendering while packets keep flowing. Do not run
    // compilation concurrently with this timing sample.
    for(const p of[page,phone])await p.evaluate(()=>{window.raceFrames=[]});
    for(let i=0;i<4;i++){await Promise.all([answer(page),answer(phone,true)]);await page.waitForTimeout(1250)}
    report.liftPerformance=await Promise.all([page,phone].map(p=>p.evaluate(()=>{
      const a=[...window.raceFrames].sort((a,b)=>a-b),mean=a.reduce((a,b)=>a+b,0)/a.length;
      return {frames:a.length,fps:1000/mean,p99:a[Math.floor(a.length*.99)],over50:a.filter(x=>x>50).length};
    })));
    report.errors=errors;check(!errors.length,errors.join('\n'));
  }finally{await context.close();await page.evaluate(()=>{window.raceDone=true})}
  return report;
}
