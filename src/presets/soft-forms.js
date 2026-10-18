import { createCanvas } from '@napi-rs/canvas';
import { uniform } from '../math/distributions.js';
import { hsbToRGB } from '../math/colour.js';

const rgba = (colour, alpha) => `rgba(${hsbToRGB(colour).join(',')},${alpha})`;

// Longer side of the hidden colour map used by the frosted finish.
const MAP_SIZE = 128;

// Two or three large colour regions over a two-hue base gradient. Each region is a
// huge circle centred outside the image, so its visible edge is an evenly rounded
// arc. Edges vary from crisp to smoky, and fine grain gives a photographic texture.
// The frosted finish rebuilds the same image from small bubbles.
export function drawSoftForms(context, recipe, width, height, random) {
  const texture = recipe.texture;
  const grain = recipe.variation?.grain ?? 0;
  if (texture?.type !== 'soft-arcs' || !Array.isArray(texture.forms) ||
      texture.forms.length < 1 || texture.forms.length > 10 || !texture.forms.every(isValidForm) ||
      !Number.isFinite(grain) || grain < 0 || grain > 64 ||
      !['smooth', 'frosted'].includes(texture.finish) ||
      (texture.finish === 'frosted' && !isValidBubbles(texture.bubbles))) {
    throw new RangeError('Invalid soft-form texture parameters.');
  }
  if (texture.finish === 'smooth') {
    paintRegions(context, recipe, width, height);
  } else {
    drawBubbles(context, recipe, width, height, random);
  }
  if (grain > 0) addGrain(context, width, height, grain, random);
}

// Bubbles take their colour from a small hidden map of the regions. The map, scaled
// up, also fills any gaps between bubbles.
function drawBubbles(context, recipe, width, height, random) {
  const ratio = MAP_SIZE / Math.max(width, height);
  const mapWidth = Math.max(1, Math.round(width * ratio));
  const mapHeight = Math.max(1, Math.round(height * ratio));
  const map = createCanvas(mapWidth, mapHeight);
  const mapContext = map.getContext('2d');
  paintRegions(mapContext, recipe, mapWidth, mapHeight);
  const pixels = mapContext.getImageData(0, 0, mapWidth, mapHeight).data;
  context.drawImage(map, 0, 0, width, height);

  const { count, minRadius, maxRadius } = recipe.texture.bubbles;
  const scale = Math.min(width, height);
  const margin = maxRadius * scale;
  for (let i = 0; i < count; i++) {
    const x = uniform(random, -margin, width + margin);
    const y = uniform(random, -margin, height + margin);
    const radius = uniform(random, minRadius, maxRadius) * scale;
    // Colour from the map pixel under the bubble's centre (clamped to the image).
    const mx = Math.min(mapWidth - 1, Math.max(0, Math.floor(x * ratio)));
    const my = Math.min(mapHeight - 1, Math.max(0, Math.floor(y * ratio)));
    const index = (my * mapWidth + mx) * 4;
    context.fillStyle = `rgb(${pixels[index]},${pixels[index + 1]},${pixels[index + 2]})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function paintRegions(context, recipe, width, height) {
  const stops = recipe.colour.stops;
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

  for (const form of recipe.texture.forms) {
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
}

// Grain: the same seeded offset for all three channels of a pixel (no colour speckles).
function addGrain(context, width, height, grain, random) {
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

function isValidForm(form) {
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  return inRange(form?.directionDegrees, 0, 360) && inRange(form.radius, 0.1, 10) &&
    inRange(form.edge, -1, 1) && inRange(form.opacity, 0, 1) &&
    inRange(form.softBlur, 0, 0.5) && inRange(form.crispBlur, 0, 0.5) &&
    [1, -1].includes(form.crispFadeSide) && inRange(form.crispFadeEnd, 0.01, 1) &&
    inRange(form.colour?.h, 0, 360) && inRange(form.colour?.s, 0, 100) && inRange(form.colour?.b, 0, 100);
}

function isValidBubbles(bubbles) {
  return Number.isInteger(bubbles?.count) && bubbles.count >= 1 && bubbles.count <= 20000 &&
    Number.isFinite(bubbles.minRadius) && Number.isFinite(bubbles.maxRadius) &&
    bubbles.minRadius > 0 && bubbles.maxRadius > bubbles.minRadius && bubbles.maxRadius <= 0.2;
}
