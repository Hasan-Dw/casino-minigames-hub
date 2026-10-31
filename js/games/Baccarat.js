// Pure Punto-Banco Baccarat rules. No DOM, no fetch, no balance.
// The controller draws real cards (DeckAPI) and passes them in; this module
// only scores hands, applies the third-card tableau, and settles bets.

export const BACCARAT_STATES = Object.freeze({
  BETTING: 'BETTING',
  DEALING: 'DEALING',
  RESOLVING: 'RESOLVING',
  ROUND_COMPLETE: 'ROUND_COMPLETE'
});

export const BACCARAT_SPOTS = Object.freeze(['player', 'banker', 'tie']);

/** Single-card Baccarat value: faces/10 = 0, Ace = 1, else face value. */
export function baccaratCardValue(value) {
  const v = String(value).toUpperCase();
  if (v === 'ACE') return 1;
  if (v === 'KING' || v === 'QUEEN' || v === 'JACK' || v === '10') return 0;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 2 && n <= 9) return n;
  throw new Error(`Unknown card value: ${value}`);
}

/** Hand total: only the final digit matters (modulo 10). */
export function handTotal(hand) {
  if (!Array.isArray(hand) || hand.length === 0) throw new Error('Hand must be a non-empty array');
  const sum = hand.reduce((total, card) => total + baccaratCardValue(card.value), 0);
  return sum % 10;
}

/** Natural: a two-card 8 or 9 ends drawing immediately. */
export function isNatural(playerHand, bankerHand) {
  if (playerHand.length !== 2 || bankerHand.length !== 2) return false;
  return handTotal(playerHand) >= 8 || handTotal(bankerHand) >= 8;
}

/** Player draws a third card on totals 0–5, stands on 6–7. */
export function playerShouldDraw(playerTotal) {
  return playerTotal <= 5;
}

/**
 * Standard banker tableau.
 * @param {number} bankerTotal - banker's two-card total
 * @param {number|null} playerThird - value of player's third card, or null if player stood
 */
export function bankerShouldDraw(bankerTotal, playerThird) {
  if (playerThird === null || playerThird === undefined) {
    return bankerTotal <= 5;
  }
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return playerThird !== 8;
  if (bankerTotal === 4) return playerThird >= 2 && playerThird <= 7;
  if (bankerTotal === 5) return playerThird >= 4 && playerThird <= 7;
  if (bankerTotal === 6) return playerThird === 6 || playerThird === 7;
  return false; // banker 7 always stands
}

/**
 * Play a full round from already-drawn cards (deal order P, B, P, B, then thirds).
 * Consumes 4–6 cards and returns every detail the UI needs to reveal the round.
 */
export function playRound(cards) {
  if (!Array.isArray(cards) || cards.length < 4) {
    throw new Error('playRound requires at least 4 cards');
  }
  const playerHand = [cards[0], cards[2]];
  const bankerHand = [cards[1], cards[3]];
  let used = 4;
  let playerThirdValue = null;

  if (!isNatural(playerHand, bankerHand)) {
    if (playerShouldDraw(handTotal(playerHand))) {
      if (!cards[used]) throw new Error('Not enough cards for player third');
      playerHand.push(cards[used]);
      used += 1;
      playerThirdValue = baccaratCardValue(playerHand[2].value);
    }
    if (bankerShouldDraw(handTotal(bankerHand), playerThirdValue)) {
      if (!cards[used]) throw new Error('Not enough cards for banker third');
      bankerHand.push(cards[used]);
      used += 1;
    }
  }

  const playerTotal = handTotal(playerHand);
  const bankerTotal = handTotal(bankerHand);
  const winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';

  return {
    playerHand, bankerHand, playerTotal, bankerTotal,
    winner, playerThirdValue,
    natural: isNatural([cards[0], cards[2]], [cards[1], cards[3]]),
    cardsUsed: used
  };
}

/**
 * Settle one spot bet. Returns { result, payout } where payout is total chips
 * returned (stake included; 0 on loss). Banker wins pay 5% commission;
 * player/banker stakes push on a tie; tie bets pay 8:1 profit.
 */
export function settleBet({ spot, bet, winner }) {
  const stake = Math.floor(Number(bet));
  if (!BACCARAT_SPOTS.includes(spot)) throw new Error(`Unknown spot: ${spot}`);
  if (!Number.isInteger(stake) || stake <= 0) throw new Error('Bet must be a positive integer');
  if (winner === 'tie') {
    if (spot === 'tie') return { result: 'win', payout: stake + stake * 8 };
    return { result: 'push', payout: stake };
  }
  if (spot === winner) {
    if (spot === 'banker') return { result: 'win', payout: stake + Math.floor(stake * 0.95) };
    return { result: 'win', payout: stake * 2 };
  }
  return { result: 'loss', payout: 0 };
}

export const BaccaratLogic = {
  BACCARAT_STATES, BACCARAT_SPOTS,
  baccaratCardValue, handTotal, isNatural,
  playerShouldDraw, bankerShouldDraw, playRound, settleBet
};
