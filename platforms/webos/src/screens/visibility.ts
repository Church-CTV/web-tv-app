/**
 * Screen visibility helpers — show/hide screen panels with fade transitions.
 * Mirrors Roku's screen transition pattern: fade in/out rather than instant swap.
 */

export function showScreen(screenId: string): void {
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((s) => {
    s.classList.remove('screen-active');
    // Reset any inline opacity left behind by a prior showScreen. Without this,
    // the previously-active screen keeps its inline `opacity: 1` (its CSS base
    // is `opacity: 0`), so it stays visible stacked behind the new screen
    // (e.g. the home grid showing through the search/settings screens).
    (s as HTMLElement).style.opacity = '';
    (s as HTMLElement).style.display = '';
  });

  const target = document.getElementById(screenId);
  if (!target) return;

  // Ensure display is block and set initial state
  (target as HTMLElement).style.display = 'block';
  (target as HTMLElement).style.opacity = '1';
  target.classList.add('screen-active');
}

export function hideScreen(screenId: string): void {
  const target = document.getElementById(screenId);
  if (!target) return;
  target.classList.remove('screen-active');
}

/**
 * Return the id of the currently active screen (the one with screen-active).
 * Used by back/exit handling to know where we are.
 */
export function getActiveScreenId(): string | null {
  const active = document.querySelector('.screen.screen-active');
  return active ? active.getAttribute('id') : null;
}

/**
 * Transition from one screen to another with crossfade.
 * Simulates Roku's screen transition pattern.
 */
export function transitionToScreen(fromId: string, toId: string, duration: number = 250): void {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);
  if (!from || !to) return;

  // Fade out current screen
  (from as HTMLElement).style.opacity = '0';
  from.classList.remove('screen-active');

  // Show target screen
  (to as HTMLElement).style.opacity = '1';
  (to as HTMLElement).style.display = 'block';
  to.classList.add('screen-active');

  // After transition, hide old screen fully
  setTimeout(() => {
    from.style.display = 'none';
    (from as HTMLElement).style.opacity = '';
  }, duration);
}

/**
 * Show a loading spinner while screen content is being fetched.
 */
export function showLoadingScreen(containerId: string, message: string = 'Loading...'): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="screen-loading"><div class="screen-loading__spinner"></div><p class="loading-message">${message}</p></div>`;
  showScreen(containerId);
}

/**
 * Clear loading state from a screen.
 */
export function clearLoadingScreen(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  const loading = container.querySelector('.screen-loading');
  if (loading) loading.remove();
}
