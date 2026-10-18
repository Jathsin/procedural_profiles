import { drawGradient } from './gradient.js';

export function drawPreset(context, recipe, width, height, random) {
  if (recipe.preset.type !== 'gradient') throw new RangeError('Unknown preset.');
  drawGradient(context, recipe, width, height, random);
}
