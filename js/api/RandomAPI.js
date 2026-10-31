// Async RNG abstraction. Tries Random.org (short timeout) then falls back to
// the local cryptographic RNG. Callers always get a valid result or a thrown
// friendly error — they never care which source produced it.
import { RNGManager } from '../core/RNGManager.js';

const RANDOM_ORG_URL = 'https://api.random.org/json-rpc/4/invoke';
const TIMEOUT_MS = 3000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('RNG timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function randomOrgInteger(min, max) {
  // Random.org JSON-RPC generateIntegers without an API key is rate-limited;
  // any failure is treated as "unavailable" and falls back to crypto.
  const body = {
    jsonrpc: '2.0', method: 'generateIntegers',
    params: { apiKey: '00000000-0000-0000-0000-000000000000', n: 1, min, max, replacement: true },
    id: Date.now()
  };
  const response = await withTimeout(
    fetch(RANDOM_ORG_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Random.org HTTP ${response.status}`);
  const data = await response.json();
  const value = data && data.result && data.result.random && data.result.random.data && data.result.random.data[0];
  if (!Number.isInteger(value) || value < min || value > max) throw new Error('Invalid Random.org payload');
  return value;
}

export const RandomAPI = {
  /** Async uniform integer in [min, max]. Falls back to Web Crypto on any failure. */
  async randomInteger(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    try {
      return await randomOrgInteger(lo, hi);
    } catch (error) {
      // Expected offline / no-key path: quiet fallback keeps games playable.
      return RNGManager.randomInteger(lo, hi);
    }
  },

  /**
   * Server-only integer in [min, max]. NEVER falls back: throws on any
   * transport/payload failure so callers (roulette) can abort the round
   * instead of settling on a non-server result.
   */
  async randomIntegerStrict(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) {
      throw new Error(`Invalid range [${min}, ${max}]`);
    }
    return randomOrgInteger(lo, hi);
  },

  async randomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) throw new Error('Cannot choose from empty array');
    const index = await this.randomInteger(0, array.length - 1);
    return array[index];
  },

  /** Exposes the sync crypto source for shuffles / non-async contexts. */
  sync: RNGManager
};
