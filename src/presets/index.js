import { drawSoftForms } from './soft-forms.js';

export function drawPreset(context, recipe, width, height, random) {
  if (recipe.preset.type === 'soft-forms') return drawSoftForms(context, recipe, width, height, random);
  throw new RangeError('Unknown preset.');
}
