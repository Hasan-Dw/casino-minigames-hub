// Pure European-roulette rules. No DOM, no RNG. Testable in isolation.
import { ROULETTE_RED_NUMBERS, ROULETTE_PAYOUTS } from '../utils/constants.js';

export const ROULETTE_NUMBERS = Object.freeze(Array.from({ length: 37 }, (_, i) => i));

/** Standard European wheel order around the rim (single zero). */
export const WHEEL_ORDER = Object.freeze(
  [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
   24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
);

export function colorOf(number) {
  const n = Number(number);
  if (n === 0) return 'green';
  return ROULETTE_RED_NUMBERS.has(n) ? 'red' : 'black';
}

function dozenOf(number) {
  if (number < 1 || number > 36) return 0;
  return Math.ceil(number / 12);
}

function columnOf(number) {
  if (number < 1 || number > 36) return 0;
  return ((number - 1) % 3) + 1;
}

/** Street (row) index 0..11 for numbers 1..36. Row k = {3k+1, 3k+2, 3k+3}. */
function streetOf(n) {
  if (!Number.isInteger(n) || n < 1 || n > 36) return -1;
  return Math.floor((n - 1) / 3);
}

/** Normalize a bet's covered numbers to a sorted array of ints. */
export function numbersOf(bet) {
  if (!bet) return [];
  if (bet.type === 'straight') {
    const n = Number(bet.value);
    return Number.isInteger(n) && n >= 0 && n <= 36 ? [n] : [];
  }
  if (['split', 'street', 'corner', 'sixline'].includes(bet.type) && Array.isArray(bet.value)) {
    const nums = bet.value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 36);
    return [...new Set(nums)].sort((a, b) => a - b);
  }
  return [];
}

/** Stable identity key so identical placements merge: "split:17,20". */
export function betKey(bet) {
  if (['split', 'street', 'corner', 'sixline'].includes(bet.type)) {
    return `${bet.type}:${numbersOf(bet).join(',')}`;
  }
  return `${bet.type}:${bet.value === undefined || bet.value === null ? '' : String(bet.value)}`;
}

// ---------- inside-bet validation (layout geometry, 3-wide grid + zero) ----------

function same(a, b) {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
}

/** Split = exactly 2 adjacent numbers (share a side; zero has no neighbours). */
export function isValidSplit(nums) {
  const arr = [...new Set(nums.map(Number))].sort((a, b) => a - b);
  if (arr.length !== 2) return false;
  const [a, b] = arr;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b > 36) return false;
  if (b - a === 1) return streetOf(a) === streetOf(b); // horizontal neighbours
  if (b - a === 3) return true; // vertical neighbours
  return false;
}

/** Street = one full row of 3, or one of the two zero trios (0-1-2, 0-2-3). */
export function isValidStreet(nums) {
  const arr = [...new Set(nums.map(Number))].sort((a, b) => a - b);
  if (arr.length !== 3) return false;
  if (same(arr, [0, 1, 2]) || same(arr, [0, 2, 3])) return true;
  if (arr[0] < 1) return false;
  const k = streetOf(arr[0]);
  return k >= 0 && same(arr, [3 * k + 1, 3 * k + 2, 3 * k + 3]);
}

/** Corner = a valid 2x2 block {n, n+1, n+3, n+4} with n in the left column. */
export function isValidCorner(nums) {
  const arr = [...new Set(nums.map(Number))].sort((a, b) => a - b);
  if (arr.length !== 4) return false;
  if (arr.some((n) => !Number.isInteger(n) || n < 1 || n > 36)) return false;
  const n = arr[0];
  return n % 3 === 1 && same(arr, [n, n + 1, n + 3, n + 4]);
}

/** Six line = two adjacent full streets (6 consecutive numbers starting a row). */
export function isValidSixLine(nums) {
  const arr = [...new Set(nums.map(Number))].sort((a, b) => a - b);
  if (arr.length !== 6) return false;
  if (arr.some((n) => !Number.isInteger(n) || n < 1 || n > 36)) return false;
  const k = streetOf(arr[0]);
  if (k < 0 || k > 10 || arr[0] % 3 !== 1) return false;
  const expected = [0, 1, 2, 3, 4, 5].map((i) => 3 * k + 1 + i);
  return same(arr, expected);
}

