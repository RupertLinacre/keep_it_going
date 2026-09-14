async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(base+'tracks.html?element=midwayloop&world=night&km=0');
 await page.setViewportSize({width:1440,height:1000});await page.locator('.stage canvas').waitFor();
 for(const world of ['meadow','mountain','night','halloween']){
  await page.locator('#collection').selectOption(world);
  const kinds=await page.locator('#element option').evaluateAll(options=>options.map(o=>o.value));
  if(kinds.length<3)throw Error('Fewer than three pieces in '+world);
  for(const kind of kinds){
   await page.locator(`[data-kind="${kind}"]`).click();await page.waitForTimeout(120);
   if(await page.locator('#height').innerText()==='NaN m')throw Error('Invalid geometry bounds');
  }
  report.push({world,kinds});
  await page.screenshot({path:`output/playwright/gallery-${world}-desktop.png`});
 }
 await page.locator('#collection').selectOption('night');await page.locator('[data-kind="midwayloop"]').click();
 await page.locator('#next').click();
 if(await page.locator('#element').inputValue()!=='carouselhelix')throw Error('Next left the selected world');
 await page.locator('#previous').click();
 if(await page.locator('#element').inputValue()!=='midwayloop')throw Error('Previous did not return to the loop');
 await page.screenshot({path:'output/playwright/gallery-night-loop-desktop.png'});
 await page.locator('#play').click();await page.waitForTimeout(100);
 const paused=await page.locator('#play').innerText();if(paused!=='Play preview')throw Error('Preview pause failed');
 await page.setViewportSize({width:390,height:844});await page.locator('#element').selectOption('carouselhelix');
 await page.waitForTimeout(200);await page.screenshot({path:'output/playwright/gallery-night-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Phone overflow');
 await page.locator('#collection').selectOption('all');await page.locator('#element').selectOption('nestedloop');await page.waitForTimeout(150);
 if(!(await page.locator('#piece-title').innerText()).includes('Loop'))throw Error('Classic gallery lost');
 if(errors.length)throw Error(errors.join('\n'));return {report,errors};
}
