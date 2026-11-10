/**
 * SettingsScreen — app settings with layout, theme, language, server URL, etc.
 */

import { getPlatformI18n } from '../utils/PlatformI18n';
import type { TranslationKey } from '@ctv/core/i18n/I18n';
import { isUrlValidForEnvironment } from '@ctv/core/server-config/ServerConfig';
import { createConfirmDialog, showConfirmDialog } from '@ctv/shared/ui/ConfirmDialog';

export interface SettingsStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAll(): Record<string, string>;
}

/**
 * Church / channel metadata shown on the settings screen (Roku
 * SettingsScreen channelName / channelVersion / contentSource labels).
 * Optional so existing no-arg callers (and tests) keep working.
 */
export interface SettingsInfo {
  channelName?: string;
  version?: string;
  contentSource?: string;
  /** Church donation URL, encoded into the QR asset + shown as a link. */
  givingUrl?: string;
}

/**
 * Render the full settings screen as an HTMLElement.
 * When `info` is provided, a Channel section (church name, version, content
 * source) is prepended and a Give section (donation link + QR code) is
 * appended, matching the Roku SettingsScreen.
 */
export function renderSettingsScreen(info?: SettingsInfo): HTMLElement {
  const container = document.createElement('div');
  container.className = 'settings-screen';
  container.id = 'settings-screen';
  // Stash the info on the element so the language-toggle re-render (which
  // re-invokes renderSettingsScreen) can preserve the channel/give sections.
  (container as HTMLElement & { __settingsInfo?: SettingsInfo }).__settingsInfo = info;

  const title = document.createElement('h2');
  title.className = 'settings-screen__title';
  title.textContent = 'Settings';
  container.appendChild(title);
  const channelCard = document.createElement('section');
  channelCard.className = 'settings-channel-card';
  const channelHeading = document.createElement('h3');
  channelHeading.className = 'settings-channel__heading';
  channelHeading.textContent = 'Channel information';
  channelCard.appendChild(channelHeading);
  const channel = document.createElement('div');
  channel.className = 'settings-channel';
  for (const [label, value] of [
    ['Channel', info?.channelName],
    ['Version', info?.version],
  ]) {
    if (!value) continue;
    const row = document.createElement('p');
    row.textContent = `${label}: ${value}`;
    channel.appendChild(row);
  }
  channelCard.appendChild(channel);
  container.appendChild(channelCard);

  if (info?.givingUrl && isUrlValidForEnvironment(info.givingUrl, true)) {
    const heading = document.createElement('h3');
    heading.textContent = 'Give';
    container.appendChild(heading);
    const link = document.createElement('a');
    link.className = 'settings-give__link';
    link.tabIndex = 0;
    link.href = info.givingUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = info.givingUrl;
    container.appendChild(link);
  }

  return container;
}

/**
 * Initialize settings screen interactivity.
 * @param onOptOutChange - called with the new share-usage state when the
 *   privacy checkbox is toggled (analytics on/off).
 */
export function initSettingsScreen(
  store: SettingsStore,
  onSave: () => void,
  onOptOutChange?: (enabled: boolean) => void
): void {
  bindSettingsHandlers(store, onSave, onOptOutChange);
  updateSettingsDisplay(store);
}

