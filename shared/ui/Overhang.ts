/**
 * Shared Overhang — app header bar (webOS native overhang equivalent).
 * Used by all three platforms (webOS, Tizen, Vizio).
 * Mirrors platforms/webos/src/ui/Overhang.ts API exactly.
 */

export interface OverhangConfig {
  title: string;
  logoUrl?: string;
  showBackButton?: boolean;
  actions?: Array<{ icon: string; label: string; action: string }>;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/**
 * Render the overhang/header bar as HTML string.
 */
export function renderOverhang(config: OverhangConfig): string {
  const logoHtml = config.logoUrl
    ? `<img class="overhang__logo" src="${escapeAttr(config.logoUrl)}" alt="${escapeHtml(config.title)}" />`
    : '';

  let actionsHtml = '';
  if (config.showBackButton) {
    actionsHtml +=
      '<button class="overhang__btn overhang__btn--back" id="overhang-back" tabindex="0">&#8592;</button>';
  }
  if (config.actions) {
    for (const action of config.actions) {
      actionsHtml += `<button class="overhang__btn" data-action="${escapeAttr(action.action)}" tabindex="0">${escapeHtml(action.icon)} ${escapeHtml(action.label)}</button>`;
    }
  }

  return `<header class="overhang" id="overhang">${logoHtml}<h1 class="overhang__title">${escapeHtml(config.title)}</h1><div class="overhang__actions">${actionsHtml}</div></header>`;
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
