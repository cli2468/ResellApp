function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMessage(message) {
  return escapeHtml(message).replaceAll('\n', '<br>');
}

function ensureToastHost() {
  let host = document.getElementById('feedback-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'feedback-toast-host';
    host.className = 'feedback-toast-host';
    document.body.appendChild(host);
  }
  return host;
}

function closeToast(toast) {
  if (!toast || toast.dataset.closing === 'true') return;
  toast.dataset.closing = 'true';
  toast.classList.add('closing');
  setTimeout(() => toast.remove(), 220);
}

let activeDialog = null;
let activeDialogResolve = null;

function cleanupDialog(result = false) {
  if (activeDialogResolve) {
    activeDialogResolve(result);
  }
  if (activeDialog) {
    activeDialog.remove();
  }
  activeDialog = null;
  activeDialogResolve = null;
}

export function showToast(message, options = {}) {
  const {
    variant = 'info',
    duration = 3200,
    title = ''
  } = options;

  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `feedback-toast ${variant}`;
  toast.innerHTML = `
    <div class="feedback-toast-copy">
      ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="feedback-toast-close" type="button" aria-label="Dismiss notice">Close</button>
  `;

  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));

  const dismiss = () => closeToast(toast);
  toast.querySelector('.feedback-toast-close')?.addEventListener('click', dismiss);

  if (duration > 0) {
    window.setTimeout(dismiss, duration);
  }
}

export function showAlert(message, options = {}) {
  return showDialog({
    title: options.title || 'Notice',
    message,
    confirmLabel: options.confirmLabel || 'OK',
    tone: options.tone || 'default',
    showCancel: false
  });
}

export function confirmAction(options) {
  return showDialog({
    ...options,
    showCancel: true
  });
}

export function showDialog(options) {
  const {
    title = 'Notice',
    message = '',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    tone = 'default',
    showCancel = false
  } = options;

  if (activeDialog) {
    cleanupDialog(false);
  }

  return new Promise((resolve) => {
    activeDialogResolve = resolve;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay bottom-sheet feedback-dialog-overlay';
    overlay.innerHTML = `
      <div class="modal-content feedback-dialog ${tone === 'danger' ? 'danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
        <div class="feedback-dialog-icon">${tone === 'danger' ? '!' : 'i'}</div>
        <div class="feedback-dialog-body">
          <div class="feedback-dialog-eyebrow">${tone === 'danger' ? 'Please confirm' : 'Heads up'}</div>
          <h2 class="modal-title" id="feedback-dialog-title">${escapeHtml(title)}</h2>
          <p class="feedback-dialog-copy">${formatMessage(message)}</p>
        </div>
        <div class="feedback-dialog-actions">
          ${showCancel ? `<button class="btn btn-secondary" type="button" data-feedback-cancel>${escapeHtml(cancelLabel)}</button>` : ''}
          <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="button" data-feedback-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      if (!overlay.isConnected) {
        cleanupDialog(result);
        return;
      }

      overlay.classList.add('closing');
      setTimeout(() => cleanupDialog(result), 180);
      document.removeEventListener('keydown', keyHandler);
    };

    const keyHandler = (event) => {
      if (event.key === 'Escape') {
        close(false);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(false);
      }
    });

    overlay.querySelector('[data-feedback-cancel]')?.addEventListener('click', () => close(false));
    overlay.querySelector('[data-feedback-confirm]')?.addEventListener('click', () => close(true));

    document.addEventListener('keydown', keyHandler);
    document.body.appendChild(overlay);
    activeDialog = overlay;
    overlay.querySelector('[data-feedback-confirm]')?.focus();
  });
}
