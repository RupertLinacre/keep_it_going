import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ChristmasLights } from '../src/games/attractions/christmas-lights';
import { ChristmasBuilder } from '../src/games/attractions/christmas-builder';
import { FairgroundLights } from '../src/games/world-lighting';
import type { MiniSection } from '../src/games/mini-track';

test('Christmas lights register swept crossings, retain afterglow and reset for replay',()=>{
  const material=new T.MeshStandardMaterial(),lamps=new FairgroundLights(),builder=new ChristmasBuilder(material,lamps);
  const section={start:400} as MiniSection;
  const effect=new ChristmasLights(builder,section,[
    {position:new T.Vector3(2,4,6),stop:410,color:'#ffd17d'},
    {position:new T.Vector3(8,6,2),stop:430,color:'#82e8d7'},
  ],'test');
  try{
    const fired=effect.core.geometry.getAttribute('lampFired'),positions=effect.core.geometry.getAttribute('lampPosition');
    const before=positions.array.slice();
    effect.update(0,405,false,400);
    assert.deepEqual(Array.from(fired.array),[-1,-1]);
    effect.update(1,435,false,400);
    assert.deepEqual(Array.from(fired.array),[1,1],'fast passage still lights both bulbs');
    assert.equal(effect.uniforms.trainDistance.value,35);
    const version=fired.version;
    effect.update(1,435,false,400);
    assert.equal(fired.version,version,'paused draws cannot retrigger or upload bulbs');
    effect.update(2,440,true,400);
    assert.deepEqual(Array.from(fired.array),[1,1],'afterglow retains the actual crossing time');
    assert.equal(effect.uniforms.motion.value,0);
    assert.deepEqual(positions.array,before,'animation changes uniforms, not static geometry');
    effect.update(0,405,false,400);
    assert.deepEqual(Array.from(fired.array),[-1,-1]);
    assert.equal((effect.core.geometry as T.InstancedBufferGeometry).instanceCount,2);
    assert.equal(effect.halos.geometry.getAttribute('lampFired'),fired,'two draws share one trigger buffer');
    assert.equal(builder.group.children.length,2);
    let geometries=0,materials=0;
    for(const mesh of [effect.core,effect.halos]){
      assert.ok(!mesh.castShadow);
      mesh.geometry.addEventListener('dispose',()=>geometries++);
      (mesh.material as T.Material).addEventListener('dispose',()=>materials++);
    }
    builder.dispose();assert.equal(geometries,2);assert.equal(materials,2);
  }finally{material.dispose();lamps.dispose();}
});
