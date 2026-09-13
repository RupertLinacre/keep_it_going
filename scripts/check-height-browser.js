// Run through playwright-cli run-code against the Vite development server.
async (page) => {
  const base = await page.evaluate(() => new URL('/', location.href).href);
  const errors = [];
  const inspect = async (target, mobile) => {
    target.on('pageerror', error => errors.push(error.message));
    await target.addInitScript(() => {
      let seed = 731;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; };
    });
    await target.goto(base);
    await target.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find(e => e.name.includes('/src/games/mini.ts')).name;
      const { Mini } = await import(url);
      const update = Mini.prototype.update, action = Mini.prototype.action;
      window.liftChecks = []; window.frameTimes = [];
      Mini.prototype.update = function(dt) { window.heightGame = this; return update.call(this, dt); };
      Mini.prototype.action = function(value) {
        const correct = this.correct, speed = this.physics.velocity;
        const result = action.call(this, value);
        if (this.correct > correct) window.liftChecks.push({ speedBefore: speed, speedAfter: this.physics.velocity });
        return result;
      };
      let last;
      const frame = now => { if (last) window.frameTimes.push(now - last); last = now; if (!window.measureDone) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    });
    await target.getByRole('button', { name: '1 player Jump straight in' }).click();
    await target.waitForFunction(() => window.heightGame);
    if (!mobile) {
      await target.keyboard.type('999'); await target.keyboard.press('Escape');
      if (await target.locator('.answer-display').innerText() !== '?') throw new Error('Escape failed');
    }
    for (let i = 0; i < 8; i++) {
      const text = await target.locator('.prompt h2').innerText();
      const [,a,b] = text.match(/(\d+) × (\d+)/);
      const answer = String(Number(a)*Number(b));
      for (const digit of answer) {
        if (mobile) await target.locator(`[data-action="digit:${digit}"]`).tap();
        else await target.keyboard.type(digit);
      }
      if (await target.locator('.answer-display').innerText() !== answer) throw new Error('Accepted answer vanished too early');
      if (i === 1) {
        await target.waitForTimeout(550);
        await target.screenshot({ path: `output/playwright/height-${mobile ? 'mobile' : 'desktop'}-lifting.png` });
        await target.waitForTimeout(1650);
      } else await target.waitForTimeout(2200);
    }
    const result = await target.evaluate(() => {
      window.measureDone = true;
      const game = window.heightGame, frames = window.frameTimes.slice(60).sort((a,b) => a-b);
      const keypad = document.querySelector('.number-pad');
      return { correct: game.correct, ended: game.ended, distance: Math.round(game.travelled),
        height: game.track.elevation(game.physics.distance), lifts: window.liftChecks,
        overflow: document.documentElement.scrollWidth > innerWidth,
        keypadVisible: getComputedStyle(keypad).display !== 'none',
        fps: 1000/(frames.reduce((a,b) => a+b, 0)/frames.length), p99: frames[Math.floor(frames.length*.99)] };
    });
    if (result.correct !== 8 || result.ended || result.overflow || result.keypadVisible !== mobile) throw new Error(JSON.stringify(result));
    if (result.lifts.some(l => l.speedBefore !== l.speedAfter)) throw new Error('Answer changed speed directly');
    await target.keyboard.press('p');
    return result;
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = await inspect(page, false);
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const phone = await context.newPage();
  let mobile;
  try {
    mobile = await inspect(phone, true);
    await phone.setViewportSize({ width: 844, height: 390 });
    await phone.keyboard.press('p');
    await phone.waitForTimeout(200);
    await phone.screenshot({ path: 'output/playwright/height-mobile-landscape.png' });
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 1);
    if (overflow) throw new Error('Landscape overflows');
  } finally { await context.close(); }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.evaluate(result => { window.heightCheck = result; }, { desktop, mobile, errors });
  return { desktop, mobile, errors };
}
