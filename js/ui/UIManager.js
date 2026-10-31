// Thin DOM helpers owned by the UI layer: balance pill, routing, tables, settings.
import { CASINO_CONFIG, ROUTES, STORAGE_KEYS } from '../utils/constants.js';
import { formatChips, formatSigned, formatDateTime, resultLabel } from '../utils/formatters.js';
import { storageManager } from '../core/StorageManager.js';
import { pulse } from './AnimationManager.js';

export function updateBalanceDisplay(balance) {
  const nodes = document.querySelectorAll('[data-balance]');
  nodes.forEach((node) => {
    node.textContent = `${formatChips(balance)} ${CASINO_CONFIG.currencyShort}`;
    pulse(node.closest('.balance-pill') || node);
  });
  const navBalance = document.getElementById('nav-balance');
  if (navBalance) {
    navBalance.textContent = `${formatChips(balance)} ${CASINO_CONFIG.currencyShort}`;
    pulse(navBalance);
  }
}

export function setActivePage(route) {
  const current = ROUTES.includes(route) ? route : 'lobby';
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('active', page.dataset.page === current);
  });
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === current);
  });
  const titles = {
    lobby: 'Casino Lobby', blackjack: 'Blackjack', roulette: 'Roulette',
    slots: 'Slot Machine', baccarat: 'Baccarat',
    history: 'Game History', statistics: 'Statistics', settings: 'Settings'
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[current] || 'Casino';
}

export function setBetDisplay(scope, bet) {
  const node = document.querySelector(`[data-bet="${scope}"]`);
  if (node) node.textContent = `${formatChips(bet)} ${CASINO_CONFIG.currencyShort}`;
}

export function setMessage(scope, text, kind = '') {
  const node = document.querySelector(`[data-message="${scope}"]`);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

export function renderHistoryTable(tbody, records) {
  tbody.innerHTML = '';
  if (records.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="6" class="empty-cell">No rounds yet. Place a bet to make history.</td>';
    tbody.append(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement('tr');
    const profit = record.profit;
    row.innerHTML = `
      <td class="cap">${record.game}</td>
      <td class="num">${formatChips(record.bet)}</td>
      <td><span class="badge badge-${record.result}">${resultLabel(record.result)}</span></td>
      <td class="num ${profit >= 0 ? 'pos' : 'neg'}">${formatSigned(profit)}</td>
      <td class="num">${formatChips(record.balanceAfter)}</td>
      <td class="muted">${formatDateTime(record.timestamp)}${record.detail ? ` · ${record.detail}` : ''}</td>`;
    tbody.append(row);
  }
}

export function renderStats(grid, stats, balance) {
  const cards = [
    ['Current Balance', formatChips(balance)],
    ['Total Games', stats.totalGames],
    ['Won / Lost / Push', `${stats.wins} / ${stats.losses} / ${stats.pushes}`],
    ['Win Rate', `${stats.winRate}%`],
    ['Total Wagered', formatChips(stats.totalWagered)],
    ['Net Profit', formatSigned(stats.net)],
    ['Biggest Win', formatSigned(stats.biggestWin)],
    ['Biggest Loss', `−${formatChips(stats.biggestLoss)}`],
    ['Favorite Game', stats.favoriteGame],
    ['Blackjack Wins', `${stats.perGame.blackjack.won}/${stats.perGame.blackjack.played}`],
    ['Roulette Wins', `${stats.perGame.roulette.won}/${stats.perGame.roulette.played}`],
    ['Slots Wins', `${stats.perGame.slots.won}/${stats.perGame.slots.played}`],
    ['Baccarat Wins', `${stats.perGame.baccarat.won}/${stats.perGame.baccarat.played}`]
  ];
  grid.innerHTML = '';
  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
    grid.append(card);
  }
}

export function loadSettings() {
  return storageManager.loadJSON(
    STORAGE_KEYS.settings,
    { sound: 'on', animations: 'on', reducedMotion: 'off' },
    (v) => v && typeof v === 'object'
  );
}

export function saveSettings(settings) {
  storageManager.saveJSON(STORAGE_KEYS.settings, settings);
}

export function applySettings(settings) {
  document.body.dataset.animations = settings.animations === 'off' ? 'off' : 'on';
  document.body.dataset.reducedMotion = settings.reducedMotion === 'on' ? 'on' : 'off';
}

export const UIManager = {
  updateBalanceDisplay, setActivePage, setBetDisplay, setMessage,
  renderHistoryTable, renderStats, loadSettings, saveSettings, applySettings
};
