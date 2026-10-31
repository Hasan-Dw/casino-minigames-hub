// Application bootstrap + orchestration. Game rules live in js/games/*;
// this file only wires DOM events to those engines and to the core managers.
import { CASINO_CONFIG, SLOTS_CONFIG, STORAGE_KEYS } from './utils/constants.js';
import { validateBetAmount, sleep, $all } from './utils/helpers.js';
import { formatChips, formatSigned } from './utils/formatters.js';
import { balanceManager } from './core/BalanceManager.js';
import { historyManager } from './core/HistoryManager.js';
import { statisticsManager } from './core/StatisticsManager.js';
import { gameManager } from './core/GameManager.js';
import { DeckAPI } from './api/DeckAPI.js';
import { RandomAPI } from './api/RandomAPI.js';
import { BLACKJACK_STATES, BlackjackLogic } from './games/Blackjack.js';
import { RouletteLogic, colorOf } from './games/Roulette.js';
import { SlotLogic, glyphFor } from './games/SlotMachine.js';
import { BaccaratLogic } from './games/Baccarat.js';
import { storageManager } from './core/StorageManager.js';
import { renderCard } from './ui/CardRenderer.js';
import { confirmModal, openModal } from './ui/ModalManager.js';
import { notify } from './ui/NotificationManager.js';
import { flashResult, reducedMotion } from './ui/AnimationManager.js';
import { SoundManager } from './ui/SoundManager.js';
import { LobbyMusic } from './ui/LobbyMusicManager.js';
import { UIManager } from './ui/UIManager.js';

// ---------- shared helpers ----------

function settleAndRecord({ game, bet, payout, result, detail }) {
  if (payout > 0) balanceManager.credit(payout);
  historyManager.addRecord({ game, bet, result, payout, balanceAfter: balanceManager.get(), detail });
  statisticsManager.recordGame({ game, bet, payout, result });
  if (balanceManager.rescueIfBroke()) {
    notify('Balance topped up to 10,000 Virtual Chips so you can keep playing.', 'info');
  }
  refreshMetaPages();
}

function buildChipRow(containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;
  container.innerHTML = '';
  for (const value of CASINO_CONFIG.chipDenominations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = value >= 1000 ? `${value / 1000}K` : `${value}`;
    button.title = `${value} chips`;
    button.setAttribute('aria-label', `Set bet to ${value}`);
    button.addEventListener('click', () => {
      SoundManager.click();
      input.value = value;
      container.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
      button.classList.add('selected');
    });
    container.append(button);
  }
}

function currentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return hash || 'lobby';
}

function refreshMetaPages() {
  if (currentRoute() === 'history') refreshHistory();
  if (currentRoute() === 'statistics') refreshStats();
}

// ---------- router ----------

function initRouter() {
  const apply = () => {
    UIManager.setActivePage(currentRoute());
    // Music follows the actual view: lobby plays, every other page stops.
    LobbyMusic.sync(currentRoute());
    if (currentRoute() === 'history') refreshHistory();
    if (currentRoute() === 'statistics') refreshStats();
  };
  window.addEventListener('hashchange', apply);
  apply();
}

// ---------- blackjack controller ----------

const bj = {
  state: BLACKJACK_STATES.BETTING,
  bet: 0,
  playerHand: [],
  dealerHand: [],
  revealed: false,
  busy: false
};

function bjElements() {
  return {
    dealerHand: document.getElementById('bj-dealer-hand'),
    playerHand: document.getElementById('bj-player-hand'),
    dealerScore: document.getElementById('bj-dealer-score'),
    playerScore: document.getElementById('bj-player-score'),
    betInput: document.getElementById('bj-bet-input'),
    state: document.getElementById('bj-state'),
    deal: document.getElementById('bj-deal'),
    hit: document.getElementById('bj-hit'),
    stand: document.getElementById('bj-stand'),
    double: document.getElementById('bj-double'),
    newRound: document.getElementById('bj-new-round'),
    max: document.getElementById('bj-max'),
    clearBet: document.getElementById('bj-clear-bet'),
    table: document.getElementById('bj-table')
  };
}

function setBjState(state) {
  bj.state = state;
  const e = bjElements();
  e.state.textContent = state.replace('_', ' ');
  const playerTurn = state === BLACKJACK_STATES.PLAYER_TURN && !bj.busy;
  const canDeal = (state === BLACKJACK_STATES.BETTING || state === BLACKJACK_STATES.ROUND_COMPLETE) && !bj.busy;
  e.deal.disabled = !canDeal;
  e.hit.disabled = !playerTurn;
  e.stand.disabled = !playerTurn;
  e.double.disabled = !(playerTurn && bj.playerHand.length === 2 && balanceManager.canAfford(bj.bet));
  e.newRound.disabled = !(state === BLACKJACK_STATES.ROUND_COMPLETE && !bj.busy);
  e.max.disabled = bj.busy;
  e.clearBet.disabled = bj.busy;
  e.betInput.disabled = !(state === BLACKJACK_STATES.BETTING || state === BLACKJACK_STATES.ROUND_COMPLETE);
  UIManager.setBetDisplay('blackjack', bj.bet);
}

function renderBjHands() {
  const e = bjElements();
  e.dealerHand.innerHTML = '';
  e.playerHand.innerHTML = '';
  bj.dealerHand.forEach((card, index) => {
    const faceDown = index === 1 && !bj.revealed;
    e.dealerHand.append(renderCard(card, { faceDown }));
  });
  bj.playerHand.forEach((card) => e.playerHand.append(renderCard(card, {})));
  const player = bj.playerHand.length ? BlackjackLogic.calculateScore(bj.playerHand).total : '—';
  e.playerScore.textContent = `${player}`;
  if (!bj.dealerHand.length) {
    e.dealerScore.textContent = '—';
  } else if (!bj.revealed) {
    try {
      const visible = BlackjackLogic.calculateScore([bj.dealerHand[0]]).total;
      e.dealerScore.textContent = `${visible} + ?`;
    } catch { e.dealerScore.textContent = '?'; }
  } else {
    e.dealerScore.textContent = `${BlackjackLogic.calculateScore(bj.dealerHand).total}`;
  }
}

function bjResetTable(message = 'Place your bet, then press DEAL.') {
  bj.playerHand = [];
  bj.dealerHand = [];
  bj.revealed = false;
  bj.bet = 0;
  renderBjHands();
  UIManager.setMessage('blackjack', message, '');
  setBjState(BLACKJACK_STATES.BETTING);
}

