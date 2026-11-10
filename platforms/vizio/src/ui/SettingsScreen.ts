import type { SettingsStore } from '@ctv/shared/ui/SettingsScreen';
import { APP_VERSION } from '../version';
import { isUrlValidForEnvironment } from '@ctv/core/server-config/ServerConfig';
export * from '@ctv/shared/ui/SettingsScreen';

/** Roku product scope: channel information and local giving QR. */
export function renderSettingsScreen(store?: SettingsStore): string {
  const channel = store?.get('channelName') || 'Unconfigured channel';
  const escape = (value: string): string =>
    value.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    );
  const givingUrl = store?.get('givingUrl');
  const giving = givingUrl && !/[\s"'<>]/.test(givingUrl) && isUrlValidForEnvironment(givingUrl, true)
    ? `<h3>Give</h3><a class="settings-give__link" tabindex="0" href="${escape(givingUrl)}" target="_blank" rel="noopener noreferrer">${escape(givingUrl)}</a>`
    : '<p>Giving is not configured.</p>';
  return `<div class="settings-screen" id="settings-screen">
    <h2 class="settings-screen__title">Settings</h2>
    <section class="settings-channel-card"><h3 class="settings-channel__heading">Channel information</h3><div class="settings-channel"><p>Channel: ${escape(channel)}</p><p>Version: ${APP_VERSION}</p></div></section>
    ${giving}
  </div>`;
}
