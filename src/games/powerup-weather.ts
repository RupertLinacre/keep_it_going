import type { PowerKind } from './ride-powerups';
export type WeatherPoint = { id:number; x:number; y:number; z:number; dx:number; dy:number; dz:number };
const fract = (n:number) => n-Math.floor(n);
const noise = (n:number) => fract(Math.sin(n)*43758.5453);
/** Fixed world cells recycle only at the edge of the visible neighbourhood.
 * Moving the train selects cells; it never translates the particles inside them. */
export function weatherPoint(i:number, seed:number, kind:PowerKind, time:number,
  focus:{x:number;y:number;z:number}, out:WeatherPoint = {id:0,x:0,y:0,z:0,dx:0,dy:0,dz:0}) {
  const cx=Math.floor(focus.x/20)-2+i%5, cy=Math.floor(focus.y/24)-1+Math.floor(i/5)%3;
  const cz=Math.floor(focus.z/24)-1+Math.floor(i/15)%2, slot=Math.floor(i/30);
  const id=cx*73856093+cy*19349663+cz*83492791+(slot+1)*7919+seed;
  const rx=noise(id+1),rz=noise(id+7), phase=fract(noise(id+19)+time*(kind==='heavy'?.9:kind==='reverse'||kind==='lift'?-.25:.3));
  out.id=id;out.x=cx*20+rx*20;out.y=cy*24+(1-phase)*24;out.z=cz*24+rz*24;
  out.dx=0;out.dy=kind==='ice'||kind==='cargo'?.25:kind==='heavy'?2.4:.9;out.dz=0;
  if(kind==='wind'){out.x=cx*20+fract(rx+time*.48)*20;out.y=cy*24+noise(id+19)*24;out.dx=3.2;out.dy=.12;out.dz=.15;}
  if(kind==='ice')out.x+=Math.sin(time+id)*1.7;
  return out;
}
export function weatherRock(i:number,seed:number,kind:PowerKind,time:number,focus:{x:number;z:number}) {
  const cx=Math.floor(focus.x/25)-1+i%4,cz=Math.floor(focus.z/22)-1+Math.floor(i/4);
  const id=cx*73856093+cz*83492791+seed,phase=fract(time*(kind==='reverse'?.075:.38)+noise(id));
  return {x:cx*25+noise(id+2)*25,y:kind==='reverse'?.7+phase*30:.7+(1-phase*phase)*28,z:cz*22+noise(id+9)*22,
    spin:noise(id+4)*6,size:.5+noise(id+5)*.6};
}
