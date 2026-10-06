import * as T from 'three';
import type { MiniSection } from '../mini-track';
import { waterfallLayout } from '../christmas-path';
import { WorldModel, WORLD_SHAPES as G } from '../world-models';
import { nearest } from './christmas-builder';
import { hangingLantern } from './waterfall-ice';

/** Portal poses come from the actual metre-sampled rail, including race shifts. */
export function waterfallBore(s:MiniSection){
 const l=waterfallLayout(s.width,s.amplitude,s.hand);
 const entry=nearest(s,l.entrance),exit=nearest(s,l.exit);
 const frames=[];for(let d=entry-12;d<exit+2;d+=.65)frames.push(s.sample(d));
 const local=(p:T.Vector3)=>p.clone().sub(new T.Vector3(s.origin.x,0,s.origin.z));
 const centers=frames.map(f=>local(f.position).addScaledVector(f.up,1.1));
 return{entry,exit,frames,centers,local,start:entry-12};
}
export type WaterfallBore=ReturnType<typeof waterfallBore>;
/** Real geometry subtraction. Dense faceted terrain is cut around the descending
 * railway; no opaque sphere, cap or facade remains across the bore. */
export function carveWaterfall(group:T.Group,bore:WaterfallBore){
 const triangle=new T.Triangle(),q=new T.Vector3();
 group.traverse(o=>{
  if(!(o instanceof T.Mesh)||o.material instanceof T.ShaderMaterial)return;
  const g=o.geometry,p=g.getAttribute('position'),source=g.index,indices:number[]=[];
  for(let i=0;i<(source?.count??p.count);i+=3){
   const a=source?source.getX(i):i,b=source?source.getX(i+1):i+1,c=source?source.getX(i+2):i+2;
   triangle.a.fromBufferAttribute(p,a);triangle.b.fromBufferAttribute(p,b);triangle.c.fromBufferAttribute(p,c);
   const minX=Math.min(triangle.a.x,triangle.b.x,triangle.c.x)-3.45,maxX=Math.max(triangle.a.x,triangle.b.x,triangle.c.x)+3.45;
   const minY=Math.min(triangle.a.y,triangle.b.y,triangle.c.y)-3.45,maxY=Math.max(triangle.a.y,triangle.b.y,triangle.c.y)+3.45;
   const minZ=Math.min(triangle.a.z,triangle.b.z,triangle.c.z)-3.45,maxZ=Math.max(triangle.a.z,triangle.b.z,triangle.c.z)+3.45;
   const cut=bore.centers.some(center=>{if(center.x<minX||center.x>maxX||center.y<minY||center.y>maxY||center.z<minZ||center.z>maxZ)return false;triangle.closestPointToPoint(center,q);return q.distanceToSquared(center)<3.45**2;});
   if(!cut)indices.push(a,b,c);
  }g.setIndex(indices);
 });
}
/** Inward-facing walls follow the complete descending route. End rings remain
 * open; stone collars are aligned with the rail rather than a decorative slit. */
