// Playwright CLI run-code. Exercise all 36 proposals without keeping them resident.
async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:5198/piece-review.html?piece=carouselhelix&option=a');
 await page.waitForFunction(()=>document.querySelector('#stage canvas'));
 const saved=await page.evaluate(()=>[localStorage.getItem('keep-going-piece-choices-v1'),localStorage.getItem('keep-going-piece-choices-v2')]);
 await page.evaluate(()=>{localStorage.removeItem('keep-going-piece-choices-v2');localStorage.setItem('keep-going-piece-choices-v1',JSON.stringify({carouselhelix:'after',sheepbank:'before'}));});
 await page.reload();
 if(await page.locator('#choose-option').getAttribute('aria-pressed')!=='true')throw Error('Original proposal choices did not migrate to A');
 const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,mode:document.querySelector('#stage').dataset.mode}));
 if(mobile.scroll>mobile.width||mobile.mode!=='after')throw Error('Mobile layout');
 await page.locator('[data-option=b]').click();await page.locator('#choose-option').click();await page.reload();
 if(await page.locator('#choose-option').getAttribute('aria-pressed')!=='true')throw Error('B choice did not persist');
 await page.locator('[data-option=c]').click();
 if(await page.locator('#choose-option').getAttribute('aria-pressed')==='true')throw Error('Browsing C must not change the saved B choice');
 await page.locator('#reference').selectOption('a');
 await page.screenshot({path:'output/playwright/three-designs-mobile.png',fullPage:true});
 await page.setViewportSize({width:1600,height:1250});await page.locator('[data-mode=both]').click();
 const cycles=await page.evaluate(async()=>{
  const m=await import('/src/review/piece-review.ts'),d=await import('/src/review/piece-review-data.ts'),runs=[];
  for(let j=0;j<3;j++){const r=[];for(const p of d.PIECE_REVIEW)for(const option of ['a','b','c']){
   m.reviewSelect(p.kind,option,'original');const s=m.reviewAt(2);r.push({kind:p.kind,option,memory:s.memory,metrics:s.metrics});
  }runs.push(r);}return runs;
 });
 for(let i=0;i<36;i++)if(JSON.stringify(cycles[1][i].memory)!==JSON.stringify(cycles[2][i].memory))throw Error('GPU resources grow: '+cycles[2][i].kind+cycles[2][i].option);
 await page.evaluate(async()=>{const m=await import('/src/review/piece-review.ts');m.reviewSelect('tunnel','b','c');m.reviewAt(4)});
 await page.locator('#cutaway').click();if(await page.locator('#cutaway').getAttribute('aria-pressed')!=='true')throw Error('Cutaway failed');
 await page.locator('[data-world=halloween]').click();if(await page.locator('.piece-card:visible').count()!==3)throw Error('Filter failed');
 await page.locator('[data-world=all]').click();
 await page.evaluate(async()=>{const m=await import('/src/review/piece-review.ts');m.reviewSelect('carouselhelix','b','c');m.reviewAt(3)});
 await page.screenshot({path:'output/playwright/three-designs-desktop.png',fullPage:true});
 await page.evaluate(saved=>{for(let i=0;i<2;i++){const key=`keep-going-piece-choices-v${i+1}`;if(saved[i]===null)localStorage.removeItem(key);else localStorage.setItem(key,saved[i]);}},saved);
 if(errors.length)throw Error(errors.join('\n'));return {mobile,stableMemory:true,designs:cycles[2],errors};
}
