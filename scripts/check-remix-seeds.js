// Run via playwright-cli run-code against the Vite development server.
async (page) => {
  const base = await page.evaluate(() => new URL('/', location.href).href);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const open = async query => {
    await page.goto(base + query);
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').find(e => e.name.includes('/src/games/mini.ts')).name;
      const { Mini } = await import(url), update = Mini.prototype.update;
      Mini.prototype.update = function(dt) { window.seedGame = this; return update.call(this, dt); };
    });
  };
  const start = async () => {
    await page.locator('[data-single]').click();
    await page.waitForFunction(() => window.seedGame);
    await page.keyboard.press('p');
    return page.evaluate(() => ({ seed: window.seedGame.track.seed, remix: window.seedGame.remixMode }));
  };
  const restart = async () => {
    await page.evaluate(() => { window.previousSeedGame = window.seedGame; });
    await page.getByRole('button', { name: 'Start again', exact: true }).click();
    await page.waitForFunction(() => window.seedGame !== window.previousSeedGame);
    await page.keyboard.press('p');
    return page.evaluate(() => window.seedGame.track.seed);
  };
  await open('?mode=height&seed=RIVER');
  await page.locator('.remix-settings summary').click();
  if (await page.locator('#course-seed').inputValue() !== 'RIVER') throw new Error('Seed link was not populated');
  const fixed = await start(), fixedReplay = await restart();
  if (!fixed.remix || fixed.seed !== fixedReplay) throw new Error('Fixed seed restart changed course');
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async value => { window.copiedRide = value; } }); });
  await page.locator('[data-copy-seed]').click();
  const copied = await page.evaluate(() => window.copiedRide);
  const link = await page.evaluate(value => {
    const query = new URL(value).searchParams;
    return { mode: query.get('mode'), seed: Number(query.get('seed')) };
  }, copied);
  if (link.mode !== 'remix' || link.seed !== fixed.seed) throw new Error('Copy ride serialized the wrong course');

  await open('?mode=remix');
  const fresh = await start(), freshReplay = await restart();
  if (fresh.seed === freshReplay) throw new Error('Blank seed restart reused the course');
  await open('?mode=remix&seed=0');
  const zero = await start();
  if (zero.seed !== 0) throw new Error('Zero is a valid seed');
  await page.keyboard.press('p');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'output/playwright/remix-gate.png', scale: 'css' });

  await open('?mode=classic');
  await page.locator('[data-two]').click();
  await page.getByRole('heading', { name: 'Bring a friend' }).waitFor();
  await page.locator('[data-back]').click();
  const classic = await start();
  if (classic.remix || await page.locator('.power-hud').count()) throw new Error('Remix leaked into classic');
  await page.keyboard.press('p');
  const equation = await page.locator('.prompt h2').innerText(), m = equation.match(/(\d+) × (\d+)/);
  await page.keyboard.type(String(Number(m[1])*Number(m[2])));
  const classicAnswers = await page.evaluate(() => window.seedGame.correct);
  if (classicAnswers !== 1) throw new Error('Classic answer input failed');
  await page.keyboard.press('p');
  await open('?join=ABCD');
  await page.getByRole('heading', { name: 'Bring a friend' }).waitFor();
  if (await page.locator('#invite-code').inputValue() !== 'ABCD') throw new Error('Classic invite route broke');
  if (errors.length) throw new Error(errors.join('\n'));
  return { fixed, fixedReplay, copied, fresh, freshReplay, zero, classic, classicAnswers, inviteRoute: true, errors };
}
