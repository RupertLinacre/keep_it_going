import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { MiniSection } from '../src/games/mini-track';
import { WorldModel } from '../src/games/world-models';
import { FairgroundLights } from '../src/games/world-lighting';
import { createMeadowPieceAnimation, meadowArrival } from '../src/games/meadow-piece-animation';
import { sheepBanks,lilyBridge,meadowWindmill,meadowSailsModel } from '../src/games/world-meadow';

const material=new T.MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
const pieces=[['sheepbank',74,8,sheepBanks],['pondbridge',66,4,lilyBridge],['windmillloop',8,10,meadowWindmill]] as const;
function matrices(group:T.Group) {return group.children.flatMap(child=>Array.from((child as T.InstancedMesh).instanceMatrix.array));}

test('meadow interactions stay in fixed batches and do not drift during pause or replay',()=>{
  for(const [kind,width,height]of pieces.filter(([kind])=>kind!=="sheepbank"))for(const hand of [-1,1]) {
    const section=new MiniSection(4,kind,90,new T.Vector3(40,4,-7),width,height,kind==='windmillloop'?hand*2.2:0,hand);
    const animation=createMeadowPieceAnimation(section,material,lights)!;
    // Paddles and packing presses each need one independently moving batch.
    assert.ok(animation.group.children.length<=(kind==='sheepbank'?3:4),'Meadow animation stays within its per-piece fixed draw budget');
    const counts=animation.group.children.map(c=>(c as T.InstancedMesh).count),mid=section.start+section.length/2;
    animation.update(5,mid,false);const initial=matrices(animation.group);
    animation.update(5,mid,false);assert.deepEqual(matrices(animation.group),initial,'Paused inputs freeze every instance');
    animation.update(50,section.end+50,false);animation.update(5,mid,false);
    assert.deepEqual(matrices(animation.group),initial,'Scrubbing backward exactly restores the previous pose');
    for(const child of animation.group.children) {
      const mesh=child as T.InstancedMesh;assert.ok(mesh.geometry.getAttribute('position').count<15000);
      assert.equal(mesh.castShadow,false,'Decorative details do not multiply shadow passes');
    }
    assert.deepEqual(animation.group.children.map(c=>(c as T.InstancedMesh).count),counts);
    assert.ok(initial.every(Number.isFinite));
    animation.update(0,mid,true);const reduced=matrices(animation.group);
    animation.update(999,mid,true);assert.deepEqual(matrices(animation.group),reduced,'Reduced motion has no time-based movement');
    for(const frame of section.frames)frame.position.y+=100;
    animation.update(0,mid,true);assert.deepEqual(matrices(animation.group),reduced,'HeightTrack mutations are applied only by the parent');
    animation.dispose();assert.equal(animation.group.children.length,0);
  }
});

test('meadow static detail is baked and leaves the original windmill sail envelope intact',()=>{
  for(const [kind,width,height,build]of pieces) {
    const section=new MiniSection(0,kind,0,new T.Vector3(0,4,0),width,height,0,1),model=new WorldModel();build(model,section);
    const group=model.finish(material,lights,false);assert.equal(group.children.length,1,'All static detail shares a single scenery draw');
    const geometry=(group.children[0] as T.Mesh).geometry,p=geometry.getAttribute('position');
    assert.ok(p.count<110000,`${kind}: bounded static vertex budget (${p.count})`);
    for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
    if(kind==='pondbridge') {
      const color=geometry.getAttribute('color'),rims=['#adc783','#d0dfab'].map(c=>new T.Color(c));let rimVertices=0;
      for(let i=0;i<p.count;i++)if(rims.some(c=>Math.abs(color.getX(i)-c.r)<1e-5&&Math.abs(color.getY(i)-c.g)<1e-5&&Math.abs(color.getZ(i)-c.b)<1e-5)) {
        assert.ok(p.getY(i)<.1,'Raised shoreline must never emerge through the blue water');rimVertices++;
      }
      assert.ok(rimVertices>100);
    }
    geometry.dispose();
  }
  const sails=meadowSailsModel().finish(material,lights,false),g=(sails.children[0] as T.Mesh).geometry,p=g.getAttribute('position');
  for(let i=0;i<p.count;i++) {
    assert.ok(Math.hypot(p.getX(i),p.getY(i))<3.01,'No blade tip protrudes beyond the existing safe radius');
    assert.ok(p.getZ(i)>=-.051&&p.getZ(i)<=.131,'Sails keep their original swept depth');
  }
  g.dispose();
});

test('arrival responses are bounded and local to the passing train',()=>{
  assert.equal(meadowArrival(10,10),1);assert.equal(meadowArrival(-100,10),0);assert.equal(meadowArrival(100,10),0);
  assert.equal(meadowArrival(1,10),meadowArrival(19,10));
  for(let d=-100;d<100;d+=.3)assert.ok(meadowArrival(d,0)>=0&&meadowArrival(d,0)<=1);
  const other=new MiniSection(0,'hill',0,new T.Vector3(0,4,0),60,8,0,1);
  assert.equal(createMeadowPieceAnimation(other,material,lights),undefined);
});