export function lineWaterfall(m:WorldModel,s:MiniSection,bore:WaterfallBore){
 const positions:number[]=[],rings:T.Vector3[][]=[],radius=2.7;
 for(let i=0;i<bore.frames.length;i++){const f=bore.frames[i],center=bore.centers[i];rings.push(Array.from({length:16},(_,j)=>center.clone().addScaledVector(f.right,Math.cos(j*Math.PI/8)*radius).addScaledVector(f.up,Math.sin(j*Math.PI/8)*radius)));}
 const append=(a:T.Vector3,b:T.Vector3,c:T.Vector3,center:T.Vector3)=>{const normal=b.clone().sub(a).cross(c.clone().sub(a)),mid=a.clone().add(b).add(c).divideScalar(3);if(normal.dot(center.clone().sub(mid))<0)[b,c]=[c,b];positions.push(...a.toArray(),...b.toArray(),...c.toArray());};
 for(let i=1;i<rings.length;i++){if(bore.start+i*.65<bore.entry-1)continue;
 for(let j=0;j<16;j++){const k=(j+1)%16;append(rings[i-1][j],rings[i][j],rings[i-1][k],bore.centers[i]);append(rings[i-1][k],rings[i][j],rings[i][k],bore.centers[i]);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();m.add(g,'#3d5971',[0,0,0]);g.dispose();
 for(const [distance,isEntry] of [[bore.entry,true],[bore.exit,false]] as const){
  const f=s.sample(distance),center=bore.local(f.position).addScaledVector(f.up,1.1),ringPositions:number[]=[];
  for(let j=0;j<20;j++){
   const point=(r:number,a:number)=>center.clone().addScaledVector(f.right,Math.cos(a)*r).addScaledVector(f.up,Math.sin(a)*r);
   const a=j*Math.PI/10,b=(j+1)*Math.PI/10,p=point(2.7,a),q=point(3.5,a),r=point(2.7,b),t=point(3.5,b);
   ringPositions.push(...p.toArray(),...q.toArray(),...r.toArray(),...r.toArray(),...q.toArray(),...t.toArray());
  }
  const collar=new T.BufferGeometry();collar.setAttribute('position',new T.Float32BufferAttribute(ringPositions,3));collar.computeVertexNormals();
  // Both sides of these thin stone rims are baked so rear and front reviews
  // show the actual opening. They add no extra material or transparency pass.
  m.add(collar,isEntry?'#a6c4d4':'#b5d5e2',[0,0,0]);const reversed=collar.clone();const p=reversed.getAttribute('position');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),c=new T.Vector3().fromBufferAttribute(p,i+2);p.setXYZ(i,c.x,c.y,c.z);p.setXYZ(i+2,a.x,a.y,a.z);}reversed.computeVertexNormals();m.add(reversed,isEntry?'#a6c4d4':'#b5d5e2',[0,0,0]);collar.dispose();reversed.dispose();
  for(const side of [-1,1]){const q=center.clone().addScaledVector(f.right,side*4.7).addScaledVector(f.up,.2);hangingLantern(m,q.toArray(),.85);}
 }
 // Small interior warm lamps guide the train down the mountain without lights.
 for(let i=12;i<bore.frames.length-12;i+=18){const f=bore.frames[i],q=bore.centers[i].clone().addScaledVector(f.right,2.8).addScaledVector(f.up,1.2);m.add(G.rock,'#ffdd97',q.toArray(),[.14,.2,.14],[],true);}
}

/** A faceted rock flank joins the descending bore to the front waterfall face.
 * The railway stays enclosed until its mouth rather than emerging as an exposed
 * tube midway down the terraces. Broad sides and a low crown retain rail clearance. */
export function mantleWaterfall(m:WorldModel,s:MiniSection,bore:WaterfallBore){
 const rings:T.Vector3[][]=[];
 for(let i=0;i<bore.frames.length;i++){
  const f=bore.frames[i],d=bore.start+i*.65;if(d<bore.entry+.3||d>bore.exit+.3)continue;
  const center=bore.centers[i],blend=T.MathUtils.clamp((s.origin.y+s.amplitude-f.position.y)/(s.amplitude-17),0,1),width=T.MathUtils.lerp(3.05,5.7,blend),height=T.MathUtils.lerp(3.1,3.9,blend);rings.push(Array.from({length:12},(_,j)=>{const a=j*Math.PI/6;return center.clone().addScaledVector(f.right,Math.cos(a)*(width+.15*Math.sin(i*.43+j))).addScaledVector(f.up,Math.sin(a)*height);}));
 }
 for(let j=0;j<12;j++){
  const positions:number[]=[];
  for(let i=1;i<rings.length;i++){const k=(j+1)%12,a=rings[i-1][j],b=rings[i][j],c=rings[i-1][k],d=rings[i][k];positions.push(...a.toArray(),...b.toArray(),...c.toArray(),...b.toArray(),...d.toArray(),...c.toArray());}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();m.add(g,['#a2bacd','#c2d5df','#dbe8ec','#b1cbd8','#90afc5','#819db5'][j%6],[0,0,0]);g.dispose();
 }
}
