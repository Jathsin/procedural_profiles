import { createRandomStreams } from './src/input-randomness.js';
import { chooseRecipe } from './src/recipe.js';

// Inspect parameters independently of drawing.
export function generateRecipe(input) {
  const { seed, streams } = createRandomStreams(input);
  return chooseRecipe(seed, streams);
}

// Returns PNG bytes; the caller decides whether and where to save them.
export async function generateImage(input, options = {}) {
  const { renderRecipe } = await import('./src/renderer.js');
  return renderRecipe(generateRecipe(input), options);
}
