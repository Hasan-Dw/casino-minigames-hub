// Cryptographically secure browser RNG. All game outcomes use this (via RandomAPI).
// Never use Math.random() for game results.

function randomValues(count) {
  const array = new Uint32Array(count);
  window.crypto.getRandomValues(array);
  return array;
}

/** Uniform integer in [min, max] inclusive, rejection-sampled to avoid modulo bias. */
export function cryptoRandomInteger(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) {
    throw new Error(`Invalid range [${min}, ${max}]`);
  }
  const range = hi - lo + 1;
  const maxUint = 0xffffffff;
  const limit = maxUint - (maxUint % range);
  for (;;) {
    const [value] = randomValues(1);
    if (value < limit) return lo + (value % range);
  }
}

export function cryptoRandomFloat(min, max) {
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) {
    throw new Error(`Invalid range [${min}, ${max}]`);
  }
  const [value] = randomValues(1);
  return lo + (value / 0xffffffff) * (hi - lo);
}

export function cryptoRandomChoice(array) {
  if (!Array.isArray(array) || array.length === 0) throw new Error('Cannot choose from empty array');
  return array[cryptoRandomInteger(0, array.length - 1)];
}

/** Fisher–Yates shuffle using crypto randomness. Returns a new array. */
export function cryptoShuffle(input) {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i--) {
    const j = cryptoRandomInteger(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export const RNGManager = {
  randomInteger: cryptoRandomInteger,
  randomFloat: cryptoRandomFloat,
  randomChoice: cryptoRandomChoice,
  shuffle: cryptoShuffle
};
