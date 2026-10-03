// Playwright CLI run-code: selected production attractions, desktop and phone.
async page => {
 const errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://localhost:5198/tracks.html?element=pondbridge&world=meadow&km=0');
 await page.locator('.stage canvas').waitFor();
 for(const size of [{width:1440,height:1000},{width:390,height:844}]) {
  await page.setViewportSize(size);
  for(const world of ['meadow','mountain','night','halloween']) {
   await page.locator('#collection').selectOption(world);
   const kinds=await page.locator('#element option').evaluateAll(options=>options.map(o=>o.value));
   if(kinds.length!==(world==='meadow'?5:4))throw Error('Unexpected selections: '+world);
   for(const kind of kinds) {
    if(size.width>800)await page.locator(`[data-kind="${kind}"]`).click();
    else await page.locator('#element').selectOption(kind);await page.waitForTimeout(180);
    if((await page.locator('#height').innerText()).includes('NaN'))throw Error('Invalid geometry');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Layout overflow');
    await page.locator('.stage').screenshot({path:`output/playwright/selected-${kind}-${size.width}.png`});
    report.push({kind,world,width:size.width,title:await page.locator('#piece-title').innerText()});
   }
  }
 }
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