async function bjDeal() {
  if (bj.busy || !(bj.state === BLACKJACK_STATES.BETTING || bj.state === BLACKJACK_STATES.ROUND_COMPLETE)) return;
  const e = bjElements();
  const check = validateBetAmount(e.betInput.value, balanceManager.get(), CASINO_CONFIG.minBet, CASINO_CONFIG.maxBet);
  if (!check.ok) {
    notify(check.reason, 'loss');
    UIManager.setMessage('blackjack', check.reason, 'loss');
    return;
  }
  bj.busy = true;
  setBjState(BLACKJACK_STATES.DEALING);
  UIManager.setMessage('blackjack', 'Dealing…', '');
  try {
    if (!balanceManager.deduct(check.amount)) throw new Error('Insufficient balance.');
    bj.bet = check.amount;
    UIManager.setBetDisplay('blackjack', bj.bet);
    const cards = await DeckAPI.drawCards(4);
    bj.playerHand = [cards[0], cards[2]];
    bj.dealerHand = [cards[1], cards[3]];
    bj.revealed = false;
    SoundManager.deal();
    renderBjHands();
    const playerBJ = BlackjackLogic.isBlackjack(bj.playerHand);
    const dealerBJ = BlackjackLogic.isBlackjack(bj.dealerHand);
    if (playerBJ || dealerBJ) {
      bj.revealed = true;
      renderBjHands();
      await bjSettle(playerBJ && !dealerBJ ? 'BLACKJACK! You hit 21.' : dealerBJ && !playerBJ ? 'Dealer has Blackjack.' : 'Both have Blackjack — push.');
    } else {
      setBjState(BLACKJACK_STATES.PLAYER_TURN);
      UIManager.setMessage('blackjack', 'Your move: HIT, STAND or DOUBLE.', '');
    }
  } catch (error) {
    console.warn('[Blackjack] deal failed:', error);
    UIManager.setMessage('blackjack', 'Unable to deal right now. Please try again.', 'loss');
    setBjState(BLACKJACK_STATES.ERROR);
    setTimeout(() => bjResetTable(), 1200);
  } finally {
    bj.busy = false;
    if (bj.state === BLACKJACK_STATES.DEALING) setBjState(BLACKJACK_STATES.BETTING);
    else setBjState(bj.state);
  }
}

async function bjHit() {
  if (bj.busy || bj.state !== BLACKJACK_STATES.PLAYER_TURN) return;
  bj.busy = true;
  setBjState(BLACKJACK_STATES.PLAYER_TURN);
  try {
    const [card] = await DeckAPI.drawCards(1);
    bj.playerHand.push(card);
    SoundManager.deal();
    renderBjHands();
    if (BlackjackLogic.isBust(bj.playerHand)) {
      bj.revealed = true;
      renderBjHands();
      await bjSettle('BUST! You went over 21.');
    } else {
      const score = BlackjackLogic.calculateScore(bj.playerHand).total;
      UIManager.setMessage('blackjack', score === 21 ? '21! STAND to lock it in.' : 'Your move: HIT, STAND or DOUBLE.', '');
    }
  } catch (error) {
    console.warn('[Blackjack] hit failed:', error);
    notify('Card draw failed. Please try again.', 'loss');
  } finally {
    bj.busy = false;
    setBjState(bj.state);
  }
}

async function bjStand() {
  if (bj.busy || bj.state !== BLACKJACK_STATES.PLAYER_TURN) return;
  bj.busy = true;
  setBjState(BLACKJACK_STATES.DEALER_TURN);
  UIManager.setMessage('blackjack', 'Dealer plays…', '');
  try {
    bj.revealed = true;
    renderBjHands();
    await sleep(reducedMotion() ? 60 : 550);
    while (BlackjackLogic.dealerShouldHit(bj.dealerHand)) {
      const [card] = await DeckAPI.drawCards(1);
      bj.dealerHand.push(card);
      SoundManager.deal();
      renderBjHands();
      await sleep(reducedMotion() ? 60 : 600);
    }
    const dealerScore = BlackjackLogic.calculateScore(bj.dealerHand).total;
    const playerScore = BlackjackLogic.calculateScore(bj.playerHand).total;
    let note = `Dealer stands on ${dealerScore}.`;
    if (dealerScore > 21) note = 'Dealer busts!';
    else if (playerScore > dealerScore) note = `You win ${playerScore} vs ${dealerScore}.`;
    else if (dealerScore > playerScore) note = `Dealer wins ${dealerScore} vs ${playerScore}.`;
    else note = `Push at ${playerScore}.`;
    await bjSettle(note);
  } catch (error) {
    console.warn('[Blackjack] stand failed:', error);
    notify('Dealer draw failed. Round refunded.', 'loss');
    balanceManager.credit(bj.bet);
    bjResetTable();
  } finally {
    bj.busy = false;
    setBjState(bj.state);
  }
}

async function bjDouble() {
  if (bj.busy || bj.state !== BLACKJACK_STATES.PLAYER_TURN || bj.playerHand.length !== 2) return;
  if (!balanceManager.canAfford(bj.bet)) {
    notify('Insufficient balance to double down.', 'loss');
    return;
  }
  bj.busy = true;
  setBjState(BLACKJACK_STATES.DEALER_TURN);
  try {
    balanceManager.deduct(bj.bet);
    bj.bet *= 2;
    UIManager.setBetDisplay('blackjack', bj.bet);
    const [card] = await DeckAPI.drawCards(1);
    bj.playerHand.push(card);
    renderBjHands();
    if (BlackjackLogic.isBust(bj.playerHand)) {
      bj.revealed = true;
      renderBjHands();
      await bjSettle('BUST after doubling!');
    } else {
      bj.revealed = true;
      renderBjHands();
      while (BlackjackLogic.dealerShouldHit(bj.dealerHand)) {
        const [extra] = await DeckAPI.drawCards(1);
        bj.dealerHand.push(extra);
        renderBjHands();
        await sleep(reducedMotion() ? 60 : 500);
      }
      await bjSettle('Doubled down — dealer stands.');
    }
  } catch (error) {
    console.warn('[Blackjack] double failed:', error);
    notify('Double down failed. Please try again.', 'loss');
  } finally {
    bj.busy = false;
    setBjState(bj.state);
  }
}

async function bjSettle(note) {
  const e = bjElements();
  setBjState(BLACKJACK_STATES.RESOLVING);
  const { result, payout } = BlackjackLogic.settleRound({ bet: bj.bet, playerHand: bj.playerHand, dealerHand: bj.dealerHand });
  settleAndRecord({
    game: 'blackjack', bet: bj.bet, payout, result,
    detail: `${BlackjackLogic.calculateScore(bj.playerHand).total} vs ${BlackjackLogic.calculateScore(bj.dealerHand).total}`
  });
  const profit = payout - bj.bet;
  if (result === 'win') {
    const natural = BlackjackLogic.isBlackjack(bj.playerHand);
    UIManager.setMessage('blackjack', `${natural ? 'BLACKJACK! ' : 'YOU WIN! '} ${note} ${formatSigned(profit)} chips.`, 'win');
    SoundManager.win();
  } else if (result === 'loss') {
    UIManager.setMessage('blackjack', `YOU LOSE. ${note} ${formatSigned(profit)} chips.`, 'loss');
    SoundManager.lose();
  } else {
    UIManager.setMessage('blackjack', `PUSH. ${note} Bet returned.`, 'push');
    SoundManager.click();
  }
  flashResult(e.table, result);
  setBjState(BLACKJACK_STATES.ROUND_COMPLETE);
}

