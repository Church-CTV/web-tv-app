/**
 * LeftNav — Left sidebar navigation with category links.
 * Mirrors Roku's LeftNavScreen component.
 *
 * D-pad behavior lives in GridNav.ts (shared with the grid) so remote
 * navigation between the nav and the grid is spatial, not list-cycling (K2a).
 */

import { routeDpadKey } from './GridNav';

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

// Track button click handlers for cleanup.
// Entries are removed during cleanupLeftNav() to prevent unbounded
// growth across successive createLeftNav()/updateLeftNav() cycles.
const buttonClickHandlers = new Map<HTMLButtonElement, () => void>();

/**
 * Create a LeftNav component.
 * Renders a vertical sidebar with navigation items.
 * Returns the root element with a cleanup function to remove all
 * event listeners from navigation buttons.
 */
export function createLeftNav(props: LeftNavProps): HTMLDivElement & { cleanup: () => void } {
  const nav = document.createElement('nav') as HTMLDivElement;
  nav.className = 'left-nav';
  nav.setAttribute('aria-label', 'Main navigation');

  // Store button references for cleanup
  const buttons: HTMLButtonElement[] = [];

  // D-pad keydown handler (browser / E2E path): delegates to the shared
  // D-pad router (routeDpadKey) so the nav, the home grid, and every other
  // screen (Search, Settings, ...) all navigate with one spatial model.
  // On the home screen this routes grid<->nav bridging; elsewhere it runs the
  // TV-style spatial picker over the active screen.
  const onNavKeydown = (evt: Event) => {
    const e = evt as KeyboardEvent;
    const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const dir = dirMap[e.key];
    if (!dir) return;
    if (routeDpadKey(dir)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  nav.addEventListener('keydown', onNavKeydown);

  // Render each navigation item
  for (const item of props.items) {
    const button = document.createElement('button');
    button.className = 'left-nav__item';
    button.setAttribute('data-nav-id', item.id);
    button.setAttribute('aria-label', item.label);

    // Icon placeholder (could be SVG or icon font)
    const icon = document.createElement('span');
    icon.className = `left-nav__icon left-nav__icon--${item.icon}`;
    button.appendChild(icon);

    // Label
    const label = document.createElement('span');
    label.className = 'left-nav__label';
    label.textContent = item.label;
    button.appendChild(label);

    // Active state
    if (props.activeItem === item.id) {
      button.classList.add('left-nav__item--active');
      button.setAttribute('aria-current', 'page');
    }

    // Click handler
    const handler = () => {
      props.onItemClick(item);
    };
    button.addEventListener('click', handler);
    buttonClickHandlers.set(button, handler);

    buttons.push(button);
    nav.appendChild(button);
  }

  // Cleanup function
  const cleanup = () => {
    nav.removeEventListener('keydown', onNavKeydown);
    for (const button of buttons) {
      const handler = buttonClickHandlers.get(button);
      if (handler) {
        button.removeEventListener('click', handler);
        buttonClickHandlers.delete(button);
      }
    }
    buttons.length = 0;
  };

  return Object.assign(nav, { cleanup }) as HTMLDivElement & { cleanup: () => void };
}

/**
 * Remove all click event listeners from navigation buttons.
 * Call this before rebuilding the nav with updateLeftNav to prevent leaks.
 * Deletes handler entries from the global registry so that destroyed
 * buttons do not leave dangling references.
 */
export function cleanupLeftNav(nav: HTMLDivElement): void {
  const buttons = nav.querySelectorAll<HTMLButtonElement>('.left-nav__item');
  for (const button of buttons) {
    const handler = buttonClickHandlers.get(button);
    if (handler) {
      button.removeEventListener('click', handler);
      buttonClickHandlers.delete(button);
    }
  }
}

/**
 * Update an existing LeftNav with new data.
 * Cleans up existing event listeners before rebuilding.
 */
export function updateLeftNav(nav: HTMLDivElement, props: LeftNavProps): void {
  // Clean up existing listeners before rebuilding
  cleanupLeftNav(nav);

  // Clear existing items
  nav.innerHTML = '';

  // Re-render all items
  for (const item of props.items) {
    const button = document.createElement('button');
    button.className = 'left-nav__item';
    button.setAttribute('data-nav-id', item.id);
    button.setAttribute('aria-label', item.label);

    const icon = document.createElement('span');
    icon.className = `left-nav__icon left-nav__icon--${item.icon}`;
    button.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'left-nav__label';
    label.textContent = item.label;
    button.appendChild(label);

    if (props.activeItem === item.id) {
      button.classList.add('left-nav__item--active');
      button.setAttribute('aria-current', 'page');
    }

    const handler = () => {
      props.onItemClick(item);
    };
    button.addEventListener('click', handler);
    buttonClickHandlers.set(button, handler);

    nav.appendChild(button);
  }
}

/**
 * Focus the active navigation item.
 */
export function focusActiveItem(nav: HTMLDivElement): void {
  const activeItem = nav.querySelector('.left-nav__item--active') as HTMLElement;
  if (activeItem) {
    activeItem.focus();
  }
}

/**
 * Focus the first navigation item.
 */
export function focusFirstItem(nav: HTMLDivElement): void {
  const firstItem = nav.querySelector('.left-nav__item') as HTMLElement;
  if (firstItem) {
    firstItem.focus();
  }
}
