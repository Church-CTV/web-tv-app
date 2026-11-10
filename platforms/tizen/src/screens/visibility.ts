/**
 * Tizen screen visibility helpers — show/hide screen panels.
 * Left nav lives outside .screen so it stays visible on every screen
 * except fullscreen video.
 */

const SCREEN_TO_NAV: Record<string, string> = {
  'screen-grid': 'home',
  'screen-search': 'search',
  'screen-settings': 'settings',
};

export function showScreen(screenId: string): void {
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((s) => s.classList.remove('screen-active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('screen-active');

  const app = document.getElementById('app');
  if (app) {
    app.classList.toggle('video-playing', screenId === 'screen-video');
  }

  const nav = document.getElementById('left-nav');
  if (nav) {
    const hide = screenId === 'screen-video';
    nav.hidden = hide;
    nav.style.display = hide ? 'none' : 'flex';
    const activeId = SCREEN_TO_NAV[screenId];
    nav.querySelectorAll('.left-nav__item').forEach((el) => {
      const on = activeId !== undefined && el.getAttribute('data-nav-id') === activeId;
      el.classList.toggle('left-nav__item--active', on);
      if (on) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }
}

export function hideScreen(screenId: string): void {
  const target = document.getElementById(screenId);
  if (target) target.classList.remove('screen-active');
}

/**
 * Return the id of the currently active screen (the one with screen-active).
 * Used by back/exit handling to know where we are.
 */
export function getActiveScreenId(): string | null {
  const active = document.querySelector('.screen.screen-active');
  return active ? active.getAttribute('id') : null;
}
