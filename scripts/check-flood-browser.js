// Vite + playwright-cli run-code: real flooded geometry and game updates on desktop/phone.
async (page) => {
  const base = await page.evaluate(() => new URL('/', location.href).href);
  const errors = [];
  const bind = async target => {
    target.on('pageerror', e => errors.push(e.message));
    await target.goto(base + '?mode=remix&seed=18');
    await target.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find(e => e.name.includes('/src/games/mini.ts')).name;
      const { Mini } = await import(url), original = Mini.prototype.update;
      Mini.prototype.update = function(dt) { window.floodGame = this; return original.call(this, dt); };
    });
    await target.locator('[data-single]').click();
    await target.waitForFunction(() => window.floodGame);
    await target.evaluate(() => {
      const g = window.floodGame;
      g.track.ensure(g.physics.distance, 2000);
      const pool = g.track.sections.find(s => s.kind === 'splash');
      g.physics.distance = pool.start - 25; g.physics.previousDistance = g.physics.distance;
      g.physics.velocity = 34;
      g.powerups.gate = {kind:'wind', distance:pool.end+1000, id:0};
      g.view && (g.view.cameraRig.height = 0);
      window.floodPool = pool; window.floodFrames = []; window.floodDone = false;
      let last;
      const frame = now => { if (last) window.floodFrames.push(now-last); last=now; if (!window.floodDone) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    });
  };
  const run = async (target, name) => {
    await bind(target);
    await target.waitForFunction(() => window.floodGame.carriages.floodEntries === 1);
    const entry = await target.evaluate(() => window.floodGame.physics.velocity);
    await target.waitForTimeout(300);
    await target.screenshot({ path:`output/playwright/flood-${name}.png`, scale:'css' });
    await target.waitForTimeout(450);
    await target.screenshot({ path:`output/playwright/flood-${name}-wake.png`, scale:'css' });
    await target.waitForFunction(() => window.floodGame.physics.distance > window.floodPool.end);
    const report = await target.evaluate(() => {
      window.floodDone = true;
      const g = window.floodGame, frames = window.floodFrames.slice(30).sort((a,b) => a-b);
      return { exitSpeed:g.physics.velocity, ended:g.ended, flooded:g.carriages.floodEntries,
        active:g.powerups.active ?? null, drag:g.physics.dragAt(g.physics.distance), baseDrag:g.physics.options.drag,
        fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length), p99:frames[Math.floor(frames.length*.99)], maxFrame:frames.at(-1),
        overflow:document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight+1 };
    });
    if (report.ended || report.active || report.flooded !== 1 || report.overflow || report.exitSpeed >= entry || report.drag !== report.baseDrag) throw new Error(JSON.stringify(report));
    // Pausing also freezes the spray; reuse the normal pause control.
    await target.keyboard.press('p');
    return {entrySpeed:entry, ...report};
  };
  await page.setViewportSize({width:1440,height:900});
  const desktop = await run(page, 'desktop');
  const context = await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  let mobile, fallback;
  try {
    const phone = await context.newPage();
    mobile = await run(phone, 'mobile');
    await phone.setViewportSize({width:844,height:390});
    await phone.screenshot({path:'output/playwright/flood-landscape.png',scale:'css'});
    if (await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight+1)) throw new Error('Landscape overflow');
    await phone.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return String(kind).includes('webgl') ? null : original.call(this,kind,...args); };
    });
    await phone.setViewportSize({width:390,height:844});
    fallback = await run(phone, 'fallback');
  }
  finally { await context.close(); }
  await page.goto(base + 'tracks.html?element=splash&km=0');
  await page.locator('#piece-title').filter({hasText:'Splash Zone'}).waitFor();
  await page.screenshot({path:'output/playwright/flood-gallery.png',scale:'css'});
  if (errors.length) throw new Error(errors.join('\n'));
  return {desktop,mobile,fallback,gallery:true,errors};
}
