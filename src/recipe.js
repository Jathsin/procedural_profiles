import { uniform, weightedChoice, chance, integer } from './math/distributions.js';

// Initial experimental bounds, not a claim that these palettes are aesthetically final.
export const COLOUR_RULES = Object.freeze({
  saturationMin: 65, saturationMax: 90,
  startBrightnessMin: 35, startBrightnessMax: 60,
  endBrightnessMax: 95, minimumBrightnessGap: 25,
  analogousOffsetMin: 20, analogousOffsetMax: 45,
});

export function chooseRecipe(seed, streams) {
  const c = streams.colour;
  const r = COLOUR_RULES;
  const mode = weightedChoice(streams.preset, [
    { value: 'linear', weight: 1 },
    { value: 'mixed', weight: 1 },
  ]);
  const relationship = weightedChoice(c, [
    { value: 'monochromatic', weight: 1 },
    { value: 'analogous', weight: 1 },
  ]);
  const hue = uniform(c, 0, 360);
  const offset = relationship === 'analogous'
    ? uniform(c, r.analogousOffsetMin, r.analogousOffsetMax) * (chance(c, 0.5) ? 1 : -1)
    : 0;
  const mixed = mode === 'mixed';
  const startSaturation = uniform(c, r.saturationMin, r.saturationMax);
  const startBrightness = uniform(c, r.startBrightnessMin, r.startBrightnessMax);
  const endBrightness = uniform(c, startBrightness + r.minimumBrightnessGap, r.endBrightnessMax);
  const colourCount = integer(c, 3, 5);
  const stops = Array.from({ length: colourCount }, (_, index) => {
    const position = index / (colourCount - 1);
    return {
      position,
      h: offset === 0 ? hue : (hue + offset * position + 360) % 360,
      s: index === 0 ? startSaturation : uniform(c, r.saturationMin, r.saturationMax),
      b: index === 0 ? startBrightness : index === colourCount - 1 ? endBrightness
        : uniform(c, startBrightness, endBrightness),
    };
  });
  // Broader marks need fewer draws to cover the surface.
  const broad = chance(streams.texture, 0.5);
  const texture = {
    type: 'soft-marks',
    count: broad ? integer(streams.texture, 100, 220) : integer(streams.texture, 350, 650),
    minRadius: broad ? 0.06 : 0.025,
    maxRadius: broad ? 0.16 : 0.07,
  };
  return {
    version: 6,
    seed,
    colour: { space: 'HSB', relationship, count: colourCount, stops },
    preset: { type: 'gradient', kind: mode,
      ...(mixed ? {} : { angleDegrees: uniform(streams.preset, 0, 360) }) },
    variation: { distribution: 'uniform', noise: null, colourJitter: mixed ? 0 : 0.15 },
    texture,
    elements: [],
  };
}
