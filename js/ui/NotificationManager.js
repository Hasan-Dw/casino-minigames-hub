// Toast notifications. Text-first so color is never the only signal.
let region = null;

function ensureRegion() {
  if (region) return;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('aria-live', 'polite');
  document.body.append(region);
}

export function notify(message, type = 'info', durationMs = 3200) {
  ensureRegion();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  region.append(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, durationMs);
  while (region.children.length > 4) region.firstChild.remove();
}

export const NotificationManager = { notify };
