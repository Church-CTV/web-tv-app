/**
 * Overhang — app header bar at top (webOS native overhang equivalent).
 */

import { escapeHtml, escapeAttr } from '../utils/HtmlEscape';

export interface OverhangConfig {
  title: string;
  logoUrl?: string;
  showBackButton?: boolean;
  actions?: Array<{ icon: string; label: string; action: string }>;
}

/**
 * Render the overhang/header bar.
 */
export function renderOverhang(config: OverhangConfig): string {
  const logoHtml = config.logoUrl
    ? `<img class="overhang__logo" src="${escapeAttr(config.logoUrl)}" alt="${escapeHtml(config.title)}" />`
    : '';

  let actionsHtml = '';
  if (config.showBackButton) {
    actionsHtml +=
      '<button class="overhang__btn overhang__btn--back" id="overhang-back" tabindex="0">←</button>';
  }
  if (config.actions) {
    for (const action of config.actions) {
      actionsHtml += `<button class="overhang__btn" data-action="${escapeAttr(action.action)}" tabindex="0">${escapeHtml(action.icon)} ${escapeHtml(action.label)}</button>`;
    }
  }

  return `
    <header class="overhang" id="overhang">
      ${logoHtml}
      <h1 class="overhang__title">${escapeHtml(config.title)}</h1>
      <div class="overhang__actions">${actionsHtml}</div>
    </header>
  `;
}

/**
 * Wire up overhang button clicks.
 */
export function initOverhang(onBack?: () => void, _onAction?: (action: string) => void): void {
  const backBtn = document.getElementById('overhang-back');
  if (backBtn && onBack) {
    backBtn.addEventListener('click', onBack);
  }
}

export function formatOverhangClock(now: Date): string {
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
}
