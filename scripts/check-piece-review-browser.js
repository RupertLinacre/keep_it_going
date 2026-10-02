async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:5198/piece-review.html?piece=carouselhelix');
 await page.waitForFunction(()=>document.querySelector('#stage canvas'));
 const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,mode:document.querySelector('#stage').dataset.mode}));
 if(mobile.scroll>mobile.width||mobile.mode!=='after')throw Error('Mobile layout');
 await page.getByRole('button',{name:'Use this update',exact:true}).click();
 await page.reload();
 if(await page.getByRole('button',{name:'Use this update',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('Choice did not persist');
 await page.getByRole('button',{name:'Decide later',exact:true}).click();
 await page.screenshot({path:'output/playwright/piece-review-mobile.png',fullPage:true});
 await page.setViewportSize({width:1600,height:1100});
 await page.getByRole('button',{name:'Side by side',exact:true}).click();
 const cycles=await page.evaluate(async()=>{
  const m=await import('/src/review/piece-review.ts'),d=await import('/src/review/piece-review-data.ts'),runs=[];
  for(let j=0;j<3;j++){const r=[];for(const p of d.PIECE_REVIEW){m.reviewSelect(p.kind);const s=m.reviewAt(2);r.push({kind:p.kind,memory:s.memory,metrics:s.metrics});}runs.push(r);}
  return runs;
 });
 for(let i=0;i<12;i++)if(JSON.stringify(cycles[1][i].memory)!==JSON.stringify(cycles[2][i].memory))throw Error('GPU resources grow: '+cycles[2][i].kind);
 await page.evaluate(async()=>{const m=await import('/src/review/piece-review.ts');m.reviewSelect('tunnel');m.reviewAt(4)});
 await page.getByRole('button',{name:'Inside tunnel',exact:true}).click();
 if(await page.getByRole('button',{name:'Inside tunnel',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('Cutaway failed');
 await page.getByRole('button',{name:'☾ Pumpkin Party',exact:true}).click();
 if(await page.locator('.piece-card:visible').count()!==3)throw Error('Filter failed');
 await page.getByRole('button',{name:'All worlds',exact:true}).click();
 await page.evaluate(async()=>{const m=await import('/src/review/piece-review.ts');m.reviewSelect('carouselhelix');m.reviewAt(3)});
 await page.screenshot({path:'output/playwright/piece-review-desktop.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 return {mobile,stableMemory:true,cycles:cycles[2],errors};
}
