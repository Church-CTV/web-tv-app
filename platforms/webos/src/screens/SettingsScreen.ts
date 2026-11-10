/**
 * Settings screen loader.
 */
import { renderSettingsScreen, type SettingsInfo } from '../ui/SettingsScreen';
import { showScreen } from './visibility';
import { getServerBaseUrl } from '@ctv/core';
import { APP_VERSION } from '../version';


/**
 * Build the church/channel metadata for the settings screen.
 * - channelName: persisted by HomeScreen from the feed provider name, with a
 *   fallback to the live overhang title (Roku SettingsScreen channelName).
 * - version: the app/channel version (Roku channelVersion).
 * - contentSource: the configured server base URL (Roku contentSourceUrl).
 * - givingUrl: the church donation URL encoded into the QR + link.
 */
function buildSettingsInfo(storage: { get(key: string): string | null }): SettingsInfo {
  const channelName =
    storage.get('ctv_channel_name') ||
    document.querySelector('.overhang-title')?.textContent?.trim() ||
    '';
  const contentSource = getServerBaseUrl(storage) || '';
  return {
    channelName,
    version: APP_VERSION,
    contentSource,
  };
}

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

  const el = renderSettingsScreen(buildSettingsInfo(storage));
  container.innerHTML = '';
  container.appendChild(el);
  showScreen('screen-settings');

  // Focus the first focusable control so a TV remote user lands somewhere
  // sensible (Roku settings SetFocus on first toggle row).
  const first = container.querySelector<HTMLElement>('.settings-option, .settings-give__link');
  first?.focus();
}
