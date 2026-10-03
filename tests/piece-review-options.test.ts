import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { PIECE_REVIEW, designFor } from '../src/review/piece-review-data';
import { DESIGN_OPTIONS } from '../src/review/variants/variant-kit';
import { createVariant } from '../src/review/variants';
import { createMiniSection } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { FairgroundLights } from '../src/games/world-lighting';

test('all twelve pieces expose five named choices with distinct new designs',()=>{
 assert.equal(PIECE_REVIEW.length,12);assert.deepEqual([...DESIGN_OPTIONS],['a','b','c','d','e']);
 const names=new Set<string>();
 for(const piece of PIECE_REVIEW)for(const option of DESIGN_OPTIONS){const design=designFor(piece.kind,option);assert.ok(design.name&&design.idea);assert.ok(!names.has(design.name));names.add(design.name);}
 assert.equal(names.size,60);
});

test('the workshop registry constructs both new designs for every piece',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 for(const piece of PIECE_REVIEW)for(const option of ['d','e'] as const){
  const section=createMiniSection(piece.kind,100,new T.Vector3(30,4,-8),0,seededRandom(71)),ride=createVariant(section,option,material,lights);
  assert.ok(ride,`${piece.kind} ${option} is registered`);assert.ok(ride.group.children.length>0,`${piece.kind} ${option} is built`);ride.update(0,section.start-12,false);ride.dispose();
 }
 material.dispose();lights.dispose();
});
