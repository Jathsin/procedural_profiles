import { uniform, weightedChoice, chance, integer } from './math/distributions.js';

// Pastel, hue-only palettes after Tyler Hobbs's "Working with Color" examples:
// saturation and brightness are fixed within an image; only the hue varies.
// Experimental ranges, not final aesthetic rules.
export const COLOUR_RULES = Object.freeze({
  saturationMin: 35, saturationMax: 50,
  brightnessMin: 65, brightnessMax: 80,
  hueSpanMin: 40, hueSpanMax: 90,
});

// Small crisp circles at the size of the references; more of them keep the image covered.
// Radii are fractions of the smaller image dimension.
export const TEXTURE_RULES = Object.freeze({
  countMin: 800, countMax: 1200,
  minRadius: 0.02, maxRadius: 0.06,
});

export function chooseRecipe(seed, streams) {
  const c = streams.colour;
  const r = COLOUR_RULES;
  const mode = weightedChoice(streams.preset, [
    { value: 'linear', weight: 1 },
    { value: 'mixed', weight: 1 },
  ]);
  const mixed = mode === 'mixed';
  const hue = uniform(c, 0, 360);
  const span = uniform(c, r.hueSpanMin, r.hueSpanMax) * (chance(c, 0.5) ? 1 : -1);
  const s = uniform(c, r.saturationMin, r.saturationMax);
  const b = uniform(c, r.brightnessMin, r.brightnessMax);
  const stops = [
    { position: 0, h: hue, s, b },
    { position: 1, h: (hue + span + 360) % 360, s, b },
  ];
  const t = TEXTURE_RULES;
  return {
    version: 11,
    seed,
    colour: { space: 'HSB', relationship: 'analogous', count: stops.length, stops },
    preset: { type: 'gradient', kind: mode,
      ...(mixed ? {} : { angleDegrees: uniform(streams.preset, 0, 360) }) },
    // Linear marks shift their gradient position slightly, like Hobbs's (random y (+ y 100)).
    variation: { distribution: 'uniform', noise: null, colourJitter: mixed ? 0 : 0.08 },
    texture: {
      type: 'circles',
      count: integer(streams.texture, t.countMin, t.countMax),
      minRadius: t.minRadius,
      maxRadius: t.maxRadius,
    },
    elements: [],
  };
}
