import * as T from 'three';
import type { MiniSection } from './mini-track';
import type { PieceAnimation } from './piece-animation';
import type { FairgroundLights } from './world-lighting';
import { WorldModel, WORLD_SHAPES as G } from './world-models';
import { carouselCenter, carouselRideRadius, lanternDistance, star } from './world-night';
import { CarouselMotion } from './carousel-motion';

const COLORS = ['#ffe092', '#f3a8d3', '#9ee7dc', '#c4aff5'];

/** One recognisable little lantern creature, shared by all seven gates. */
function lanternMascot() {
  const m = new WorldModel();
  m.add(G.round, '#ffd79a', [0,0,0], [1.02,1.1,.83], [], true, 0);
  for (const side of [-1,1]) {
    m.add(G.round, '#ffd79a', [side*.44,1.08,0], [.23,.72,.25], [0,0,-side*.2], true, .3);
    m.add(G.rock, '#f7b3c9', [side*.44,1.13,.21], [.11,.45,.055], [0,0,-side*.2]);
    for (const face of [-1,1]) {
      m.add(G.rock, '#674f84', [side*.34,.16,face*.78], [.105,.16,.07]);
      m.add(G.rock, '#f7a7bf', [side*.62,-.12,face*.68], [.2,.12,.06]);
    }
  }
  for (const face of [-1,1]) {
    m.add(G.rock, '#c379a3', [0,-.09,face*.84], [.12,.09,.07]);
    m.add(G.rock, '#775a91', [0,-.32,face*.79], [.2,.13,.06]);
    m.add(G.rock, '#ffe4b2', [0,-.26,face*.83], [.2,.1,.04], [], true);
  }
  m.add(G.pole, '#ddae84', [0,-1.1,0], [.42,.15,.42]);
  for (const side of [-1,1]) m.add(G.pole, '#d4a5ab', [side*.28,-1.45,0], [.035,.58,.035]);
  m.add(G.box, '#a58bc1', [0,-1.8,0], [.74,.38,.6]);
  m.add(G.box, '#efd098', [0,-1.63,0], [.84,.1,.67]);
  // Butterfly wings and ribbon tails give the whole lantern a cheerful silhouette.
  for(const side of [-1,1]) {
    m.add(G.cone,'#e9b5d9',[side*.27,-2.18,0],[.16,.64,.055],[0,0,Math.PI-side*.12]);
    m.add(G.rock,'#fff0c8',[side*.22,-1.42,.22],[.15,.18,.14]);
  }
  m.add(G.box,'#aee0d4',[0,-1.76,.32],[.18,.35,.04]);
  return m;
}

/** Low-poly unicorn with a saddle, mane, ears, hooves and a happy face on each
 * side. Twelve riders reuse this one geometry and one material. */
function unicorn() {
  const m = new WorldModel();
  m.add(G.round, '#fff0cf', [0,0,0], [.83,.43,.34]);
  m.add(G.round, '#fff0cf', [.55,.52,0], [.28,.62,.27], [0,0,-.3]);
  m.add(G.round, '#fff0cf', [.79,.96,0], [.45,.25,.28], [0,0,-.12]);
  m.add(G.rock, '#eac2bc', [1.1,.87,0], [.22,.18,.28]);
  m.add(G.cone, '#eaca86', [.8,1.4,0], [.14,.62,.14], [0,0,-.25]);
  for (const side of [-1,1]) {
    m.add(G.cone, '#fff0cf', [.49,1.3,side*.16], [.16,.4,.12], [0,0,.2]);
    m.add(G.rock, '#66547c', [.86,1.04,side*.26], [.06,.085,.045]);
    m.add(G.rock, '#eea5be', [1.02,.89,side*.26], [.07,.055,.045]);
  }
  for (let i=0;i<4;i++) m.add(G.rock, COLORS[(i+1)%4], [.32-i*.06,.85-i*.23,0], [.22,.24,.3]);
  for (let i=0;i<3;i++) m.add(G.rock, COLORS[(i+1)%4], [-.77-i*.15,.12-i*.15,0], [.27,.22,.23], [0,0,-.4]);
  m.add(G.rock, '#a891d0', [-.12,.4,0], [.43,.12,.4]);
  m.add(G.rock, '#eac37e', [-.36,.5,0], [.13,.2,.38]);
  return m;
}