function initBlackjack() {
  const e = bjElements();
  renderBjHands();
  setBjState(BLACKJACK_STATES.BETTING);
  e.deal.addEventListener('click', () => { SoundManager.click(); void bjDeal(); });
  e.hit.addEventListener('click', () => { SoundManager.click(); void bjHit(); });
  e.stand.addEventListener('click', () => { SoundManager.click(); void bjStand(); });
  e.double.addEventListener('click', () => { SoundManager.click(); void bjDouble(); });
  e.newRound.addEventListener('click', () => { SoundManager.click(); bjResetTable(); });
  e.max.addEventListener('click', () => {
    SoundManager.click();
    e.betInput.value = Math.min(CASINO_CONFIG.maxBet, balanceManager.get());
  });
  e.clearBet.addEventListener('click', () => { SoundManager.click(); e.betInput.value = CASINO_CONFIG.minBet; });
  gameManager.register('blackjack', { name: 'Blackjack', description: 'Beat the dealer to 21.', route: 'blackjack', controller: bj });
}

// ---------- roulette controller ----------

const rl = {
  bets: [], spinning: false, wheelRotation: 0, ballRotation: 0,
  insideMode: 'straight', selection: [], callPreview: null
};

const INSIDE_MODE_SIZE = { straight: 1, split: 2, street: 3, corner: 4, sixline: 6 };
const INSIDE_MODE_HINT = {
  straight: 'Tap a number for a Straight bet, or pick another inside bet above.',
  split: 'Split: tap 2 adjacent numbers, then PLACE INSIDE BET.',
  street: 'Street: tap 3 numbers in one row, then PLACE INSIDE BET.',
  corner: 'Corner: tap 4 numbers in a 2×2 block, then PLACE INSIDE BET.',
  sixline: 'Six Line: tap 6 numbers across two adjacent rows, then PLACE INSIDE BET.'
};

function rouletteCommitted() {
  return rl.bets.reduce((sum, b) => sum + b.amount, 0);
}

function renderRouletteBets() {
  const total = rouletteCommitted();
  UIManager.setBetDisplay('roulette', total);
  const active = document.getElementById('roulette-active-bets');
  if (rl.bets.length === 0) {
    active.textContent = 'No bets placed.';
  } else {
    active.textContent = rl.bets.map((b) => RouletteLogic.describeBet(b)).join(' · ') + `  (Total ${formatChips(total)})`;
  }
  const state = document.getElementById('roulette-state');
  if (state) state.textContent = rl.spinning ? 'SPINNING' : 'BETTING';
  const spin = document.getElementById('roulette-spin');
  const clear = document.getElementById('roulette-clear');
  if (spin) spin.disabled = rl.spinning || rl.bets.length === 0;
  if (clear) clear.disabled = rl.spinning || rl.bets.length === 0;
  document.querySelectorAll('#roulette-outside .outside-btn').forEach((btn) => {
    const type = btn.dataset.betType;
    const value = btn.dataset.betValue ? Number(btn.dataset.betValue) : undefined;
    btn.classList.toggle('selected', rl.bets.some((b) => b.type === type && (value === undefined || Number(b.value) === value)));
  });
  document.querySelectorAll('#roulette-call-bets .outside-btn').forEach((btn) => {
    btn.classList.toggle('selected', rl.callPreview === btn.dataset.callBet);
  });
  document.querySelectorAll('#roulette-numbers .num-btn').forEach((btn) => {
    const n = Number(btn.dataset.number);
    const covered = rl.bets.some((b) => RouletteLogic.numbersOf(b).includes(n));
    btn.classList.toggle('selected', covered);
    btn.classList.toggle('picked', rl.selection.includes(n));
    btn.classList.toggle('preview',
      Boolean(rl.callPreview && RouletteLogic.CALL_BETS[rl.callPreview].numbers.includes(n)));
  });
  const placeInside = document.getElementById('roulette-place-inside');
  if (placeInside) placeInside.disabled = rl.spinning || rl.insideMode === 'straight' || rl.selection.length === 0;
  const clearSel = document.getElementById('roulette-clear-selection');
  if (clearSel) clearSel.disabled = rl.spinning || rl.selection.length === 0;
  updateInsideHint();
}

function updateInsideHint() {
  const hint = document.getElementById('roulette-inside-hint');
  if (!hint) return;
  const need = INSIDE_MODE_SIZE[rl.insideMode] || 1;
  let text = INSIDE_MODE_HINT[rl.insideMode] || '';
  if (rl.insideMode !== 'straight' && rl.selection.length > 0) {
    const picked = [...rl.selection].sort((a, b) => a - b).join(', ');
    text = `Selected (${rl.selection.length}/${need}): ${picked}.`;
  }
  hint.textContent = text;
}

function setInsideMode(mode) {
  if (rl.spinning || !INSIDE_MODE_SIZE[mode]) return;
  SoundManager.click();
  rl.insideMode = mode;
  rl.selection = [];
  document.querySelectorAll('#roulette-inside-modes .outside-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.insideMode === mode);
  });
  renderRouletteBets();
}

function toggleNumberSelection(n) {
  if (rl.spinning) return;
  if (rl.insideMode === 'straight') {
    placeRouletteBet('straight', n);
    return;
  }
  SoundManager.click();
  const need = INSIDE_MODE_SIZE[rl.insideMode];
  if (rl.selection.includes(n)) {
    rl.selection = rl.selection.filter((x) => x !== n);
  } else {
    if (rl.selection.length >= need) rl.selection.shift();
    rl.selection.push(n);
  }
  renderRouletteBets();
}

function placeInsideBet() {
  if (rl.spinning || rl.insideMode === 'straight' || rl.selection.length === 0) return;
  const nums = [...rl.selection].sort((a, b) => a - b);
  const valid = RouletteLogic.validateInsideBet(rl.insideMode, nums);
  if (!valid.ok) {
    notify(valid.reason, 'loss');
    return;
  }
  const input = document.getElementById('roulette-bet-input');
  const check = validateBetAmount(input.value, balanceManager.get(), CASINO_CONFIG.minBet, CASINO_CONFIG.maxBet);
  if (!check.ok) {
    notify(check.reason, 'loss');
    return;
  }
  if (!balanceManager.deduct(check.amount)) {
    notify('Insufficient balance for that chip.', 'loss');
    return;
  }
  SoundManager.click();
  const bet = { type: rl.insideMode, value: [...nums], amount: check.amount };
  const key = RouletteLogic.betKey(bet);
  const existing = rl.bets.find((b) => RouletteLogic.betKey(b) === key && (b.group || '') === '');
  if (existing) existing.amount += check.amount;
  else rl.bets.push(bet);
  rl.selection = [];
  renderRouletteBets();
}

function clearSelection() {
  if (rl.spinning) return;
  SoundManager.click();
  rl.selection = [];
  renderRouletteBets();
}

function placeRouletteBet(type, value, group) {
  if (rl.spinning) return;
  const input = document.getElementById('roulette-bet-input');
  const check = validateBetAmount(input.value, balanceManager.get(), CASINO_CONFIG.minBet, CASINO_CONFIG.maxBet);
  if (!check.ok) {
    notify(check.reason, 'loss');
    return;
  }
  if (!balanceManager.deduct(check.amount)) {
    notify('Insufficient balance for that chip.', 'loss');
    return;
  }
  SoundManager.click();
  const bet = { type, value, amount: check.amount };
  if (group) bet.group = group;
  const key = RouletteLogic.betKey(bet);
  const existing = rl.bets.find((b) => RouletteLogic.betKey(b) === key && (b.group || '') === (group || ''));
  if (existing) existing.amount += check.amount;
  else rl.bets.push(bet);
  renderRouletteBets();
}

