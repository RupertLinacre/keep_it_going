// Real gallery geometry, including the opaque exterior and explicit inside view.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const mobile of [false,true]){
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await page.goto(base+'tracks.html?element=tunnel&world=mountain&km=0');await page.locator('.stage canvas').waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({path:`output/playwright/mountain-tunnel-closed-${mobile?'mobile':'desktop'}.png`,fullPage:mobile});
  await page.locator('#tunnel-cutaway').click();await page.waitForTimeout(200);
  await page.screenshot({path:`output/playwright/mountain-tunnel-inside-${mobile?'mobile':'desktop'}.png`,fullPage:mobile});
  if(mobile)await page.locator('#element').selectOption('mountainpass');else await page.locator('[data-kind="mountainpass"]').click();
  if(await page.locator('#tunnel-cutaway').isVisible())throw Error('Tunnel control leaked to gorge');
  await page.waitForTimeout(250);await page.screenshot({path:`output/playwright/mountain-gorge-${mobile?'mobile':'desktop'}.png`,fullPage:mobile});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');
 }
 if(errors.length)throw Error(errors.join('\n'));return {errors};
}
