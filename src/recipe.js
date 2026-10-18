import { uniform, weightedChoice, chance, integer } from './math/distributions.js';
import { luma } from './math/colour.js';

// Initial experimental bounds, not a claim that these palettes are aesthetically final.
export const COLOUR_RULES = Object.freeze({
  saturationMin: 65, saturationMax: 90,
  startBrightnessMin: 35, startBrightnessMax: 60,
  endBrightnessMax: 95, minimumBrightnessGap: 25,
  analogousOffsetMin: 20, analogousOffsetMax: 45,
  // Perceived lightness difference between endpoints, on a 0–255 luma scale.
  minimumLumaGap: 50, paletteAttempts: 20,
});

function sampleStops(c, count, hue, offset) {
  const r = COLOUR_RULES;
  const startSaturation = uniform(c, r.saturationMin, r.saturationMax);
  const startBrightness = uniform(c, r.startBrightnessMin, r.startBrightnessMax);
  const endBrightness = uniform(c, startBrightness + r.minimumBrightnessGap, r.endBrightnessMax);
  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1);
    return {
      position,
      h: offset === 0 ? hue : (hue + offset * position + 360) % 360,
      s: index === 0 ? startSaturation : uniform(c, r.saturationMin, r.saturationMax),
      b: index === 0 ? startBrightness : index === count - 1 ? endBrightness
        : uniform(c, startBrightness, endBrightness),
    };
  });
}

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
  const colourCount = integer(c, 3, 5);
  // Retry saturation/brightness, never hue, so dark hues such as blue stay as common.
  let stops;
  for (let attempt = 0; attempt < r.paletteAttempts && !stops; attempt++) {
    const candidate = sampleStops(c, colourCount, hue, offset);
    if (Math.abs(luma(candidate.at(-1)) - luma(candidate[0])) >= r.minimumLumaGap) stops = candidate;
  }
  // Rare fallback: the most contrasting endpoints the rules allow. An analogous palette
  // may drift towards a darker hue (cyan → blue), so pick the drift direction that
  // lands its light end on the lighter hue; this keeps every hue above 80 luma.
  if (!stops) {
    const gap = o => luma({ h: (hue + o + 360) % 360, s: r.saturationMin, b: r.endBrightnessMax })
      - luma({ h: hue, s: r.saturationMax, b: r.startBrightnessMin });
    stops = sampleStops(c, colourCount, hue, gap(-offset) > gap(offset) ? -offset : offset);
    Object.assign(stops[0], { s: r.saturationMax, b: r.startBrightnessMin });
    Object.assign(stops.at(-1), { s: r.saturationMin, b: r.endBrightnessMax });
  }
  // Broader marks need fewer draws to cover the surface.
  const scale = integer(streams.texture, 0, 1);
  const ranges = [
    { countMin: 45, countMax: 90, minRadius: 0.12, maxRadius: 0.24 },
    { countMin: 20, countMax: 45, minRadius: 0.22, maxRadius: 0.4 },
  ];
  const range = ranges[scale];
  const texture = {
    type: 'soft-marks',
    shape: weightedChoice(streams.texture, ['circle', 'square', 'rectangle', 'triangle']
      .map(value => ({ value, weight: 1 }))),
    count: integer(streams.texture, range.countMin, range.countMax),
    minRadius: range.minRadius,
    maxRadius: range.maxRadius,
  };
  return {
    version: 10,
    seed,
    colour: { space: 'HSB', relationship, count: colourCount, stops },
    preset: { type: 'gradient', kind: mode,
      ...(mixed ? {} : { angleDegrees: uniform(streams.preset, 0, 360) }) },
    variation: { distribution: 'uniform', noise: null, colourJitter: mixed ? 0 : 0.15 },
    texture,
    elements: [],
  };
}