function previewCallBet(key) {
  if (rl.spinning || !RouletteLogic.CALL_BETS[key]) return;
  SoundManager.click();
  rl.callPreview = rl.callPreview === key ? null : key;
  renderCallPreview();
  renderRouletteBets();
}

function renderCallPreview() {
  const box = document.getElementById('roulette-call-preview');
  if (!box) return;
  const key = rl.callPreview;
  if (!key) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const def = RouletteLogic.CALL_BETS[key];
  const input = document.getElementById('roulette-bet-input');
  const base = Math.floor(Number(input.value)) || 0;
  const chips = RouletteLogic.callBetChips(key);
  const total = base * chips;
  box.hidden = false;
  box.innerHTML = '';
  const title = document.createElement('strong');
  title.textContent = `${def.label} — ${chips} chips × ${formatChips(base)} = ${formatChips(total)}`;
  box.append(title);
  const covers = document.createElement('div');
  covers.className = 'call-numbers';
  covers.textContent = `Covers: ${def.numbers.join(', ')}`;
  box.append(covers);
  const list = document.createElement('ul');
  list.className = 'call-breakdown';
  for (const leg of def.legs) {
    const item = document.createElement('li');
    const legBet = { type: leg.type, value: leg.type === 'straight' ? leg.numbers[0] : [...leg.numbers] };
    item.textContent = `${RouletteLogic.describeBet(legBet).split(' — ')[0]} × ${leg.units} = ${formatChips(base * leg.units)}`;
    list.append(item);
  }
  box.append(list);
  const row = document.createElement('div');
  row.className = 'btn-row';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'btn btn-yallo';
  confirm.textContent = `PLACE ${def.label.toUpperCase()} (${formatChips(total)})`;
  confirm.addEventListener('click', confirmCallBet);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-ghost';
  cancel.textContent = 'CANCEL';
  cancel.addEventListener('click', () => {
    SoundManager.click();
    rl.callPreview = null;
    renderCallPreview();
    renderRouletteBets();
  });
  row.append(confirm, cancel);
  box.append(row);
}

function confirmCallBet() {
  const key = rl.callPreview;
  if (rl.spinning || !key || !RouletteLogic.CALL_BETS[key]) return;
  const def = RouletteLogic.CALL_BETS[key];
  const input = document.getElementById('roulette-bet-input');
  const check = validateBetAmount(input.value, balanceManager.get(), CASINO_CONFIG.minBet, CASINO_CONFIG.maxBet);
  if (!check.ok) {
    notify(check.reason, 'loss');
    return;
  }
  const chips = RouletteLogic.callBetChips(key);
  const total = check.amount * chips;
  if (!balanceManager.canAfford(total)) {
    notify(`${def.label} needs ${formatChips(total)} total. Insufficient balance.`, 'loss');
    return;
  }
  let legs;
  try {
    legs = RouletteLogic.expandCallBet(key, check.amount);
  } catch (error) {
    notify(error.message || 'Invalid call bet.', 'loss');
    return;
  }
  if (legs.some((leg) => leg.amount > CASINO_CONFIG.maxBet)) {
    notify(`Base chip too large: a multi-chip leg exceeds the max bet of ${CASINO_CONFIG.maxBet}.`, 'loss');
    return;
  }
  if (!balanceManager.deduct(total)) {
    notify('Insufficient balance for that call bet.', 'loss');
    return;
  }
  SoundManager.click();
  for (const leg of legs) {
    const legKey = RouletteLogic.betKey(leg);
    const existing = rl.bets.find((b) => RouletteLogic.betKey(b) === legKey && (b.group || '') === def.label);
    if (existing) existing.amount += leg.amount;
    else rl.bets.push({ type: leg.type, value: leg.value, amount: leg.amount, group: leg.group });
  }
  rl.callPreview = null;
  renderCallPreview();
  renderRouletteBets();
}

async function spinRoulette() {
  if (rl.spinning || rl.bets.length === 0) return;
  rl.spinning = true;
  renderRouletteBets();
  UIManager.setMessage('roulette', 'No more bets — spinning…', '');
  SoundManager.spin();
  // Result is predetermined before any animation runs.
  // Server-only: on any RNG failure the spin aborts with bets kept,
  // no balance change, no history entry and no fallback result.
  let winningNumber;
  try {
    winningNumber = await RandomAPI.randomIntegerStrict(0, 36);
  } catch (error) {
    console.warn('[Roulette] RNG unavailable, spin aborted:', error);
    rl.spinning = false;
    renderRouletteBets();
    UIManager.setMessage('roulette', 'RNG service unavailable — spin cancelled. Your bets are kept; try again.', 'loss');
    notify('RNG service unavailable. Spin cancelled — bets kept.', 'loss');
    return;
  }
  const wheel = document.getElementById('roulette-wheel');
  const track = document.getElementById('roulette-ball-track');
  const hub = document.getElementById('roulette-hub');
  const pocket = 360 / 37;
  // European wheel order around the rim (for a convincing landing position).
  const order = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const targetIndex = order.indexOf(winningNumber);
  const reduce = reducedMotion();
  const turns = reduce ? 1 : 5;
  rl.wheelRotation += turns * 360 + (360 - targetIndex * pocket - rl.wheelRotation % 360 + 360) % 360;
  rl.ballRotation -= (turns + 2) * 360 + targetIndex * pocket * 2;
  wheel.style.transitionDuration = reduce ? '0.4s' : '4s';
  track.style.transitionDuration = reduce ? '0.4s' : '4s';
  wheel.style.transform = `rotate(${rl.wheelRotation}deg)`;
  track.style.transform = `rotate(${rl.ballRotation}deg)`;
  await sleep(reduce ? 450 : 4200);
  hub.textContent = `${winningNumber}`;
  hub.style.background = winningNumber === 0 ? '#0a7a4e' : colorOf(winningNumber) === 'red' ? '#8e1f26' : '#161616';
  hub.style.color = '#fff';
  document.querySelectorAll('#roulette-numbers .num-btn').forEach((btn) => {
    btn.classList.toggle('winner', Number(btn.dataset.number) === winningNumber);
  });
  const { totalBet, totalPayout, result, details } = RouletteLogic.evaluateBets(rl.bets, winningNumber);
  const legSummary = details.map((d) => RouletteLogic.describeBet(d)).join(' · ');
  settleAndRecord({
    game: 'roulette', bet: totalBet, payout: totalPayout, result,
    detail: `number ${winningNumber} ${colorOf(winningNumber)} · ${legSummary}`
  });
  const profit = totalPayout - totalBet;
  if (result === 'win') {
    UIManager.setMessage('roulette', `WINNING NUMBER: ${winningNumber} (${colorOf(winningNumber)}). YOU WIN ${formatSigned(profit)} chips!`, 'win');
    SoundManager.win();
  } else if (result === 'push') {
    UIManager.setMessage('roulette', `WINNING NUMBER: ${winningNumber}. Push — stake returned.`, 'push');
  } else {
    UIManager.setMessage('roulette', `WINNING NUMBER: ${winningNumber} (${colorOf(winningNumber)}). YOU LOSE ${formatSigned(profit)} chips.`, 'loss');
    SoundManager.lose();
  }
  flashResult(document.querySelector('[data-page="roulette"] .felt-table, [data-page="roulette"] .panel'), result);
  rl.bets = [];
  rl.selection = [];
  rl.callPreview = null;
  renderCallPreview();
  rl.spinning = false;
  renderRouletteBets();
}

