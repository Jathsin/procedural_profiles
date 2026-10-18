import { createCanvas } from '@napi-rs/canvas';
import { createDrawingRandom } from './input-randomness.js';
import { drawPreset } from './presets/index.js';

// Render recipes produced by generateRecipe(); arbitrary external JSON is not an API yet.
export async function renderRecipe(recipe, { width = 512, height = 512 } = {}) {
  for (const dimension of [width, height]) {
    if (!Number.isInteger(dimension) || dimension < 1 || dimension > 2048) {
      throw new RangeError('Image dimensions must be integers between 1 and 2048.');
    }
  }
  if (recipe.version !== 10) throw new RangeError('Renderer requires recipe version 10.');
  const canvas = createCanvas(width, height);
  drawPreset(canvas.getContext('2d'), recipe, width, height, createDrawingRandom(recipe.seed));
  return canvas.encode('png');
}
