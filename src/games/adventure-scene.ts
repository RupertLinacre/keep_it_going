import { tunnelRevealAt } from "./mountain-landforms";
import { AttractionDrive } from './attraction-drive';
import { SceneryFlight } from './scenery-flight';
import { mountainGondolaPosition } from './mountain-gondolas';
import { PortalImpact, PortalEffects, PORTAL_PUMPKINS, portalHitDistance, portalPumpkin } from './pumpkin-portal';
import { FairgroundLights, fairgroundBeamMaterial } from "./world-lighting";
import { sheepBanks, lilyBridge, meadowWindmill, duckModel, SHEEP_STOPS, trackSheepPose } from "./world-meadow";
import { halloweenScenery, pumpkinHops, witchHat, witchHatCenter, ghostModel, batModel, pumpkin } from "./world-halloween";
import { nightScenery, lanternParade, marqueeLoop, carouselClimb, carouselCenter, carouselRotation, carouselModel, gondolaModel, tracksideLights } from "./world-night";
import { mountainScenery, mountainRidge, tunnelModel, ravineBridge } from "./world-mountains";
import * as T from "three";
import { adventureAt, type AdventureWorld } from "./adventure-worlds";
import { WorldModel, WORLD_SHAPES as G } from "./world-models";
import { sectionBounds } from "./mini-world";
import { seededRandom } from "./mini-rail";
import type { MiniSection, MiniTrack } from "./mini-track";

type Actor = { kind: "sheep" | "pumpkin" | "mill" | "cable" | "wheel" | "firefly" | "ghost" | "bat" | "duck" | "spray" | "carousel" | "gondola" | "beam"; x: number; y: number; z: number; phase: number; size: number; onTrack?: boolean; drop?: number; liftCable?:boolean; sheepDistance?:number; portalIndex?:number; flights?:[SceneryFlight,SceneryFlight] };
type Tile = { root: T.Group; formation?: T.Group; mirrorFormation?: T.Group; gorgeWall?: T.Group; actors: Actor[]; section: MiniSection; tunnel?: T.Group; mirrorTunnel?: T.Group; drives: [AttractionDrive,AttractionDrive]; portals?:[PortalImpact,PortalImpact] };

/** World decorations stay in world coordinates, outside the camera's subject list.
 * Static scenery is batched; animated creatures share a small instance buffer. */
