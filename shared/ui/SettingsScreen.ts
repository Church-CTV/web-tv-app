/**
 * Shared SettingsScreen — app settings with layout, theme, server URL, cache toggles,
 * and privacy (analytics opt-out) section.
 * Pure render/init: no @ctv/core imports, no platform SDKs.
 */

import { createConfirmDialog, showConfirmDialog } from './ConfirmDialog';

export interface SettingsStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAll(): Record<string, string>;
}

export const PRIVACY_STORAGE_KEY = 'ctv_pref_share_usage';

/**
 * Read the analytics share-usage flag from the store.
 * Returns true (share on) when the stored value is 'true'.
 * Privacy by default: unset means opted-out.
 */
export function loadShareUsage(store: SettingsStore): boolean {
  return store.get(PRIVACY_STORAGE_KEY) === 'true';
}

/**
 * Persist the analytics share-usage flag to the store.
 */
export function saveShareUsage(store: SettingsStore, enabled: boolean): void {
  store.set(PRIVACY_STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Render the privacy section HTML.
 */
export function renderPrivacySection(shareUsage: boolean): string {
  const checked = shareUsage ? 'checked' : '';
  return `<div class="settings-section settings-section--privacy" id="settings-privacy">
      <h3 class="settings-section__title">Privacy</h3>
      <div class="settings-option" data-setting="share-usage" tabindex="0">
        <label class="settings-option__label" for="setting-optout" id="setting-optout-label">Share Usage Data</label>
        <input type="checkbox" id="setting-optout" data-setting-checkbox="share-usage" ${checked} />
      </div>
      <p class="settings-option__desc" id="setting-optout-desc">
        Help improve the app by sharing anonymous usage and error reports.
        No personal data is collected.
      </p>
    </div>`;
}

/**
 * Render the full settings screen HTML.
 * @param store - optional store; when provided, privacy section reflects stored preference
 */
export function renderSettingsScreen(store?: SettingsStore): string {
  const privacyHtml = store ? renderPrivacySection(loadShareUsage(store)) : '';
  return `<div class="settings-screen" id="settings-screen">
    <h2 class="settings-screen__title">Settings</h2>
    <div class="settings-section">
      <h3 class="settings-section__title">Appearance</h3>
      <div class="settings-option" data-setting="layout" tabindex="0">
        <span class="settings-option__label">Layout</span>
        <span class="settings-option__value" id="layout-value">Left Nav</span>
      </div>
      <div class="settings-option" data-setting="theme" tabindex="0">
        <span class="settings-option__label">Theme</span>
        <span class="settings-option__value" id="theme-value">Dark</span>
      </div>
    </div>
    <div class="settings-section">
      <h3 class="settings-section__title">Server</h3>
      <div class="settings-option" data-setting="server-url" tabindex="0">
        <span class="settings-option__label">Server URL</span>
        <span class="settings-option__value" id="server-url-value">/</span>
      </div>
    </div>
    <div class="settings-section">
      <h3 class="settings-section__title">Data</h3>
      <div class="settings-option settings-option--danger" data-setting="clear-cache" tabindex="0">
        <span class="settings-option__label">Clear Cache</span>
        <span class="settings-option__value">Clear all cached data</span>
      </div>
    </div>
    ${privacyHtml}
  </div>`;
}

/**
 * Initialize settings screen interactivity.
 * @param onOptOutChange - called with the new share-usage state when the
 *   privacy checkbox is toggled. When omitted, the privacy section is not
 *   rendered and no handler is bound (backward compatible).
 */
export function initSettingsScreen(
  store: SettingsStore,
  onSave: () => void,
  onOptOutChange?: (enabled: boolean) => void
): void {
  const layoutEl = document.querySelector('[data-setting="layout"]') as HTMLElement | null;
  if (layoutEl) {
    layoutEl.addEventListener('click', () => {
      const current = store.get('ctv_pref_layout') || 'leftnav';
      const next = current === 'leftnav' ? 'grid' : 'leftnav';
      store.set('ctv_pref_layout', next);
      onSave();
    });
  }

  const themeEl = document.querySelector('[data-setting="theme"]') as HTMLElement | null;
  if (themeEl) {
    themeEl.addEventListener('click', () => {
      const current = store.get('ctv_pref_theme') || 'dark';
      const next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
      store.set('ctv_pref_theme', next);
      onSave();
    });
  }

  const clearEl = document.querySelector('[data-setting="clear-cache"]') as HTMLElement | null;
  if (clearEl) {
    clearEl.addEventListener('click', () => {
      // K4b: CTV-compatible confirmation (native confirm doesn't render on CTV)
      const dialog = createConfirmDialog({
        title: 'Clear Cache',
        message: 'Clear all cached data?',
        confirmLabel: 'Clear',
        cancelLabel: 'Cancel',
      });
      showConfirmDialog(dialog, {
        onConfirm: () => {
          const keys = Object.keys(store.getAll());
          keys.forEach((k) => store.remove(k));
        },
      });
    });
  }

  if (onOptOutChange) {
    const optOutEl = document.querySelector(
      '[data-setting-checkbox="share-usage"]'
    ) as HTMLInputElement | null;
    if (optOutEl && !optOutEl.hasAttribute('data-callback-bound')) {
      optOutEl.addEventListener('change', () => {
        saveShareUsage(store, optOutEl.checked);
        onOptOutChange(optOutEl.checked);
      });
      optOutEl.setAttribute('data-callback-bound', 'true');
    }
  }
}
