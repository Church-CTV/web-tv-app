/**
 * Shared LeftNav — left sidebar navigation with category links.
 * Used by all three platforms (webOS, Tizen, Vizio).
 * Follows Tizen/Vizio renderLeftNav pattern (returns string).
 */

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  screen: string;
}

export interface LeftNavProps {
  items: NavItem[];
  activeItem?: string;
  onItemClick: (item: NavItem) => void;
  onBack?: () => void;
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
 * Render the left navigation as HTML string.
 */
export function renderLeftNav(props: LeftNavProps): string {
  let html = '<div class="left-nav-inner" aria-label="Main navigation">';
  for (const item of props.items) {
    const activeClass = props.activeItem === item.id ? ' left-nav__item--active' : '';
    const ariaCurrent = props.activeItem === item.id ? ' aria-current="page"' : '';
    html += `<button class="left-nav__item${activeClass}" data-nav-id="${escapeAttr(item.id)}" screen="${escapeAttr(item.screen)}" aria-label="${escapeAttr(item.label)}"${ariaCurrent} tabindex="0"><span class="left-nav__icon left-nav__icon--${escapeAttr(item.icon)}"></span><span class="left-nav__label">${escapeHtml(item.label)}</span></button>`;
  }
  html += '</div>';
  return html;
}

/**
 * Initialize left nav interactivity.
 */
export function initLeftNav(
  items: NavItem[],
  activeItem: string | undefined,
  onItemClick: (item: NavItem) => void
): void {
  const nav = document.getElementById('left-nav');
  if (!nav) return;

  const buttons = nav.querySelectorAll('.left-nav__item');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const navId = (button as HTMLElement).getAttribute('data-nav-id');
      if (!navId) return;
      const item = items.find((i) => i.id === navId);
      if (item) onItemClick(item);
    });
  });
}

export function focusActiveItem(nav: HTMLElement): void {
  const activeItem = nav.querySelector('.left-nav__item--active') as HTMLElement | null;
  if (activeItem) activeItem.focus();
}

export function focusFirstItem(nav: HTMLElement): void {
  const firstItem = nav.querySelector('.left-nav__item') as HTMLElement | null;
  if (firstItem) firstItem.focus();
}
