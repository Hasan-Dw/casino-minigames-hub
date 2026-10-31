// Single reusable modal. Content injected per use; focus trapped lightly.
let backdrop = null;
let dialog = null;
let lastFocus = null;

function ensureShell() {
  if (backdrop) return;
  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h3 id="modal-title" class="modal-title"></h3>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>
    </div>`;
  document.body.append(backdrop);
  dialog = backdrop.querySelector('.modal');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (!backdrop.hidden && event.key === 'Escape') closeModal();
  });
}

export function openModal({ title, body, actions = [] }) {
  ensureShell();
  lastFocus = document.activeElement;
  dialog.querySelector('.modal-title').textContent = title || '';
  const bodyEl = dialog.querySelector('.modal-body');
  bodyEl.innerHTML = '';
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.append(body);
  const actionsEl = dialog.querySelector('.modal-actions');
  actionsEl.innerHTML = '';
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${action.kind === 'danger' ? 'btn-danger' : action.kind === 'primary' ? 'btn-yallo' : 'btn-ghost'}`;
    button.textContent = action.label;
    button.addEventListener('click', () => {
      if (typeof action.onClick === 'function') action.onClick();
      if (action.keepOpen !== true) closeModal();
    });
    actionsEl.append(button);
  }
  backdrop.hidden = false;
  document.body.classList.add('modal-open');
  const firstButton = actionsEl.querySelector('button');
  if (firstButton) firstButton.focus();
}

export function closeModal() {
  if (!backdrop) return;
  backdrop.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
}

export function confirmModal({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p>${message}</p>`,
      actions: [
        { label: 'Cancel', onClick: () => resolve(false) },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => resolve(true) }
      ]
    });
  });
}

export const ModalManager = { openModal, closeModal, confirmModal };
