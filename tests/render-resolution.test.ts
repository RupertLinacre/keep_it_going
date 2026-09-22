import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SCENE_PIXELS, scenePixelRatio } from '../src/games/render-resolution';

test('large and scaled 4K windows fit the GPU pixel budget', () => {
  for (const [width, height, dpr] of [[3790, 1937, 1], [2958, 1496, 2], [2510, 1245, 2], [7680, 4320, 2]]) {
    const ratio = scenePixelRatio(width, height, dpr);
    assert.ok(Math.floor(width * ratio) * Math.floor(height * ratio) <= MAX_SCENE_PIXELS);
    assert.ok(ratio <= dpr && ratio <= 1.7 && ratio > 0);
  }
});

test('ordinary desktop and phone rendering keeps its previous density', () => {
  assert.equal(scenePixelRatio(1440, 900, 1), 1);
  assert.equal(scenePixelRatio(1440, 900, 2), 1.7);
  assert.equal(scenePixelRatio(390, 500, 3), 1.7);
  assert.equal(scenePixelRatio(0, 0, 2), 1.7);
});
