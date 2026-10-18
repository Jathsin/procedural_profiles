import { uniform, weightedChoice, chance, integer } from './math/distributions.js';

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
  // Frosted finish: small crisp bubbles coloured from a hidden map of the regions.
  bubbleCountMin: 3200, bubbleCountMax: 4800,
  bubbleRadiusMin: 0.01, bubbleRadiusMax: 0.03,
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
  const { relationship, hues, stops } = chooseSoftFormPalette(streams.colour);
  const parts = chooseSoftForms(streams, hues);
  return {
    version: 16,
    seed,
    colour: { space: 'HSB', relationship, hues, count: stops.length, stops },
    preset: parts.preset,
    variation: parts.variation,
    texture: parts.texture,
    elements: [],
  };
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
  // Smooth regions, or the same regions rebuilt from small bubbles.
  const finish = weightedChoice(random, [
    { value: 'smooth', weight: 1 },
    { value: 'frosted', weight: 1 },
  ]);
  return {
    preset: { type: 'soft-forms', angleDegrees: uniform(streams.preset, 0, 360) },
    variation: { distribution: 'uniform', noise: null, grain: f.grain },
    texture: {
      type: 'soft-arcs',
      forms,
      finish,
      ...(finish === 'frosted' ? {
        bubbles: {
          count: integer(random, f.bubbleCountMin, f.bubbleCountMax),
          minRadius: f.bubbleRadiusMin,
          maxRadius: f.bubbleRadiusMax,
        },
      } : {}),
    },
  };
}
