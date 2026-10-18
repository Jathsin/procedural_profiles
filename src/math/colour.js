// Hue follows the shorter arc across 0/360; S and B interpolate linearly.
export function interpolateHSB(start, end, t) {
  const hueDelta = ((end.h - start.h + 540) % 360) - 180;
  return {
    h: (start.h + hueDelta * t + 360) % 360,
    s: start.s + (end.s - start.s) * t,
    b: start.b + (end.b - start.b) * t,
  };
}

export function hsbToRGB({ h, s, b }) {
  const saturation = s / 100;
  const brightness = b / 100;
  const channel = n => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * brightness * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

export function hsbToCSS(colour) {
  return `rgb(${hsbToRGB(colour).join(',')})`;
}

// Interpolate between the surrounding stops, including every interior colour.
export function samplePalette(stops, t) {
  if (t <= stops[0].position) return stops[0];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].position) {
      const left = stops[i - 1];
      const right = stops[i];
      return interpolateHSB(left, right, (t - left.position) / (right.position - left.position));
    }
  }
  return stops.at(-1);
}

// Perceived lightness estimate (Rec. 709 weights on 0–255 RGB): the eye is most
// sensitive to green and least to blue, so equal HSB brightness can look very different.
export function luma(colour) {
  const [r, g, b] = hsbToRGB(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
