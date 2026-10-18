import { createDrawingRandom } from '../input-randomness.js';
import { uniform } from '../math/distributions.js';
import { samplePalette, hsbToCSS, hsbToRGB } from '../math/colour.js';

export function drawGradient(context, recipe, width, height, random) {
  const stops = recipe.colour.stops;
  const colourAt = t => hsbToCSS(samplePalette(stops, t));

  const linear = recipe.preset.kind === 'linear';
  if (!linear && recipe.preset.kind !== 'mixed') throw new RangeError('Unknown gradient mode.');
  // Colour arrangement and mark style are independent.
  const angle = (recipe.preset.angleDegrees ?? 0) * Math.PI / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const span = Math.abs(dx) * width + Math.abs(dy) * height;
  const colourRandom = createDrawingRandom(`${recipe.seed}:colour-variation`);
  const jitter = recipe.variation.colourJitter ?? 0;
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) throw new RangeError('Invalid colour jitter.');
  const texture = recipe.texture;
  if (texture?.type !== 'soft-marks' || !Number.isInteger(texture.count) ||
      texture.count < 1 || texture.count > 10000 ||
      !Number.isFinite(texture.minRadius) || !Number.isFinite(texture.maxRadius) ||
      texture.minRadius <= 0 || texture.maxRadius <= texture.minRadius || texture.maxRadius > 0.5) {
    throw new RangeError('Invalid mark texture parameters.');
  }
  context.fillStyle = colourAt(0.5);
  context.fillRect(0, 0, width, height);
  const scale = Math.min(width, height);
  const margin = texture.maxRadius * scale;
  for (let i = 0; i < texture.count; i++) {
    const x = uniform(random, -margin, width + margin);
    const y = uniform(random, -margin, height + margin);
    const radius = uniform(random, texture.minRadius, texture.maxRadius) * scale;
    // Linear: position controls colour. Mixed: sample colour independently.
    const t = linear
      ? Math.max(0, Math.min(1, 0.5 + ((x - width / 2) * dx + (y - height / 2) * dy) / span
        + (jitter > 0 ? uniform(colourRandom, -jitter, jitter) : 0)))
      : random();
    const rgb = hsbToRGB(samplePalette(stops, t));
    context.fillStyle = softMarkFill(context, x, y, radius, rgb);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

// Smooth opacity falloff: strongest at the centre, transparent at the edge.
// Reuse the same RGB at every stop to avoid dark fringes during interpolation.
export function softMarkFill(context, x, y, radius, rgb) {
  const fill = context.createRadialGradient(x, y, 0, x, y, radius);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const opacity = 1 - t * t * (3 - 2 * t);
    fill.addColorStop(t, `rgba(${rgb.join(',')},${opacity})`);
  }
  return fill;
}