export function validateInsideBet(type, nums) {
  const arr = Array.isArray(nums) ? nums.map(Number) : [];
  switch (type) {
    case 'straight':
      return arr.length === 1 && Number.isInteger(arr[0]) && arr[0] >= 0 && arr[0] <= 36
        ? { ok: true } : { ok: false, reason: 'Straight needs exactly one number (0–36).' };
    case 'split':
      return isValidSplit(arr)
        ? { ok: true } : { ok: false, reason: 'Split needs exactly 2 adjacent numbers.' };
    case 'street':
      return isValidStreet(arr)
        ? { ok: true } : { ok: false, reason: 'Street needs 3 numbers in one row.' };
    case 'corner':
      return isValidCorner(arr)
        ? { ok: true } : { ok: false, reason: 'Corner needs 4 numbers in a 2×2 block.' };
    case 'sixline':
      return isValidSixLine(arr)
        ? { ok: true } : { ok: false, reason: 'Six Line needs 6 numbers across two adjacent rows.' };
    default:
      return { ok: false, reason: `Unknown inside bet: ${type}` };
  }
}

// ---------- French call bets (fixed chip combinations of individual bets) ----------

export const CALL_BETS = Object.freeze({
  voisins: Object.freeze({
    label: 'Voisins du Zero',
    description: '17 numbers around zero · 9 chips',
    numbers: Object.freeze([0, 2, 3, 4, 7, 12, 15, 18, 19, 21, 22, 25, 26, 28, 29, 32, 35]),
    legs: Object.freeze([
      { type: 'street', numbers: Object.freeze([0, 2, 3]), units: 2 },
      { type: 'split', numbers: Object.freeze([4, 7]), units: 1 },
      { type: 'split', numbers: Object.freeze([12, 15]), units: 1 },
      { type: 'split', numbers: Object.freeze([18, 21]), units: 1 },
      { type: 'split', numbers: Object.freeze([19, 22]), units: 1 },
      { type: 'split', numbers: Object.freeze([32, 35]), units: 1 },
      { type: 'corner', numbers: Object.freeze([25, 26, 28, 29]), units: 2 }
    ])
  }),
  tiers: Object.freeze({
    label: 'Tiers du Cylindre',
    description: '12 numbers opposite zero · 6 splits',
    numbers: Object.freeze([5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36]),
    legs: Object.freeze([
      { type: 'split', numbers: Object.freeze([5, 8]), units: 1 },
      { type: 'split', numbers: Object.freeze([10, 11]), units: 1 },
      { type: 'split', numbers: Object.freeze([13, 16]), units: 1 },
      { type: 'split', numbers: Object.freeze([23, 24]), units: 1 },
      { type: 'split', numbers: Object.freeze([27, 30]), units: 1 },
      { type: 'split', numbers: Object.freeze([33, 36]), units: 1 }
    ])
  }),
  orphelins: Object.freeze({
    label: 'Orphelins',
    description: '8 leftover numbers · 5 chips',
    numbers: Object.freeze([1, 6, 9, 14, 17, 20, 31, 34]),
    legs: Object.freeze([
      { type: 'straight', numbers: Object.freeze([1]), units: 1 },
      { type: 'split', numbers: Object.freeze([6, 9]), units: 1 },
      { type: 'split', numbers: Object.freeze([14, 17]), units: 1 },
      { type: 'split', numbers: Object.freeze([17, 20]), units: 1 },
      { type: 'split', numbers: Object.freeze([31, 34]), units: 1 }
    ])
  })
});

export function callBetChips(key) {
  const def = CALL_BETS[key];
  if (!def) return 0;
  return def.legs.reduce((sum, leg) => sum + leg.units, 0);
}

/** Expand a call bet into individual bet objects (base chip × leg units each). */
export function expandCallBet(key, baseAmount) {
  const def = CALL_BETS[key];
  if (!def) throw new Error(`Unknown call bet: ${key}`);
  const base = Math.floor(Number(baseAmount)) || 0;
  if (base <= 0) throw new Error('Base chip must be positive.');
  return def.legs.map((leg) => ({
    type: leg.type,
    value: leg.type === 'straight' ? leg.numbers[0] : [...leg.numbers],
    amount: base * leg.units,
    group: def.label
  }));
}

