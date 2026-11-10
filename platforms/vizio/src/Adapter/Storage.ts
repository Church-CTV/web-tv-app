/**
 * Vizio Storage Adapter — localStorage wrapper for core preferences, watch-later, continue-watching.
 */

import type { PreferencesStore } from '@ctv/core/preferences/Preferences';
import type { WatchLaterStore } from '@ctv/core/watch-later/WatchLater';
import type { ContinueWatchingStore } from '@ctv/core/continue-watching/ContinueWatching';
import type { CrashReporterStore } from '@ctv/core/crash-reporting/CrashReporter';

export function createStorageAdapter(): PreferencesStore &
  WatchLaterStore &
  ContinueWatchingStore &
  CrashReporterStore {
  return {
    get: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key: string, val: string) => {
      try {
        localStorage.setItem(key, val);
      } catch (e) {
        void e;
      }
    },
    remove: (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        void e;
      }
    },
    getAll: () => {
      const result: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) result[k] = localStorage.getItem(k) ?? '';
      }
      return result;
    },
  };
}
