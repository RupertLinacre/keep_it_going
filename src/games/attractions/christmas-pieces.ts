import { frozenWaterfall } from './frozen-waterfall';
import { chimneyHouse } from './chimney-house';
import * as T from 'three';
import { isChristmasKind } from '../christmas-rails';
import type { MiniSection } from '../mini-track';
import type { FairgroundLights } from '../world-lighting';
import { ChristmasBuilder } from './christmas-builder';
import { ribbonPiece } from './ribbon-reel';

import { treeLandmark, snowmanLandmark, globeLandmark } from './christmas-landmarks';

const treePiece=treeLandmark;

/** A snowball shell with a real bore along X. The hole has no hidden solid
 * sphere inside it, and the gold mouth frames are placed beyond the shell. */
export function tunnelSnowball(radius:number,centerY:number,tunnelY:number,bore:number){
  const g=new T.SphereGeometry(radius,24,14),p=g.getAttribute('position'),indices:number[]=[];
  const index=g.index!;
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    // Keep only facets outside the bore; whole-triangle removal leaves a
    // slightly generous faceted opening rather than any clipping triangles.
    const clear=ids.some(k=>Math.hypot(p.getY(k)+centerY-tunnelY,p.getZ(k))<bore);
    if(!clear)indices.push(...ids);
  }
  g.setIndex(indices);g.computeVertexNormals();return g;
}
const snowmanPiece=snowmanLandmark;

const globePiece=globeLandmark;

export function createChristmasPiece(s:MiniSection,material:T.Material,lights:FairgroundLights){
  if(!isChristmasKind(s.kind))return;
  const v=new ChristmasBuilder(material,lights);v.group.name=s.kind+'-christmas-attraction';
  switch(s.kind){
    case 'frozenwaterfall':frozenWaterfall(v,s);break;
    case 'chimneyhouse':chimneyHouse(v,s);break;
    case 'startree':treePiece(v,s);break;
    case 'snowmanscarf':snowmanPiece(v,s);break;
    case 'ribbonreel':ribbonPiece(v,s);break;
    case 'snowglobe':globePiece(v,s);break;
  }
  v.update(0,s.start-100,true);return v;
}