function initRoulette() {
  const grid = document.getElementById('roulette-numbers');
  grid.innerHTML = '';
  for (let n = 0; n <= 36; n++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `num-btn ${n === 0 ? 'green' : colorOf(n)}`;
    button.textContent = `${n}`;
    button.dataset.number = `${n}`;
    button.setAttribute('aria-label', `Bet on number ${n}`);
    button.addEventListener('click', () => toggleNumberSelection(n));
    grid.append(button);
  }
  document.querySelectorAll('#roulette-inside-modes .outside-btn').forEach((btn) => {
    if (btn.dataset.insideMode === 'straight') btn.classList.add('selected');
    btn.addEventListener('click', () => setInsideMode(btn.dataset.insideMode));
  });
  document.getElementById('roulette-place-inside').addEventListener('click', placeInsideBet);
  document.getElementById('roulette-clear-selection').addEventListener('click', clearSelection);
  document.querySelectorAll('#roulette-call-bets .outside-btn').forEach((btn) => {
    btn.addEventListener('click', () => previewCallBet(btn.dataset.callBet));
  });
  document.getElementById('roulette-bet-input').addEventListener('input', () => {
    if (rl.callPreview) renderCallPreview();
  });
  document.querySelectorAll('#roulette-outside .outside-btn').forEach((btn) => {
    btn.addEventListener('click', () => placeRouletteBet(btn.dataset.betType, btn.dataset.betValue ? Number(btn.dataset.betValue) : undefined));
  });
  document.getElementById('roulette-spin').addEventListener('click', () => { void spinRoulette(); });
  document.getElementById('roulette-clear').addEventListener('click', () => {
    if (rl.spinning || rl.bets.length === 0) return;
    SoundManager.click();
    const refund = rouletteCommitted();
    rl.bets = [];
    balanceManager.credit(refund);
    renderRouletteBets();
    UIManager.setMessage('roulette', 'Bets cleared and refunded.', 'push');
  });
  renderRouletteBets();
  gameManager.register('roulette', { name: 'Roulette', description: 'European wheel.', route: 'roulette', controller: rl });
}

// ---------- slots controller ----------

const sl = { spinning: false };

function renderPaytable() {
  const body = document.getElementById('slots-paytable');
  body.innerHTML = '';
  const entries = Object.entries(SLOTS_CONFIG.paytable).sort((a, b) => b[1] - a[1]);
  for (const [symbol, mult] of entries) {
    const row = document.createElement('tr');
    const glyph = glyphFor(symbol);
    row.innerHTML = `<td>${glyph} ${glyph} ${glyph}</td><td>${mult}×</td>`;
    body.append(row);
  }
  const pair = document.createElement('tr');
  pair.innerHTML = `<td>🍒 🍒 any</td><td>2×</td>`;
  body.append(pair);
}

function setReel(index, glyph, seven) {
  const reel = document.getElementById(`slot-reel-${index}`);
  reel.textContent = glyph;
  reel.classList.toggle('reel-seven', Boolean(seven));
}

async function spinSlots() {
  if (sl.spinning) return;
  const input = document.getElementById('slots-bet-input');
  const check = validateBetAmount(input.value, balanceManager.get(), CASINO_CONFIG.minBet, CASINO_CONFIG.maxBet);
  if (!check.ok) {
    notify(check.reason, 'loss');
    UIManager.setMessage('slots', check.reason, 'loss');
    return;
  }
  sl.spinning = true;
  const spinBtn = document.getElementById('slots-spin');
  spinBtn.disabled = true;
  document.getElementById('slots-banner').textContent = '';
  UIManager.setBetDisplay('slots', check.amount);
  if (!balanceManager.deduct(check.amount)) {
    notify('Insufficient balance.', 'loss');
    sl.spinning = false;
    spinBtn.disabled = false;
    return;
  }
  SoundManager.spin();
  UIManager.setMessage('slots', 'Spinning…', '');
  // Predetermined result first; animation only reveals it.
  const symbols = SlotLogic.spinReels((arr) => RandomAPI.sync.randomChoice(arr));
  const reduce = reducedMotion();
  const reels = [0, 1, 2].map((i) => document.getElementById(`slot-reel-${i}`));
  reels.forEach((r) => { r.classList.remove('win-reel'); r.classList.add('spinning'); });
  const glyphs = Object.values(SLOTS_CONFIG.glyphs);
  const stopAt = reduce ? [150, 250, 350] : [900, 1400, 1900];
  const timers = reels.map((reel, i) => {
    const interval = setInterval(() => {
      reel.textContent = glyphs[RandomAPI.sync.randomInteger(0, glyphs.length - 1)];
    }, 90);
    setTimeout(() => {
      clearInterval(interval);
      reel.classList.remove('spinning');
      setReel(i, glyphFor(symbols[i]), symbols[i] === '7');
      SoundManager.click();
    }, stopAt[i]);
    return interval;
  });
  void timers;
  await sleep(reduce ? 450 : 2000);
  const { result, payout, multiplier } = SlotLogic.settleSpin({ bet: check.amount, symbols });
  settleAndRecord({
    game: 'slots', bet: check.amount, payout, result,
    detail: symbols.map(glyphFor).join(' ')
  });
  const lastWin = document.getElementById('slots-last-win');
  if (result === 'win') {
    lastWin.textContent = `+${formatChips(payout)}`;
    const banner = document.getElementById('slots-banner');
    if (multiplier >= 25) {
      banner.textContent = multiplier >= 100 ? 'JACKPOT!' : 'BIG WIN!';
      banner.classList.remove('jackpot');
      void banner.offsetWidth;
      banner.classList.add('jackpot');
    } else {
      banner.textContent = 'WIN!';
    }
    reels.forEach((r) => r.classList.add('win-reel'));
    UIManager.setMessage('slots', `YOU WIN ${formatSigned(payout - check.amount)} chips (${multiplier}×)!`, 'win');
    SoundManager.win();
    flashResult(document.querySelector('[data-page="slots"] .slot-cabinet'), 'win');
  } else {
    lastWin.textContent = '—';
    UIManager.setMessage('slots', `No win — ${formatSigned(-check.amount)} chips. Spin again!`, 'loss');
    SoundManager.lose();
  }
  sl.spinning = false;
  spinBtn.disabled = false;
}

function initSlots() {
  renderPaytable();
  UIManager.setBetDisplay('slots', 0);
  document.getElementById('slots-spin').addEventListener('click', () => { void spinSlots(); });
  gameManager.register('slots', { name: 'Slots', description: 'Three reels.', route: 'slots', controller: sl });
}

// ---------- members' entrance gate ----------

function loadProfile() {
  return storageManager.loadJSON(
    STORAGE_KEYS.profile, null,
    (v) => v && typeof v === 'object' && typeof v.username === 'string' && v.verified === true
  );
}

function applyProfileChip(username) {
  const chip = document.getElementById('user-chip');
  const name = document.getElementById('user-name');
  if (chip && name) {
    name.textContent = username;
    chip.hidden = false;
  }
}

