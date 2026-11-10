/**
 * Vizio settings screen loader.
 */

import { renderSettingsScreen } from '../ui/SettingsScreen';

export async function loadSettingsScreen(
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    getAll(): Record<string, string>;
  },
  _analytics?: { setOptOut: (enabled: boolean) => void } | null
): Promise<void> {
  const container = document.getElementById('screen-settings') as HTMLDivElement | null;
  if (!container) return;

  const el = renderSettingsScreen(storage);
  container.innerHTML = '';
  const elDiv = document.createElement('div');
  elDiv.innerHTML = typeof el === 'string' ? el : el;
  container.appendChild(elDiv);
  container.querySelector<HTMLAnchorElement>('.settings-give__link')?.focus();
}
