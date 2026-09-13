// Run via playwright-cli run-code against Vite. Fixed-position visual fixtures
// isolate camera response; the final ride uses normal timed keyboard answers.
async (page) => {
  const base = await page.evaluate(() => new URL('/', location.href).href);
  const errors = [], results = [];
  const bind = async target => {
    target.on('pageerror', e => errors.push(e.message));
    await target.goto(base + '?mode=remix&seed=42');
    await target.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find(e => e.name.includes('/src/games/mini.ts')).name;
      const { Mini } = await import(url), original = Mini.prototype.update;
      Mini.prototype.update = function(dt) {
        window.tiltGame = this;
        if (window.freezeRide) { this.elapsed += dt; this.powerHud?.render(this.powerups, this.physics.distance); return; }
        return original.call(this, dt);
      };
      window.tiltFrames = []; let last;
      const frame = now => { if (last) window.tiltFrames.push(now-last); last=now; if (!window.tiltDone) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    });
    await target.locator('[data-single]').click();
    await target.waitForFunction(() => window.tiltGame);
  };
  const snapshot = target => target.evaluate(() => {
    const g=window.tiltGame, v=g.view;
    const lead=g.carriages.poses(g.physics.renderDistance,g.physics.renderAlpha)[0].frame.position.clone();
    const angle=v?.scene.rotation.z;
    const boardForward=v && lead.clone().set(1,0,0).transformDirection(v.board.matrixWorld);
    const boardPitch=boardForward ? Math.atan2(-boardForward.y,boardForward.x) : 0;
    if(v) { lead.x-=Math.floor(lead.x/25)*25; lead.applyMatrix4(v.scene.matrixWorld).project(v.camera); }
    return { height:v?.cameraRig.height, angle, tilt:g.physics.options.worldTilt, boardPitch, inlay:v?.boardInlay.visible,
      screen:lead.toArray(), objects:g.carriages.cameraSubjects(g.physics.sample(g.physics.distance).position).length,
      overflow:document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight+1 };
  });
  const fixture = async (target,name) => {
    await bind(target);
    await target.evaluate(() => { window.freezeRide=true; const g=window.tiltGame; g.powerups.gate=undefined; g.view && (g.view.cameraRig.height=0); });
    await target.waitForTimeout(1200);
    const normal=await snapshot(target);
    for (const kind of ['ice','reverse','cargo','lift','heavy','wind','tilt']) {
      await target.evaluate(kind => {
        const g=window.tiltGame; g.powerups.activate(kind,g.physics,g.carriages);
        g.powerups.age=2;g.powerups.remaining=18;g.powerups.apply(g.physics,g.carriages);g.panel();
      },kind);
      await target.waitForTimeout(1100);
      const state=await snapshot(target);
      if(Math.abs(state.boardPitch-state.tilt)>.00001 || state.inlay !== (kind==='tilt')) throw new Error('The physical board did not tilt with the power');
      if(state.height > normal.height*1.08 || state.overflow || Math.abs(state.screen[0])>.85 || Math.abs(state.screen[1])>.85) throw new Error(JSON.stringify({kind,name,normal,state}));
      results.push({name,kind,...state});
    }
    await target.screenshot({path:`output/playwright/tilt-${name}.png`,scale:'css'});
    await target.evaluate(() => {
      const g=window.tiltGame, f=g.physics.sample(g.physics.distance), zero=f.position.clone().set(0,0,0);
      for(let i=0;i<64;i++) g.carriages.parcels.push({position:f.position.clone().add(zero.clone().set(600+i,1000+i,0)),velocity:zero.clone(),rotation:f.rotation.clone(),angularVelocity:zero.clone(),age:0,bounces:0,groundedFor:0});
      for(const flags of [{water:true},{dynamite:true}]) g.carriages.explosions.push({...flags,position:f.position.clone(),age:.2,colorIndex:0,particles:Array.from({length:28},()=>({position:f.position.clone().add(zero.clone().set(800,800,0)),velocity:zero.clone(),size:.5}))});
    });
    await target.waitForTimeout(1000);
    const outliers=await snapshot(target);
    if(outliers.height>normal.height*1.08 || outliers.objects!==0) throw new Error(JSON.stringify({name,outliers,normal}));
    await target.evaluate(() => {
      const g=window.tiltGame;g.powerups.finish(g.physics,g.carriages);g.carriages.parcels.length=0;g.carriages.explosions.length=0;
      for(let i=0;i<5;i++)g.track.raise(g.physics.distance);
      g.track.advance(1.5);g.view.cameraRig.height=0;
    });
    await target.waitForTimeout(1100);
    const sky=await snapshot(target);
    if(sky.height>normal.height*1.12 || Math.abs(sky.screen[1])>.85) throw new Error(JSON.stringify({name,normal,sky}));
    await target.screenshot({path:`output/playwright/tilt-${name}-raised.png`,scale:'css'});
    await target.evaluate(() => { window.tiltDone=true; });
    return {normal,outliers,sky};
  };
  await page.setViewportSize({width:1440,height:900});
  const desktop=await fixture(page,'desktop');
  await page.keyboard.press('p');
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  let mobile,fallback,ride;
  try {
    const phone=await context.newPage(); mobile=await fixture(phone,'mobile');
    await phone.setViewportSize({width:844,height:390});await phone.waitForTimeout(200);
    if((await snapshot(phone)).overflow)throw new Error('Landscape overflow');
    await phone.addInitScript(() => {
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args){return String(kind).includes('webgl')?null:original.call(this,kind,...args);};
    });
    await phone.setViewportSize({width:390,height:844});await bind(phone);
    await phone.evaluate(()=>{window.freezeRide=true;const g=window.tiltGame;g.powerups.activate('tilt',g.physics,g.carriages);g.powerups.age=2;g.powerups.apply(g.physics,g.carriages);g.panel();});
    await phone.waitForTimeout(800);await phone.screenshot({path:'output/playwright/tilt-fallback.png',scale:'css'});
    fallback=await snapshot(phone);if(fallback.overflow || !fallback.tilt)throw new Error(JSON.stringify(fallback));
    await phone.keyboard.press('p');
  } finally { await context.close(); }
  await bind(page);
  await page.evaluate(()=>{const g=window.tiltGame;g.powerups.gate={kind:'tilt',distance:g.physics.distance+2,id:0};});
  for(let i=0;i<10;i++) {
    const value=await page.evaluate(()=>String(window.tiltGame.a*window.tiltGame.b));
    await page.keyboard.type(value);await page.waitForTimeout(1800);
  }
  ride=await page.evaluate(()=>{
    window.tiltDone=true;const g=window.tiltGame,frames=window.tiltFrames.slice(90).sort((a,b)=>a-b);
    return {answers:g.correct,ended:g.ended,metres:g.travelled,active:g.powerups.active,
      fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p99:frames[Math.floor(frames.length*.99)],max:frames.at(-1)};
  });
  await page.screenshot({path:'output/playwright/tilt-playing.png',scale:'css'});
  await page.keyboard.press('p');
  if(ride.answers!==10 || ride.ended || errors.length)throw new Error(JSON.stringify({ride,errors}));
  return {desktop,mobile,fallback,ride,results,errors};
}