function spinningPalace(radius:number, floors:number[], ceiling:number) {
  const m = new WorldModel(), roofBase=ceiling;
  m.add(G.pole, '#dac197', [0,(ceiling+2)/2,0], [radius*.22,ceiling-2,radius*.22]);
  for (let level=0;level<3;level++) {
    const y=floors[level], top=level===2?roofBase:floors[level+1];
    m.add(G.pole, level%2?'#c68cb6':'#9abfc5', [0,y,0], [radius,.35,radius]);
    m.add(G.pole, '#efd397', [0,y+.2,0], [radius,.12,radius]);
    m.add(G.pole, '#ba90c0', [0,top-.48,0], [radius,.4,radius]);
    for (let j=0;j<12;j++) {
      const a=j*Math.PI/6, x=Math.sin(a)*radius*.9, z=Math.cos(a)*radius*.9;
      m.add(G.rock, COLORS[(j+level)%4], [x,top-1.42,z], [.18,.18,.18], [], true, j*.4+level);
      // Wide striped skirts read as stacked carousel canopies at game scale.
      const b=(j+1)*Math.PI/6,upper=radius*.68,lower=radius*.97;
      const aTop=[Math.sin(a)*upper,top-.3,Math.cos(a)*upper],bTop=[Math.sin(b)*upper,top-.3,Math.cos(b)*upper];
      const aBottom=[Math.sin(a)*lower,top-1.45,Math.cos(a)*lower],bBottom=[Math.sin(b)*lower,top-1.45,Math.cos(b)*lower];
      const skirt=new T.BufferGeometry();
      skirt.setAttribute('position',new T.Float32BufferAttribute([...aTop,...aBottom,...bBottom,...aTop,...bBottom,...bTop],3));
      skirt.computeVertexNormals();m.add(skirt,j%2?'#ecc4a1':'#be83ba',[0,0,0]);skirt.dispose();
      // Brass poles, spindle balcony rails and scalloped roof valances.
      if(j%2===0) {
        m.add(G.pole, '#e2be83', [x,(y+top)/2,z], [.065,top-y-.3,.065]);
        const b=a+Math.PI/3, q=new T.Vector3(Math.sin(b)*radius*.9,y+.95,Math.cos(b)*radius*.9);
        m.beam('#ebce94',new T.Vector3(x,y+.95,z),q,.045);
      }
      m.add(G.pole, '#d4b6bd', [x,y+.57,z], [.035,.72,.035]);
      m.add(G.rock, COLORS[(j+level)%4], [x,top-1.59,z], [.25,.4,.18], [0,a,0]);
    }
    // Six radial gold inlays make the train-matched spin immediately legible.
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3;
      m.add(G.box, '#eed49a', [Math.sin(a)*radius*.43,y+.29,Math.cos(a)*radius*.43], [.16,.05,radius*.85], [0,a,0]);
      // Inlaid mirrors on the centre drum give the tall interior a rich core.
      const core=radius*.225,px=Math.sin(a)*core,pz=Math.cos(a)*core;
      m.add(G.box,'#edd298',[px,y+(top-y)*.5,pz],[radius*.27,(top-y)*.64,.12],[0,a,0]);
      m.add(G.box,level%2?'#bcdbe0':'#d9c5e6',[px+Math.sin(a)*.08,y+(top-y)*.5,pz+Math.cos(a)*.08],[radius*.2,(top-y)*.55,.07],[0,a,0]);
    }
    for(let j=0;j<4;j++) {
      const a=j*Math.PI/2+level*Math.PI/4;
      m.add(G.pole,'#eacd98',[Math.sin(a)*radius*.6,(y+top)/2,Math.cos(a)*radius*.6],[.05,top-y-.5,.05]);
    }
    // Gold scalloped arches form an arcade above the ponies, with jewel pendants.
    for(let j=0;j<6;j++) {
      const a=j*Math.PI/3,b=a+Math.PI/3;
      let previous:T.Vector3|undefined;
      for(let k=0;k<=6;k++) {
        const t=k/6,angle=a+(b-a)*t,p=new T.Vector3(Math.sin(angle)*radius*.87,top-2.1+Math.sin(t*Math.PI)*.65,Math.cos(angle)*radius*.87);
        if(previous)m.beam('#f4d898',previous,p,.055);previous=p;
      }
      const angle=(a+b)/2;
      m.add(G.rock,COLORS[(j+level)%4],[Math.sin(angle)*radius*.88,top-2.3,Math.cos(angle)*radius*.88],[.2,.36,.2],[],true,j*.5);
    }
  }
  for (let j=0;j<12;j++) {
    const a=j*Math.PI/6,b=(j+1)*Math.PI/6;
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([0,roofBase+3.8,0,Math.sin(a)*radius,roofBase,Math.cos(a)*radius,Math.sin(b)*radius,roofBase,Math.cos(b)*radius],3));
    g.computeVertexNormals();m.add(g,j%2?'#f1c5a1':'#bf89bc',[0,0,0]);g.dispose();
    m.beam('#eed09b',new T.Vector3(0,roofBase+3.8,0),new T.Vector3(Math.sin(a)*radius,roofBase,Math.cos(a)*radius),.045);
  }
  m.add(G.pole, '#e8c890', [0,roofBase+4.1,0], [.07,.8,.07]);
  star(m,0,roofBase+4.7,0,.7,'#ffe5aa');
  return m;
}

