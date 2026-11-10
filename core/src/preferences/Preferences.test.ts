/**
 * Preferences module tests — save/load, layout, theme, playback position.
 */

import { describe, it, expect } from 'vitest';
import {
  savePreference,
  loadPreference,
  removePreference,
  getAllPreferences,
  setLayoutPreference,
  getLayoutPreference,
  setThemePreference,
  getThemePreference,
  setPlaybackPosition,
  getPlaybackPosition,
} from './Preferences';

function makeMockStore() {
  const store: Record<string, string> = {};
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, val: string) => {
      store[key] = val;
    },
    remove: (key: string) => {
      delete store[key];
    },
    getAll: () => ({ ...store }),
  } as const;
}

describe('Preferences', () => {
  describe('savePreference / loadPreference', () => {
    it('saves and loads a preference', () => {
      const store = makeMockStore();
      savePreference(store, 'layout', 'grid');
      expect(loadPreference(store, 'layout')).toBe('grid');
    });

    it('returns null for non-existent preference', () => {
      const store = makeMockStore();
      expect(loadPreference(store, 'nonexistent')).toBeNull();
    });

    it('overwrites existing preference', () => {
      const store = makeMockStore();
      savePreference(store, 'layout', 'leftnav');
      savePreference(store, 'layout', 'grid');
      expect(loadPreference(store, 'layout')).toBe('grid');
    });
  });

  describe('removePreference', () => {
    it('removes a preference', () => {
      const store = makeMockStore();
      savePreference(store, 'layout', 'grid');
      removePreference(store, 'layout');
      expect(loadPreference(store, 'layout')).toBeNull();
    });
  });

  describe('getAllPreferences', () => {
    it('returns all preferences without prefix', () => {
      const store = makeMockStore();
      savePreference(store, 'layout', 'grid');
      savePreference(store, 'theme', 'dark');
      const prefs = getAllPreferences(store);
      expect(prefs).toEqual({ layout: 'grid', theme: 'dark' });
    });

    it('filters out non-pref keys', () => {
      const store = makeMockStore();
      store.set('ctv_pref_layout', 'grid');
      store.set('other_key', 'value');
      store.set('another', 'thing');
      const prefs = getAllPreferences(store);
      expect(prefs).toEqual({ layout: 'grid' });
    });
  });

  describe('setLayoutPreference / getLayoutPreference', () => {
    it('saves and retrieves leftnav layout', () => {
      const store = makeMockStore();
      setLayoutPreference(store, 'leftnav');
      expect(getLayoutPreference(store)).toBe('leftnav');
    });

    it('saves and retrieves grid layout', () => {
      const store = makeMockStore();
      setLayoutPreference(store, 'grid');
      expect(getLayoutPreference(store)).toBe('grid');
    });

    it('defaults to leftnav when no preference set', () => {
      const store = makeMockStore();
      expect(getLayoutPreference(store)).toBe('leftnav');
    });
  });

  describe('setThemePreference / getThemePreference', () => {
    it('saves and retrieves dark theme', () => {
      const store = makeMockStore();
      setThemePreference(store, 'dark');
      expect(getThemePreference(store)).toBe('dark');
    });

    it('saves and retrieves light theme', () => {
      const store = makeMockStore();
      setThemePreference(store, 'light');
      expect(getThemePreference(store)).toBe('light');
    });

    it('saves and retrieves auto theme', () => {
      const store = makeMockStore();
      setThemePreference(store, 'auto');
      expect(getThemePreference(store)).toBe('auto');
    });

    it('defaults to dark when no preference set', () => {
      const store = makeMockStore();
      expect(getThemePreference(store)).toBe('dark');
    });
  });

  describe('setPlaybackPosition / getPlaybackPosition', () => {
    it('saves and retrieves playback position', () => {
      const store = makeMockStore();
      setPlaybackPosition(store, 'video-1', 120);
      expect(getPlaybackPosition(store, 'video-1')).toBe(120);
    });

    it('returns 0 for unwatched video', () => {
      const store = makeMockStore();
      expect(getPlaybackPosition(store, 'video-unwatched')).toBe(0);
    });

    it('handles large position values', () => {
      const store = makeMockStore();
      setPlaybackPosition(store, 'video-long', 86400);
      expect(getPlaybackPosition(store, 'video-long')).toBe(86400);
    });
  });
});
