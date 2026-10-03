// Playwright CLI run-code. Exercise all track and smoke proposals without keeping them resident.
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
 await page.locator('[data-option=e]').click();await page.locator('#choose-option').click();await page.reload();
 if(await page.locator('#choose-option').getAttribute('aria-pressed')!=='true')throw Error('E choice did not persist');
 await page.locator('[data-option=d]').click();
 if(await page.locator('#choose-option').getAttribute('aria-pressed')==='true')throw Error('Browsing D must not change the saved E choice');
 await page.locator('#reference').selectOption('a');
 await page.locator('#close-up').click();if(await page.locator('#close-up').getAttribute('aria-pressed')!=='true')throw Error('Closer look did not activate');
 await page.screenshot({path:'output/playwright/five-designs-mobile.png',fullPage:true});
 for(const width of [320,768,1024]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow at '+width);if(await page.locator('[data-option]:visible').count()!==5)throw Error('Missing design buttons');}

 await page.setViewportSize({width:1600,height:1250});await page.locator('[data-mode=both]').click();await page.locator('#reset-view').click();if(await page.locator('#close-up').getAttribute('aria-pressed')!=='false')throw Error('Reset view did not restore full track');
 const cycles=await page.evaluate(async()=>{
  const m=await import('/src/review/piece-review.ts'),d=await import('/src/review/piece-review-data.ts'),{DESIGN_OPTIONS}=await import('/src/review/variants/variant-kit.ts'),runs=[];
  for(let j=0;j<3;j++){const r=[];for(const p of d.REVIEW_ITEMS)for(const option of DESIGN_OPTIONS){
   m.reviewSelect(p.kind,option,'original');const s=m.reviewAt(2);r.push({kind:p.kind,option,memory:s.memory,metrics:s.metrics});
  }runs.push(r);}return runs;
 });
 for(let i=0;i<cycles[2].length;i++)if(JSON.stringify(cycles[1][i].memory)!==JSON.stringify(cycles[2][i].memory))throw Error('GPU resources grow: '+cycles[2][i].kind+cycles[2][i].option);
 await page.evaluate(async()=>{const m=await import('/src/review/piece-review.ts');m.reviewSelect('tunnel','d','e');m.reviewAt(4)});
 await page.locator('#cutaway').click();if(await page.locator('#cutaway').getAttribute('aria-pressed')!=='true')throw Error('Cutaway failed');
 await page.locator('[data-world=halloween]').click();if(await page.locator('.piece-card:visible').count()!==3)throw Error('Filter failed');
 await page.locator('[data-world=all]').click();
 await page.evaluate(async()=>{const m=await import('/src/review/piece-review.ts');m.reviewSelect('carouselhelix','d','e');m.reviewAt(3)});
 await page.screenshot({path:'output/playwright/five-designs-desktop.png',fullPage:true});
 await page.evaluate(saved=>{for(let i=0;i<2;i++){const key=`keep-going-piece-choices-v${i+1}`;if(saved[i]===null)localStorage.removeItem(key);else localStorage.setItem(key,saved[i]);}},saved);
 if(errors.length)throw Error(errors.join('\n'));return {mobile,stableMemory:true,designs:cycles[2],errors};
}
