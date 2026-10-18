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

test('1000 seeds yield pastel, hue-only palettes and small crisp circles', () => {
  const modes = { linear: 0, mixed: 0 };
  for (let i = 0; i < 1000; i++) {
    const recipe = generateRecipe(`object-${i}`);
    const { colour, preset, texture } = recipe;
    assert.equal(recipe.version, 11);
    assert.equal(colour.relationship, 'analogous');
    assert.equal(colour.stops.length, 2);
    assert.equal(preset.type, 'gradient');
    modes[preset.kind]++;
    if (preset.kind === 'linear') assert.ok(preset.angleDegrees >= 0 && preset.angleDegrees < 360);
    else assert.equal(preset.angleDegrees, undefined);
    const [start, end] = colour.stops;
    assert.deepEqual([start.position, end.position], [0, 1]);
    // Only the hue varies within an image.
    assert.equal(start.s, end.s);
    assert.equal(start.b, end.b);
    assert.ok(start.s >= 35 && start.s < 50);
    assert.ok(start.b >= 65 && start.b < 80);
    for (const stop of colour.stops) assert.ok(stop.h >= 0 && stop.h < 360);
    const delta = Math.abs(start.h - end.h);
    const distance = Math.min(delta, 360 - delta);
    assert.ok(distance >= 40 - 1e-10 && distance <= 90 + 1e-10);
    assert.equal(recipe.variation.noise, null);
    assert.equal(texture.type, 'circles');
    assert.ok(texture.count >= 800 && texture.count <= 1200);
    assert.deepEqual([texture.minRadius, texture.maxRadius], [0.02, 0.06]);
    assert.deepEqual(recipe.elements, []);
  }
  assert.ok(modes.mixed > 400 && modes.mixed < 600);
  assert.equal(modes.linear + modes.mixed, 1000);
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


test('mode weights divide the random interval equally', () => {
  for (const [value, expected] of [[0, 'linear'], [0.49999, 'linear'], [0.5, 'mixed'], [0.99999, 'mixed']]) {
    const { seed, streams } = createRandomStreams('mode-boundaries');
    streams.preset = () => value;
    assert.equal(chooseRecipe(seed, streams).preset.kind, expected);
  }
});

