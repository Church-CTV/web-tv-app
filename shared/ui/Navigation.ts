/**
 * Shared Navigation — screen stack with push/pop/focus restore.
 * Used by all three platforms (webOS, Tizen, Vizio).
 * Mirrors platforms/webos/src/ui/Navigation.ts API exactly.
 */

export type ScreenName =
  | 'main'
  | 'grid'
  | 'search'
  | 'settings'
  | 'video'
  | 'schedule'
  | 'continue-watching'
  | 'watch-later'
  | 'content-detail'
  | 'error';

export interface ScreenEntry {
  name: ScreenName;
  render: () => void;
  onEnter?: () => void;
  onFocusRestore?: () => void;
}

const screenStack: ScreenEntry[] = [];
let focusedElementBeforePush: HTMLElement | null = null;

/**
 * Initialize the screen stack with the main screen.
 */
export function initNavigation(): void {
  if (screenStack.length === 0) {
    screenStack.push({
      name: 'main',
      render: () => {
        const container = document.getElementById('app-container');
        if (container) {
          container.innerHTML = '<div class="main-screen"><h1>Main Screen</h1></div>';
        }
      },
    });
  }
}

/**
 * Push a new screen onto the stack.
 * Saves current focus state for later restoration.
 */
export function pushScreen(
  name: ScreenName,
  render: () => void,
  onEnter?: () => void,
  onFocusRestore?: () => void
): void {
  focusedElementBeforePush = document.activeElement as HTMLElement | null;
  screenStack.push({ name, render, onEnter, onFocusRestore });
  render();
  if (onEnter) onEnter();
}

/**
 * Pop the current screen and restore the previous one.
 */
export function popScreen(): void {
  if (screenStack.length <= 1) return;
  screenStack.pop();
  const previous = screenStack[screenStack.length - 1];
  previous.render();
  if (focusedElementBeforePush && previous.onFocusRestore) {
    previous.onFocusRestore();
  }
  focusedElementBeforePush = null;
}

export function getCurrentScreen(): ScreenName {
  return screenStack.length > 0 ? screenStack[screenStack.length - 1].name : 'main';
}

export function canGoBack(): boolean {
  return screenStack.length > 1;
}

export function getScreenStack(): ScreenName[] {
  return screenStack.map((s) => s.name);
}

export function replaceScreen(name: ScreenName, render: () => void): void {
  if (screenStack.length > 0) {
    screenStack[screenStack.length - 1] = { name, render };
    render();
  }
}

export function clearStack(): void {
  screenStack.length = 0;
  focusedElementBeforePush = null;
}

export function reInitialize(): void {
  initNavigation();
}
