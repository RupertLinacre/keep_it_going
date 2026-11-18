import { WorldModel, WORLD_SHAPES as G } from '../world-models';

const gold = '#ffdb85';
const satin = '#cf2344';
const ivory = '#fff0cd';

export const WRAP_HALF_WIDTH = 2.2;
export const WRAP_TOP = .17;

// Bake the printed paper and crossed wrapping bands into the attraction's scenery batch.
export function wrappedParcel(m:WorldModel,x:number,y:number,z:number,height:number) {
  const width=35, depth=13, lid=y+height;
  const box=(color:string,px:number,py:number,pz:number,w:number,h:number,d:number)=>
    m.add(G.box,color,[px,py,pz],[w,h,d]);
  box('#167a65',x,y+height/2,z,width,height,depth);
  box('#9b5c35',x,lid-.88,z,width+.38,.18,depth+.4);
  box('#309678',x,lid-.4,z,width+.65,.8,depth+.7);
  for(const side of [-1,1]){
    const face=z+side*(depth/2+.04);
    // Scandinavian wrapping paper: alternating ivory firs and foil diamonds.
    for(let i=-4;i<=4;i++){
      if(i===0)continue;
      const px=x+i*3.55,py=y+height*.52;
      for(const dy of [-1,1]){
        m.add(G.box,gold,[px,py+dy*height*.32,face],[.34,.34,.05],[0,0,Math.PI/4]);
      }
      if(i%2===0){
        for(let j=0;j<3;j++)m.add(G.cone,ivory,[px,py-.54+j*.58,face],[1.13-j*.21,1.35-j*.13,.09]);
        box(ivory,px,py-1.25,face,.25,.55,.06);
      }else{
        for(let j=0;j<4;j++)m.add(G.box,ivory,[px,py,face],[.17,2.3,.07],[0,0,j*Math.PI/4]);
      }
    }
    box(satin,x,y+height/2,face+side*.11,4.4,height,.21);
    box(satin,x+side*(width/2+.07),y+height/2,z,.19,height,4.4);
    for(const e of [-1,1]){
      box(gold,x+e*2,y+height/2,face+side*.23,.19,height,.06);
      box(gold,x+side*(width/2+.18),y+height/2,z+e*2,.06,height,.19);
    }
    box(gold,x,lid-.79,z+side*(depth/2+.38),width+.6,.12,.06);
    // Carry both bands over the lip of the wider lid and onto the body.
    box(satin,x,lid-.39,z+side*(depth/2+.36),2*WRAP_HALF_WIDTH,.98,.12);
    box(satin,x+side*(width/2+.34),lid-.39,z,.12,.92,2*WRAP_HALF_WIDTH);
    for(const e of [-1,1]){
      box(gold,x+e*2,lid-.39,z+side*(depth/2+.43),.19,.98,.04);
      box(gold,x+side*(width/2+.41),lid-.39,z+e*2,.04,.92,.19);
    }
  }
  box(satin,x,lid+.04,z,width+.68,.12,4.4);
  box(satin,x,lid+WRAP_TOP-.07,z,2*WRAP_HALF_WIDTH,.14,depth+.76);
  for(const e of [-1,1]){
    box(gold,x+e*2,lid+.19,z,.18,.03,depth+.76);
    box(gold,x,lid+.12,z+e*2,width+.68,.03,.18);
  }
}
