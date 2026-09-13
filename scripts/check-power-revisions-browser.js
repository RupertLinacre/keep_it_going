// Browser-only checks for rendered world anchoring and the Sky lift rescue.
async page => {
 const base=await page.evaluate(()=>new URL('/',location.href).href),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'?mode=remix&seed=42');
 await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/src/games/mini.ts')).name;
  const {Mini}=await import(url),update=Mini.prototype.update;
  Mini.prototype.update=function(dt){window.powerGame=this;if(!window.powerHold)return update.call(this,dt)};
 });
 await page.locator('[data-single]').click();await page.waitForFunction(()=>window.powerGame);
 const report=await page.evaluate(()=>{
  window.powerHold=true;const g=window.powerGame;
  g.powerups.activate('reverse',g.physics,g.carriages);g.draw(document.querySelector('.game-canvas').getContext('2d'));
  const scene=g.view.powerScene,power=g.powerups;power.age=2;
  const render=(x,anchor)=>{scene.render(power,g.track,{position:{x,y:10,z:10}},anchor,5);return Array.from(scene.weatherGeometry.getAttribute('position').array)};
  const a=render(10,0),b=render(11,0),c=render(11,1000);
  if(a.some((n,i)=>n!==b[i]))throw new Error('Weather translated with train');
  if(b.some((n,i)=>Math.abs(n-c[i]-(i%3===0?1000:0))>.001))throw new Error('Render origin moved weather in world space');
  g.powerups.activate('lift',g.physics,g.carriages);g.track.ensure(g.physics.distance,1500);
  let at=g.track.startDistance;while(at<g.track.end&&g.track.slope(at)<.3)at++;
  g.physics.distance=at;g.physics.previousDistance=at;g.physics.velocity=2;
  const before=g.physics.velocity;for(const d of String(g.a*g.b))g.key(d);
  const after=g.physics.velocity;
  if(!(after>before&&after*after-before*before<=600.001&&g.track.lifts.length))throw new Error('Sky lift rescue missing');
  return{weatherAnchored:true,rescue:{before,after,lifts:g.track.lifts.length}};
 });
 await page.screenshot({path:'output/playwright/sky-lift-rescue-desktop.png',scale:'css'});
 await page.evaluate(()=>{const g=window.powerGame;g.powerups.activate('reverse',g.physics,g.carriages);g.powerups.age=3;g.view.cameraRig.height=0;window.powerHold=false});
 await page.waitForTimeout(800);await page.screenshot({path:'output/playwright/world-weather-desktop.png',scale:'css'});
 if(errors.length)throw new Error(errors.join('\n'));return{...report,errors};
}
