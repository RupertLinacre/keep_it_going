// Run with the Playwright CLI. Smoke candidates stay in the workshop until selected.
async page => {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1600,height:1250});
 await page.goto('http://localhost:5198/piece-review.html?piece=smoke&option=a&compare=original');
 await page.waitForFunction(()=>document.querySelector('#stage canvas'));
 await page.evaluate(async()=>{window.smokeReview=await import('/src/review/piece-review.ts');});
 const states=[];
 for(const option of ['a','b','c','d','e']){
  const state=await page.evaluate(option=>{window.smokeReview.reviewSelect('smoke',option,'original');return window.smokeReview.reviewAt(8);},option);
  if(state.kind!=='smoke'||state.option!==option)throw Error('Missing smoke '+option);
  if(state.smoke[0].variant!=='normal'||state.smoke[1].variant!==option||!state.smoke[1].activeCount)throw Error('Smoke timing '+option);
  states.push(state);
  await page.locator('#stage').screenshot({path:`output/playwright/smoke-${option}-comparison.png`});
 }
 await page.evaluate(()=>window.smokeReview.reviewSelect('smoke','a','e'));
 const phases=[];for(const time of [1,8,21,24])phases.push(await page.evaluate(time=>window.smokeReview.reviewAt(time),time));
 if(phases[0].smoke.some(s=>s.variant!=='normal')||phases[3].smoke.some(s=>s.variant!=='normal'))throw Error('Power-up must begin/end with normal smoke');
 const paused=await page.evaluate(async()=>{const before=window.smokeReview.reviewState();for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);const after=window.smokeReview.reviewState();return JSON.stringify(before.smoke)===JSON.stringify(after.smoke)&&before.elapsed===after.elapsed});
 if(!paused)throw Error('Paused smoke must stay still');
 const cycles=await page.evaluate(async()=>{
  const {REVIEW_ITEMS}=await import('/src/review/piece-review-data.ts'),results=[];
  for(let cycle=0;cycle<3;cycle++){const run=[];for(const piece of REVIEW_ITEMS){window.smokeReview.reviewSelect(piece.kind,'e','original');run.push(window.smokeReview.reviewAt(8).memory);}results.push(run);}
  return results;
 });
 if(JSON.stringify(cycles[1])!==JSON.stringify(cycles[2]))throw Error('Geometry or texture memory grows on gallery revisit');
 await page.evaluate(()=>{window.smokeReview.reviewSelect('smoke','d','original');window.smokeReview.reviewAt(8)});
 await page.locator('[data-world=powerups]').click();
 if(await page.locator('.piece-card:visible').count()!==1)throw Error('Power-up filter must show smoke only');
 await page.locator('#next').click();
 if((await page.evaluate(()=>window.smokeReview.reviewState())).kind!=='sheepbank')throw Error('Next must wrap after smoke');
 await page.locator('#previous').click();
 if((await page.evaluate(()=>window.smokeReview.reviewState())).kind!=='smoke')throw Error('Previous must return to smoke');
 const mobile=[];
 await page.locator('button[data-mode=after]').click();
 for(const width of [320,390,768,1024]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>window.smokeReview.reviewAt(8));
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  if(layout.scroll>layout.width)throw Error('Overflow at '+width);
  if(await page.locator('[data-option]:visible').count()!==5)throw Error('Missing smoke variants at '+width);
  mobile.push(layout);
  if(width===390)await page.screenshot({path:'output/playwright/smoke-mobile.png',fullPage:true});
 }
 await page.setViewportSize({width:1600,height:1250});
 await page.locator('button[data-mode=both]').click();
 await page.evaluate(()=>{window.smokeReview.reviewSelect('smoke','a','original');window.smokeReview.reviewAt(8)});
 await page.screenshot({path:'output/playwright/smoke-gallery.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 return {states,phases,mobile,stableMemory:true,errors};
}
