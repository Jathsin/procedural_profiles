import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generateRecipe, generateImage } from '../pipeline.js';

const inputs = process.argv.slice(2);
const ids = inputs.length ? inputs : Array.from({ length: 8 }, (_, i) => `object-${i}`);
const directory = new URL('../samples/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const id of ids) {
  const recipe = generateRecipe(id);
  // Never use the input as a filesystem path. Full hashes keep filenames safe.
  const name = `${recipe.preset.kind ?? recipe.preset.type}-${createHash('sha256').update(id).digest('hex')}`;
  const start = performance.now();
  const image = await generateImage(id);
  await writeFile(new URL(`${name}.png`, directory), image);
  await writeFile(new URL(`${name}.json`, directory), JSON.stringify(recipe, null, 2) + '\n');
  console.log(`${JSON.stringify(id)} → samples/${name}.png (${Math.round(performance.now() - start)} ms, ${image.length} bytes)`);
}
