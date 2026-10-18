// All helpers consume the supplied stream; none use global Math.random().
export function uniform(random, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new RangeError('Expected finite bounds with min < max.');
  }
  return min + random() * (max - min);
}

export function integer(random, min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min ||
      !Number.isSafeInteger(max - min + 1)) {
    throw new RangeError('Expected an ordered, safe integer interval.');
  }
  return Math.floor(uniform(random, 0, max - min + 1)) + min;
}

export function weightedChoice(random, choices) {
  if (!Array.isArray(choices) || choices.length === 0 ||
      choices.some(({ weight }) => !Number.isFinite(weight) || weight < 0)) {
    throw new RangeError('Expected choices with finite, nonnegative weights.');
  }
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('Total weight must be positive and finite.');
  let remaining = random() * total;
  for (const { value, weight } of choices) {
    if (weight === 0) continue;
    remaining -= weight;
    if (remaining < 0) return value;
  }
  return choices.findLast(choice => choice.weight > 0).value;
}

export function chance(random, probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError('Probability must be between 0 and 1.');
  }
  return random() < probability;
}
