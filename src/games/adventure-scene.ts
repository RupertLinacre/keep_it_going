import { nightScenery, lanternParade } from "./world-night";
import { mountainScenery, mountainRidge, tunnelModel } from "./world-mountains";
import * as T from "three";
import { adventureAt } from "./adventure-worlds";
import { WorldModel, WORLD_SHAPES as G } from "./world-models";
import { sectionBounds } from "./mini-world";
import { seededRandom } from "./mini-rail";
import type { MiniSection, MiniTrack } from "./mini-track";

type Actor = { kind: "sheep" | "mill" | "cable" | "wheel" | "firefly"; x: number; y: number; z: number; phase: number; size: number };
type Tile = { root: T.Group; mirror?: T.Group; actors: Actor[]; section: MiniSection; tunnel?: T.Group; mirrorTunnel?: T.Group };

/** World decorations stay in world coordinates, outside the camera's subject list.
 * Static scenery is batched; animated creatures share a small instance buffer. */
export class AdventureScene {
  readonly group = new T.Group();
  readonly tiles = new Map<number, Tile>();
  private material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
  private luminous = new T.MeshBasicMaterial({ vertexColors: true });
  private sheep: T.InstancedMesh;
  private mills: T.InstancedMesh;
  private cables: T.InstancedMesh;
  private wheels: T.InstancedMesh;
  private fireflies: T.InstancedMesh;
  private dummy = new T.Object3D();
  constructor(scene: T.Scene) {
    scene.add(this.group);
    const sheep = new WorldModel();
    sheep.add(G.round, "#fff5de", [0, 1.05, 0], [1, .64, .65]);
    for (const x of [-.6, .6]) for (const z of [-.35, .35]) sheep.add(G.pole, "#5d6265", [x, .35, z], [.1, .65, .1]);
    sheep.add(G.round, "#585c62", [.85, 1.15, 0], [.43, .43, .38]);
    for (const z of [-.4, .4]) sheep.add(G.rock, "#6a6770", [.88, 1.4, z], [.24, .1, .24]);
    for (const z of [-.31, .31]) {
      sheep.add(G.round, "#ffffff", [1.1, 1.25, z], [.115,.115,.07]);
      sheep.add(G.round, "#263e41", [1.14,1.25,z*1.12], [.052,.06,.035]);
    }
    const mill = new WorldModel();
    for (let i=0;i<4;i++) {
      const a=i*Math.PI/2;
      mill.add(G.box,"#fff0c8",[Math.sin(a)*1.55,Math.cos(a)*1.55,0],[.55,2.7,.09],[0,0,-a]);
      mill.add(G.box,"#ae8159",[Math.sin(a)*1.45,Math.cos(a)*1.45,.08],[.075,3,.1],[0,0,-a]);
    }
    this.sheep = this.instances(sheep); this.mills = this.instances(mill);
    const cable=new WorldModel();
    cable.add(G.box,'#e8ac5b',[0,0,0],[1.9,1.6,1.6]);
    cable.add(G.box,'#a9dce0',[0,.55,0],[1.95,.65,1.65]);
    cable.add(G.box,'#735c53',[0,1.02,0],[2.05,.18,1.75]);
    cable.add(G.pole,'#606976',[0,1.6,0],[.06,1.2,.06]);
    this.cables=this.instances(cable);
    const wheel=new WorldModel();
    wheel.add(G.ring,'#90f0d8',[0,0,0],[7,7,7],[],true);
    wheel.add(G.ring,'#cab0ef',[0,0,0],[6.5,6.5,6.5],[],true);
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      wheel.add(G.box,'#718fb7',[Math.sin(a)*3.5,Math.cos(a)*3.5,0],[.065,7,.065],[0,0,-a],true);
      wheel.add(G.round,i%2?'#ffd69c':'#e9a2cb',[Math.sin(a)*7,Math.cos(a)*7,0],[.65,.75,.6],[],true);
    }
    this.wheels=this.instances(wheel,true);
    const firefly=new WorldModel();firefly.add(G.round,'#c4f8a4',[0,0,0],[.1,.1,.1],[],true);
    this.fireflies=this.instances(firefly,true);
  }
  private instances(model: WorldModel, glow=false) {
    const source = model.finish(this.material, this.luminous).children[0] as T.Mesh;
    const mesh = new T.InstancedMesh(source.geometry, glow?this.luminous:this.material, 192);
    mesh.castShadow = !glow; mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.group.add(mesh); return mesh;
  }
  private build(section: MiniSection, track: MiniTrack): Tile {
    const model = new WorldModel(), actors: Actor[] = [];
    const world = adventureAt(Math.max(0, section.start)).world;
    const random = seededRandom((track.seed ^ Math.imul(section.id + 17, 17041)) >>> 0);
    const bounds = sectionBounds(section);
    const back = Math.min(-10, bounds.min.z - section.origin.z - 9);
    const front = Math.max(9, bounds.max.z - section.origin.z + 7);
    const span = section.span;
    const n = Math.min(12, Math.max(1, Math.ceil(span / 32)));
    for (let i = 0; i < n; i++) {
      const x = span * (i+.5) / n;
      if(world.id==='mountain') {
        mountainScenery(model,x,back,front,random);
        if(i%2===0) {
          model.add(G.box,'#697d88',[x,15,back-8],[24,.055,.055]);
          for(const dx of [-12,12])model.add(G.pole,'#9aa7a4',[x+dx,7.5,back-8],[.17,15,.17]);
          actors.push({kind:'cable',x,y:12.8,z:back-8,phase:random()*6.28,size:1});
        }
      } else if(world.id==='night') {
        nightScenery(model,x,back,front,random);
        if(i===0 && section.id%4===0) {
          const z=back-3;
          for(const side of [-1,1]) model.add(G.box,'#797aa7',[x+side*2.3,4.5,z],[.3,10,.3],[0,0,side*-.46]);
          actors.push({kind:'wheel',x,y:9,z,phase:random()*6.28,size:1});
        }
        for(let j=0;j<10;j++)actors.push({kind:'firefly',x:x-14+random()*28,y:1+random()*3,z:front+random()*7,phase:random()*6.28,size:.7+random()});
      } else this.meadow(model, actors, x, back, front, random);
    }
    if(section.kind==='lanternrun')lanternParade(model,section);
    if(section.kind==='mountainpass')mountainRidge(model,section);
    const root = model.finish(this.material, this.luminous);
    this.group.add(root);
    const tunnel=section.kind==='tunnel'?tunnelModel(this.material,this.luminous,world.id==='halloween'):undefined;
    if(tunnel)this.group.add(tunnel);
    return { root, actors, section, tunnel };
  }
  private meadow(m: WorldModel, actors: Actor[], x: number, back: number, front: number, r: () => number) {
    // Broad, overlapping hills read as a landscape rather than miniature cones.
    m.add(G.round, r()>.5 ? "#88b968" : "#97c574", [x, -2, back-11], [24, 9+r()*8, 15]);
    m.add(G.round, "#afcf84", [x+9, -2, back-31], [29, 18+r()*8, 20]);
    for(let i=0;i<3;i++) {
      const sx=x-9+r()*18, z=front+1+r()*5;
      actors.push({kind:"sheep",x:sx,y:.15,z,phase:r()*6.28,size:.8+r()*.35});
      // A little grass island makes each flock feel settled in the field.
      m.add(G.round,"#99c56c",[sx,-.1,z],[2.2,.23,1.9]);
    }
    for(let i=0;i<5;i++) {
      const tx=x-13+i*6, tz=back-2;
      m.add(G.pole,"#a47d51",[tx, .8, tz],[.11,1.6,.11]);
      if(i<4) for(const y of [.6,1.25]) m.add(G.box,"#f3deb1",[tx+3,y,tz],[6,.12,.12]);
    }
    for(let i=0;i<14;i++) {
      const fx=x-13+r()*26, fz=front+6+r()*6;
      m.add(G.pole,"#689454",[fx,.25,fz],[.035,.5,.035]);
      m.add(G.round,i%3 ? "#fff4bb" : "#ec9caf",[fx,.52,fz],[.23,.13,.23]);
      m.add(G.round,"#efc356",[fx,.64,fz],[.08,.06,.08]);
    }
    const tx=x+6,tz=back+2;
    m.add(G.pole,"#977957",[tx,1.8,tz],[.35,3.6,.35]);
    for(const [dx,dy,dz] of [[-1,4,0],[1.2,4.4,.2],[0,5.3,-.6]])
      m.add(G.round,"#639c65",[tx+dx,dy,tz+dz],[2.2,2.1,1.9]);
    if(r()<.38) {
      const mx=x-8,mz=back-5;
      m.add(G.cone,"#f4dfb2",[mx,3.5,mz],[2,7,2]);
      m.add(G.cone,"#da8c72",[mx,7,mz],[2.2,2.1,2.2]);
      m.add(G.box,"#789996",[mx,2.4,mz+1.4],[.7,1.4,.1]);
      actors.push({kind:"mill",x:mx,y:6,z:mz+1.6,phase:r()*6.28,size:1});
    }
  }
  render(track: MiniTrack, distance: number, anchor: number, laneOffset: number, time: number) {
    const visible = track.sections.filter(s=>s.start<distance+350);
    const ids = new Set(visible.map(s=>s.id));
    for (const [id,tile] of this.tiles) if(!ids.has(id)) { this.release(tile); this.tiles.delete(id); }
    let sheep=0,mills=0,cables=0,wheels=0,fireflies=0;
    const leadX=track.sample(distance).position.x;
    for (const section of visible) {
      let tile=this.tiles.get(section.id);
      if(!tile) { tile=this.build(section,track);this.tiles.set(section.id,tile); }
      tile.root.position.set(section.origin.x-anchor,0,section.origin.z+laneOffset);
      if(laneOffset && !tile.mirror) { tile.mirror=tile.root.clone();tile.mirror.scale.z=-1;this.group.add(tile.mirror); }
      if(tile.mirror) tile.mirror.position.set(section.origin.x-anchor,0,-section.origin.z-laneOffset);
      if(tile.tunnel) {
        const f=section.sample(section.start+section.length*.5);
        tile.tunnel.position.copy(f.position);tile.tunnel.position.x-=anchor;tile.tunnel.position.z+=laneOffset;
        tile.tunnel.quaternion.copy(f.rotation);
        if(laneOffset) {
          tile.mirrorTunnel??=tile.tunnel.clone();this.group.add(tile.mirrorTunnel);
          tile.mirrorTunnel.position.copy(tile.tunnel.position);tile.mirrorTunnel.position.z*=-1;
          tile.mirrorTunnel.quaternion.set(-f.rotation.x,-f.rotation.y,f.rotation.z,f.rotation.w);tile.mirrorTunnel.scale.z=-1;
        }
      }
      for (const rival of laneOffset ? [false,true] : [false]) for(const actor of tile.actors) {
        const mesh=actor.kind==="sheep"?this.sheep:actor.kind==="mill"?this.mills:actor.kind==="cable"?this.cables:actor.kind==="wheel"?this.wheels:this.fireflies;
        const index=actor.kind==="sheep"?sheep++:actor.kind==="mill"?mills++:actor.kind==="cable"?cables++:actor.kind==="wheel"?wheels++:fireflies++;
        if(index>=192)continue;
        const phase=time*.9+actor.phase;
        this.dummy.position.set(section.origin.x+actor.x-anchor,actor.y, (section.origin.z+actor.z+laneOffset)*(rival?-1:1));
        this.dummy.rotation.set(0,actor.kind==="sheep"?Math.sin(phase*.3)*.16+actor.phase:0,actor.kind==="mill"?phase*.35:Math.sin(phase)*.035);
        if(actor.kind==='wheel')this.dummy.rotation.set(0,0,phase*.19);
        if(actor.kind==='firefly') {
          this.dummy.position.x+=Math.sin(phase*.9)*.8;this.dummy.position.y+=Math.sin(phase)*.6;
          this.dummy.position.z+=Math.cos(phase*.7)*.6;
        }
        if(actor.kind==='cable') {this.dummy.position.x+=Math.sin(phase*.24)*9;this.dummy.rotation.set(0,0,Math.sin(phase)*.025);}
        if(actor.kind==='sheep') {
          const passing=(leadX-section.origin.x-actor.x+8)/16;
          this.dummy.position.y+=passing>0&&passing<1?Math.sin(passing*Math.PI)*.7:0;
        }
        this.dummy.scale.setScalar(actor.size*(actor.kind==='firefly'?.5+.5*Math.sin(phase*.7)**2:1));this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);
      }
    }
    for(const [mesh,count] of [[this.sheep,sheep],[this.mills,mills],[this.cables,cables],[this.wheels,wheels],[this.fireflies,fireflies]] as const) { mesh.count=Math.min(192,count);mesh.instanceMatrix.needsUpdate=true; }
  }
  private release(tile: Tile) {
    tile.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});
    tile.root.removeFromParent();tile.mirror?.removeFromParent();
    tile.tunnel?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});tile.tunnel?.removeFromParent();tile.mirrorTunnel?.removeFromParent();
  }
  destroy() {
    this.tiles.forEach(tile=>this.release(tile));this.tiles.clear();
    for(const mesh of [this.sheep,this.mills,this.cables,this.wheels,this.fireflies]) {mesh.geometry.dispose();mesh.dispose()}
    this.material.dispose();this.luminous.dispose();this.group.removeFromParent();
  }
}