function resetGatePanels() {
  document.getElementById('gate-form').hidden = false;
  document.getElementById('gate-denied').hidden = true;
  document.getElementById('gate-welcome').hidden = true;
  const error = document.getElementById('gate-error');
  error.hidden = true;
  error.textContent = '';
}

function showGate() {
  const gate = document.getElementById('gate');
  resetGatePanels();
  gate.hidden = false;
  requestAnimationFrame(() => gate.classList.remove('gate-hidden'));
  document.body.classList.add('gated');
  setTimeout(() => {
    const input = document.getElementById('gate-username');
    if (input) input.focus();
  }, 80);
}

function hideGate() {
  const gate = document.getElementById('gate');
  gate.classList.add('gate-hidden');
  document.body.classList.remove('gated');
  setTimeout(() => { gate.hidden = true; }, reducedMotion() ? 50 : 550);
}

function gateError(message) {
  const error = document.getElementById('gate-error');
  error.textContent = message;
  error.hidden = false;
}

function resetIntroVideo() {
  const cinema = document.getElementById('intro-cinema');
  const video = document.getElementById('intro-video');
  if (!cinema || !video) return;
  try { video.pause(); } catch { /* nothing to stop */ }
  try { video.currentTime = 0; } catch { /* not loaded yet */ }
  cinema.classList.remove('cinema-fadeout');
  cinema.classList.add('cinema-hidden');
  cinema.hidden = true;
}

/**
 * Cinematic flow after successful verification:
 * gate fades -> intro video plays once -> "Welcome, [user]" -> casino.
 * Any video failure (missing file, blocked autoplay, stall) falls through
 * to the welcome message so the entrance can never get stuck.
 */
async function playIntroVideo(username) {
  const cinema = document.getElementById('intro-cinema');
  const video = document.getElementById('intro-video');
  hideGate();
  if (!cinema || !video) {
    showWelcomeThenEnter(username);
    return;
  }
  cinema.hidden = false;
  // Instant appearance at full opacity: no transition class is applied here.
  cinema.classList.remove('cinema-fadeout');
  requestAnimationFrame(() => cinema.classList.remove('cinema-hidden'));
  document.body.classList.add('gated');
  let finished = false;
  const safetyTimer = setTimeout(() => {
    console.warn('[Intro] video timed out, continuing to welcome.');
    finish();
  }, 90000);
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(safetyTimer);
    try { video.pause(); } catch { /* already stopped */ }
    // Cinematic handoff: the fade-out begins ONLY here, in the 'ended'
    // flow, while the welcome message and lobby music start immediately
    // underneath it, like a door slowly opening into the casino.
    if (reducedMotion()) {
      cinema.hidden = true;
    } else {
      cinema.classList.add('cinema-fadeout');
      setTimeout(() => {
        cinema.hidden = true;
        cinema.classList.remove('cinema-fadeout');
      }, 1250);
    }
    showWelcomeThenEnter(username);
  }
  if (video._introEndedHandler) video.removeEventListener('ended', video._introEndedHandler);
  video._introEndedHandler = finish;
  video.addEventListener('ended', finish);
  video.onerror = () => {
    console.warn('[Intro] video unavailable, skipping to welcome.');
    finish();
  };
  try { video.currentTime = 0; } catch { /* not loaded yet */ }
  video.loop = false;
  try {
    // Called from the form-submit gesture, so audible autoplay usually succeeds.
    await video.play();
  } catch (playError) {
    console.warn('[Intro] autoplay blocked, retrying muted:', playError);
    try {
      video.muted = true;
      await video.play();
    } catch (mutedError) {
      console.warn('[Intro] video cannot play, skipping to welcome:', mutedError);
      finish();
    }
  }
}

/** Reuses the gate card for the welcome beat, then glides into the casino. */
function showWelcomeThenEnter(username) {
  const gate = document.getElementById('gate');
  document.getElementById('gate-form').hidden = true;
  document.getElementById('gate-denied').hidden = true;
  document.getElementById('gate-welcome-text').textContent = `Welcome, ${username}.`;
  document.getElementById('gate-welcome').hidden = false;
  gate.hidden = false;
  requestAnimationFrame(() => gate.classList.remove('gate-hidden'));
  document.body.classList.add('gated');
  // The message starts appearing immediately (same tick as the video's
  // 'ended' event) and stays readable ~3.5s before gliding into the casino.
  // The lobby music starts in that same tick and plays underneath the
  // welcome message into the lobby.
  LobbyMusic.setEntranceReady();
  LobbyMusic.sync(currentRoute());
  setTimeout(hideGate, 3500);
}

function initGate() {
  const existing = loadProfile();
  if (existing) {
    // Returning member goes straight in — no ceremony, no flash.
    applyProfileChip(existing.username);
    LobbyMusic.setUser(existing.username);
    LobbyMusic.setEntranceReady();
    const gate = document.getElementById('gate');
    gate.hidden = true;
    gate.classList.add('gate-hidden');
    return;
  }
  showGate();
  document.getElementById('gate-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const username = document.getElementById('gate-username').value.trim();
    const age = Number(document.getElementById('gate-age').value.trim());
    if (!/^[A-Za-z0-9 _-]{2,20}$/.test(username)) {
      gateError('Please choose a username of 2–20 letters, numbers or spaces.');
      return;
    }
    if (!Number.isInteger(age) || age < 1 || age > 130) {
      gateError('Please enter a valid age.');
      return;
    }
    if (age < 18) {
      // Underage: remain on the gate behind the house message.
      SoundManager.lose();
      document.getElementById('gate-form').hidden = true;
      document.getElementById('gate-denied').hidden = false;
      return;
    }
    // Adult: persist the member, then run the cinematic entrance:
    // gate fades -> intro video plays once -> welcome -> casino.
    // Under-18 handling above is untouched: no video, no welcome, milk message only.
    storageManager.saveJSON(STORAGE_KEYS.profile, { username, verified: true });
    applyProfileChip(username);
    LobbyMusic.setUser(username);
    void playIntroVideo(username);
  });
  document.getElementById('gate-back').addEventListener('click', () => {
    SoundManager.click();
    resetGatePanels();
  });
  document.getElementById('settings-switch-user').addEventListener('click', async () => {
    const confirmed = await confirmModal({
      title: 'Switch user?',
      message: 'This signs out the current member. Balance and history stay on this device.',
      confirmLabel: 'Switch user'
    });
    if (!confirmed) return;
    storageManager.remove(STORAGE_KEYS.profile);
    resetIntroVideo();
    LobbyMusic.signOut();
    const chip = document.getElementById('user-chip');
    if (chip) chip.hidden = true;
    window.location.hash = '#/';
    showGate();
  });
}

// ---------- baccarat controller ----------

const bc = {
  state: BaccaratLogic.BACCARAT_STATES.BETTING,
  spot: 'player',
  bet: 0,
  busy: false,
  road: []
};

