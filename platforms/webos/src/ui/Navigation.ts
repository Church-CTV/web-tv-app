/**
 * Navigation — screen stack with push/pop/focus restore.
 * Manages the screen lifecycle and preserves focus state during navigation.
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
  // Save current focused element
  focusedElementBeforePush = document.activeElement as HTMLElement | null;

  screenStack.push({ name, render, onEnter, onFocusRestore });
  render();

  // Call onEnter if provided
  if (onEnter) onEnter();
}

/**
 * Pop the current screen and restore the previous one.
 * Restores focus to the saved element.
 */
export function popScreen(): void {
  if (screenStack.length <= 1) return;

  // Restore previous screen
  screenStack.pop();
  const previous = screenStack[screenStack.length - 1];
  previous.render();

  // Restore focus
  if (focusedElementBeforePush && previous.onFocusRestore) {
    previous.onFocusRestore();
  }
  focusedElementBeforePush = null;
}

/**
 * Get the current screen name.
 */
export function getCurrentScreen(): ScreenName {
  return screenStack.length > 0 ? screenStack[screenStack.length - 1].name : 'main';
}

/**
 * Check if we can go back.
 */
export function canGoBack(): boolean {
  return screenStack.length > 1;
}

/**
 * Get the full screen stack for debugging.
 */
export function getScreenStack(): ScreenName[] {
  return screenStack.map((s) => s.name);
}

/**
 * Replace the current screen without adding to stack (for transitions).
 */
export function replaceScreen(name: ScreenName, render: () => void): void {
  if (screenStack.length > 0) {
    screenStack[screenStack.length - 1] = { name, render };
    render();
  }
}

/**
 * Clear all screens.
 */
export function clearStack(): void {
  screenStack.length = 0;
  focusedElementBeforePush = null;
}

/**
 * Re-initialize the screen stack with the main screen.
 * Call this after clearStack() to restore the initial state.
 */
export function reInitialize(): void {
  initNavigation();
}