export class AdventureScene {
  readonly group = new T.Group();
  readonly tiles = new Map<number, Tile>();
  private material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
  private luminous = new FairgroundLights();
  private beamMaterial = fairgroundBeamMaterial();
  private sheep: T.InstancedMesh;
  private mills: T.InstancedMesh;
  private cables: T.InstancedMesh;
  private wheels: T.InstancedMesh;
  private fireflies: T.InstancedMesh;
  private ghosts: T.InstancedMesh;
  private pumpkins: T.InstancedMesh;
  private pumpkinFaces: T.InstancedMesh;
  private bats: T.InstancedMesh;
  private ducks: T.InstancedMesh;
  private spray: T.InstancedMesh;
  private carousels: T.InstancedMesh;
  private gondolas: T.InstancedMesh;
  private beams: T.InstancedMesh;
  private actorMeshes: Record<Actor["kind"],T.InstancedMesh>;
  private dummy = new T.Object3D();
  private lightTransform = new T.Matrix4();
  private lastFlightTime?: number;
  private portalEffects:PortalEffects;
  private reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  constructor(scene: T.Scene, private options: { attractionsOnly?: boolean; world?: AdventureWorld; tunnelCutaway?: boolean } = {}) {
    scene.add(this.group);
    this.portalEffects=new PortalEffects(this.group);
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
      wheel.add(G.round,i%2?'#ffd69c':'#e9a2cb',[Math.sin(a)*7,Math.cos(a)*7,0],[.22,.22,.22],[],true,i*.7);
    }
    this.wheels=this.instances(wheel,true);
    const firefly=new WorldModel();firefly.add(G.round,'#c4f8a4',[0,0,0],[.1,.1,.1],[],true);
    this.fireflies=this.instances(firefly,true);
    this.ghosts=this.instances(ghostModel());this.bats=this.instances(batModel());
    const pumpkinModel=new WorldModel();pumpkin(pumpkinModel,0,0,0,1);
    const pumpkinParts=pumpkinModel.finish(this.material,this.luminous,false);
    const pumpkinMeshes=pumpkinParts.children.map(source=>{
      const part=source as T.Mesh,mesh=new T.InstancedMesh(part.geometry,part.material,192);
      mesh.castShadow=part.material===this.material;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.count=0;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);return mesh;
    });
    [this.pumpkins,this.pumpkinFaces]=pumpkinMeshes;
    this.ducks=this.instances(duckModel());
    const spray=new WorldModel();spray.add(G.round,"#d5f0f0",[0,0,0],[.18,.45,.18],[],true);this.spray=this.instances(spray,true);
    this.carousels=this.instances(carouselModel());this.gondolas=this.instances(gondolaModel());
    const beamGeometry=new T.CylinderGeometry(.22,0,1,16,1,true);beamGeometry.translate(0,.5,0);
    this.beams=new T.InstancedMesh(beamGeometry,this.beamMaterial,192);this.beams.count=0;this.beams.frustumCulled=false;
    this.beams.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(this.beams);
    this.actorMeshes={sheep:this.sheep,pumpkin:this.pumpkins,mill:this.mills,cable:this.cables,wheel:this.wheels,firefly:this.fireflies,ghost:this.ghosts,bat:this.bats,duck:this.ducks,spray:this.spray,carousel:this.carousels,gondola:this.gondolas,beam:this.beams};
  }
  private instances(model: WorldModel, glow=false) {
    const source = model.finish(this.material, this.luminous,false).children[0] as T.Mesh;
    const mesh = new T.InstancedMesh(source.geometry, glow?this.luminous:this.material, 192);
    mesh.castShadow = !glow; mesh.frustumCulled = false; mesh.count = 0;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.group.add(mesh); return mesh;
  }
  private build(section: MiniSection, track: MiniTrack): Tile {
    const model = new WorldModel(true), actors: Actor[] = [];
    const placePumpkin=(x:number,y:number,z:number,size:number)=>actors.push({kind:'pumpkin',x,y,z,size,phase:x*.7+z*.3,onTrack:true});
    const world = this.options.world ?? adventureAt(Math.max(0, section.start)).world;
    const random = seededRandom((track.seed ^ Math.imul(section.id + 17, 17041)) >>> 0);
    const bounds = sectionBounds(section);
    const back = -Math.max(10,Math.abs(bounds.min.z-section.origin.z),Math.abs(bounds.max.z-section.origin.z))-12;
    const front = Math.max(9, bounds.max.z - section.origin.z + 7);
    const span = section.span;
    const n = Math.min(12, Math.max(1, Math.ceil(span / 32)));
    for (let i = 0; i < (this.options.attractionsOnly ? 0 : n); i++) {
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
          const phase=random()*6.28;
          actors.push({kind:'wheel',x,y:9,z,phase,size:1});
          for(let j=0;j<10;j++)actors.push({kind:'gondola',x,y:9,z:z+.2,phase:phase+j*Math.PI*2/10/.19,size:1});
        }
        if(i===0){
          for(const dx of [-9,9]){
            model.add(G.pole,'#73698a',[x+dx,.5,back+3],[.65,1,.65]);
            actors.push({kind:'beam',x:x+dx,y:1,z:back+3,phase:random()*6.28,size:26});
          }
        }
        for(let j=0;j<10;j++)actors.push({kind:'firefly' ,x:x-14+random()*28,y:1+random()*3,z:front+random()*7,phase:random()*6.28,size:.7+random()});
      } else if(world.id==='halloween') {
        halloweenScenery(model,x,back,front,random,placePumpkin);
        for(let j=0;j<2;j++)actors.push({kind:'ghost',x:x-10+random()*20,y:2+random()*2,z:front+2+random()*5,phase:random()*6.28,size:.9+random()*.4,onTrack:true});
        for(let j=0;j<3;j++)actors.push({kind:'bat',x:x-12+random()*24,y:7+random()*3,z:back+3,phase:random()*6.28,size:.7+random()*.3});
      } else this.meadow(model, actors, x, back, front, random);
    }
    let formation:T.Group|undefined, gorgeWall:T.Group|undefined;
    if (['sheepbank','pondbridge','windmillloop'].includes(section.kind)) {
      const attraction=new WorldModel();
      if(section.kind==='sheepbank'){
        sheepBanks(attraction,section);
        SHEEP_STOPS.forEach((fraction,i)=>{
          const at=section.start+section.length*fraction,p=section.sample(at).position;
          actors.unshift({kind:'sheep',x:p.x-section.origin.x,y:p.y+.12,z:p.z-section.origin.z,
            phase:i*.83+.4,size:.85+(i%3)*.07,onTrack:true,sheepDistance:at});
        });
      }
      if(section.kind==='pondbridge') {
        lilyBridge(attraction,section);
        for(let i=0;i<4;i++)actors.push({kind:'duck',x:section.span*.4+i*1.3,y:.32,z:section.hand*4+9+i*.3,phase:i*.7,size:1,onTrack:true});
      }
      if(section.kind==='windmillloop') {
        meadowWindmill(attraction,section);
        actors.push({kind:'mill',x:section.width*.5,y:section.origin.y+section.amplitude,z:-3.1,phase:0,size:section.amplitude*.22,onTrack:true});
      }
      formation=attraction.finish(this.material,this.luminous);this.group.add(formation);
    }
    if(section.kind==='pumpkinhop'||section.kind==='lanternrun') {
      const decoration=new WorldModel();
      if(section.kind==='pumpkinhop')pumpkinHops(decoration,section,placePumpkin);else lanternParade(decoration,section);
      formation=decoration.finish(this.material,this.luminous);this.group.add(formation);
    }
    if(section.kind==='ravinebridge') {
      const viaduct=new WorldModel();ravineBridge(viaduct,section);formation=viaduct.finish(this.material,this.luminous);this.group.add(formation);
      const p=section.frames[Math.round(section.resolution*.5)].position;
      for(let i=0;i<14;i++)actors.push({kind:'spray',x:p.x-section.origin.x+1.7+(i%3)*1.2,y:p.y*.8,z:p.z-section.origin.z-9.6,phase:i/14,size:.8+(i%3)*.2,drop:p.y*.8,onTrack:true});
    }
    if(section.kind==='midwayloop'||section.kind==='carouselhelix') {
      const attraction=new WorldModel();
      if(section.kind==='midwayloop')marqueeLoop(attraction,section);
      else {
        carouselClimb(attraction,section);
        const {x,z,radius}=carouselCenter(section);
        actors.push({kind:'carousel',x,y:0,z,phase:0,size:radius/3.7,onTrack:true});
      }
      formation=attraction.finish(this.material,this.luminous);this.group.add(formation);
    }
    if(section.kind==='witchhat') {
      const hat=new WorldModel();witchHat(hat,section,placePumpkin);formation=hat.finish(this.material,this.luminous);this.group.add(formation);
      const {x,z}=witchHatCenter(section);
      for(let i=0;i<3;i++)actors.push({kind:'ghost',x:x+(i-1)*4,y:section.origin.y+section.amplitude*.45+i,z:z+8,phase:i*2,size:.9,onTrack:true});
    }
    if(section.kind==='mountainpass') {
      const ridge=new WorldModel(),cliffs=new WorldModel();mountainRidge(ridge,section,cliffs);
      formation=ridge.finish(this.material,this.luminous);gorgeWall=cliffs.finish(this.material,this.luminous);this.group.add(formation,gorgeWall);
    }
    if(section.kind==='tunnel'||section.kind==='pumpkintunnel') {
      const base=new WorldModel(),f=section.sample(section.start+section.length*.5).position;
      if(section.kind==='tunnel') {
        base.add(G.rock,'#9caeb0',[f.x-section.origin.x,-.1,f.z-section.origin.z],[21,(f.y+.2)*1.2,12.5]);
        for(let i=0;i<6;i++)actors.push({kind:'cable',x:0,y:0,z:0,phase:i/6,size:1,onTrack:true,liftCable:true});
      } else {
        base.add(G.box,'#92727d',[f.x-section.origin.x,f.y-.65,f.z-section.origin.z],[4,.8,10]);
        for(let i=0;i<PORTAL_PUMPKINS;i++){
          const p=portalPumpkin(section,i,-1);
          actors.unshift({kind:'pumpkin',x:p.position.x-section.origin.x,y:p.position.y,z:p.position.z-section.origin.z,
            size:p.size,phase:i*2.4,onTrack:true,portalIndex:i});
        }
        for(const side of [-1,1]){
          base.add(G.pole,'#aa90b5',[f.x-section.origin.x,f.y+1,f.z-section.origin.z+side*5.5],[.12,3.6,.12]);
          base.add(G.round,'#a6f474',[f.x-section.origin.x,f.y+3,f.z-section.origin.z+side*5.5],[.4,.55,.4],[],true);
        }
      }
      formation=base.finish(this.material,this.luminous);this.group.add(formation);
    }
    if(world.id==='night'&&!formation){
      const lights=new WorldModel();tracksideLights(lights,section);formation=lights.finish(this.material,this.luminous);this.group.add(formation);
    }
    const root = model.finish(this.material, this.luminous);
    this.group.add(root);
    const tunnel=section.kind==='tunnel'?tunnelModel(this.material,this.luminous):undefined;
    if(tunnel)this.group.add(tunnel);
    return { root, actors, section, tunnel, formation, gorgeWall, drives:[new AttractionDrive(),new AttractionDrive()],
      portals:section.kind==='pumpkintunnel'?[new PortalImpact(),new PortalImpact()]:undefined };
  }
  private meadow(m: WorldModel, actors: Actor[], x: number, back: number, front: number, r: () => number) {
    // Broad, overlapping hills read as a landscape rather than miniature cones.
    m.add(G.round, r()>.5 ? "#88b968" : "#97c574", [x, -2, back-19], [24, 9+r()*8, 15]);
    m.add(G.round, "#afcf84", [x+9, -2, back-38], [29, 18+r()*8, 20]);
    for(let i=0;i<3;i++) {
      const sx=x-9+r()*18, z=front+1+r()*5;
      actors.push({kind:"sheep",x:sx,y:.15,z,phase:r()*6.28,size:.8+r()*.35,onTrack:true});
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
  setTunnelCutaway(reveal: boolean) { this.options.tunnelCutaway = reveal; }
  render(track: MiniTrack, distance: number, anchor: number, laneOffset: number, time: number, opponentDistance?: number, gravity=9.81, opponentGravity=9.81) {
    if(this.reducedMotion?.matches)time=0;
    const flightDt=this.lastFlightTime===undefined?0:Math.max(0,Math.min(.1,time-this.lastFlightTime));this.lastFlightTime=time;
    this.luminous.clock.value=time;
    // Read the pending transform without updating ancestor world matrices.
    // The scene deliberately disables matrixAutoUpdate. Updating only its
    // ancestors here would clear its dirty flag before the renderer propagates
    // Downhill Drift to static rails, leaving them behind the moving train.
    this.lightTransform.identity();
    for(let node:T.Object3D|null=this.group;node;node=node.parent){
      if(node.matrixAutoUpdate)node.updateMatrix();
      this.lightTransform.premultiply(node.matrix);
    }
    for(let rider=0;rider<2;rider++)for(let tail=0;tail<2;tail++){
      const point=this.luminous.trains.value[rider*2+tail];
      if(rider && !laneOffset){point.set(1e6,1e6,1e6);continue;}
      point.copy(track.sample((rider?opponentDistance??distance:distance)-tail*15).position);
      point.x-=anchor;point.z=(point.z+laneOffset)*(rider?-1:1);
      // Downhill drift rotates the whole scene; compare lamps and trains in
      // that same transformed space so the glow remains beside the carriages.
      point.applyMatrix4(this.lightTransform);
    }
    const near=(s:MiniSection)=>Math.max(0,s.start-distance,distance-s.end);
    const visible = track.sections.filter(s=>s.start<distance+350).sort((a,b)=>near(a)-near(b));
    const ids = new Set(visible.map(s=>s.id));
    for (const [id,tile] of this.tiles) if(!ids.has(id)) { this.release(tile); this.tiles.delete(id); }
    const counts:Record<Actor["kind"],number>={sheep:0,pumpkin:0,mill:0,cable:0,wheel:0,firefly:0,ghost:0,bat:0,duck:0,spray:0,carousel:0,gondola:0,beam:0};
    this.portalEffects.begin();
    const leadX=track.sample(distance).position.x;
    for (const section of visible) {
      let tile=this.tiles.get(section.id);
      if(!tile) { tile=this.build(section,track);this.tiles.set(section.id,tile); }
      tile.drives[0].update(time,distance,section.start,section.end,!!this.reducedMotion?.matches);
      tile.drives[1].update(time,opponentDistance??distance,section.start,section.end,!!this.reducedMotion?.matches);
      if(tile.portals)for(const rider of laneOffset?[0,1]:[0]){
        const portal=tile.portals[rider];portal.update(time,rider?opponentDistance??distance:distance,portalHitDistance(section),!!this.reducedMotion?.matches);
        this.portalEffects.emit(section,portal.age,anchor,laneOffset,!!rider);
      }
      tile.root.position.set(section.origin.x-anchor,0,section.origin.z);
      for(const mesh of tile.root.children) mesh.position.z=laneOffset?(mesh.userData.front?laneOffset:-laneOffset-2*section.origin.z):0;
      if(tile.gorgeWall) {
        // The high gorge wall frames both riders from behind. Mirroring a tall
        // wall beside each lane would put a mountain in front of the opponent.
        const bounds=sectionBounds(section);
        const bend=Math.max(Math.abs(bounds.min.z-section.origin.z),Math.abs(bounds.max.z-section.origin.z));
        tile.gorgeWall.position.set(section.origin.x-anchor,0,laneOffset?-section.origin.z-laneOffset-2*bend:section.origin.z);
      }
      if(tile.formation) {
        tile.formation.position.set(section.origin.x-anchor,0,section.origin.z+laneOffset);
        if(laneOffset) {
          if(!tile.mirrorFormation){tile.mirrorFormation=tile.formation.clone();tile.mirrorFormation.scale.z=-1;this.group.add(tile.mirrorFormation)}
          tile.mirrorFormation.position.set(section.origin.x-anchor,0,-section.origin.z-laneOffset);
        }
      }
      if(tile.tunnel) {
        const f=section.sample(section.start+section.length*.5);
        tile.tunnel.position.copy(f.position);tile.tunnel.position.x-=anchor;tile.tunnel.position.z+=laneOffset;
        tile.tunnel.quaternion.copy(f.rotation);
        if(laneOffset) {
          if(!tile.mirrorTunnel){
            tile.mirrorTunnel=tile.tunnel.clone();
            tile.mirrorTunnel.traverse(o=>{if(o instanceof T.Mesh && o.userData.mountainCover)o.material=(o.material as T.Material).clone()});
            this.group.add(tile.mirrorTunnel);
          }
          tile.mirrorTunnel.position.copy(tile.tunnel.position);tile.mirrorTunnel.position.z*=-1;
          tile.mirrorTunnel.quaternion.set(-f.rotation.x,-f.rotation.y,f.rotation.z,f.rotation.w);tile.mirrorTunnel.scale.z=-1;
        }
        const ownReveal=this.options.attractionsOnly?(this.options.tunnelCutaway?1:0):tunnelRevealAt(section,distance);
        this.revealTunnel(tile.tunnel,ownReveal,1);
        if(tile.mirrorTunnel)this.revealTunnel(tile.mirrorTunnel,tunnelRevealAt(section,opponentDistance??distance),-1);
      }
      for(const actor of tile.actors) for(const mirror of actor.onTrack && laneOffset ? [false,true] : [false]) {
        const portalAge=tile.portals?.[mirror?1:0].age??-1;
        if(actor.portalIndex!==undefined&&portalAge>=6)continue;
        const mesh=this.actorMeshes[actor.kind],index=counts[actor.kind]++;
        if(index>=192)continue;
        const phase=time*.9+actor.phase;
        const drive=tile.drives[mirror?1:0];
        const worldZ = actor.onTrack ? (section.origin.z+actor.z+laneOffset)*(mirror?-1:1)
          : actor.z+(laneOffset&&actor.z<0?-section.origin.z-laneOffset:section.origin.z+laneOffset);
        this.dummy.position.set(section.origin.x+actor.x-anchor,actor.y,worldZ);
        this.dummy.rotation.set(0,actor.kind==="sheep"?Math.sin(phase*.3)*.16+actor.phase:0,Math.sin(phase)*.035);
        if(actor.kind==='ghost') {this.dummy.position.y+=Math.sin(phase)*.55;this.dummy.rotation.set(0,Math.sin(phase*.8)*.25,Math.sin(phase)*.08);}
        if(actor.kind==='bat') {this.dummy.position.x+=Math.sin(phase*.6)*2;this.dummy.position.y+=Math.cos(phase)*.6;this.dummy.rotation.set(0,Math.sin(phase*.5)*.4,0);}
        if(actor.kind==='mill')this.dummy.rotation.set(0,0,actor.phase+drive.angle);
        if(actor.kind==='carousel'){
          this.dummy.rotation.set(0,this.reducedMotion?.matches?0:carouselRotation(section,mirror?opponentDistance??distance:distance),0);
        }
        // The same passing train gives the fairground wheel a gentle push;
        // its cabins use the exact same angle and remain upright.
        if(actor.kind==='wheel')this.dummy.rotation.set(0,0,phase*.19+drive.angle*.18);
        if(actor.kind==='gondola'){
          const a=phase*.19+drive.angle*.18;
          this.dummy.position.x=section.origin.x+actor.x-anchor-Math.sin(a)*7;
          this.dummy.position.y=actor.y+Math.cos(a)*7;
          this.dummy.rotation.set(0,0,0);
        }
        if(actor.kind==='beam')this.dummy.rotation.set(Math.sin(phase*.25)*.22,0,Math.sin(phase*.4)*.42);
        if(actor.kind==='firefly') {
          this.dummy.position.x+=Math.sin(phase*.9)*.8;this.dummy.position.y+=Math.sin(phase)*.6;
          this.dummy.position.z+=Math.cos(phase*.7)*.6;
        }
        if(actor.kind==='spray') {const fall=(time*.7+actor.phase)%1;this.dummy.position.y=.25+(actor.drop??12)*(1-fall*fall);this.dummy.rotation.set(0,0,0);}
        if(actor.kind==='duck'){
          this.dummy.position.x+=Math.sin(phase*.25)*2;this.dummy.position.y+=Math.sin(phase)*.07;
          this.dummy.rotation.set(0,Math.sin(phase*.25)*.3,0);
          this.dummy.position.z+=(mirror?-1:1)*Math.min(1.6,drive.speed)*Math.sin(actor.phase+1);
          this.dummy.rotation.y+=Math.sin(drive.angle*2+actor.phase)*Math.min(.3,drive.speed*.15);
        }
        if(actor.kind==='cable') {
          if(actor.liftCable){
            const p=mountainGondolaPosition(section,this.reducedMotion?.matches?section.start:mirror?opponentDistance??distance:distance,actor.phase);
            this.dummy.position.set(p.x-anchor,p.y,(p.z+laneOffset)*(mirror?-1:1));
            this.dummy.rotation.set(0,0,0);
          }else{this.dummy.position.x+=Math.sin(phase*.24)*9;this.dummy.rotation.set(0,0,Math.sin(phase)*.025);}
        }
        if(actor.kind==='sheep') {
          if(actor.sheepDistance!==undefined){
            const pose=trackSheepPose(section,actor.sheepDistance,mirror?opponentDistance??distance:distance,actor.phase,time,!!this.reducedMotion?.matches);
            this.dummy.position.set(pose.position.x-anchor,pose.position.y,(pose.position.z+laneOffset)*(mirror?-1:1));
            this.dummy.rotation.set(0,pose.yaw,0);
          }else if(!this.reducedMotion?.matches){
            const passing=(leadX-section.origin.x-actor.x+8)/16;
            this.dummy.position.y+=passing>0&&passing<1?Math.sin(passing*Math.PI)*.7:0;
          }
        }
        let actorSize=actor.size;
        if(actor.portalIndex!==undefined){
          const p=portalPumpkin(section,actor.portalIndex,portalAge,mirror?opponentGravity:gravity);
          this.dummy.position.set(p.position.x-anchor,p.position.y,(p.position.z+laneOffset)*(mirror?-1:1));
          this.dummy.rotation.set(p.spin*.6,p.spin,p.spin*.35);actorSize=p.size;
        }else if(['sheep','pumpkin','ghost'].includes(actor.kind)){
          actor.flights??=[new SceneryFlight(actor.phase),new SceneryFlight(actor.phase)];
          const flight=actor.flights[mirror?1:0];flight.update(flightDt,mirror?opponentGravity:gravity);
          this.dummy.position.y+=flight.height;
          const airborne=Math.min(1,flight.height/2);
          this.dummy.rotation.z+=Math.sin(flight.angle+actor.phase)*airborne*.45;
          this.dummy.rotation.y+=Math.sin(flight.angle*.6+actor.phase)*airborne*.4;
        }
        this.dummy.scale.setScalar(actorSize*(actor.kind==='firefly'?.5+.5*Math.sin(phase*.7)**2:1));if(actor.kind==='bat')this.dummy.scale.y*=.35+.65*Math.abs(Math.sin(time*5+actor.phase));
        if(mirror){this.dummy.quaternion.x*=-1;this.dummy.quaternion.y*=-1;}
        this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);
        if(actor.kind==='pumpkin')this.pumpkinFaces.setMatrixAt(index,this.dummy.matrix);
      }
    }
    this.pumpkinFaces.count=Math.min(192,counts.pumpkin);this.pumpkinFaces.instanceMatrix.needsUpdate=true;
    this.portalEffects.finish();
    for(const kind of Object.keys(this.actorMeshes) as Actor["kind"][]) {
      const mesh=this.actorMeshes[kind];mesh.count=Math.min(192,counts[kind]);mesh.instanceMatrix.needsUpdate=true;
    }
  }
  private revealTunnel(group:T.Group,reveal:number,side:number) {
    group.traverse(o=>{
      if(!(o instanceof T.Mesh)||!o.userData.mountainCover)return;
      const material=o.material as T.Material;
      const opacity=o.userData.mountainCover===side?1-reveal*.9:1;
      const transparent=opacity<.999;
      if(material.transparent!==transparent){material.transparent=transparent;material.depthWrite=!transparent;material.needsUpdate=true;}
      material.opacity=opacity;o.castShadow=!transparent;
    });
  }
  private release(tile: Tile) {
    tile.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});
    tile.root.removeFromParent();
    tile.gorgeWall?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});tile.gorgeWall?.removeFromParent();
    tile.formation?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});tile.formation?.removeFromParent();tile.mirrorFormation?.removeFromParent();
    const owned=new Set<T.Material>();
    for(const tunnel of [tile.tunnel,tile.mirrorTunnel])tunnel?.traverse(o=>{if(o instanceof T.Mesh && o.userData.mountainCover)owned.add(o.material as T.Material)});
    owned.forEach(material=>material.dispose());
    tile.tunnel?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose()});tile.tunnel?.removeFromParent();tile.mirrorTunnel?.removeFromParent();
  }
  destroy() {
    this.portalEffects.destroy();
    this.tiles.forEach(tile=>this.release(tile));this.tiles.clear();
    for(const mesh of [this.sheep,this.pumpkins,this.pumpkinFaces,this.mills,this.cables,this.wheels,this.fireflies,this.ghosts,this.bats,this.ducks,this.spray,this.carousels,this.gondolas,this.beams]) {mesh.geometry.dispose();mesh.dispose()}
    this.material.dispose();this.luminous.dispose();this.beamMaterial.dispose();this.group.removeFromParent();
  }
}
