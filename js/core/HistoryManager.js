// Append-only round history (capped), persisted to localStorage.
import { CASINO_CONFIG, STORAGE_KEYS } from '../utils/constants.js';
import { storageManager } from './StorageManager.js';

const VALID_GAMES = new Set(['blackjack', 'roulette', 'slots', 'baccarat']);
const VALID_RESULTS = new Set(['win', 'loss', 'push']);

function isValidRecord(record) {
  return (
    record && typeof record === 'object' &&
    VALID_GAMES.has(record.game) &&
    Number.isFinite(record.bet) && record.bet > 0 &&
    VALID_RESULTS.has(record.result) &&
    Number.isFinite(record.payout) && record.payout >= 0 &&
    Number.isFinite(record.balanceAfter) && record.balanceAfter >= 0 &&
    typeof record.timestamp === 'string'
  );
}

class HistoryManager {
  constructor() {
    this.records = [];
  }

  load() {
    const stored = storageManager.loadJSON(
      STORAGE_KEYS.history, [],
      (v) => Array.isArray(v) && v.every(isValidRecord)
    );
    this.records = Array.isArray(stored) ? stored.slice(-CASINO_CONFIG.maxHistoryRecords) : [];
    return this.records;
  }

  persist() {
    storageManager.saveJSON(STORAGE_KEYS.history, this.records);
  }

  addRecord({ game, bet, result, payout, balanceAfter, detail = '' }) {
    const record = {
      game, result,
      bet: Math.floor(Number(bet)) || 0,
      payout: Math.floor(Number(payout)) || 0,
      profit: (Math.floor(Number(payout)) || 0) - (Math.floor(Number(bet)) || 0),
      balanceAfter: Math.floor(Number(balanceAfter)) || 0,
      detail: String(detail).slice(0, 160),
      timestamp: new Date().toISOString()
    };
    if (!isValidRecord(record)) {
      console.warn('[History] rejected invalid record', record);
      return null;
    }
    this.records.push(record);
    if (this.records.length > CASINO_CONFIG.maxHistoryRecords) {
      this.records = this.records.slice(-CASINO_CONFIG.maxHistoryRecords);
    }
    this.persist();
    window.dispatchEvent(new CustomEvent('vc:history', { detail: { record } }));
    return record;
  }

  getAll() {
    return [...this.records].reverse();
  }

  filter({ game = 'all', result = 'all' } = {}) {
    return this.getAll().filter((r) =>
      (game === 'all' || r.game === game) && (result === 'all' || r.result === result)
    );
  }

  clear() {
    this.records = [];
    this.persist();
    window.dispatchEvent(new CustomEvent('vc:history', { detail: { cleared: true } }));
  }
}

export const historyManager = new HistoryManager();
export { HistoryManager };
