import * as T from 'three';
import { WorldModel } from '../world-models';
import type { MiniSection } from '../mini-track';
import type { PieceAnimation } from '../piece-animation';
import type { FairgroundLights } from '../world-lighting';

export type InstancePool = T.InstancedMesh[];

/** Selected attractions share the game's batching and lifecycle conventions.
 * Only the selected design is built; animation never creates render objects. */
export class PieceBuilder implements PieceAnimation {
  readonly group = new T.Group();
  private geometries = new Set<T.BufferGeometry>();
  private instances: T.InstancedMesh[] = [];
  private dummy = new T.Object3D();
  private tick: PieceAnimation['update'] = () => {};
  constructor(private material:T.Material, private lights:FairgroundLights) {}
  batch(model:WorldModel, parent=this.group, halos=false, softGlowMaterial?:T.Material) {
    const group=model.finish(this.material,this.lights,halos,softGlowMaterial);
    group.traverse(o=>{if(o instanceof T.Mesh){this.geometries.add(o.geometry);o.castShadow=false;}});
    parent.add(group);return group;
  }
  /** Register a custom mesh with the same geometry lifetime as baked models. */
  own(mesh:T.Mesh){this.geometries.add(mesh.geometry);mesh.castShadow=false;this.group.add(mesh);return mesh;}
  pool(model:WorldModel,count:number,parent=this.group):InstancePool {
    const source=model.finish(this.material,this.lights,false),result:InstancePool=[];
    for(const child of source.children){
      const mesh=child as T.Mesh,instance=new T.InstancedMesh(mesh.geometry,mesh.material,count);
      instance.instanceMatrix.setUsage(T.DynamicDrawUsage);instance.frustumCulled=false;instance.castShadow=false;
      this.geometries.add(mesh.geometry);this.instances.push(instance);result.push(instance);parent.add(instance);
    }
    return result;
  }
  place(pool:InstancePool,index:number,x:number,y:number,z:number,scale=1,rx=0,ry=0,rz=0,order:T.EulerOrder='XYZ') {
    this.dummy.position.set(x,y,z);this.dummy.scale.setScalar(scale);this.dummy.rotation.set(rx,ry,rz,order);this.dummy.updateMatrix();
    for(const mesh of pool)mesh.setMatrixAt(index,this.dummy.matrix);
  }
  animate(tick:PieceAnimation['update']){this.tick=tick;return this;}
  update(time:number,distance:number,reduced:boolean){this.tick(time,distance,reduced);for(const mesh of this.instances)mesh.instanceMatrix.needsUpdate=true;}
  dispose(){for(const mesh of this.instances)mesh.dispose();for(const g of this.geometries)g.dispose();this.group.removeFromParent();this.group.clear();}
}

/** Geometry parameter fractions, rather than fractions of arc length. */
export function point(s:MiniSection,fraction:number){const p=s.frames[Math.round(s.resolution*T.MathUtils.clamp(fraction,0,1))].position;return new T.Vector3(p.x-s.origin.x,p.y,p.z-s.origin.z);}
export function at(s:MiniSection,fraction:number){return s.start+s.distances[Math.round(s.resolution*T.MathUtils.clamp(fraction,0,1))];}
export function arrival(distance:number,stop:number,width=10){const gap=(distance-stop)/width;return Math.exp(-gap*gap);}

/** Timed bursts start only when the train crosses; replay and pause are stable. */
export class CrossingPulses {
  private fired:number[]=[];
  private previous=-Infinity;
  private time=-Infinity;
  constructor(readonly stops:readonly number[]){}
  update(time:number,distance:number){
    if(time<this.time||distance<this.previous-.01){this.fired=[];this.previous=-Infinity;}
    for(let i=0;i<this.stops.length;i++)if(Number.isFinite(this.previous)&&this.previous<this.stops[i]&&distance>=this.stops[i])this.fired[i]=time;
    this.previous=distance;this.time=time;
  }
  age(index:number,time:number){return time-(this.fired[index]??Infinity);}
}
