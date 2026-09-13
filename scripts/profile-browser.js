// Run with playwright-cli run-code against an open Vite game page. This measures
// real requestAnimationFrame gameplay; it does not step a recording clock.
async (page) => {
  await page.addInitScript(() => {
    let seed = 731;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.goto(page.url());
  await page.locator('.mini-canvas').waitFor();
  await page.evaluate(async () => {
    // Reuse the loaded modules, including Vite's HMR timestamp if present.
    const loaded = name => performance.getEntriesByType('resource')
      .find(entry => entry.name.includes('/src/games/' + name + '.ts')).name;
    const { MiniView } = await import(loaded('mini-view'));
    const { MiniTrack } = await import(loaded('mini-track'));
    const { Mini } = await import(loaded('mini'));
    const { MiniCarriages } = await import(loaded('mini-carriages'));
    window.profileDone = false;
    window.measure = { frames: [], update: [], render: [], build: [], ensure: [], hud: [], carriages: [], long: [], geometry: [] };
    const wrap = (prototype, method, key) => {
      const original = prototype[method];
      prototype[method] = function (...args) {
        const start = performance.now();
        const result = original.apply(this, args);
        window.measure[key].push(performance.now() - start);
        if (key === 'render') {
          window.profileView = this;
          if (window.measure.render.length % 60 === 0) window.measure.geometry.push({
            calls: this.renderer.info.render.calls,
            triangles: this.renderer.info.render.triangles,
            pieces: this.pieces.size,
            coaches: this.cartCount,
          });
        }
        return result;
      };
    };
    wrap(MiniView.prototype, 'build', 'build');
    wrap(MiniView.prototype, 'render', 'render');
    wrap(MiniTrack.prototype, 'ensure', 'ensure');
    wrap(Mini.prototype, 'update', 'update');
    wrap(Mini.prototype, 'hud', 'hud');
    wrap(MiniCarriages.prototype, 'update', 'carriages');
    const observer = new PerformanceObserver(list => window.measure.long.push(...list.getEntries().map(entry => entry.duration)));
    observer.observe({ type: 'longtask', buffered: false });
    let last;
    const frame = time => {
      if (last !== undefined) window.measure.frames.push(time - last);
      last = time;
      if (!window.profileDone) requestAnimationFrame(frame);
      else observer.disconnect();
    };
    requestAnimationFrame(frame);
  });
  // Exclude module instrumentation and initial shader compilation.
  await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const key of Object.keys(window.measure)) window.measure[key] = []; });
  for (let answer = 0; answer < 18; answer++) {
    const question = await page.locator('.prompt h2').innerText();
    const match = question.match(/(\d+) × (\d+)/);
    if (!match) throw new Error('The arithmetic question is missing');
    await page.keyboard.type(String(Number(match[1]) * Number(match[2])), { delay: 80 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1750);
  }
  await page.evaluate(() => {
    window.profileDone = true;
    const stats = values => {
      const sorted = [...values].sort((a, b) => a - b);
      const round = n => +n.toFixed(2);
      return {
        count: values.length,
        mean: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
        p95: round(sorted[Math.floor(sorted.length * .95)] || 0),
        p99: round(sorted[Math.floor(sorted.length * .99)] || 0),
        max: round(Math.max(0, ...values)),
        over25: values.filter(value => value > 25).length,
        over50: values.filter(value => value > 50).length,
      };
    };
    const gl = window.profileView.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    window.profileResult = {
      viewport: [innerWidth, innerHeight],
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      stats: Object.fromEntries(Object.entries(window.measure).filter(([key]) => key !== 'geometry').map(([key, values]) => [key, stats(values)])),
      geometry: window.measure.geometry,
    };
  });
}
