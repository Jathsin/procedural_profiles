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

// Soft forms: two or three large regions bounded by arcs of huge off-image circles,
// so every edge follows an evenly rounded curve. Radii, offsets and blur radii are
// fractions of the smaller image dimension, so the look survives resizing.
export const SOFT_FORM_RULES = Object.freeze({
  countMin: 2, countMax: 3,
  radiusMin: 1.2, radiusMax: 3,
  // Distance of the arc's nearest point from the image centre (negative: past it).
  edgeMin: -0.3, edgeMax: 0.3,
  opacityMin: 0.85, opacityMax: 1,
  // Each form is drawn twice: very soft everywhere, then crisper but fading out
  // along the arc, so the edge goes from crisp to smoky.
  softBlurMin: 0.08, softBlurMax: 0.15,
  crispBlurMin: 0.01, crispBlurMax: 0.03,
  crispFadeMin: 0.4, crispFadeMax: 0.8,
  // Seeded per-pixel noise, in 0–255 channel units (peak to peak).
  grain: 14,
});

// Three neighbouring hues, each used by its own region, in three tones.
// The light tone is a tinted, translucent glow rather than an opaque white.
export const SOFT_FORM_COLOUR_RULES = Object.freeze({
  hueSpanMin: 50, hueSpanMax: 110,
  tones: {
    deep: { saturationMin: 70, saturationMax: 90, brightnessMin: 68, brightnessMax: 82 },
    vivid: { saturationMin: 55, saturationMax: 85, brightnessMin: 90, brightnessMax: 100 },
    light: { saturationMin: 8, saturationMax: 20, brightnessMin: 97, brightnessMax: 100 },
  },
  lightOpacityScale: 0.6,
});

export function chooseRecipe(seed, streams) {
  const type = weightedChoice(streams.preset, [
    { value: 'gradient', weight: 1 },
    { value: 'soft-forms', weight: 1 },
  ]);
  let colour, parts;
  if (type === 'gradient') {
    const stops = choosePalette(streams.colour);
    colour = { space: 'HSB', relationship: 'analogous', count: stops.length, stops };
    parts = chooseGradient(streams);
  } else {
    const { relationship, hues, stops } = chooseSoftFormPalette(streams.colour);
    colour = { space: 'HSB', relationship, hues, count: stops.length, stops };
    parts = chooseSoftForms(streams, hues);
  }
  return {
    version: 15,
    seed,
    colour,
    preset: parts.preset,
    variation: parts.variation,
    texture: parts.texture,
    elements: [],
  };
}

function choosePalette(c) {
  const r = COLOUR_RULES;
  const hue = uniform(c, 0, 360);
  const span = uniform(c, r.hueSpanMin, r.hueSpanMax) * (chance(c, 0.5) ? 1 : -1);
  const s = uniform(c, r.saturationMin, r.saturationMax);
  const b = uniform(c, r.brightnessMin, r.brightnessMax);
  return [
    { position: 0, h: hue, s, b },
    { position: 1, h: (hue + span + 360) % 360, s, b },
  ];
}

function chooseSoftFormPalette(c) {
  const r = SOFT_FORM_COLOUR_RULES;
  const hue = uniform(c, 0, 360);
  const span = uniform(c, r.hueSpanMin, r.hueSpanMax) * (chance(c, 0.5) ? 1 : -1);
  const hues = [0, 0.5, 1].map(t => (hue + span * t + 360) % 360);
  // Background: two vivid neighbouring hues, which blend without turning grey.
  const stops = [0, 1].map(index => ({ position: index, h: hues[index], ...chooseTone(c, 'vivid') }));
  return { relationship: 'analogous', hues, stops };
}

function chooseTone(c, name) {
  const tone = SOFT_FORM_COLOUR_RULES.tones[name];
  return {
    s: uniform(c, tone.saturationMin, tone.saturationMax),
    b: uniform(c, tone.brightnessMin, tone.brightnessMax),
  };
}

function chooseGradient(streams) {
  const mode = weightedChoice(streams.preset, [
    { value: 'linear', weight: 1 },
    { value: 'mixed', weight: 1 },
  ]);
  const mixed = mode === 'mixed';
  const t = TEXTURE_RULES;
  return {
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
  };
}

function chooseSoftForms(streams, hues) {
  const f = SOFT_FORM_RULES;
  const random = streams.texture;
  const c = streams.colour;
  // Each region gets a different tone and hue, so the regions stay distinct.
  const colours = [
    { colour: { h: hues[2], ...chooseTone(c, 'deep') }, light: false },
    { colour: { h: hues[1], ...chooseTone(c, 'light') }, light: true },
    { colour: { h: hues[2], ...chooseTone(c, 'vivid') }, light: false },
  ];
  const forms = Array.from({ length: integer(random, f.countMin, f.countMax) }, (_, index) => ({
    // The circle's centre lies in this direction from the image centre.
    directionDegrees: uniform(random, 0, 360),
    radius: uniform(random, f.radiusMin, f.radiusMax),
    edge: uniform(random, f.edgeMin, f.edgeMax),
    colour: colours[index].colour,
    opacity: uniform(random, f.opacityMin, f.opacityMax) *
      (colours[index].light ? SOFT_FORM_COLOUR_RULES.lightOpacityScale : 1),
    softBlur: uniform(random, f.softBlurMin, f.softBlurMax),
    crispBlur: uniform(random, f.crispBlurMin, f.crispBlurMax),
    // Which way along the arc the crisp edge fades out, and where it has vanished.
    crispFadeSide: chance(random, 0.5) ? 1 : -1,
    crispFadeEnd: uniform(random, f.crispFadeMin, f.crispFadeMax),
  }));
  return {
    preset: { type: 'soft-forms', angleDegrees: uniform(streams.preset, 0, 360) },
    variation: { distribution: 'uniform', noise: null, grain: f.grain },
    texture: { type: 'soft-arcs', forms },
  };
}
