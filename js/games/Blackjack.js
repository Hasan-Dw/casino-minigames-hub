// Pure Blackjack rules: scoring, blackjack/bust detection, dealer policy, outcome.
// No DOM, no fetch, no balance. Fully unit-testable.
import { BLACKJACK_CONFIG } from '../utils/constants.js';

export const BLACKJACK_STATES = Object.freeze({
  IDLE: 'IDLE',
  BETTING: 'BETTING',
  DEALING: 'DEALING',
  PLAYER_TURN: 'PLAYER_TURN',
  DEALER_TURN: 'DEALER_TURN',
  RESOLVING: 'RESOLVING',
  ROUND_COMPLETE: 'ROUND_COMPLETE',
  ERROR: 'ERROR'
});

function cardPoints(value) {
  const v = String(value).toUpperCase();
  if (v === 'ACE') return 11;
  if (v === 'KING' || v === 'QUEEN' || v === 'JACK') return 10;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 2 && n <= 10) return n;
  throw new Error(`Unknown card value: ${value}`);
}

/** Best score <= 21, counting Aces as 11 then demoting to 1 as needed. */
export function calculateScore(hand) {
  if (!Array.isArray(hand)) throw new Error('Hand must be an array');
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardPoints(card.value);
    if (String(card.value).toUpperCase() === 'ACE') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const naem = aces > 0 && total <= 21;
  return { total, naem, bust: total > 21 };
}

export function isBlackjack(hand) {
  return hand.length === 2 && calculateScore(hand).total === 21;
}

export function isBust(hand) {
  return calculateScore(hand).bust;
}

/** Standard dealer rule: hit below 17, stand on all 17s (incl. naem 17). */
export function dealerShouldHit(hand) {
  return calculateScore(hand).total < BLACKJACK_CONFIG.dealerStandsOn;
}

export function compareHands(playerHand, dealerHand) {
  const player = calculateScore(playerHand).total;
  const dealer = calculateScore(dealerHand).total;
  const playerBust = player > 21;
  const dealerBust = dealer > 21;
  if (playerBust) return 'dealer';
  if (dealerBust) return 'player';
  if (player > dealer) return 'player';
  if (dealer > player) return 'dealer';
  return 'push';
}

/**
 * Settle a round. Returns { result: 'win'|'loss'|'push', payout } where payout
 * is the total chips returned to the player (stake included; 0 on loss).
 */
export function settleRound({ bet, playerHand, dealerHand, doubled = false }) {
  const stake = Math.floor(bet);
  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);
  if (playerBJ && dealerBJ) return { result: 'push', payout: stake };
  if (playerBJ) {
    // Natural 3:2 — profit 1.5x stake on the original bet (double impossible on natural).
    return { result: 'win', payout: stake + Math.floor(stake * BLACKJACK_CONFIG.blackjackPayout) };
  }
  if (dealerBJ) return { result: 'loss', payout: 0 };
  if (isBust(playerHand)) return { result: 'loss', payout: 0 };
  if (isBust(dealerHand)) return { result: 'win', payout: stake * 2 };
  const winner = compareHands(playerHand, dealerHand);
  if (winner === 'player') return { result: 'win', payout: stake * 2 };
  if (winner === 'dealer') return { result: 'loss', payout: 0 };
  return { result: 'push', payout: stake };
}

export const BlackjackLogic = {
  calculateScore, isBlackjack, isBust, dealerShouldHit, compareHands, settleRound
};
