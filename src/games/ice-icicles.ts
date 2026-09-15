/** Icicles grow and melt on the carriages, never tinting the landscape. */
export function iceDeployment(power?: { active?: string; age: number; remaining: number }) {
  if (power?.active !== 'ice') return 0;
  const t = Math.max(0, Math.min(1, power.age / .7, power.remaining / .65));
  return t*t*(3-2*t);
}
export const ICICLES = Array.from({length:12},(_,i)=>({
  x:i<10?(i%2?-.78:.78):0,
  z:i<10?-.82+Math.floor(i/2)*.4:(i%2?-.98:.98),
  length:.32+(i*7%5)*.095,
}));
export function drawIceIcicles(ctx:CanvasRenderingContext2D,deployment:number,open:boolean){
  if(deployment<=0)return;
  const y=open?-15:-27;
  ctx.save();ctx.fillStyle='#b4eaf5';ctx.strokeStyle='#efffff';ctx.lineWidth=.8;
  for(let i=0;i<7;i++){
    const x=-17+i*5.5,length=(7+(i*3%5)*2)*deployment;
    ctx.beginPath();ctx.moveTo(x-2.3,y);ctx.lineTo(x,y+length);ctx.lineTo(x+2.3,y);ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