function bindSettingsHandlers(
  store: SettingsStore,
  onSave: () => void,
  onOptOutChange?: (enabled: boolean) => void
): void {
  const i18n = getPlatformI18n();

  // Make all options keyboard-activatable (D-pad Enter key)
  document.querySelectorAll('[data-setting]').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        el.dispatchEvent(new MouseEvent('click'));
      }
    });
    settingsHandlers.push({ el, handler: () => {} });
  });

  // Layout toggle
  const layoutEl = document.querySelector('[data-setting="layout"]') as HTMLElement | null;
  if (layoutEl) {
    const layoutHandler = () => {
      const current = loadLayout(store);
      const next = current === 'leftnav' ? 'grid' : 'leftnav';
      saveLayout(store, next);
      updateSettingsDisplay(store);
      onSave();
    };
    layoutEl.addEventListener('click', layoutHandler);
    settingsHandlers.push({ el: layoutEl, handler: layoutHandler });
  }

  // Theme toggle
  const themeEl = document.querySelector('[data-setting="theme"]') as HTMLElement | null;
  if (themeEl) {
    const themeHandler = () => {
      const current = loadTheme(store);
      const next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
      saveTheme(store, next);
      updateSettingsDisplay(store);
      onSave();
    };
    themeEl.addEventListener('click', themeHandler);
    settingsHandlers.push({ el: themeEl, handler: themeHandler });
  }

  // Language toggle (en ↔ es)
  const languageEl = document.querySelector('[data-setting="language"]') as HTMLElement | null;
  if (languageEl) {
    const languageHandler = () => {
      const current = i18n.locale;
      const next = current === 'en' ? 'es' : 'en';
      i18n.setLocale(next);
      // Re-render the settings screen so every label reflects the new locale,
      // then rebind handlers on the fresh DOM. Preserve the channel/give info
      // stashed on the previous container.
      const currentContainer = document.getElementById('settings-screen') as
        (HTMLElement & { __settingsInfo?: SettingsInfo }) | null;
      const preservedInfo = currentContainer?.__settingsInfo;
      if (currentContainer) {
        currentContainer.replaceWith(renderSettingsScreen(preservedInfo));
      }
      updateSettingsDisplay(store);
      cleanupSettingsScreen();
      bindSettingsHandlers(store, onSave);
    };
    languageEl.addEventListener('click', languageHandler);
    settingsHandlers.push({ el: languageEl, handler: languageHandler });
  }

  // Server URL
  const serverEl = document.querySelector('[data-setting="server-url"]') as HTMLElement | null;
  const serverInput = document.getElementById('server-url-input') as HTMLInputElement | null;
  if (serverEl && serverInput) {
    const serverClickHandler = () => {
      serverEl.style.display = 'none';
      serverInput.style.display = 'block';
      serverInput.value = loadServerUrl(store) || '/';
      serverInput.focus();
    };
    serverEl.addEventListener('click', serverClickHandler);
    settingsHandlers.push({ el: serverEl, handler: serverClickHandler });

    const blurHandler = () => {
      const url = serverInput.value.trim();
      if (url && isUrlValidForEnvironment(url, import.meta.env.PROD)) saveServerUrl(store, url);
      serverEl.style.display = 'block';
      serverInput.style.display = 'none';
      updateSettingsDisplay(store);
      onSave();
    };
    serverInput.addEventListener('blur', blurHandler);
    settingsHandlers.push({ el: serverInput, handler: blurHandler });

    serverInput.addEventListener('keydown', ((e: KeyboardEvent) => {
      if (e.key === 'Enter') serverInput.blur();
      if (e.key === 'Escape') {
        serverInput.value = '';
        serverInput.blur();
      }
    }) as EventListener);
    settingsHandlers.push({
      el: serverInput,
      handler: ((e?: Event) => {
        if (e && (e as KeyboardEvent).key === 'Enter') serverInput.blur();
        if (e && (e as KeyboardEvent).key === 'Escape') {
          serverInput.value = '';
          serverInput.blur();
        }
      }) as (e?: Event) => void,
    });
  }

  // Clear cache
  const clearEl = document.querySelector('[data-setting="clear-cache"]') as HTMLElement | null;
  if (clearEl) {
    const clearHandler = () => {
      // K4b: CTV-compatible confirmation (native confirm() doesn't render on webOS)
      const dialog = createConfirmDialog({
        title: i18n.t('settings.clear_cache'),
        message: i18n.t('settings.clear_cache_confirm'),
        confirmLabel: i18n.t('yes'),
        cancelLabel: i18n.t('no'),
      });
      showConfirmDialog(dialog, {
        onConfirm: () => {
          const keys = Object.keys(store.getAll());
          keys.forEach((k) => store.remove(k));
          updateSettingsDisplay(store);
        },
      });
    };
    clearEl.addEventListener('click', clearHandler);
    settingsHandlers.push({ el: clearEl, handler: clearHandler });
  }

  // Privacy: share-usage opt-out
  const optOutEl = document.querySelector(
    '[data-setting-checkbox="share-usage"]'
  ) as HTMLInputElement | null;
  if (optOutEl) {
    optOutEl.checked = loadShareUsage(store);
    if (onOptOutChange) {
      const optOutHandler = () => {
        saveShareUsage(store, optOutEl.checked);
        onOptOutChange(optOutEl.checked);
        onSave();
      };
      optOutEl.addEventListener('change', optOutHandler);
      settingsHandlers.push({ el: optOutEl, handler: optOutHandler as (e?: Event) => void });
    }
  }
}

