import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecipe } from '../pipeline.js';
import { hashInput, createRandomStreams } from '../src/input-randomness.js';
import { chooseRecipe } from '../src/recipe.js';
import { uniform, integer, weightedChoice, chance } from '../src/math/distributions.js';

test('SHA-256 known vector, exact input handling, and invalid inputs', () => {
  assert.equal(hashInput('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const inputs = ['', 'Alice', 'alice', 'Alice ', 'é', 'e\u0301', '🌊'];
  assert.equal(new Set(inputs.map(hashInput)).size, inputs.length);
  for (const input of [1, null, undefined, {}, '\ud800']) {
    assert.throws(() => generateRecipe(input), TypeError);
  }
});

test('repeatability survives unrelated calls and caller mutation', () => {
  const expected = generateRecipe('object-123');
  const modified = generateRecipe('object-123');
  modified.colour.stops[0].h = -100;
  generateRecipe('other');
  assert.deepEqual(generateRecipe('object-123'), expected);
  assert.notDeepEqual(generateRecipe('object-124'), expected);
});

test('consuming texture changes only texture choices, not colour or composition', () => {
  const { seed, streams } = createRandomStreams('independence');
  for (let i = 0; i < 1000; i++) { streams.texture(); streams.elements(); }
  const changed = chooseRecipe(seed, streams);
  const original = generateRecipe('independence');
  assert.deepEqual(changed.colour, original.colour);
  assert.deepEqual(changed.preset, original.preset);
  assert.deepEqual(changed.elements, original.elements);
  const a = createRandomStreams('independence').streams;
  const b = createRandomStreams('independence').streams;
  a.colour();
  assert.equal(a.preset(), b.preset());
  assert.notEqual(a.texture(), a.elements());
});

const TONES = {
  deep: { s: [70, 90], b: [68, 82] },
  vivid: { s: [55, 85], b: [90, 100] },
  light: { s: [8, 20], b: [97, 100] },
};
const isTone = (colour, name) => {
  const { s, b } = TONES[name];
  return colour.s >= s[0] && colour.s < s[1] && colour.b >= b[0] && colour.b < b[1];
};
const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test('1000 seeds yield bounded palettes and parameters for both presets', () => {
  const types = { gradient: 0, 'soft-forms': 0 };
  const modes = { linear: 0, mixed: 0 };
  for (let i = 0; i < 1000; i++) {
    const recipe = generateRecipe(`object-${i}`);
    const { colour, preset, texture } = recipe;
    assert.equal(recipe.version, 15);
    assert.equal(colour.stops.length, colour.count);
    for (const stop of colour.stops) assert.ok(stop.h >= 0 && stop.h < 360);
    const start = colour.stops[0], end = colour.stops.at(-1);
    assert.deepEqual([start.position, end.position], [0, 1]);
    const delta = Math.abs(start.h - end.h);
    const distance = Math.min(delta, 360 - delta);
    if (preset.type === 'gradient') {
      // Pastel and hue-only: saturation and brightness are shared by both stops.
      assert.equal(colour.relationship, 'analogous');
      assert.equal(colour.count, 2);
      assert.equal(start.s, end.s);
      assert.equal(start.b, end.b);
      assert.ok(start.s >= 35 && start.s < 50);
      assert.ok(start.b >= 65 && start.b < 80);
      assert.ok(distance >= 40 - 1e-10 && distance <= 90 + 1e-10);
    } else {
      // Three neighbouring hues; the base gradient uses vivid tones of the first two.
      assert.equal(colour.relationship, 'analogous');
      assert.equal(colour.count, 2);
      assert.ok(isTone(start, 'vivid') && isTone(end, 'vivid'));
      assert.deepEqual([start.h, end.h], colour.hues.slice(0, 2));
      const span = hueDistance(colour.hues[0], colour.hues[2]);
      assert.ok(span >= 50 - 1e-9 && span <= 110 + 1e-9);
      assert.ok(Math.abs(hueDistance(colour.hues[0], colour.hues[1]) - span / 2) < 1e-9);
    }
    assert.equal(recipe.variation.noise, null);
    assert.deepEqual(recipe.elements, []);
    types[preset.type]++;
    if (preset.type === 'gradient') {
      modes[preset.kind]++;
      if (preset.kind === 'linear') assert.ok(preset.angleDegrees >= 0 && preset.angleDegrees < 360);
      else assert.equal(preset.angleDegrees, undefined);
      assert.equal(texture.type, 'circles');
      assert.ok(texture.count >= 800 && texture.count <= 1200);
      assert.deepEqual([texture.minRadius, texture.maxRadius], [0.02, 0.06]);
    } else {
      assert.equal(preset.type, 'soft-forms');
      assert.ok(preset.angleDegrees >= 0 && preset.angleDegrees < 360);
      assert.equal(recipe.variation.grain, 14);
      assert.equal(texture.type, 'soft-arcs');
      assert.ok(texture.forms.length >= 2 && texture.forms.length <= 3);
      // Regions: deep third hue, translucent light middle hue, vivid third hue.
      const roles = [['deep', 2, 0.85, 1], ['light', 1, 0.51, 0.6], ['vivid', 2, 0.85, 1]];
      texture.forms.forEach((form, index) => {
        const [tone, hue, opacityMin, opacityMax] = roles[index];
        assert.ok(isTone(form.colour, tone));
        assert.equal(form.colour.h, colour.hues[hue]);
        assert.ok(form.opacity >= opacityMin - 1e-9 && form.opacity < opacityMax);
        assert.ok(form.directionDegrees >= 0 && form.directionDegrees < 360);
        assert.ok(form.radius >= 1.2 && form.radius < 3);
        assert.ok(form.edge >= -0.3 && form.edge < 0.3);
        assert.ok(form.softBlur >= 0.08 && form.softBlur < 0.15);
        assert.ok(form.crispBlur >= 0.01 && form.crispBlur < 0.03);
        assert.ok([1, -1].includes(form.crispFadeSide));
        assert.ok(form.crispFadeEnd >= 0.4 && form.crispFadeEnd < 0.8);
      });
    }
  }
  assert.ok(types.gradient > 400 && types.gradient < 600);
  assert.ok(modes.mixed > 0.4 * types.gradient && modes.mixed < 0.6 * types.gradient);
});

test('selection helpers handle boundaries and reject invalid configuration', () => {
  assert.equal(uniform(() => 0, 20, 40), 20);
  assert.equal(integer(() => 0.999999, 2, 4), 4);
  assert.equal(integer(() => 0, 2, 4), 2);
  const choices = [{ value: 'never', weight: 0 }, { value: 'a', weight: 1 }, { value: 'b', weight: 3 }];
  assert.equal(weightedChoice(() => 0, choices), 'a');
  assert.equal(weightedChoice(() => 0.25, choices), 'b');
  assert.equal(chance(() => 0, 0), false);
  assert.equal(chance(() => 0.999, 1), true);
  assert.throws(() => uniform(() => 0, 1, 1), RangeError);
  assert.throws(() => integer(() => 0, 0.2, 1), RangeError);
  assert.throws(() => weightedChoice(() => 0, []), RangeError);
  assert.throws(() => weightedChoice(() => 0, [{ weight: -1 }]), RangeError);
  assert.throws(() => chance(() => 0, 2), RangeError);
});


test('preset and mode weights divide the random interval equally', () => {
  const choose = values => {
    const { seed, streams } = createRandomStreams('weight-boundaries');
    streams.preset = () => values.shift() ?? 0.5;
    return chooseRecipe(seed, streams).preset;
  };
  for (const [value, expected] of [[0, 'gradient'], [0.49999, 'gradient'], [0.5, 'soft-forms'], [0.99999, 'soft-forms']]) {
    assert.equal(choose([value]).type, expected);
  }
  // First value selects the gradient preset; the second selects its mode.
  for (const [value, expected] of [[0, 'linear'], [0.49999, 'linear'], [0.5, 'mixed'], [0.99999, 'mixed']]) {
    assert.equal(choose([0, value]).kind, expected);
  }
});
