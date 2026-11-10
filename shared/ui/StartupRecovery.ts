export function createStartupRecovery(
  start: () => Promise<void>,
  reset: () => void | Promise<void>
): () => Promise<void> {
  let pending: Promise<void> | null = null;
  let panel: HTMLElement | null = null;
  let retryButton: HTMLButtonElement | null = null;

  function clear(): void {
    document.removeEventListener('keydown', onKey, true);
    panel?.remove();
    panel = null;
    retryButton = null;
  }

  function show(error: unknown): void {
    clear();
    panel = document.createElement('section');
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'startup-recovery-title');
    panel.setAttribute('aria-describedby', 'startup-recovery-message');
    panel.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:#111;color:#fff;padding:8%;font-size:28px;overflow:auto';
    const title = document.createElement('h1');
    title.id = 'startup-recovery-title';
    title.textContent = 'Unable to start';
    const message = document.createElement('p');
    message.id = 'startup-recovery-message';
    message.textContent =
      `${error instanceof Error ? error.message : 'Startup failed.'} ` +
      'Startup has not completed. Press Enter to replace your saved server configuration with ' +
      'http://localhost:3000 and retry. If startup still fails, check your connection and try again.';
    retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.textContent = 'Use default server and retry';
    retryButton.style.cssText =
      'font:inherit;padding:20px;background:#fff;color:#111;border:4px solid #fff;outline:4px solid #6cf;outline-offset:6px';
    retryButton.addEventListener('click', retry);
    panel.append(title, message, retryButton);
    document.body.append(panel);
    document.addEventListener('keydown', onKey, true);
    retryButton.focus();
  }

  function run(withReset = false): Promise<void> {
    if (pending) return pending;
    if (retryButton) {
      retryButton.disabled = true;
      retryButton.textContent = 'Retrying…';
    }
    pending = Promise.resolve()
      .then(async () => {
        if (withReset) await reset();
        await start();
        clear();
      })
      .catch((error: unknown) => {
        show(error);
        throw error;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  function retry(): void {
    void run(true).catch(() => {});
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.keyCode === 13) {
      event.preventDefault();
      event.stopImmediatePropagation();
      retry();
    } else if (event.key === 'Tab' || event.key.startsWith('Arrow')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      retryButton?.focus();
    }
  }

  return () => run();
}