class CarnivalPieceAnimation implements PieceAnimation {
  readonly group = new T.Group();
  private readonly geometries = new Set<T.BufferGeometry>();
  private readonly instances: T.InstancedMesh[] = [];
  private readonly dummy = new T.Object3D();
  private tick: (time:number,distance:number,reduced:boolean)=>void = ()=>{};

  constructor(section:MiniSection,material:T.Material,lights:FairgroundLights) {
    const batch=(model:WorldModel,parent=this.group)=>{
      const group=model.finish(material,lights,false);
      for(const child of group.children){this.geometries.add((child as T.Mesh).geometry);child.castShadow=false;}
      parent.add(group);return group;
    };
    const pool=(model:WorldModel,count:number,parent=this.group)=>{
      const source=model.finish(material,lights,false),meshes:T.InstancedMesh[]=[];
      for(const child of source.children) {
        const mesh=child as T.Mesh, instanced=new T.InstancedMesh(mesh.geometry,mesh.material,count);
        this.geometries.add(mesh.geometry);this.instances.push(instanced);meshes.push(instanced);
        instanced.instanceMatrix.setUsage(T.DynamicDrawUsage);instanced.frustumCulled=false;
        // These small props do not add shadow passes to the scene.
        parent.add(instanced);
      }
      return meshes;
    };
    const place=(meshes:T.InstancedMesh[],index:number)=>{
      this.dummy.updateMatrix();for(const mesh of meshes)mesh.setMatrixAt(index,this.dummy.matrix);
    };
    if(section.kind==='carouselhelix') {
      const center=carouselCenter(section),radius=carouselRideRadius(section),ceiling=section.origin.y+section.amplitude*.84;
      const floors=[2,2+(ceiling-2)/3,2+(ceiling-2)*2/3], rotor=new T.Group();
      rotor.name='carousel-rotor';rotor.position.set(center.x,0,center.z);this.group.add(rotor);
      batch(spinningPalace(radius,floors,ceiling),rotor);
      const animals=pool(unicorn(),12,rotor),animalRadius=radius*.6;
      const leg=new WorldModel();leg.add(G.box,'#fff0cf',[0,-.3,0],[.15,.6,.16]);
      leg.add(G.box,'#e9bd7d',[0,-.65,0],[.23,.16,.23]);
      const legs=pool(leg,48,rotor),local=new T.Object3D(),bodyMatrix=new T.Matrix4();
      for(const mesh of legs)mesh.name='galloping-unicorn-legs';
      for(const mesh of animals)mesh.name='greeting-unicorns';
      const motion=new CarouselMotion(section),size=Math.min(1.13,radius*.34);
      const greetings=[.2,.42,.65].map(t=>section.start+section.distances[Math.round(section.resolution*t)]);
      this.tick=(time,distance,reduced)=>{
        rotor.rotation.y=motion.update(time,distance,reduced);
        for(let i=0;i<12;i++) {
          const level=Math.floor(i/4),a=(i%4)*Math.PI/2+level*Math.PI/4,gap=(distance-greetings[level]-(i%4)*1.3)/11;
          const greeting=reduced?0:Math.exp(-gap*gap),bob=reduced?0:Math.sin(rotor.rotation.y*2+a)*.28+greeting*.32;
          this.dummy.position.set(Math.sin(a)*animalRadius,floors[level]+1.65+bob,Math.cos(a)*animalRadius);
          this.dummy.rotation.set(0,a,greeting*.13);this.dummy.scale.setScalar(size);place(animals,i);
          bodyMatrix.copy(this.dummy.matrix);
          // Feet swing about their own hips: a cantering wave, not a rigid toy bob.
          for(let foot=0;foot<4;foot++) {
            const front=foot<2,side=foot%2?1:-1;
            local.position.set(front?.52:-.52,-.22,side*.23);local.scale.setScalar(1);
            local.rotation.set(0,0,reduced?0:Math.sin(rotor.rotation.y*4+a+(front?0:Math.PI)+side*.7)*.27+greeting*(front?.4:-.18));
            local.updateMatrix();this.dummy.matrix.multiplyMatrices(bodyMatrix,local.matrix);
            for(const mesh of legs)mesh.setMatrixAt(i*4+foot,this.dummy.matrix);
          }
        }
      };
    } else if(section.kind==='lanternrun') {
      const meshes=pool(lanternMascot(),7),stops=Array.from({length:7},(_,i)=>{
        const distance=lanternDistance(section,i),f=section.sample(distance);
        return {distance,position:f.position.clone().sub(new T.Vector3(section.origin.x,0,section.origin.z))};
      });
      for(const mesh of meshes)mesh.name='lantern-creatures';
      const wing=new WorldModel();
      wing.add(G.round,'#f0b2d3',[.58,.14,0],[.7,.87,.13],[0,0,-.36]);
      wing.add(G.rock,'#b4e4dc',[.51,-.54,.03],[.52,.5,.14],[0,0,.26]);
      wing.beam('#f9d89b',new T.Vector3(0,0,.15),new T.Vector3(1.02,.57,.15),.035);
      wing.beam('#f9d89b',new T.Vector3(0,0,.15),new T.Vector3(.9,-.61,.15),.035);
      const wings=pool(wing,14),local=new T.Object3D(),bodyMatrix=new T.Matrix4();
      for(const mesh of wings)mesh.name='lantern-butterfly-wings';
      this.tick=(time,distance,reduced)=>{
        for(let i=0;i<7;i++) {
          const stop=stops[i],arrival=Math.exp(-(((distance-stop.distance)/10)**2)),bob=reduced?0:Math.sin(time*1.5+i)*.16+arrival*.85;
          this.dummy.position.copy(stop.position);this.dummy.position.y+=10+bob;
          this.dummy.rotation.set(reduced?0:-arrival*.13,Math.sin(i*.8)*.35,reduced?0:Math.sin(time*1.8+i)*(.045+arrival*.12));
          const size=.98+(reduced?0:arrival*.09);this.dummy.scale.set(size,size*(reduced?1:1+arrival*.08),size);place(meshes,i);
          bodyMatrix.copy(this.dummy.matrix);
          for(let side=0;side<2;side++){
            local.position.set(side===0?.54:-.54,0,-.28);local.scale.setScalar(1);
            const flap=reduced?0:Math.sin(time*(2.2+arrival*4)+i)*(.15+arrival*.5);
            local.rotation.set(0,(side===0?0:Math.PI)+(side===0?1:-1)*flap,0);local.updateMatrix();
            this.dummy.matrix.multiplyMatrices(bodyMatrix,local.matrix);for(const mesh of wings)mesh.setMatrixAt(i*2+side,this.dummy.matrix);
          }
        }
      };
    } else {
      const m=new WorldModel();star(m,0,0,0,.62,'#ffe3a2');
      const meshes=pool(m,12),top=section.frames[Math.round(section.resolution/2)].position;
      const x=top.x-section.origin.x,y=top.y+5.8,z=top.z-section.origin.z;
      const cheers=Array.from({length:6},(_,i)=>{
        const stop=section.start+section.length*(.08+i*.168),f=section.sample(stop);
        return {stop,p:f.position.clone().addScaledVector(f.up,-3.1).addScaledVector(f.right,2.2).sub(new T.Vector3(section.origin.x,0,section.origin.z))};
      });
      const ray=new WorldModel();ray.add(G.cone,'#ffd58c',[0,0,0],[.43,1.18,.26],[],true);
      const rays=pool(ray,12);for(const mesh of rays)mesh.name='sunshine-fan-rays';
      this.tick=(time,distance,reduced)=>{
        const progress=T.MathUtils.clamp((distance-section.start)/section.length,0,1);
        const cheer=Math.sin(progress*Math.PI),spin=reduced?0:time*.25+progress*Math.PI;
        for(let i=0;i<6;i++) {
          const a=i*Math.PI/3+spin,r=4.05+cheer*.12;
          this.dummy.position.set(x+Math.sin(a)*r,y+Math.cos(a)*r,z+.15);
          this.dummy.rotation.set(0,0,-a);this.dummy.scale.setScalar(.7+cheer*.25);place(meshes,i);
          const marker=cheers[i],gap=(distance-marker.stop)/8,pulse=Math.exp(-gap*gap);
          this.dummy.position.copy(marker.p);this.dummy.rotation.set(0,0,reduced?0:pulse*Math.PI);
          this.dummy.scale.setScalar(.9+(reduced?0:pulse*.85));place(meshes,i+6);
        }
        const apex=section.start+section.distances[Math.round(section.resolution*.5)],near=Math.exp(-(((distance-apex)/13)**2));
        for(let i=0;i<12;i++) {
          const a=i*Math.PI/6+(reduced?0:time*.15+near*.32),r=2.48+(reduced?0:near*.4);
          this.dummy.position.set(x+Math.sin(a)*r,y+Math.cos(a)*r,z);this.dummy.rotation.set(0,0,-a);
          this.dummy.scale.setScalar(1+(reduced?0:near*.2));place(rays,i);
        }
      };
    }
    this.update(0,section.start-12,false);
  }
  update(time:number,distance:number,reduced:boolean) {
    this.tick(time,distance,reduced);
    for(const mesh of this.instances)mesh.instanceMatrix.needsUpdate=true;
  }
  dispose() {
    for(const geometry of this.geometries)geometry.dispose();
    for(const mesh of this.instances)mesh.dispose();
    this.group.clear();
  }
}

/** Fixed instance pools keep articulated carnival rides independent of train size. */
export function createCarnivalPieceAnimation(section:MiniSection,material:T.Material,lights:FairgroundLights):PieceAnimation|undefined {
  return ['carouselhelix','lanternrun','midwayloop'].includes(section.kind)?new CarnivalPieceAnimation(section,material,lights):undefined;
}
