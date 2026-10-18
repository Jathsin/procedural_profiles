import { uniform } from '../math/distributions.js';
import { hsbToRGB } from '../math/colour.js';

const rgba = (colour, alpha) => `rgba(${hsbToRGB(colour).join(',')},${alpha})`;

// Two or three large colour regions over a two-hue base gradient. Each region is a
// huge circle centred outside the image, so its visible edge is an evenly rounded
// arc. Edges vary from crisp to smoky, and fine grain gives a photographic texture.
export function drawSoftForms(context, recipe, width, height, random) {
  const stops = recipe.colour.stops;
  const forms = recipe.texture?.forms;
  const grain = recipe.variation?.grain ?? 0;
  if (recipe.texture?.type !== 'soft-arcs' || !Array.isArray(forms) ||
      forms.length < 1 || forms.length > 10 || !forms.every(isValidForm) ||
      !Number.isFinite(grain) || grain < 0 || grain > 64) {
    throw new RangeError('Invalid soft-form texture parameters.');
  }
  const scale = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;

  // Base: two vivid neighbouring hues along the main direction.
  const angle = recipe.preset.angleDegrees * Math.PI / 180;
  const dx = Math.cos(angle) * scale / 2;
  const dy = Math.sin(angle) * scale / 2;
  const base = context.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const stop of stops) base.addColorStop(stop.position, rgba(stop, 1));
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  for (const form of forms) {
    const direction = form.directionDegrees * Math.PI / 180;
    const radius = form.radius * scale;
    // Place the circle so its nearest point is `edge` away from the image centre.
    const distance = radius + form.edge * scale;
    const x = cx + distance * Math.cos(direction);
    const y = cy + distance * Math.sin(direction);
    const circle = () => {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
    };
    // Pass 1: very soft everywhere.
    context.save();
    context.filter = `blur(${form.softBlur * scale}px)`;
    context.fillStyle = rgba(form.colour, form.opacity);
    circle();
    context.fill();
    context.restore();
    // Pass 2: a crisper edge that fades out along the arc (the tangent direction).
    const tx = -Math.sin(direction) * scale / 2 * form.crispFadeSide;
    const ty = Math.cos(direction) * scale / 2 * form.crispFadeSide;
    const fade = context.createLinearGradient(cx - tx, cy - ty, cx + tx, cy + ty);
    fade.addColorStop(0, rgba(form.colour, form.opacity));
    fade.addColorStop(form.crispFadeEnd, rgba(form.colour, 0));
    context.save();
    context.filter = `blur(${form.crispBlur * scale}px)`;
    context.fillStyle = fade;
    circle();
    context.fill();
    context.restore();
  }

  // Grain: the same seeded offset for all three channels of a pixel (no colour speckles).
  if (grain > 0) {
    const image = context.getImageData(0, 0, width, height);
    const data = image.data; // clamps to 0–255 on assignment
    for (let i = 0; i < data.length; i += 4) {
      const noise = uniform(random, -grain / 2, grain / 2);
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    context.putImageData(image, 0, 0);
  }
}

function isValidForm(form) {
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  return inRange(form?.directionDegrees, 0, 360) && inRange(form.radius, 0.1, 10) &&
    inRange(form.edge, -1, 1) && inRange(form.opacity, 0, 1) &&
    inRange(form.softBlur, 0, 0.5) && inRange(form.crispBlur, 0, 0.5) &&
    [1, -1].includes(form.crispFadeSide) && inRange(form.crispFadeEnd, 0.01, 1) &&
    inRange(form.colour?.h, 0, 360) && inRange(form.colour?.s, 0, 100) && inRange(form.colour?.b, 0, 100);
}
