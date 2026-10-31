// Deck of Cards API abstraction with a local crypto-shuffled fallback deck.
// Games call ensureDeck() + drawCards(n) and never touch URLs or fetch directly.
import { BLACKJACK_CONFIG } from '../utils/constants.js';
import { RNGManager } from '../core/RNGManager.js';

const API_BASE = 'https://deckofcardsapi.com/api/deck';
const FETCH_TIMEOUT_MS = 8000;

const SUITS = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const VALUES = ['ACE', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING'];

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function buildLocalDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ code: `${value[0]}${suit[0]}-${deck.length}`, value, suit, image: '', local: true });
    }
  }
  return RNGManager.shuffle(deck);
}

function normalizeRemoteCard(card) {
  if (!card || typeof card.value !== 'string' || typeof card.suit !== 'string') return null;
  return {
    code: String(card.code || `${card.value}-${card.suit}`),
    value: String(card.value).toUpperCase(),
    suit: String(card.suit).toUpperCase(),
    image: typeof card.image === 'string' ? card.image : '',
    local: false
  };
}

class DeckAPIClass {
  constructor() {
    this.deckId = null;
    this.remaining = 0;
    this.remoteAvailable = true;
    this.localDeck = [];
    this.usingLocal = false;
  }

  status() {
    return { deckId: this.deckId, remaining: this.remaining, usingLocal: this.usingLocal, remoteAvailable: this.remoteAvailable };
  }

  async ensureDeck() {
    if (this.usingLocal) {
      if (this.localDeck.length < BLACKJACK_CONFIG.reshuffleBelow) this.localDeck = buildLocalDeck();
      this.remaining = this.localDeck.length;
      return { mode: 'local' };
    }
    if (this.deckId && this.remaining > BLACKJACK_CONFIG.reshuffleBelow) return { mode: 'remote', deckId: this.deckId };
    try {
      const response = await withTimeout(fetch(`${API_BASE}/new/shuffle/?deck_count=1`), FETCH_TIMEOUT_MS);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.success !== true || !data.deck_id) throw new Error('Invalid shuffle response');
      this.deckId = data.deck_id;
      this.remaining = Number(data.remaining) || 52;
      this.remoteAvailable = true;
      return { mode: 'remote', deckId: this.deckId };
    } catch (error) {
      console.warn('[DeckAPI] shuffle failed, switching to local deck:', error);
      this.switchToLocal('Unable to reach the card service. Using a local deck so play can continue.');
      return { mode: 'local', fallback: true };
    }
  }

  switchToLocal(reason) {
    this.usingLocal = true;
    this.remoteAvailable = false;
    this.localDeck = buildLocalDeck();
    this.remaining = this.localDeck.length;
    window.dispatchEvent(new CustomEvent('vc:deck-fallback', { detail: { reason } }));
  }

  /** Draw n normalized cards. Always resolves; throws only with a friendly message. */
  async drawCards(count) {
    const needed = Math.max(1, Math.floor(count));
    await this.ensureDeck();
    if (this.usingLocal) {
      if (this.localDeck.length < needed) this.localDeck = buildLocalDeck();
      const drawn = this.localDeck.splice(0, needed);
      this.remaining = this.localDeck.length;
      return drawn;
    }
    try {
      const response = await withTimeout(
        fetch(`${API_BASE}/${this.deckId}/draw/?count=${needed}`),
        FETCH_TIMEOUT_MS
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.success !== true || !Array.isArray(data.cards)) throw new Error('Invalid draw response');
      const cards = data.cards.map(normalizeRemoteCard).filter(Boolean);
      if (cards.length !== needed) throw new Error('Incomplete draw response');
      this.remaining = Number(data.remaining) || 0;
      return cards;
    } catch (error) {
      console.warn('[DeckAPI] draw failed, switching to local deck:', error);
      this.switchToLocal('Card service interrupted. Continuing with a local deck.');
      return this.drawCards(needed);
    }
  }

  reset() {
    this.deckId = null;
    this.remaining = 0;
    this.usingLocal = false;
    this.remoteAvailable = true;
    this.localDeck = [];
  }
}

export const DeckAPI = new DeckAPIClass();