/** Single bet wins? bet = { type, value?, amount }. value is a number or number[]. */
export function betWins(bet, winningNumber) {
  const n = Number(winningNumber);
  switch (bet.type) {
    case 'straight': return Number(bet.value) === n;
    case 'split':
    case 'street':
    case 'corner':
    case 'sixline': return numbersOf(bet).includes(n);
    case 'red': return n !== 0 && colorOf(n) === 'red';
    case 'black': return n !== 0 && colorOf(n) === 'black';
    case 'odd': return n !== 0 && n % 2 === 1;
    case 'even': return n !== 0 && n % 2 === 0;
    case 'low': return n >= 1 && n <= 18;
    case 'high': return n >= 19 && n <= 36;
    case 'dozen': return dozenOf(n) === Number(bet.value);
    case 'column': return columnOf(n) === Number(bet.value);
    default: return false;
  }
}

export function payoutMultiplier(betType) {
  switch (betType) {
    case 'straight': return ROULETTE_PAYOUTS.straight;
    case 'split': return ROULETTE_PAYOUTS.split;
    case 'street': return ROULETTE_PAYOUTS.street;
    case 'corner': return ROULETTE_PAYOUTS.corner;
    case 'sixline': return ROULETTE_PAYOUTS.sixline;
    case 'red': case 'black': return ROULETTE_PAYOUTS.redBlack;
    case 'odd': case 'even': return ROULETTE_PAYOUTS.oddEven;
    case 'low': case 'high': return ROULETTE_PAYOUTS.lowHigh;
    case 'dozen': return ROULETTE_PAYOUTS.dozen;
    case 'column': return ROULETTE_PAYOUTS.column;
    default: throw new Error(`Unknown bet type: ${betType}`);
  }
}

/**
 * Evaluate a list of bets against the predetermined winning number.
 * Returns { totalBet, totalPayout, won, details[] }.
 * totalPayout is chips returned (stake included per winning bet).
 */
export function evaluateBets(bets, winningNumber) {
  const list = Array.isArray(bets) ? bets : [];
  let totalBet = 0;
  let totalPayout = 0;
  const details = list.map((bet) => {
    const amount = Math.floor(Number(bet.amount)) || 0;
    totalBet += amount;
    const win = betWins(bet, winningNumber);
    const returned = win ? amount * (payoutMultiplier(bet.type) + 1) : 0;
    totalPayout += returned;
    return { ...bet, amount, win, returned };
  });
  const result = totalPayout > totalBet ? 'win' : totalPayout === totalBet && totalBet > 0 ? 'push' : 'loss';
  return { totalBet, totalPayout, result: totalBet === 0 ? 'loss' : result, won: totalPayout > 0, details };
}

function shortInsideLabel(bet) {
  const nums = numbersOf(bet);
  switch (bet.type) {
    case 'straight': return `Number ${nums[0]}`;
    case 'split': return `Split ${nums.join('+')}`;
    case 'street': return `Street ${nums.join('-')}`;
    case 'corner': return `Corner ${nums.join(',')}`;
    case 'sixline': return `Six Line ${nums[0]}-${nums[nums.length - 1]}`;
    default: return bet.type;
  }
}

export function describeBet(bet) {
  const labels = {
    red: 'Red', black: 'Black',
    odd: 'Odd', even: 'Even', low: 'Low (1–18)', high: 'High (19–36)',
    dozen: `Dozen ${bet.value}`, column: `Column ${bet.value}`
  };
  const core = labels[bet.type] || shortInsideLabel(bet);
  const prefix = bet.group ? `${bet.group} · ` : '';
  return `${prefix}${core} — ${bet.amount}`;
}

export const RouletteLogic = {
  ROULETTE_NUMBERS, WHEEL_ORDER, CALL_BETS,
  colorOf, numbersOf, betKey,
  isValidSplit, isValidStreet, isValidCorner, isValidSixLine, validateInsideBet,
  callBetChips, expandCallBet,
  betWins, payoutMultiplier, evaluateBets, describeBet
};
