// Small pure helpers shared across the app.
export function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Strict bet validation: finite integer within [minBet, maxBet] and affordable. */
export function validateBetAmount(raw, balance, minBet, maxBet) {
  const amount = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return { ok: false, reason: 'Enter a valid bet amount.' };
  if (!Number.isInteger(Math.round(amount)) || amount <= 0) return { ok: false, reason: 'Bet must be a positive whole number.' };
  const whole = Math.floor(amount);
  if (whole < minBet) return { ok: false, reason: `Minimum bet is ${minBet}.` };
  if (whole > maxBet) return { ok: false, reason: `Maximum bet is ${maxBet}.` };
  if (whole > balance) return { ok: false, reason: 'Insufficient balance for that bet.' };
  return { ok: true, amount: whole };
}

export function sanitizeInteger(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Safe JSON parse returning fallback on any error. */
export function safeParse(text, fallback) {
  try {
    if (text === null || text === undefined) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
