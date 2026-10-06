import * as T from 'three';

/** Code-painted alpine panorama for the gallery's fixed horizon. No downloaded
 * image assets; the production attraction remains real, orbitable geometry. */
export function sledBackdrop(aspect=1400/900) {
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=Math.round(1400/aspect);
  const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;
  const sky=ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'#ffc6b7');sky.addColorStop(.4,'#f9ddcd');sky.addColorStop(.64,'#d4e3f2');sky.addColorStop(1,'#9dcde5');
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const sun=ctx.createRadialGradient(w*.8,h*.16,5,w*.8,h*.16,65);
  sun.addColorStop(0,'#fff5bf');sun.addColorStop(.45,'#fff3bf');sun.addColorStop(1,'#fff3bf00');
  ctx.fillStyle=sun;ctx.fillRect(w*.8-70,h*.16-70,140,140);
  ctx.beginPath();ctx.arc(w*.8,h*.16,32,0,Math.PI*2);ctx.fillStyle='#fff2b8';ctx.fill();
  for(let layer=0;layer<3;layer++) {
    const baseline=h*(.40+layer*.1),step=175-layer*28;
    const peaks:Array<[number,number]>=[];
    for(let i=-1;i<=w/step+1;i++)peaks.push([i*step,baseline-(70+Math.sin(i*2.4+layer)*36)]);
    ctx.beginPath();ctx.moveTo(-step,h*.73);
    for(const [x,y]of peaks){ctx.lineTo(x-step*.42,baseline+20);ctx.lineTo(x,y);}
    ctx.lineTo(w+step,h*.73);ctx.closePath();ctx.fillStyle=['#b8bedf','#9fb8d8','#86add0'][layer];ctx.fill();
    for(const [x,y]of peaks) {
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-step*.32,y+80);ctx.lineTo(x+step*.20,y+55);ctx.closePath();ctx.fillStyle=['#deddf0','#e4eafa','#e4f1ff'][layer];ctx.fill();
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+step*.6,baseline+65);ctx.lineTo(x+step*.2,y+55);ctx.closePath();ctx.fillStyle=['#aeb9d9','#90accf','#729ac3'][layer];ctx.fill();
    }
  }
  const lake=ctx.createLinearGradient(0,h*.68,0,h);lake.addColorStop(0,'#a5cee8');lake.addColorStop(1,'#91c5e0');
  ctx.fillStyle=lake;ctx.fillRect(0,h*.70,w,h*.30);
  ctx.strokeStyle='#d0e9f280';ctx.lineWidth=2;
  for(let i=0;i<22;i++) {const y=h*(.72+i*.013);ctx.beginPath();ctx.moveTo((i*127)%w,y);ctx.lineTo((i*127)%w+40+i%4*15,y);ctx.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