function bcElements() {
  return {
    playerHand: document.getElementById('bac-player-hand'),
    bankerHand: document.getElementById('bac-banker-hand'),
    playerScore: document.getElementById('bac-player-score'),
    bankerScore: document.getElementById('bac-banker-score'),
    betInput: document.getElementById('bac-bet-input'),
    state: document.getElementById('bac-state'),
    deal: document.getElementById('bac-deal'),
    newRound: document.getElementById('bac-new-round'),
    max: document.getElementById('bac-max'),
    clearBet: document.getElementById('bac-clear-bet'),
    table: document.getElementById('bac-table'),
    road: document.getElementById('bac-road'),
    spots: {
      player: document.getElementById('bac-spot-player'),
      banker: document.getElementById('bac-spot-banker'),
      tie: document.getElementById('bac-spot-tie')
    }
  };
}

function setBcState(state) {
  bc.state = state;
  const e = bcElements();
  e.state.textContent = state.replace('_', ' ');
  const betting = (state === BaccaratLogic.BACCARAT_STATES.BETTING ||
    state === BaccaratLogic.BACCARAT_STATES.ROUND_COMPLETE) && !bc.busy;
  e.deal.disabled = !betting;
  e.newRound.disabled = !(state === BaccaratLogic.BACCARAT_STATES.ROUND_COMPLETE && !bc.busy);
  e.max.disabled = bc.busy;
  e.clearBet.disabled = bc.busy;
  e.betInput.disabled = !betting;
  for (const spot of BaccaratLogic.BACCARAT_SPOTS) {
    e.spots[spot].disabled = !betting;
  }
  UIManager.setBetDisplay('baccarat', bc.bet);
}

function renderBcHands(playerCards, bankerCards) {
  const e = bcElements();
  e.playerHand.innerHTML = '';
  e.bankerHand.innerHTML = '';
  for (const card of playerCards) e.playerHand.append(renderCard(card, {}));
  for (const card of bankerCards) e.bankerHand.append(renderCard(card, {}));
  e.playerScore.textContent = playerCards.length ? `${BaccaratLogic.handTotal(playerCards)}` : '—';
  e.bankerScore.textContent = bankerCards.length ? `${BaccaratLogic.handTotal(bankerCards)}` : '—';
}

function renderBcRoad() {
  const road = document.getElementById('bac-road');
  road.innerHTML = '';
  if (bc.road.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'bead-empty';
    empty.textContent = 'No rounds yet';
    road.append(empty);
    return;
  }
  for (const winner of bc.road) {
    const bead = document.createElement('span');
    bead.className = `bead bead-${winner}`;
    bead.textContent = winner === 'player' ? 'P' : winner === 'banker' ? 'B' : 'T';
    bead.title = winner;
    road.append(bead);
  }
}

function bcResetTable(message = 'Pick a spot, set your bet, then press DEAL.') {
  const e = bcElements();
  e.playerHand.innerHTML = '';
  e.bankerHand.innerHTML = '';
  e.playerScore.textContent = '—';
  e.bankerScore.textContent = '—';
  for (const spot of BaccaratLogic.BACCARAT_SPOTS) e.spots[spot].classList.remove('spot-win');
  bc.bet = 0;
  UIManager.setMessage('baccarat', message, '');
  setBcState(BaccaratLogic.BACCARAT_STATES.BETTING);
}

function selectBcSpot(spot) {
  if (bc.busy || !(bc.state === BaccaratLogic.BACCARAT_STATES.BETTING ||
    bc.state === BaccaratLogic.BACCARAT_STATES.ROUND_COMPLETE)) return;
  SoundManager.click();
  bc.spot = spot;
  const e = bcElements();
  for (const s of BaccaratLogic.BACCARAT_SPOTS) e.spots[s].classList.toggle('selected', s === spot);
}

async function bcDeal() {
  if (bc.busy || !(bc.state === BaccaratLogic.BACCARAT_STATES.BETTING ||
    bc.state === BaccaratLogic.BACCARAT_STATES.ROUND_COMPLETE)) return;
  const e = bcElements();
  const check = validateBetAmount(e.betInput.value, balanceManager.get(), CASINO_CONFIG.minBet, CASINO_CONFIG.maxBet);
  if (!check.ok) {
    notify(check.reason, 'loss');
    UIManager.setMessage('baccarat', check.reason, 'loss');
    return;
  }
  bc.busy = true;
  setBcState(BaccaratLogic.BACCARAT_STATES.DEALING);
  UIManager.setMessage('baccarat', 'Dealing…', '');
  for (const s of BaccaratLogic.BACCARAT_SPOTS) e.spots[s].classList.remove('spot-win');
  let deducted = 0;
  try {
    // Real cards via the shared deck service (local fallback keeps play alive offline).
    const cards = await DeckAPI.drawCards(6);
    // Hands and winner are fully determined before the reveal animation starts.
    const round = BaccaratLogic.playRound(cards);
    if (!balanceManager.deduct(check.amount)) throw new Error('Insufficient balance.');
    deducted = check.amount;
    bc.bet = check.amount;
    UIManager.setBetDisplay('baccarat', bc.bet);
    const pause = reducedMotion() ? 60 : 400;
    // Reveal in true deal order: player, banker, player, banker, then thirds.
    const playerShown = [];
    const bankerShown = [];
    SoundManager.deal();
    playerShown.push(round.playerHand[0]);
    renderBcHands(playerShown, bankerShown);
    await sleep(pause);
    bankerShown.push(round.bankerHand[0]);
    renderBcHands(playerShown, bankerShown);
    await sleep(pause);
    SoundManager.deal();
    playerShown.push(round.playerHand[1]);
    renderBcHands(playerShown, bankerShown);
    await sleep(pause);
    bankerShown.push(round.bankerHand[1]);
    renderBcHands(playerShown, bankerShown);
    await sleep(pause);
    if (round.playerHand.length === 3) {
      UIManager.setMessage('baccarat', 'Player draws a third card…', '');
      await sleep(pause);
      playerShown.push(round.playerHand[2]);
      renderBcHands(playerShown, bankerShown);
      SoundManager.deal();
      await sleep(pause);
    }
    if (round.bankerHand.length === 3) {
      UIManager.setMessage('baccarat', 'Banker draws a third card…', '');
      await sleep(pause);
      bankerShown.push(round.bankerHand[2]);
      renderBcHands(playerShown, bankerShown);
      SoundManager.deal();
      await sleep(pause);
    }
    await bcSettle(round);
  } catch (error) {
    console.warn('[Baccarat] deal failed:', error);
    if (deducted > 0) balanceManager.credit(deducted);
    bcResetTable('Unable to deal right now. Stake refunded — please try again.');
  } finally {
    bc.busy = false;
    setBcState(bc.state === BaccaratLogic.BACCARAT_STATES.DEALING
      ? BaccaratLogic.BACCARAT_STATES.BETTING
      : bc.state);
  }
}

