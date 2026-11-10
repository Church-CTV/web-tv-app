/**
 * Preferences module — save/load user preferences to storage.
 * Supports layout, theme, and playback position preferences.
 */

const PREF_KEY_PREFIX = 'ctv_pref_';

export type LayoutPreference = 'leftnav' | 'grid';
export type ThemePreference = 'dark' | 'light' | 'auto';

export interface PreferencesStore {
  /** Get a preference value by key */
  get(key: string): string | null;
  /** Set a preference value by key */
  set(key: string, value: string): void;
  /** Remove a preference */
  remove(key: string): void;
  /** Get all preferences as a record */
  getAll(): Record<string, string>;
}

/**
 * Save a preference value
 */
export function savePreference(store: PreferencesStore, key: string, value: string): void {
  store.set(`${PREF_KEY_PREFIX}${key}`, value);
}

/**
 * Load a preference value
 */
export function loadPreference(store: PreferencesStore, key: string): string | null {
  return store.get(`${PREF_KEY_PREFIX}${key}`);
}

/**
 * Remove a preference
 */
export function removePreference(store: PreferencesStore, key: string): void {
  store.remove(`${PREF_KEY_PREFIX}${key}`);
}

/**
 * Get all preferences
 */
export function getAllPreferences(store: PreferencesStore): Record<string, string> {
  const all = store.getAll();
  const prefs: Record<string, string> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PREF_KEY_PREFIX)) {
      prefs[key.slice(PREF_KEY_PREFIX.length)] = value;
    }
  }
  return prefs;
}

/**
 * Set layout preference (leftnav or grid)
 */
export function setLayoutPreference(store: PreferencesStore, layout: LayoutPreference): void {
  savePreference(store, 'layout', layout);
}

/**
 * Get layout preference
 */
export function getLayoutPreference(store: PreferencesStore): LayoutPreference {
  const val = loadPreference(store, 'layout');
  if (val === 'leftnav' || val === 'grid') return val;
  return 'leftnav'; // default
}

/**
 * Set theme preference
 */
export function setThemePreference(store: PreferencesStore, theme: ThemePreference): void {
  savePreference(store, 'theme', theme);
}

/**
 * Get theme preference
 */
export function getThemePreference(store: PreferencesStore): ThemePreference {
  const val = loadPreference(store, 'theme');
  if (val === 'dark' || val === 'light' || val === 'auto') return val;
  return 'dark'; // default
}

/**
 * Set playback position for a video
 */
export function setPlaybackPosition(
  store: PreferencesStore,
  videoId: string,
  position: number
): void {
  savePreference(store, `playback_${videoId}`, String(position));
}

/**
 * Get playback position for a video
 */
export function getPlaybackPosition(store: PreferencesStore, videoId: string): number {
  const val = loadPreference(store, `playback_${videoId}`);
  return val ? Number(val) : 0;
}

/**
 * Set analytics share-usage preference (opt-in/out).
 */
export function setShareUsagePreference(store: PreferencesStore, enabled: boolean): void {
  savePreference(store, 'share_usage', enabled ? 'true' : 'false');
}

/**
 * Get analytics share-usage preference.
 * Privacy by default: returns false unless explicitly set to 'true'.
 */
export function getShareUsagePreference(store: PreferencesStore): boolean {
  return loadPreference(store, 'share_usage') === 'true';
}
