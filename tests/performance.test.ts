import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { MiniTrack, createMiniSection } from "../src/games/mini-track.ts";
import { MiniCarriages } from "../src/games/mini-carriages.ts";
import { MiniPhysics } from "../src/games/mini-physics.ts";
import { MINI_MAX_CARTS } from "../src/games/mini-config.ts";
import { seededRandom } from "../src/games/mini-rail.ts";
import { railGeometries } from "../src/games/mini-mesh.ts";

test("train growth stops at ten and resumes after losing a coach", () => {
  const track=new MiniTrack(42), c=new MiniCarriages(track);
  for(let i=0;i<120*120;i++) c.update(1/120,track.startDistance,20);
  assert.equal(c.coaches.length,MINI_MAX_CARTS);
  assert.equal(c.incoming,undefined);
  c.coaches.pop();
  for(let i=0;i<120*30;i++) {
    c.update(1/120,track.startDistance,20);
    assert.ok(c.coaches.length+(c.incoming?1:0)<=MINI_MAX_CARTS);
  }
  assert.equal(c.coaches.length,MINI_MAX_CARTS);
  assert.equal(c.incoming,undefined);
});

test("display motion stays smooth at refresh rates which do not divide the physics rate", () => {
  const rail={slope:()=>0,height:()=>0,sample:()=>{throw new Error("unused");}};
  for(const fps of [60,90,120,144,165]) {
    const p=new MiniPhysics(rail,{initialDistance:0,initialSpeed:30,drag:0,rolling:0});
    let previous=0;
    for(let frame=0;frame<fps*2;frame++) {
      p.update(1/fps);
      const distance=p.renderDistance;
      if(frame>2) assert.ok(Math.abs(distance-previous-30/fps)<1e-7, `${fps} Hz must not repeat/jump between fixed physics steps`);
      assert.ok(distance<=p.distance+1e-8);
      previous=distance;
    }
    assert.ok(Math.abs(p.distance-60)<1e-7,"Presentation does not change the physics");
  }
});

test("fast rail meshes retain circular cross-sections and upright/inverted frame alignment", () => {
  for(const kind of ["loop","pretzelknot","ascendinghelix","jump"] as const) {
    const s=createMiniSection(kind,0,new Vector3(100,4,-2),20,seededRandom(71));
    const from=s.start, to=kind==="jump"?s.takeoff:s.end;
    const meshes=railGeometries(s,from,to);
    for(const [rail,g] of meshes.entries()) {
      const points=g.getAttribute("position"), normals=g.getAttribute("normal");
      const rings=points.count/7;
      for(let ring=0;ring<rings;ring+=Math.max(1,Math.floor(rings/20))) {
        const f=s.sample(from+(to-from)*ring/(rings-1));
        const center=f.position.clone().sub(s.origin).addScaledVector(f.right, rail ? .57 : -.57);
        for(let j=0;j<7;j++) {
          const at=ring*7+j;
          assert.ok(Math.abs(new Vector3().fromBufferAttribute(points,at).distanceTo(center)-.095)<1e-4);
          assert.ok(Math.abs(new Vector3().fromBufferAttribute(normals,at).length()-1)<1e-5);
        }
      }
      assert.ok(g.boundingSphere && Number.isFinite(g.boundingSphere.radius));
      g.dispose();
    }
  }
});
