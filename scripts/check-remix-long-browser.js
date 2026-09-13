// Three-minute rendered ride, using real keyboard answers about every two seconds.
async (page) => {
  const base = await page.evaluate(() => new URL('/', location.href).href);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '?mode=remix&seed=18');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(e => e.name.includes('/src/games/mini.ts')).name;
    const { Mini } = await import(url), update = Mini.prototype.update;
    Mini.prototype.update = function(dt) { window.longGame = this; return update.call(this, dt); };
    window.longFrames = []; window.longDone = false;
    let last;
    const frame = now => {
      if (last && window.longGame && !window.longGame.ended) window.longFrames.push({ dt: now-last, power: window.longGame.powerups.active ?? 'normal' });
      last = now;
      if (!window.longDone) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.locator('#ride-difficulty').selectOption('normal');
  await page.locator('[data-single]').click();
  const seen = [];
  for (let i = 0; i < 88; i++) {
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => ({ ended: window.longGame.ended, kind: window.longGame.powerups.active }));
    if (state.ended) throw new Error('The long ride ended before completing the visual check');
    if (state.kind && !seen.includes(state.kind)) {
      seen.push(state.kind);
      await page.screenshot({ path: `output/playwright/remix-natural-${state.kind}.png`, scale: 'css' });
    }
    const m = (await page.locator('.prompt h2').innerText()).match(/(\d+) × (\d+)/);
    await page.keyboard.type(String(Number(m[1])*Number(m[2])));
  }
  const result = await page.evaluate(() => {
    window.longDone = true;
    const g = window.longGame, groups = {};
    for (const frame of window.longFrames.slice(60)) (groups[frame.power] ??= []).push(frame.dt);
    return { seconds: g.elapsed, metres: g.travelled, answers: g.correct, collected: g.powerups.collected,
      carts: g.cartCount, looseParcels: g.carriages.parcels.length, sections: g.track.sections.length, lifts: g.track.lifts.length,
      timing: Object.fromEntries(Object.entries(groups).map(([key, frames]) => {
        frames.sort((a,b) => a-b);
        return [key, { fps: 1000/(frames.reduce((a,b) => a+b,0)/frames.length), p99: frames[Math.floor(frames.length*.99)], over33ms: frames.filter(n => n>33.5).length }];
      })),
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight+1 };
  });
  await page.keyboard.press('p');
  if (seen.length !== 7 || errors.length || result.overflow) throw new Error(JSON.stringify({ seen, errors, result }));
  return { ...result, seen, errors };
}
