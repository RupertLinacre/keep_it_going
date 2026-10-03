import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createCarnivalVariant } from '../src/review/variants/carnival-variants';
import { MiniSection } from '../src/games/mini-track';
import { FairgroundLights } from '../src/games/world-lighting';
import { CarouselMotion } from '../src/games/carousel-motion';
import { carouselCenter, carouselRideRadius } from '../src/games/world-night';

const kinds=['lanternrun','midwayloop','carouselhelix']as const,options=['b','c']as const;
const section=(kind:typeof kinds[number],hand=1,width=62)=>new MiniSection(1,kind,100,new Vector3(80,4,2),kind==='midwayloop'?12:width,kind==='midwayloop'?14:kind==='lanternrun'?7:24,kind==='midwayloop'?hand*2.2:0,hand,2);

test('all six carnival alternatives have fixed small render budgets, finite instances and owned geometry',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const kind of kinds)for(const option of options) {
    const s=section(kind),animation=createCarnivalVariant(s,option,material,lights)!;
    let draws=0,triangles=0,disposed=0;const geometries=new Set();
    animation.group.traverse(o=>{
      if(!(o instanceof Mesh))return;draws++;
      triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o instanceof InstancedMesh?o.count:1);
      assert.ok(o.material===material||o.material===lights);assert.equal(o.castShadow,false);
      geometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>disposed++);
    });
    assert.ok(draws<=7,`${kind} ${option}: ${draws} draws`);assert.ok(triangles<=40000,`${kind} ${option}: ${triangles} triangles`);
    for(let frame=0;frame<=240;frame++) {
      animation.update(frame/30,s.start-12+frame*.8,false);
      animation.group.traverse(o=>{if(o instanceof InstancedMesh)assert.ok([...o.instanceMatrix.array].every(Number.isFinite),`${kind} ${option} has finite instance transforms before and after its trigger`)});
    }
    let after=0;animation.group.traverse(o=>{if(o instanceof Mesh)after++});assert.equal(after,draws);
    animation.dispose();assert.equal(disposed,geometries.size);assert.equal(animation.group.children.length,0);
  }
  material.dispose();lights.dispose();
});

test('both new carousel architectures inherit exact train motion, continue coasting, and reset for replay',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  for(const option of options)for(const hand of [-1,1]) {
    const s=section('carouselhelix',hand),animation=createCarnivalVariant(s,option,material,lights)!,rotor=animation.group.getObjectByName('carousel-rotor')!;
    const expected=new CarouselMotion(s);expected.update(0,s.start-12);
    for(let frame=1;frame<=300;frame++) {
      const time=frame/30,distance=s.start-12+time*24;
      animation.update(time,distance,false);assert.equal(rotor.rotation.y,expected.update(time,distance));
    }
    const before=rotor.rotation.y;animation.update(10.2,s.end+100,false);assert.notEqual(rotor.rotation.y,before);
    animation.update(0,s.start-12,false);assert.equal(rotor.rotation.y,expected.update(0,s.start-12));
    animation.update(.5,s.start+12,true);assert.equal(rotor.rotation.y,0);
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('teacups, planetary rings and saucers fit inside the verified spiral clearance at every generated size',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),point=new Vector3(),instance=new Matrix4();
  for(const option of options)for(const width of [57,62,65])for(const hand of [-1,1]) {
    const s=section('carouselhelix',hand,width),c=carouselCenter(s),radius=carouselRideRadius(s),animation=createCarnivalVariant(s,option,material,lights)!;
    for(const time of [0,1.8,3.7,7,10]) {
      animation.update(time,s.start-12+time*24,false);animation.group.updateMatrixWorld(true);
      let farthest=0;
      animation.group.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const p=object.geometry.getAttribute('position'),count=object instanceof InstancedMesh?object.count:1;
        for(let j=0;j<count;j++) {
          if(object instanceof InstancedMesh)object.getMatrixAt(j,instance);else instance.identity();
          for(let k=0;k<p.count;k++) {
            point.fromBufferAttribute(p,k).applyMatrix4(instance).applyMatrix4(object.matrixWorld);
            farthest=Math.max(farthest,Math.hypot(point.x-c.x,point.z-c.z));
          }
        }
      });
      assert.ok(farthest<=radius+.08,`${option}, ${width}, ${hand}: spinning extent ${farthest} exceeds ${radius}`);
    }
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('all alternatives cache their placements against height lifts and hold still under reduced motion',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights();
  const snapshot=(animation:NonNullable<ReturnType<typeof createCarnivalVariant>>)=>{
    const result:number[]=[];animation.group.updateMatrixWorld(true);
    animation.group.traverse(o=>{result.push(...o.matrixWorld.elements);if(o instanceof InstancedMesh)result.push(...o.instanceMatrix.array)});return result;
  };
  for(const kind of kinds)for(const option of options) {
    const s=section(kind),animation=createCarnivalVariant(s,option,material,lights)!;
    animation.update(2,s.start+s.length*.4,true);const before=snapshot(animation);
    for(const frame of s.frames)frame.position.y+=15;
    animation.update(8,s.start+s.length*.4,true);assert.deepEqual(snapshot(animation),before,`${kind} ${option} stays still and never double-applies track lift`);
    animation.dispose();
  }
  material.dispose();lights.dispose();
});

test('launchpads, jellyfish, arcade props and the enlarged fairy stay outside the rail corridor',()=>{
  const material=new MeshStandardMaterial({vertexColors:true}),lights=new FairgroundLights(),p=new Vector3(),matrix=new Matrix4();
  for(const kind of ['lanternrun','midwayloop']as const)for(const option of options)for(const hand of [-1,1]) {
    const s=section(kind,hand),animation=createCarnivalVariant(s,option,material,lights)!;
    const rail=s.frames.filter((_,i)=>i%4===0).map(f=>[f.position.x-s.origin.x,f.position.y,f.position.z-s.origin.z]);
    for(const time of [0,2.5,5]) {
      animation.update(time,s.start-12+time*24,false);animation.group.updateMatrixWorld(true);
      let nearest=Infinity;
      animation.group.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const positions=object.geometry.getAttribute('position'),count=object instanceof InstancedMesh?object.count:1;
        for(let i=0;i<count;i++) {
          if(object instanceof InstancedMesh)object.getMatrixAt(i,matrix);else matrix.identity();
          for(let j=0;j<positions.count;j+=3) {
            p.fromBufferAttribute(positions,j).applyMatrix4(matrix).applyMatrix4(object.matrixWorld);
            for(const [x,y,z]of rail)nearest=Math.min(nearest,(p.x-x)**2+(p.y-y)**2+(p.z-z)**2);
          }
        }
      });
      assert.ok(nearest>1.5**2,`${kind} ${option}, hand ${hand}, ${time}s: prop entered rail corridor at ${Math.sqrt(nearest)}m`);
    }
    animation.dispose();
  }
  material.dispose();lights.dispose();
});
