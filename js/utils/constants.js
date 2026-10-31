// Central configuration. All tunable economy / rules live here.
export const CASINO_CONFIG = {
  startingBalance: 10000,
  minBet: 10,
  maxBet: 5000,
  currencyName: 'Virtual Chips',
  currencyShort: 'CHIPS',
  chipDenominations: [10, 25, 50, 100, 500, 1000],
  maxHistoryRecords: 200
};

export const STORAGE_KEYS = {
  balance: 'vc_balance_v1',
  history: 'vc_history_v1',
  stats: 'vc_stats_v1',
  settings: 'vc_settings_v1',
  profile: 'vc_profile_v1'
};

export const BLACKJACK_CONFIG = {
  dealerStandsOn: 17,
  blackjackPayout: 1.5, // 3:2 profit on top of stake
  reshuffleBelow: 10
};

// European roulette: single zero.
export const ROULETTE_RED_NUMBERS = new Set(
  [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
);

export const ROULETTE_PAYOUTS = Object.freeze({
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  sixline: 5,
  redBlack: 1,
  oddEven: 1,
  lowHigh: 1,
  dozen: 2,
  column: 2
});

export const SLOTS_CONFIG = {
  symbols: ['7', 'DIAMOND', 'STAR', 'BELL', 'CHERRY', 'LEMON'],
  glyphs: { '7': '7', DIAMOND: '💎', STAR: '⭐', BELL: '🔔', CHERRY: '🍒', LEMON: '🍋' },
  // Triple multipliers (profit multiplier includes stake return handled by engine).
  paytable: { '7': 100, DIAMOND: 50, STAR: 25, BELL: 15, CHERRY: 10, LEMON: 5 },
  // Two cherries on the payline pays a small consolation (total-return multiplier).
  cherryPairMultiplier: 2
};

export const ROUTES = ['lobby', 'blackjack', 'roulette', 'slots', 'baccarat', 'history', 'statistics', 'settings'];

// Punto-banco payouts (profit multipliers; stake return handled by the engine).
export const BACCARAT_PAYOUTS = Object.freeze({
  player: 1,      // 1:1
  banker: 0.95,   // 1:1 minus 5% commission
  tie: 8          // 8:1, player/banker stakes push on a tie
});
