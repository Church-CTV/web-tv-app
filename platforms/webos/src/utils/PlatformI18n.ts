/**
 * WebOS platform i18n module — singleton wrapper around @ctv/core i18n.
 *
 * Creates a single shared i18n instance bound to the platform storage
 * (localStorage) so the selected locale persists across app restarts.
 */

import { createI18n, type I18nInstance, type Locale } from '@ctv/core/i18n/I18n';
import { createStorage } from '../modules/initStorage';

let instance: I18nInstance | null = null;

/**
 * Get (or lazily create) the platform i18n singleton.
 *
 * On first access, reads the stored locale from localStorage via
 * the platform storage adapter. Defaults to English if no preference set.
 *
 * @param forceStorage - Override storage instance (used in tests).
 */
export function getPlatformI18n(forceStorage?: {
  get(key: string): string | null;
  set(key: string, value: string): void;
}): I18nInstance {
  if (!instance) {
    const storage = forceStorage ?? createStorage();
    instance = createI18n(storage as never);
  }
  return instance;
}

/**
 * Change the platform locale and persist it.
 */
export function setPlatformLocale(locale: Locale): void {
  getPlatformI18n().setLocale(locale);
}

/**
 * Get the currently active platform locale.
 */
export function getPlatformLocale(): Locale {
  return getPlatformI18n().locale;
}

/**
 * Reset the singleton (test-only — clears the shared instance so it re-reads from storage).
 */
export function _resetPlatformI18n(): void {
  instance = null;
}
