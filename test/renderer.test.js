import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { generateImage, generateRecipe } from '../pipeline.js';
import { renderRecipe } from '../src/renderer.js';
import { hsbToRGB, interpolateHSB, samplePalette } from '../src/math/colour.js';

async function pixels(buffer) {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data };
}

test('HSB conversion and hue wrap avoid a detour around the colour wheel', () => {
  assert.deepEqual(hsbToRGB({ h: 0, s: 100, b: 100 }), [255, 0, 0]);
  assert.deepEqual(hsbToRGB({ h: 120, s: 100, b: 100 }), [0, 255, 0]);
  assert.deepEqual(hsbToRGB({ h: 240, s: 100, b: 100 }), [0, 0, 255]);
  assert.deepEqual(hsbToRGB({ h: 70, s: 0, b: 100 }), [255, 255, 255]);
  assert.equal(interpolateHSB({ h: 350, s: 50, b: 50 }, { h: 10, s: 50, b: 50 }, 0.5).h, 0);
});

test('both modes export opaque, repeatable, nonconstant PNG images', async () => {
  for (const id of ['object-0', 'object-1']) {
    const options = { width: 96, height: 64 };
    const a = await generateImage(id, options);
    const b = await generateImage(id, options);
    assert.deepEqual(a, b);
    assert.deepEqual([...a.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const image = await pixels(a);
    assert.equal(image.width, 96);
    assert.equal(image.height, 64);
    const colours = new Set();
    for (let i = 0; i < image.data.length; i += 4) {
      assert.equal(image.data[i + 3], 255);
      colours.add(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`);
    }
    assert.ok(colours.size > 10);
  }
});

test('linear marks carry a left-to-right colour trend', async () => {
  const recipe = generateRecipe('object-1');
  recipe.preset.angleDegrees = 0;
  recipe.colour.stops = [{ position: 0, h: 0, s: 0, b: 0 }, { position: 1, h: 0, s: 0, b: 100 }];
  const { data } = await pixels(await renderRecipe(recipe, { width: 128, height: 128 }));
  const average = (from, to) => {
    let sum = 0;
    for (let y = 0; y < 128; y++) for (let x = from; x < to; x++) sum += data[(y * 128 + x) * 4];
    return sum / (128 * (to - from));
  };
  assert.ok(average(96, 128) - average(0, 32) > 70);
});

test('invalid dimensions and unsupported modes fail before unbounded work', async () => {
  for (const width of [0, -1, 2049, 2.5, NaN]) {
    await assert.rejects(generateImage('object-0', { width }), RangeError);
  }
  const recipe = generateRecipe('object-0');
  recipe.texture.count = Infinity;
  await assert.rejects(renderRecipe(recipe), RangeError);
  recipe.preset.kind = 'unknown';
  await assert.rejects(renderRecipe(recipe), RangeError);
});

test('soft marks fade smoothly to the background instead of a hard circle edge', async () => {
  const { softMarkFill } = await import('../src/presets/gradient.js');
  const canvas = createCanvas(128, 128);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = softMarkFill(context, 64, 64, 48, [0, 0, 0]);
  context.fillRect(16, 16, 96, 96);
  const { data } = context.getImageData(0, 0, 128, 128);
  const red = x => data[(64 * 128 + x) * 4];
  assert.ok(red(64) < 10);
  assert.ok(red(88) > 100 && red(88) < 160);
  assert.ok(red(110) > 245);
  assert.equal(red(113), 255);
  for (let x = 64; x < 112; x++) {
    assert.ok(red(x + 1) >= red(x));
    assert.ok(red(x + 1) - red(x) < 15);
  }
});


test('hard-edged texture is rejected', async () => {
  const recipe = generateRecipe('removed-feature');
  recipe.texture.type = 'circles';
  await assert.rejects(renderRecipe(recipe), RangeError);
});

test('multi-colour sampling includes interior colours and wraps hue', () => {
  const stops = [
    { position: 0, h: 350, s: 70, b: 40 },
    { position: 0.5, h: 10, s: 85, b: 90 },
    { position: 1, h: 30, s: 75, b: 65 },
  ];
  assert.deepEqual(samplePalette(stops, 0.5), { h: 10, s: 85, b: 90 });
  assert.equal(samplePalette(stops, 0.25).h, 0);
  assert.deepEqual(samplePalette(stops, 1), { h: 30, s: 75, b: 65 });
});
