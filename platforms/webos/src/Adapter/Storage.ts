/**
 * WebOS Storage Adapter — localStorage wrapper for core preferences, watch-later, continue-watching.
 */

import type { PreferencesStore } from '@ctv/core/preferences/Preferences';
import type { WatchLaterStore } from '@ctv/core/watch-later/WatchLater';
import type { ContinueWatchingStore } from '@ctv/core/continue-watching/ContinueWatching';
import type { CrashReporterStore } from '@ctv/core/crash-reporting/CrashReporter';

/**
 * Create a storage adapter from window.localStorage
 * Implements all store interfaces used by core modules.
 */
export function createStorageAdapter(): PreferencesStore &
  WatchLaterStore &
  ContinueWatchingStore &
  CrashReporterStore {
  return {
    get: (key: string): string | null => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key: string, value: string): void => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage full */
      }
    },
    remove: (key: string): void => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage error */
      }
    },
    getAll: (): Record<string, string> => {
      const result: Record<string, string> = {};
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) result[key] = window.localStorage.getItem(key) ?? '';
        }
      } catch {
        /* storage error */
      }
      return result;
    },
  };
}