/**
 * Remove all event listeners attached by initSettingsScreen.
 */
export function cleanupSettingsScreen(): void {
  settingsHandlers.forEach(({ el, handler }) => {
    el.removeEventListener('click', handler);
    el.removeEventListener('blur', handler);
    el.removeEventListener('keydown', handler);
  });
  settingsHandlers.length = 0;
}

const settingsHandlers: Array<{ el: EventTarget; handler: (e?: Event) => void }> = [];

function loadLayout(store: SettingsStore): string {
  return store.get('ctv_pref_layout') || 'leftnav';
}
function saveLayout(store: SettingsStore, val: string): void {
  store.set('ctv_pref_layout', val);
}
function loadTheme(store: SettingsStore): string {
  return store.get('ctv_pref_theme') || 'dark';
}
function saveTheme(store: SettingsStore, val: string): void {
  store.set('ctv_pref_theme', val);
}
function loadShareUsage(store: SettingsStore): boolean {
  return store.get('ctv_pref_share_usage') === 'true';
}
function saveShareUsage(store: SettingsStore, enabled: boolean): void {
  store.set('ctv_pref_share_usage', enabled ? 'true' : 'false');
}
function loadServerUrl(store: SettingsStore): string | null {
  const data = store.get('ctv_server_config');
  if (!data) return null;
  try {
    return JSON.parse(data).baseUrl;
  } catch {
    return null;
  }
}
function saveServerUrl(store: SettingsStore, url: string): void {
  const existing = loadServerUrl(store);
  const config = existing ? JSON.parse(existing) : {};
  store.set('ctv_server_config', JSON.stringify({ ...config, baseUrl: url, timeout: 15 }));
}

const THEME_KEY_MAP: Record<string, TranslationKey> = {
  dark: 'theme.dark',
  light: 'theme.light',
  auto: 'theme.auto',
};
const LAYOUT_KEY_MAP: Record<string, TranslationKey> = {
  leftnav: 'layout.leftnav',
  grid: 'layout.grid',
};

function localeDisplayName(locale: string): string {
  return locale === 'es' ? 'Español' : 'English';
}

function updateSettingsDisplay(store: SettingsStore): void {
  const i18n = getPlatformI18n();

  const layoutVal = document.getElementById('layout-value');
  if (layoutVal) {
    const current = loadLayout(store);
    layoutVal.textContent = i18n.t(LAYOUT_KEY_MAP[current] || 'layout.leftnav');
  }

  const themeVal = document.getElementById('theme-value');
  if (themeVal) {
    const current = loadTheme(store);
    themeVal.textContent = i18n.t(THEME_KEY_MAP[current] || 'theme.dark');
  }

  const languageVal = document.getElementById('language-value');
  if (languageVal) {
    languageVal.textContent = localeDisplayName(i18n.locale);
  }

  const serverVal = document.getElementById('server-url-value');
  if (serverVal) serverVal.textContent = loadServerUrl(store) || '/';
}
