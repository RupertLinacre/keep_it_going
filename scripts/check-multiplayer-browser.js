// Run with playwright-cli run-code --filename=scripts/check-multiplayer-browser.js
// against the development server or a production build. Uses two real WebRTC peers.
async (page) => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const base = page.url().split(/[?#]/)[0];
  const softwareRenderer = await page.evaluate(() => !!window.checkSoftwareRenderer);
  const suffix = softwareRenderer ? "-software" : "";
  const report = { softwareRenderer, checks: [], performance: {} };
  const check = message => report.checks.push(message);
  let mobileContext;
  const waitFor = async (p, selector) => p.locator(selector).waitFor({ state: selector.includes('[hidden]') ? 'attached' : 'visible', timeout: 25000 });
  const visible = (p, selector) => p.locator(selector).isVisible();
  const answer = async (p, touch = false) => {
    const text = await p.locator('.prompt h2').innerText();
    const match = text.match(/(\d+) × (\d+)/);
    assert(match && match[1] === '7', 'Only the selected seven times table is asked');
    const value = String(Number(match[1]) * Number(match[2]));
    if (touch) for (const digit of value) await p.getByRole('button', { name: digit, exact: true }).click();
    else await p.keyboard.type(value, { delay: 60 });
    return value;
  };
  try {
    await page.goto(base+"?mode=classic");
    assert(await page.locator("#ride-difficulty option").count() === 5, "Five difficulty levels are available");
    await page.locator("#ride-difficulty").selectOption("very-easy");
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    assert(await page.locator('[data-single]').isDisabled(), 'An empty table selection cannot start a solo ride');
    await page.getByRole('checkbox', { name: '7×', exact: true }).check();
    await page.getByRole('button', { name: '1 player Jump straight in' }).click();
    await waitFor(page, '.mini-canvas');
    assert(!await visible(page, '.number-pad'), 'Desktop does not show a keypad');
    const value = await answer(page);
    assert((await page.locator('.answer-display').innerText()) === value, 'Complete accepted answer remains briefly visible');
    check('One player starts directly; selected table, keyboard acceptance and brief answer display work.');
    await page.getByRole('button', { name: 'Start screen', exact: true }).click();
    assert(await page.locator('#ride-difficulty').inputValue() === 'very-easy', 'Difficulty persists after a solo ride');
    await page.getByRole('button', { name: '2 players Invite a friend to race' }).click();
    await page.getByRole('textbox', { name: 'Your name (optional)' }).fill('Alice');
    await page.getByRole('button', { name: 'Create an invite →' }).click();
    await page.getByText('Invite ready. Waiting for your friend…', { exact: true }).waitFor({ timeout: 25000 });
    const code = (await page.locator('.invite-code').innerText()).trim();
    assert(/^[A-HJ-NP-Z2-9]{4}$/.test(code), 'Host has a readable four-character code');
    mobileContext = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (softwareRenderer) await mobileContext.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return String(type).includes('webgl') ? null : original.call(this, type, ...args);
      };
    });
    const mobile = await mobileContext.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`desktop: ${e.message}`));
    mobile.on('pageerror', e => errors.push(`mobile: ${e.message}`));
    await mobile.goto(`${base}?join=${code}`);
    assert(await mobile.getByRole('textbox', { name: 'Their four-character code' }).inputValue() === code, 'Invite link prefills the code');
    await mobile.getByRole('textbox', { name: 'Your name (optional)' }).fill('Bob');
    await mobile.locator('#multiplayer-difficulty').selectOption('easy');
    await mobile.screenshot({ path: `output/playwright/multiplayer-phone-join${suffix}.png`, scale: 'css' });
    await mobile.getByRole('button', { name: 'Join →', exact: true }).click();
    await page.getByRole('button', { name: 'Start the race →' }).waitFor({ timeout: 25000 });
    await mobile.getByText('You’re connected. Your friend will start the ride.', { exact: true }).waitFor({ timeout: 25000 });
    assert((await mobile.locator('.lobby-tables').innerText()).endsWith('· 7'), 'Host selection is shared');
    check('Real PeerJS invite/link joining succeeds; host tables apply on both devices.');
    assert((await mobile.locator('.lobby-riders').innerText()).includes('(you) · Easy'), 'Guest keeps their own difficulty');
    assert((await page.locator('.lobby-riders').innerText()).includes('(you) · Very easy'), 'Host keeps their own difficulty');
    const dots = async (p, selector) => p.locator(selector).evaluateAll(elements => elements.map(e => getComputedStyle(e).backgroundColor));
    const hostColors = await dots(page, '.lobby-riders .rider-dot');
    const guestColors = await dots(mobile, '.lobby-riders .rider-dot');
    assert(hostColors[0] === guestColors[1] && hostColors[1] === guestColors[0] && hostColors[0] !== hostColors[1], 'Player colours agree in both lobbies');
    await page.getByRole('button', { name: 'Start the race →' }).click();
    await waitFor(page, '.game-overlay[hidden]'); await waitFor(mobile, '.game-overlay[hidden]');
    assert(await visible(mobile, '.number-pad'), 'Mobile has the touch keypad');
    assert(JSON.stringify(await dots(page, '.race-hud .rider-dot')) === JSON.stringify(hostColors), 'Host HUD retains identity colours');
    assert(JSON.stringify(await dots(mobile, '.race-hud .rider-dot')) === JSON.stringify(guestColors), 'Guest HUD retains identity colours');
    if (softwareRenderer) assert(await mobile.locator('.mini-canvas').count() === 0, 'WebGL is unavailable and the software renderer is being used');
    assert(await page.locator('.prompt h2').innerText() === await mobile.locator('.prompt h2').innerText(), 'Both players start with the same question');
    // Capture actual frame intervals while the two clients are running together.
    for (const p of [page, mobile]) await p.evaluate(() => {
      window.raceFrames = []; let last;
      const sample = now => { if (!window.raceFrames) return; if (last) window.raceFrames.push(now-last); last=now; if (window.raceFrames) requestAnimationFrame(sample); }; requestAnimationFrame(sample);
    });
    for (let i = 0; i < 16; i++) {
      await Promise.all([answer(page), answer(mobile, true)]);
      if (i === 2) {
        await page.screenshot({ path: `output/playwright/multiplayer-desktop-final${suffix}.png`, scale: 'css' });
        await mobile.screenshot({ path: `output/playwright/multiplayer-mobile-final${suffix}.png`, scale: 'css' });
      }
      await page.waitForTimeout(1700);
    }
    for (const [label, p] of [['desktop', page], ['mobile', mobile]]) {
      report.performance[label] = await p.evaluate(() => {
        const values = window.raceFrames; window.raceFrames = null;
        const a=[...values].sort((x,y)=>x-y), mean = values.reduce((x,y)=>x+y,0)/values.length;
        return { frames:a.length, meanMs:mean, fps:1000/mean, p95Ms:a[Math.floor(a.length*.95)], p99Ms:a[Math.floor(a.length*.99)], maxMs:a.at(-1), viewport:[innerWidth,innerHeight] };
      });
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    }
    check('Both players complete 16 answers via keyboard/touch while remote trains move.');
    for (const size of [{ width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await mobile.setViewportSize(size);
      await mobile.waitForTimeout(150);
      assert(await mobile.evaluate(() => {
        const keypad = document.querySelector('.number-pad').getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth && keypad.bottom <= innerHeight && keypad.top >= 0;
      }), 'Phone rotation and small screens retain all keypad controls without overflow');
      await mobile.screenshot({ path: `output/playwright/multiplayer-${size.width}x${size.height}${suffix}.png`, scale: 'css' });
    }
    await mobile.setViewportSize({ width: 390, height: 844 });
    check('Small-phone and landscape layouts keep all keys visible.');
    await page.keyboard.press('p');
    await mobile.getByRole('heading', { name: 'Alice paused.' }).waitFor();
    await page.waitForTimeout(250);
    const before = await Promise.all([page.locator('[data-your-distance]').innerText(), mobile.locator('[data-your-distance]').innerText()]);
    await page.waitForTimeout(600);
    assert(JSON.stringify(before) === JSON.stringify(await Promise.all([page.locator('[data-your-distance]').innerText(), mobile.locator('[data-your-distance]').innerText()])), 'Both trains remain still during a shared pause');
    await page.getByRole('button', { name: 'I’m ready →' }).click();
    check('Shared pause freezes both players and resumes cleanly.');
    await page.getByText('RACE COMPLETE', { exact: true }).waitFor({ timeout: 60000 });
    await mobile.getByText('RACE COMPLETE', { exact: true }).waitFor({ timeout: 60000 });
    const a = await page.locator('.race-results strong').allInnerTexts(), b = await mobile.locator('.race-results strong').allInnerTexts();
    assert(a[0] === b[1] && a[1] === b[0], 'Results agree across both peers');
    await mobile.screenshot({ path: `output/playwright/multiplayer-results-final${suffix}.png`, scale: 'css' });
    await page.getByRole('button', { name: 'Race again →' }).click();
    await mobile.getByText('Your friend is ready for another ride.', { exact: true }).waitFor();
    assert(await visible(page, '.race-results'), 'One player alone cannot start a rematch');
    await mobile.getByRole('button', { name: 'Race again →' }).click();
    await waitFor(page, '.game-overlay[hidden]'); await waitFor(mobile, '.game-overlay[hidden]');
    assert(await page.locator('.prompt h2').innerText() === await mobile.locator('.prompt h2').innerText(), 'Rematch questions reset together');
    check('Both peers agree on results; rematch waits for both players and resets the game.');
    await mobile.getByRole('button', { name: 'Start screen', exact: true }).click();
    await page.getByRole('heading', { name: 'We lost the connection.' }).waitFor({ timeout: 20000 });
    assert(await visible(page, '[data-overlay="menu"]'), 'Disconnected players can return to the start');
    check('Leaving mid-race stops the other client with a recovery path.');
    assert(!errors.length, errors.join('\n'));
    report.errors = errors;
  } finally {
    await mobileContext?.close();
    await page.evaluate(report => { window.multiplayerCheck = report; }, report);
  }
}
