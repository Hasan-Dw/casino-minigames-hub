// Pure 3-reel slot rules. No DOM. Result generated first, animation follows.
// Uses an injected rngChoice so tests can be deterministic.
import { SLOTS_CONFIG } from '../utils/constants.js';

export const SLOT_SYMBOLS = Object.freeze([...SLOTS_CONFIG.symbols]);

export function glyphFor(symbol) {
  return SLOTS_CONFIG.glyphs[symbol] || symbol;
}

/** Draw 3 symbols using the provided choice function (defaults to Math-free crypto via caller). */
export function spinReels(choiceFn) {
  if (typeof choiceFn !== 'function') throw new Error('spinReels requires a choice function');
  return [choiceFn(SLOT_SYMBOLS), choiceFn(SLOT_SYMBOLS), choiceFn(SLOT_SYMBOLS)];
}

/**
 * Evaluate a payline. Returns { multiplier, kind } where multiplier applies to
 * total return (stake included): e.g. triple-7 with bet 100 returns 100*100.
 */
export function evaluatePayline(symbols) {
  if (!Array.isArray(symbols) || symbols.length !== 3) throw new Error('Payline must have 3 symbols');
  const [a, b, c] = symbols;
  if (a === b && b === c) {
    const triple = SLOTS_CONFIG.paytable[a];
    if (Number.isFinite(triple)) return { multiplier: triple, kind: 'triple', symbol: a };
  }
  const cherries = symbols.filter((s) => s === 'CHERRY').length;
  if (cherries === 2) return { multiplier: SLOTS_CONFIG.cherryPairMultiplier, kind: 'pair', symbol: 'CHERRY' };
  return { multiplier: 0, kind: 'none', symbol: null };
}

/** Settle a spin: { result, payout } with payout = total chips returned. */
export function settleSpin({ bet, symbols }) {
  const stake = Math.floor(bet);
  const { multiplier, kind, symbol } = evaluatePayline(symbols);
  if (multiplier <= 0) return { result: 'loss', payout: 0, multiplier, kind, symbol };
  return { result: 'win', payout: stake * multiplier, multiplier, kind, symbol };
}

export const SlotLogic = { SLOT_SYMBOLS, glyphFor, spinReels, evaluatePayline, settleSpin };
