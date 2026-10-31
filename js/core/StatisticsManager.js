// Aggregate statistics derived from settled rounds. Persisted separately from history.
import { STORAGE_KEYS } from '../utils/constants.js';
import { storageManager } from './StorageManager.js';

function defaultStats() {
  return {
    totalGames: 0, wins: 0, losses: 0, pushes: 0,
    totalWagered: 0, totalReturned: 0,
    biggestWin: 0, biggestLoss: 0,
    perGame: { blackjack: { played: 0, won: 0 }, roulette: { played: 0, won: 0 }, slots: { played: 0, won: 0 }, baccarat: { played: 0, won: 0 } }
  };
}

function isValidStats(value) {
  return value && typeof value === 'object' &&
    Number.isFinite(value.totalGames) && Number.isFinite(value.totalWagered) &&
    value.perGame && typeof value.perGame === 'object';
}

class StatisticsManager {
  constructor() {
    this.stats = defaultStats();
  }

  load() {
    const stored = storageManager.loadJSON(STORAGE_KEYS.stats, defaultStats(), isValidStats);
    this.stats = { ...defaultStats(), ...stored, perGame: { ...defaultStats().perGame, ...(stored.perGame || {}) } };
    return this.stats;
  }

  persist() {
    storageManager.saveJSON(STORAGE_KEYS.stats, this.stats);
  }

  recordGame({ game, bet, payout, result }) {
    const stake = Math.floor(Number(bet)) || 0;
    const returned = Math.floor(Number(payout)) || 0;
    const profit = returned - stake;
    const s = this.stats;
    s.totalGames += 1;
    s.totalWagered += stake;
    s.totalReturned += returned;
    if (result === 'win') {
      s.wins += 1;
      if (profit > s.biggestWin) s.biggestWin = profit;
    } else if (result === 'loss') {
      s.losses += 1;
      const loss = Math.abs(profit);
      if (loss > s.biggestLoss) s.biggestLoss = loss;
    } else {
      s.pushes += 1;
    }
    if (s.perGame[game]) {
      s.perGame[game].played += 1;
      if (result === 'win') s.perGame[game].won += 1;
    }
    this.persist();
    window.dispatchEvent(new CustomEvent('vc:stats', { detail: { stats: this.get() } }));
  }

  get() {
    const s = this.stats;
    const net = s.totalReturned - s.totalWagered;
    const decisive = s.wins + s.losses;
    const winRate = decisive === 0 ? 0 : Math.round((s.wins / decisive) * 100);
    let favoriteGame = '—';
    let best = -1;
    for (const [game, data] of Object.entries(s.perGame)) {
      if (data.played > best) { best = data.played; favoriteGame = data.played > 0 ? game : '—'; }
    }
    return { ...s, net, winRate, favoriteGame };
  }

  reset() {
    this.stats = defaultStats();
    this.persist();
    window.dispatchEvent(new CustomEvent('vc:stats', { detail: { stats: this.get() } }));
  }
}

export const statisticsManager = new StatisticsManager();
export { StatisticsManager };
