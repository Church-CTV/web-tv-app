/**
 * ConfirmDialog — CTV-compatible confirmation dialog.
 *
 * Replaces native `confirm()` which doesn't render on LG webOS, Samsung
 * Tizen, and Vizio SmartCast platforms. Uses HTML elements with proper
 * ARIA, focus management, and keyboard navigation for 10-foot UI.
 */

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmDialogCallbacks {
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ConfirmDialogResult {
  overlay: HTMLDivElement;
  dialog: HTMLDivElement;
  title: HTMLHeadingElement;
  message: HTMLParagraphElement;
  confirmBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  dispose: () => void;
}

let idCounter = 0;

/**
 * Create a confirm dialog element (not yet attached to DOM).
 */
export function createConfirmDialog(config: ConfirmDialogConfig): ConfirmDialogResult {
  const overlayId = `confirm-overlay-${++idCounter}`;
  const titleId = `confirm-title-${idCounter}`;
  const descId = `confirm-desc-${idCounter}`;

  // Overlay (backdrop)
  const overlay = document.createElement('div');
  overlay.className = 'confirm-dialog__overlay';
  overlay.id = overlayId;

  // Dialog container
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.setAttribute('aria-describedby', descId);

  // Title
  const title = document.createElement('h2');
  title.className = 'confirm-dialog__title';
  title.id = titleId;
  title.textContent = config.title;

  // Message
  const message = document.createElement('p');
  message.className = 'confirm-dialog__message';
  message.id = descId;
  message.textContent = config.message;

  // Buttons container
  const buttons = document.createElement('div');
  buttons.className = 'confirm-dialog__buttons';

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-dialog__btn confirm-dialog__btn--cancel';
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.tabIndex = 0;
  cancelBtn.textContent = config.cancelLabel || 'Cancel';

  // Confirm button
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-dialog__btn confirm-dialog__btn--confirm';
  confirmBtn.setAttribute('type', 'button');
  confirmBtn.tabIndex = 0;
  confirmBtn.textContent = config.confirmLabel || 'Confirm';

  buttons.appendChild(cancelBtn);
  buttons.appendChild(confirmBtn);

  dialog.appendChild(title);
  dialog.appendChild(message);
  dialog.appendChild(buttons);

  overlay.appendChild(dialog);

  return {
    overlay,
    dialog,
    title,
    message,
    confirmBtn,
    cancelBtn,
    dispose: () => {
      overlay.remove();
    },
  };
}

/**
 * Show a confirm dialog. Returns the dialog result for later disposal.
 */
export function showConfirmDialog(
  result: ConfirmDialogResult,
  callbacks: ConfirmDialogCallbacks = {}
): ConfirmDialogResult {
  const { onConfirm, onCancel } = callbacks;

  // Remove any existing confirm dialogs
  document.querySelectorAll('.confirm-dialog__overlay').forEach((el) => el.remove());

  // Add to DOM
  document.body.appendChild(result.overlay);

  // Focus the confirm button by default
  result.confirmBtn.focus();

  // Click handlers
  const onConfirmClick = () => {
    onConfirm?.();
    // Cleanup
    document.removeEventListener('keydown', keydownHandler);
    result.dispose();
  };

  const onCancelClick = () => {
    onCancel?.();
    // Cleanup
    document.removeEventListener('keydown', keydownHandler);
    result.dispose();
  };

  result.confirmBtn.addEventListener('click', onConfirmClick);
  result.cancelBtn.addEventListener('click', onCancelClick);

  // Keydown handler for Escape and Tab focus trap
  const keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancelClick();
    } else if (e.key === 'Tab') {
      // Focus trap: keep focus within dialog buttons
      e.preventDefault();
      const current = document.activeElement;
      if (current === result.confirmBtn) {
        result.cancelBtn.focus();
      } else if (current === result.cancelBtn) {
        result.confirmBtn.focus();
      } else {
        result.confirmBtn.focus();
      }
    }
  };

  document.addEventListener('keydown', keydownHandler);

  return result;
}

/**
 * Dispose a confirm dialog (remove from DOM).
 */
export function disposeConfirmDialog(result: ConfirmDialogResult): void {
  result.dispose();
}