async function bcSettle(round) {
  const e = bcElements();
  setBcState(BaccaratLogic.BACCARAT_STATES.RESOLVING);
  const { result, payout } = BaccaratLogic.settleBet({ spot: bc.spot, bet: bc.bet, winner: round.winner });
  settleAndRecord({
    game: 'baccarat', bet: bc.bet, payout, result,
    detail: `${bc.spot} · P${round.playerTotal} B${round.bankerTotal}`
  });
  const winnerName = round.winner === 'tie' ? 'TIE' : round.winner.toUpperCase();
  const scoreLine = `Player ${round.playerTotal} — Banker ${round.bankerTotal}. ${winnerName} wins.`;
  const profit = payout - bc.bet;
  if (result === 'win') {
    UIManager.setMessage('baccarat', `${scoreLine} YOU WIN ${formatSigned(profit)} chips!`, 'win');
    SoundManager.win();
  } else if (result === 'loss') {
    UIManager.setMessage('baccarat', `${scoreLine} YOU LOSE ${formatSigned(profit)} chips.`, 'loss');
    SoundManager.lose();
  } else {
    UIManager.setMessage('baccarat', `${scoreLine} Push — stake returned.`, 'push');
    SoundManager.click();
  }
  e.spots[round.winner].classList.add('spot-win');
  flashResult(e.table, result);
  bc.road.unshift(round.winner);
  if (bc.road.length > 18) bc.road.length = 18;
  renderBcRoad();
  setBcState(BaccaratLogic.BACCARAT_STATES.ROUND_COMPLETE);
}

function initBaccarat() {
  const e = bcElements();
  e.spots.player.classList.add('selected');
  renderBcRoad();
  setBcState(BaccaratLogic.BACCARAT_STATES.BETTING);
  for (const spot of BaccaratLogic.BACCARAT_SPOTS) {
    e.spots[spot].addEventListener('click', () => selectBcSpot(spot));
  }
  e.deal.addEventListener('click', () => { SoundManager.click(); void bcDeal(); });
  e.newRound.addEventListener('click', () => { SoundManager.click(); bcResetTable(); });
  e.max.addEventListener('click', () => {
    SoundManager.click();
    e.betInput.value = Math.min(CASINO_CONFIG.maxBet, balanceManager.get());
  });
  e.clearBet.addEventListener('click', () => { SoundManager.click(); e.betInput.value = CASINO_CONFIG.minBet; });
  gameManager.register('baccarat', { name: 'Baccarat', description: 'Punto-banco table.', route: 'baccarat', controller: bc });
}

// ---------- history / stats / settings ----------

function refreshHistory() {
  const game = document.getElementById('history-game-filter').value;
  const result = document.getElementById('history-result-filter').value;
  UIManager.renderHistoryTable(document.getElementById('history-body'), historyManager.filter({ game, result }));
}

function refreshStats() {
  UIManager.renderStats(document.getElementById('stats-grid'), statisticsManager.get(), balanceManager.get());
}

function initMeta() {
  document.getElementById('history-game-filter').addEventListener('change', refreshHistory);
  document.getElementById('history-result-filter').addEventListener('change', refreshHistory);
  document.getElementById('history-clear').addEventListener('click', async () => {
    const confirmed = await confirmModal({ title: 'Clear history?', message: 'This erases all recorded rounds. Your balance is kept.', confirmLabel: 'Clear' });
    if (confirmed) {
      historyManager.clear();
      refreshHistory();
      notify('History cleared.', 'info');
    }
  });

  const settings = UIManager.loadSettings();
  // Animations are permanently enabled (no UI control exists); correct any
  // older stored value so the untouched animation path always stays active.
  settings.animations = 'on';
  // Game sound effects are permanently enabled (no UI control exists);
  // the volume slider below governs background music only.
  settings.sound = 'on';
  // Reduced motion has no UI control either; the animation system stays
  // permanently active (the OS-level preference is still honored by games).
  settings.reducedMotion = 'off';
  UIManager.saveSettings(settings);
  const volSlider = document.getElementById('setting-music-volume');
  const volLabel = document.getElementById('music-volume-value');
  const syncVolumeUI = () => {
    const percent = Math.round(LobbyMusic.getVolume() * 100);
    volSlider.value = percent;
    volLabel.textContent = `${percent}%`;
  };
  syncVolumeUI();
  // Music slider drives background music ONLY; game effects are untouched.
  volSlider.addEventListener('input', () => {
    LobbyMusic.setVolume(Number(volSlider.value) / 100);
    volLabel.textContent = `${volSlider.value}%`;
  });
  UIManager.applySettings(settings);

  document.getElementById('settings-reset-balance').addEventListener('click', async () => {
    const confirmed = await confirmModal({ title: 'Reset balance?', message: `Balance returns to ${formatChips(CASINO_CONFIG.startingBalance)} Virtual Chips. History and stats are kept.`, confirmLabel: 'Reset' });
    if (confirmed) {
      balanceManager.reset();
      notify('Balance reset to starting stack.', 'info');
    }
  });
  document.getElementById('settings-reset-all').addEventListener('click', async () => {
    const confirmed = await confirmModal({
      title: 'Reset casino data?',
      message: 'This erases balance, history, statistics and settings.',
      confirmLabel: 'Reset everything', danger: true
    });
    if (!confirmed) return;
    historyManager.clear();
    statisticsManager.reset();
    balanceManager.reset();
    DeckAPI.reset();
    UIManager.saveSettings({ sound: 'on', animations: 'on', reducedMotion: 'off', musicVolume: 0.18 });
    UIManager.applySettings({ sound: 'on', animations: 'on', reducedMotion: 'off' });
    SoundManager.setMuted(false);
    LobbyMusic.resetVolume();
    syncVolumeUI();
    bjResetTable();
    rl.bets = [];
    rl.selection = [];
    rl.callPreview = null;
    renderCallPreview();
    renderRouletteBets();
    bcResetTable();
    refreshHistory();
    refreshStats();
    openModal({ title: 'Fresh stack', body: `<p>New starting balance: <strong>${formatChips(CASINO_CONFIG.startingBalance)} Virtual Chips</strong>.</p>`, actions: [{ label: 'Play', kind: 'primary' }] });
  });
}

// ---------- boot ----------

function boot() {
  // 1. Load + validate persisted data (first visit gets safe defaults).
  balanceManager.load();
  historyManager.load();
  statisticsManager.load();
  const settings = UIManager.loadSettings();
  // Game sound effects are permanently enabled (no UI control exists).
  settings.sound = 'on';
  UIManager.saveSettings(settings);
  UIManager.applySettings(settings);
  SoundManager.setMuted(false);

  // 2. Render global state + build static UI.
  UIManager.updateBalanceDisplay(balanceManager.get());
  buildChipRow('bj-chips', 'bj-bet-input');
  buildChipRow('roulette-chips', 'roulette-bet-input');
  buildChipRow('slots-chips', 'slots-bet-input');
  buildChipRow('bac-chips', 'bac-bet-input');

  // 3. Register games and wire controllers.
  initBlackjack();
  initRoulette();
  initSlots();
  initBaccarat();
  initMeta();
  initGate();
  initRouter();

  // 4. Global sync: balance pill follows every game; deck fallback is user-visible.
  window.addEventListener('vc:balance', (event) => UIManager.updateBalanceDisplay(event.detail.balance));
  window.addEventListener('vc:deck-fallback', (event) => {
    notify(event.detail.reason || 'Card service unavailable. Local deck in use.', 'info', 4200);
    UIManager.setMessage('blackjack', 'Card service unreachable — local deck in use. Play continues.', 'push');
  });

  // 5. Defensive: block double-submit on Enter inside number inputs.
  $all('input[type="number"]').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
  });

  refreshHistory();
  refreshStats();
  console.info('[Casino] yalloen Velvet ready. Balance:', balanceManager.get());
}

document.addEventListener('DOMContentLoaded', boot);
