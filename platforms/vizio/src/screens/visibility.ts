import { pushScreen, getScreenStack, type ScreenName } from '../ui/Navigation';

const focusByScreen = new Map<string, HTMLElement>();

/**
 * Vizio screen visibility helpers — show/hide screen panels.
 */

export function showScreen(screenId: string): void {
  const current = getActiveScreenId();
  if (current === screenId) return;
  if (current && document.activeElement instanceof HTMLElement) {
    focusByScreen.set(current, document.activeElement);
  }
  const render = () => {
    activateScreen(screenId);
    const focus = focusByScreen.get(screenId);
    if (focus?.isConnected) focus.focus();
  };
  if (
    getScreenStack().length === 0 &&
    current &&
    current !== 'screen-loading' &&
    current !== screenId
  ) {
    pushScreen(current.replace('screen-', '') as ScreenName, () => {
      activateScreen(current);
      const focus = focusByScreen.get(current);
      if (focus?.isConnected) focus.focus();
    });
  }
  pushScreen(screenId.replace('screen-', '') as ScreenName, render);
}

function activateScreen(screenId: string): void {
  document.getElementById('app')?.classList.toggle('video-playing', screenId === 'screen-video');
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((s) => s.classList.remove('screen-active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('screen-active');
    if (document.activeElement instanceof HTMLElement && !target.contains(document.activeElement))
      document.activeElement.blur();
  }
}

export function hideScreen(screenId: string): void {
  const target = document.getElementById(screenId);
  if (target) target.classList.remove('screen-active');
}

/**
 * Return the id of the currently active screen (the one with screen-active).
 * Used by back/exit handling to know where we are. Mirrors the Tizen helper.
 */
export function getActiveScreenId(): string | null {
  const active = document.querySelector('.screen.screen-active');
  return active ? active.getAttribute('id') : null;
}
