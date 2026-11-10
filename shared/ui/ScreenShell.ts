/**
 * Shared ScreenShell — screen wrapper with header, body, and footer.
 * Used by all three platforms (webOS, Tizen, Vizio).
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ScreenShellProps {
  title: string;
  bodyHtml: string;
  backLabel?: string;
}

export function renderScreenShell(title: string, bodyHtml: string): string {
  return `<div class="screen-shell" id="screen-shell">
    <header class="screen-shell__header">
      <h1 class="screen-shell__title">${escapeHtml(title)}</h1>
    </header>
    <main class="screen-shell__body">
      ${bodyHtml}
    </main>
    <footer class="screen-shell__footer"></footer>
  </div>`;
}

export function initScreenShell(container: HTMLDivElement, props: ScreenShellProps): void {
  container.innerHTML = renderScreenShell(props.title, props.bodyHtml);
}

export function setShellTitle(container: HTMLDivElement, title: string): void {
  const header = container.querySelector('.screen-shell__title') as HTMLElement | null;
  if (header) header.textContent = title;
}
