// Presentation formatting. No game logic here.
const chipFormatter = new Intl.NumberFormat('en-US');

export function formatChips(amount) {
  const n = Number.isFinite(Number(amount)) ? Math.floor(Number(amount)) : 0;
  return `${chipFormatter.format(n)}`;
}

export function formatSigned(amount) {
  const n = Number.isFinite(Number(amount)) ? Math.floor(Number(amount)) : 0;
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${chipFormatter.format(Math.abs(n))}`;
}

export function formatDateTime(isoString) {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export function resultLabel(result) {
  if (result === 'win') return 'WIN';
  if (result === 'loss') return 'LOSS';
  return 'PUSH';
}
