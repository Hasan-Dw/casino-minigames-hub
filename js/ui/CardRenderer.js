// Playing-card renderer: API image when available, elegant CSS fallback otherwise.
const SUIT_GLYPH = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };

function displayValue(value) {
  const v = String(value).toUpperCase();
  if (v === 'ACE') return 'A';
  if (v === 'KING') return 'K';
  if (v === 'QUEEN') return 'Q';
  if (v === 'JACK') return 'J';
  return v;
}

export function isRedSuit(suit) {
  return suit === 'HEARTS' || suit === 'DIAMONDS';
}

/** Build a card element. faceDown renders the yallo-patterned back. */
export function renderCard(card, { faceDown = false, animate = true } = {}) {
  const cardEl = document.createElement('div');
  cardEl.className = 'playing-card' + (animate ? ' card-enter' : '');
  cardEl.setAttribute('role', 'img');

  if (faceDown) {
    cardEl.classList.add('face-down');
    cardEl.setAttribute('aria-label', 'Hidden card');
    cardEl.innerHTML = '<div class="card-back-pattern" aria-hidden="true"></div>';
    return cardEl;
  }

  const suit = String(card.suit || '').toUpperCase();
  const red = isRedSuit(suit);
  cardEl.classList.add(red ? 'red' : 'black');
  cardEl.setAttribute('aria-label', `${card.value} of ${card.suit}`);

  if (card.image) {
    const img = document.createElement('img');
    img.src = card.image;
    img.alt = `${card.value} of ${card.suit}`;
    img.loading = 'lazy';
    img.draggable = false;
    // If the remote image fails, swap to the CSS face so the table never breaks.
    img.addEventListener('error', () => {
      img.remove();
      cardEl.append(buildFallbackFace(card, suit));
    });
    cardEl.append(img);
  } else {
    cardEl.append(buildFallbackFace(card, suit));
  }
  return cardEl;
}

function buildFallbackFace(card, suit) {
  const face = document.createElement('div');
  face.className = 'card-face-fallback';
  const corner = document.createElement('div');
  corner.className = 'card-corner';
  corner.innerHTML = `<span>${displayValue(card.value)}</span><span>${SUIT_GLYPH[suit] || ''}</span>`;
  const pip = document.createElement('div');
  pip.className = 'card-pip';
  pip.textContent = SUIT_GLYPH[suit] || '';
  face.append(corner, pip);
  return face;
}

export const CardRenderer = { renderCard, isRedSuit };
