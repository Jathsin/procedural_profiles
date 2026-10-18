import { createCanvas } from '@napi-rs/canvas';

export const SOFT_SHAPES = ['circle', 'square', 'rectangle', 'triangle'];

// A shape-relative distance: 0 at the centre, 1 at the boundary.
export function shapeDistance(shape, x, y) {
  switch (shape) {
    case 'circle': return Math.hypot(x, y);
    case 'square': return Math.max(Math.abs(x), Math.abs(y));
    case 'rectangle': return Math.max(Math.abs(x), Math.abs(y) * 2);
    case 'triangle': return Math.max(2 * y, Math.sqrt(3) * x - y, -Math.sqrt(3) * x - y);
    default: throw new RangeError('Unknown soft shape.');
  }
}

// Build one reusable alpha mask per render, not one pixel loop per mark.
export function createSoftShapeBrush(shape) {
  const size = 256;
  const mask = createCanvas(size, size);
  const context = mask.getContext('2d');
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = shapeDistance(shape, (x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
    // Keep the inner 50% fully opaque; feather the outer half.
    const t = Math.max(0, Math.min(1, (distance - 0.5) / 0.5));
    const index = (y * size + x) * 4;
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255;
    pixels.data[index + 3] = Math.round(255 * (1 - t * t * (3 - 2 * t)));
  }
  context.putImageData(pixels, 0, 0);
  const stamp = createCanvas(size, size);
  const brush = stamp.getContext('2d');
  return (target, x, y, radius, rgb, angle) => {
    brush.globalCompositeOperation = 'copy';
    brush.drawImage(mask, 0, 0);
    brush.globalCompositeOperation = 'source-in';
    brush.fillStyle = `rgb(${rgb.join(',')})`;
    brush.fillRect(0, 0, size, size);
    target.save();
    target.translate(x, y);
    target.rotate(angle);
    target.drawImage(stamp, -radius, -radius, radius * 2, radius * 2);
    target.restore();
  };
}
