import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { generateImage, generateRecipe } from '../pipeline.js';
import { renderRecipe } from '../src/renderer.js';
import { hsbToRGB, interpolateHSB, samplePalette } from '../src/math/colour.js';

// The first object-N recipe that uses the given preset.
function recipeOfType(type) {
  for (let i = 0; ; i++) {
    const recipe = generateRecipe(`object-${i}`);
    if (recipe.preset.type === type) return recipe;
  }
}

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

test('both presets export opaque, repeatable, nonconstant PNG images', async () => {
  for (const recipe of [recipeOfType('gradient'), recipeOfType('soft-forms')]) {
    const options = { width: 96, height: 64 };
    const a = await renderRecipe(recipe, options);
    const b = await renderRecipe(recipe, options);
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
  const recipe = recipeOfType('gradient');
  recipe.preset = { type: 'gradient', kind: 'linear', angleDegrees: 0 };
  recipe.texture = { type: 'circles', count: 600, minRadius: 0.04, maxRadius: 0.1 };
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
  const recipe = recipeOfType('gradient');
  recipe.texture.count = Infinity;
  await assert.rejects(renderRecipe(recipe), RangeError);
  recipe.preset.kind = 'unknown';
  await assert.rejects(renderRecipe(recipe), RangeError);
});

test('the removed soft-mark texture is rejected', async () => {
  const recipe = recipeOfType('gradient');
  recipe.texture.type = 'soft-marks';
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

test('circles are opaque with crisp edges', async () => {
  const { drawGradient } = await import('../src/presets/gradient.js');
  const recipe = recipeOfType('gradient');
  recipe.preset = { type: 'gradient', kind: 'mixed' };
  recipe.colour.stops = [{ position: 0, h: 0, s: 0, b: 0 }, { position: 1, h: 0, s: 0, b: 100 }];
  recipe.texture = { type: 'circles', count: 1, minRadius: 0.2, maxRadius: 0.3 };
  const canvas = createCanvas(128, 128);
  const context = canvas.getContext('2d');
  // x, y, radius at the middle of their ranges (centre 64,64; radius 32), then a near-white colour.
  const values = [0.5, 0.5, 0.5, 0.999];
  drawGradient(context, recipe, 128, 128, () => values.shift());
  const { data } = context.getImageData(0, 0, 128, 128);
  const red = x => data[(64 * 128 + x) * 4];
  for (let x = 64; x < 95; x++) assert.ok(red(x) > 250); // uniform interior
  assert.equal(red(97), 128); // grey background immediately outside the edge at x = 96
  assert.equal(data[(64 * 128 + 64) * 4 + 3], 255);
});

// A soft-forms recipe with a flat black base, no grain, and one white form.
function oneArc(form) {
  const recipe = recipeOfType('soft-forms');
  recipe.preset.angleDegrees = 0;
  recipe.colour.stops = [{ position: 0, h: 0, s: 0, b: 0 }, { position: 1, h: 0, s: 0, b: 0 }];
  recipe.variation.grain = 0;
  recipe.texture.forms = [{
    directionDegrees: 0, radius: 2, edge: 0, colour: { h: 0, s: 0, b: 100 }, opacity: 1,
    softBlur: 0, crispBlur: 0, crispFadeSide: 1, crispFadeEnd: 0.5, ...form,
  }];
  return recipe;
}

test('soft-form edges follow an evenly rounded arc', async () => {
  // Circle of radius 256 centred at (320, 64): its edge touches the centre (64, 64)
  // and curves away to x ≈ 67.1 at 40 px above or below.
  const { data } = await pixels(await renderRecipe(oneArc({}), { width: 128, height: 128 }));
  const red = (x, y) => data[(y * 128 + x) * 4];
  assert.ok(red(62, 64) < 10 && red(66, 64) > 245);
  for (const y of [24, 104]) assert.ok(red(65, y) < 10 && red(69, y) > 245);
});

test('soft-form blur is relative to the image size', async () => {
  const blurred = oneArc({ softBlur: 0.08, crispBlur: 0.08 });
  const row = async size => {
    const { data } = await pixels(await renderRecipe(blurred, { width: size, height: size }));
    return x => data[((size / 2) * size + x) * 4];
  };
  const large = await row(128);
  // A gradual ramp across the edge instead of a jump.
  for (let x = 44; x < 84; x++) assert.ok(Math.abs(large(x + 1) - large(x)) < 25);
  assert.ok(large(54) > 10 && large(74) < 245);
  // Half the size shows the same profile at half the coordinates.
  const small = await row(64);
  for (const x of [27, 32, 37]) assert.ok(Math.abs(small(x) - large(2 * x)) < 20);
});

test('grain is seeded, equal across channels, and bounded', async () => {
  const recipe = oneArc({ opacity: 0 });
  recipe.colour.stops = [{ position: 0, h: 0, s: 0, b: 50 }, { position: 1, h: 0, s: 0, b: 50 }];
  recipe.variation.grain = 14;
  const a = await renderRecipe(recipe, { width: 64, height: 64 });
  assert.deepEqual(await renderRecipe(recipe, { width: 64, height: 64 }), a);
  const { data } = await pixels(a);
  const values = new Set();
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(data[i] === data[i + 1] && data[i] === data[i + 2]);
    assert.ok(Math.abs(data[i] - 128) <= 8);
    values.add(data[i]);
  }
  assert.ok(values.size > 8);
});

test('invalid soft-form parameters are rejected', async () => {
  for (const change of [{ softBlur: Infinity }, { opacity: 2 }, { crispFadeSide: 0 }, { radius: undefined }, { colour: 0.5 }]) {
    await assert.rejects(renderRecipe(oneArc(change)), RangeError);
  }
  const noisy = oneArc({});
  noisy.variation.grain = 100;
  await assert.rejects(renderRecipe(noisy), RangeError);
  const empty = oneArc({});
  empty.texture.forms = [];
  await assert.rejects(renderRecipe(empty), RangeError);
  const old = oneArc({});
  old.texture.type = 'blurred-forms';
  await assert.rejects(renderRecipe(old), RangeError);
});
