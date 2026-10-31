// Virtual-chip balance. Single owner of the chip count; UI listens to 'vc:balance'.
import { CASINO_CONFIG, STORAGE_KEYS } from '../utils/constants.js';
import { sanitizeInteger } from '../utils/helpers.js';
import { storageManager } from './StorageManager.js';

class BalanceManager {
  constructor() {
    this.balance = CASINO_CONFIG.startingBalance;
    this.loaded = false;
  }

  load() {
    const stored = storageManager.loadJSON(
      STORAGE_KEYS.balance,
      CASINO_CONFIG.startingBalance,
      (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0
    );
    this.balance = sanitizeInteger(stored, CASINO_CONFIG.startingBalance);
    if (this.balance < 0) this.balance = CASINO_CONFIG.startingBalance;
    this.loaded = true;
    return this.balance;
  }

  persist() {
    storageManager.saveJSON(STORAGE_KEYS.balance, this.balance);
  }

  get() {
    return this.balance;
  }

  canAfford(amount) {
    const bet = sanitizeInteger(amount, -1);
    return bet > 0 && bet <= this.balance;
  }

  /** Remove stake at round start. Returns false if unaffordable (balance untouched). */
  deduct(amount) {
    const bet = sanitizeInteger(amount, -1);
    if (bet <= 0 || bet > this.balance) return false;
    this.balance -= bet;
    this.persist();
    this.emit();
    return true;
  }

  /** Add returned chips (winnings + stake). Never lets balance go negative. */
  credit(amount) {
    const value = sanitizeInteger(amount, 0);
    if (value <= 0) return this.balance;
    this.balance += value;
    this.persist();
    this.emit();
    return this.balance;
  }

  reset() {
    this.balance = CASINO_CONFIG.startingBalance;
    this.persist();
    this.emit();
    return this.balance;
  }

  /** If balance fell below min bet, top up to starting balance (naem rescue, recorded by caller). */
  rescueIfBroke() {
    if (this.balance < CASINO_CONFIG.minBet) {
      this.reset();
      return true;
    }
    return false;
  }

  emit() {
    window.dispatchEvent(new CustomEvent('vc:balance', { detail: { balance: this.balance } }));
  }
}

export const balanceManager = new BalanceManager();
export { BalanceManager };
