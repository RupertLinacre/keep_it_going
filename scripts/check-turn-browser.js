// Run in playwright-cli on the local Vite game. Use ?network=relay or
// ?network=relay-tls to prove relay use (TLS mode cannot use a direct/UDP route).
async (page) => {
  const base = await page.evaluate(() => { const url = new URL(location.href); url.searchParams.set('mode', 'remix'); return url.href; });
  const mode = await page.evaluate(() => new URL(location.href).searchParams.get('network') || 'auto');
  const browser = page.context().browser();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await context.newPage();
  const errors = [];
  for (const p of [page, phone]) p.on('pageerror', error => errors.push(error.message));
  const instrument = async p => p.evaluate(async () => {
    const { RaceSession } = await import(performance.getEntriesByType('resource').find(r => /multiplayer\/session\.ts/.test(r.name)).name);
    const original = RaceSession.prototype.open;
    RaceSession.prototype.open = function(...args) { window.relaySession = this; return original.apply(this, args); };
    const { Mini } = await import('/src/games/mini.ts');
    const setup = Mini.prototype.setup;
    Mini.prototype.setup = function(...args) { window.relayGame = this; return setup.apply(this, args); };
  });
  try {
    await page.goto(base); await instrument(page);
    await page.locator('#ride-difficulty').selectOption('very-easy');
    await page.locator('[data-two]').click(); await page.locator('[data-create]').click();
    await page.getByText('Invite ready. Waiting for your friend…', { exact: true }).waitFor({ timeout: 35000 });
    const code = await page.locator('.invite-code').innerText();
    await phone.goto(base + '&join=' + code); await instrument(phone);
    await phone.locator('#multiplayer-difficulty').selectOption('very-easy');
    await phone.getByRole('button', { name: 'Join →', exact: true }).click();
    await page.locator('[data-start-race]:not([disabled])').waitFor({ timeout: 35000 });
    for (const p of [page, phone]) await p.waitForFunction(() => window.relaySession.network.route !== 'unknown', null, { timeout: 10000 });
    await page.locator('[data-start-race]').click();
    for (const p of [page, phone]) await p.waitForFunction(() => window.relaySession.phase === 'racing');
    for (let i = 0; i < 4; i++) {
      for (const p of [page, phone]) {
        const answer = await p.evaluate(() => String(window.relayGame.a * window.relayGame.b));
        for (const key of answer) {
          if (p === phone) await p.locator(`[data-action="digit:${key}"]`).click();
          else await p.keyboard.type(key);
        }
      }
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(1000);
    const views = await Promise.all([page, phone].map(p => p.evaluate(() => ({
      network: window.relaySession.diagnostics(), answers: window.relayGame.correct,
      opponentAnswers: window.relayGame.opponent.latest?.correct,
      overflow: document.documentElement.scrollWidth > innerWidth,
      speed: window.relayGame.physics.velocity,
      policy: window.relaySession.connection.peerConnection.getConfiguration().iceTransportPolicy,
    }))));
    if (views.some(v => v.answers !== 4 || v.opponentAnswers !== 4 || v.overflow || v.speed <= 0)) throw new Error('Race failed: ' + JSON.stringify(views));
    if (mode !== 'auto' && views.some(v => v.network.route !== 'relay' || v.policy !== 'relay')) throw new Error('Did not use relay: ' + JSON.stringify(views));
    if (mode === 'relay-tls' && views.some(v => v.network.relayProtocol !== 'tls')) throw new Error('Did not use TURN over TLS: ' + JSON.stringify(views));
    if (errors.length) throw new Error(errors.join('\n'));
    await phone.screenshot({ path: `output/playwright/turn-${mode}-mobile.png` });
    return { mode, views, errors };
  } finally {
    await context.close();
    await page.evaluate(() => window.relaySession?.close());
  }
}
