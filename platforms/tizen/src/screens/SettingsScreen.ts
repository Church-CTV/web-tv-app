/** Roku Settings: channel information and a local giving QR. */
import { renderSettingsScreen } from '../ui/SettingsScreen';
import type { SettingsStore } from '@ctv/shared/ui/SettingsScreen';

export async function loadSettingsScreen(
  storage: SettingsStore,
  _analytics?: { setOptOut: (enabled: boolean) => void } | null
): Promise<void> {
  const container = document.getElementById('screen-settings');
  if (!container) return;
  container.innerHTML = renderSettingsScreen(storage);
  container.querySelector<HTMLAnchorElement>('.settings-give__link')?.focus();
}
