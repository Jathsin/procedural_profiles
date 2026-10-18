import { createHash } from 'node:crypto';
import seedrandom from 'seedrandom';

export function hashInput(input) {
  if (typeof input !== 'string') throw new TypeError('Input must be a string.');
  // Reject malformed Unicode rather than silently replacing it during UTF-8 encoding.
  if (!input.isWellFormed()) throw new TypeError('Input must contain well-formed Unicode.');
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function createRandomStreams(input) {
  const seed = hashInput(input);
  const names = ['colour', 'preset', 'variation', 'texture', 'elements'];
  const streams = Object.fromEntries(names.map(name => {
    const streamSeed = hashInput(JSON.stringify(['recipe-v1', seed, name]));
    return [name, seedrandom(streamSeed)];
  }));
  return { seed, streams };
}

// Drawing uses a separate seed so mark counts never change recipe parameters.
export function createDrawingRandom(seed) {
  return seedrandom(hashInput(JSON.stringify(['drawing-v2', seed, 'texture'])));
}
