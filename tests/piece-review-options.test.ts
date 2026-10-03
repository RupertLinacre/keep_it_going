import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { PIECE_REVIEW, REVIEW_ITEMS, designFor } from '../src/review/piece-review-data';
import { DESIGN_OPTIONS } from '../src/review/variants/variant-kit';
import { createVariant } from '../src/review/variants';
import { createMiniSection } from '../src/games/mini-track';
import { seededRandom } from '../src/games/mini-rail';
import { FairgroundLights } from '../src/games/world-lighting';
import { SmokeReviewScene, smokeReviewVariant } from '../src/review/smoke-review-view';

test('all twelve pieces expose five named choices with distinct new designs',()=>{
 assert.equal(PIECE_REVIEW.length,12);assert.deepEqual([...DESIGN_OPTIONS],['a','b','c','d','e']);
 const names=new Set<string>();
 for(const piece of PIECE_REVIEW)for(const option of DESIGN_OPTIONS){const design=designFor(piece.kind,option);assert.ok(design.name&&design.idea);assert.ok(!names.has(design.name));names.add(design.name);}
 assert.equal(names.size,60);
});

test('smoke is the thirteenth review entry without becoming a ride kind',()=>{
 assert.equal(REVIEW_ITEMS.length,13);
 assert.deepEqual(REVIEW_ITEMS.slice(0,12),PIECE_REVIEW);
 assert.equal(REVIEW_ITEMS[12].kind,'smoke');
 assert.equal(new Set(DESIGN_OPTIONS.map(option=>designFor('smoke',option).name)).size,5);
 for(const time of [0,1.99,2,12,21.99,22,25])assert.equal(smokeReviewVariant(time,'original'),'normal');
 for(const option of DESIGN_OPTIONS){
  assert.equal(smokeReviewVariant(1.99,option),'normal');assert.equal(smokeReviewVariant(2,option),option);
  assert.equal(smokeReviewVariant(21.99,option),option);assert.equal(smokeReviewVariant(22,option),'normal');
 }
});

test('smoke preview moves its train, resets on replay, and releases its scene',()=>{
 const preview=new SmokeReviewScene('c'),start=preview.reviewState().position;
 for(let t=0;t<5;t+=1/30)preview.update(t,0,false);
 const during=preview.reviewState();assert.equal(during.variant,'c');assert.ok(during.activeCount>0);assert.notDeepEqual(during.position,start);
 preview.update(0,0,false);assert.equal(preview.reviewState().activeCount,0);assert.deepEqual(preview.reviewState().position,start);
 preview.destroy();assert.equal(preview.scene.children.length,0);
});

test('the workshop registry constructs both new designs for every piece',()=>{
 const material=new T.MeshStandardMaterial(),lights=new FairgroundLights();
 for(const piece of PIECE_REVIEW)for(const option of ['d','e'] as const){
  const section=createMiniSection(piece.kind,100,new T.Vector3(30,4,-8),0,seededRandom(71)),ride=createVariant(section,option,material,lights);
  assert.ok(ride,`${piece.kind} ${option} is registered`);assert.ok(ride.group.children.length>0,`${piece.kind} ${option} is built`);ride.update(0,section.start-12,false);ride.dispose();
 }
 material.dispose();lights.dispose();
});
