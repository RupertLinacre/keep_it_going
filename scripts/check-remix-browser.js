// Vite + playwright-cli run-code. Uses normal answer input; individual visual
// fixtures move a collectible gate close to the train, not the train off its rail.
async (page) => {
  const base = await page.evaluate(() => new URL('/', location.href).href);
  const errors = [], portraits = [];
  const bind = async target => {
    target.on('pageerror', e => errors.push(e.message));
    await target.goto(base + '?mode=remix&seed=42');
    await target.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find(e => e.name.includes('/src/games/mini.ts')).name;
      const { Mini } = await import(url), original = Mini.prototype.update;
      window.remixFrames = []; window.remixActions = [];
      Mini.prototype.update = function(dt) { window.remixGame = this; return original.call(this, dt); };
      const action = Mini.prototype.action;
      Mini.prototype.action = function(v) {
        const before = this.correct, speed = this.physics.velocity, lift = this.liftingAnswers;
        const result = action.call(this, v);
        if (this.correct > before) window.remixActions.push({ lift, before: speed, after: this.physics.velocity });
        return result;
      };
      let last;
      const frame = now => { if (last) window.remixFrames.push(now-last); last=now; if (!window.remixDone) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    });
    await target.getByRole('button', { name: '1 player Jump straight in' }).click();
    await target.waitForFunction(() => window.remixGame);
  };
  const answer = async (target, touch = false) => {
    const text = await target.locator('.prompt h2').innerText(), m = text.match(/(\d+) × (\d+)/);
    if (!m) throw new Error('Question missing');
    const value = String(Number(m[1])*Number(m[2]));
    for (const digit of value) {
      if (touch) await target.locator(`[data-action="digit:${digit}"]`).tap();
      else await target.keyboard.type(digit);
    }
    if (await target.locator('.answer-display').innerText() !== value) throw new Error('Answer feedback disappeared');
  };
  const report = async target => target.evaluate(() => {
    window.remixDone = true;
    const g = window.remixGame, f = window.remixFrames.slice(60).sort((a,b) => a-b);
    return { answers: g.correct, distance: Math.round(g.travelled), ended: g.ended, seed: g.track.seed,
      active: g.powerups.active, collected: g.powerups.collected, gravity: g.physics.options.gravity,
      cargo: g.carriages.coaches.map(c => ({ count: c.cargo, dynamite: c.dynamite })),
      lifts: g.track.lifts.length, actions: window.remixActions,
      fps: 1000/(f.reduce((a,b) => a+b,0)/f.length), p99: f[Math.floor(f.length*.99)],
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1 };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await bind(page);
  let pauseChecked = false;
  for (let i = 0; i < 18; i++) {
    await answer(page); await page.waitForTimeout(1900);
    if (!pauseChecked && await page.evaluate(() => !!window.remixGame.powerups.active)) {
      await page.keyboard.press('p');
      const before = await page.evaluate(() => window.remixGame.powerups.remaining);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => window.remixGame.powerups.remaining);
      if (before !== after) throw new Error('Power timer advanced while paused');
      await page.keyboard.press('p'); pauseChecked = true;
    }
  }
  const natural = await report(page);
  if (natural.answers !== 18 || natural.ended || natural.collected < 1 || natural.overflow) throw new Error(JSON.stringify(natural));
  for (const kind of ['ice','reverse','cargo','lift','heavy','wind','tilt']) {
    await bind(page); await answer(page);
    await page.evaluate(kind => {
      const g = window.remixGame;
      g.powerups.gate = { kind, distance: g.physics.distance+6, id: 0 };
    }, kind);
    await page.waitForFunction(kind => window.remixGame.powerups.active === kind, kind);
    await page.waitForTimeout(400); await answer(page);
    await page.waitForTimeout(550);
    await page.screenshot({ path: `output/playwright/remix-${kind}.png`, scale: 'css' });
    await page.waitForTimeout(600); await answer(page); await page.waitForTimeout(500);
    const result = await report(page); portraits.push({ kind, ...result });
    if (result.active !== kind || result.ended || result.overflow) throw new Error(JSON.stringify(result));
    if (result.actions.some(a => a.lift ? a.before !== a.after : a.after <= a.before)) throw new Error('Wrong answer mechanism');
  }
  await page.keyboard.press('p');
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mobile = await context.newPage();
  let phone, fallback;
  try {
    await bind(mobile);
    for (let i=0; i<8; i++) { await answer(mobile,true); await mobile.waitForTimeout(1700); }
    await mobile.screenshot({ path: 'output/playwright/remix-mobile.png', scale: 'css' });
    phone = await report(mobile);
    if (phone.answers !== 8 || phone.ended || phone.overflow) throw new Error(JSON.stringify(phone));
    await mobile.setViewportSize({ width: 844, height: 390 });
    await mobile.waitForTimeout(200);
    await mobile.screenshot({ path: 'output/playwright/remix-landscape.png', scale: 'css' });
    if (await mobile.evaluate(() => document.documentElement.scrollHeight > innerHeight+1)) throw new Error('Landscape overflow');
    await mobile.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return String(kind).includes('webgl') ? null : original.call(this,kind,...args); };
    });
    await mobile.setViewportSize({ width: 390, height: 844 });
    await bind(mobile); await answer(mobile,true);
    await mobile.evaluate(() => { const g = window.remixGame; g.powerups.gate = {kind:'cargo',distance:g.physics.distance+1,id:0}; });
    await mobile.waitForTimeout(1300); await answer(mobile,true);
    await mobile.screenshot({ path: 'output/playwright/remix-fallback.png', scale: 'css' });
    fallback = await report(mobile);
    if (fallback.answers !== 2 || fallback.overflow || fallback.active !== 'cargo') throw new Error('Fallback failed');
  } finally { await context.close(); }
  if (errors.length) throw new Error(errors.join('\n'));
  const result = { natural, portraits, phone, fallback, pauseChecked, errors };
  await page.evaluate(result => { window.remixCheck = result; }, result);
  return result;
}
