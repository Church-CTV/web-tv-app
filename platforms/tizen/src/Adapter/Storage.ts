/**
 * Tizen Storage Adapter — localStorage wrapper for core preferences, watch-later, continue-watching.
 */

import type { PreferencesStore } from '@ctv/core/preferences/Preferences';
import type { WatchLaterStore } from '@ctv/core/watch-later/WatchLater';
import type { ContinueWatchingStore } from '@ctv/core/continue-watching/ContinueWatching';
import type { CrashReporterStore } from '@ctv/core/crash-reporting/CrashReporter';

/**
 * Create a localStorage-backed store implementing all core store interfaces.
 */
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
    getAll: (): Record<string, string> => {
      const result: Record<string, string> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) result[k] = localStorage.getItem(k) ?? '';
        }
      } catch {
        // Enumeration can throw on a corrupt/quota-limited store; return whatever
        // was collected rather than letting the caller crash.
      }
      return result;
    },
  };
}
