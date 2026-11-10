/**
 * G2 Privacy - Core Preferences share-usage tests
 *
 * Verifies:
 * 1. getShareUsagePreference defaults to false (privacy by default)
 * 2. set/get round-trip
 * 3. Value persisted under ctv_pref_share_usage
 */

import { describe, it, expect } from 'vitest';
import {
  getShareUsagePreference,
  setShareUsagePreference,
  type PreferencesStore,
} from './Preferences';

function makeStore(): PreferencesStore {
  const data: Record<string, string> = {};
  return {
    get: (k) => data[k] ?? null,
    set: (k, v) => {
      data[k] = v;
    },
    remove: (k) => {
      delete data[k];
    },
    getAll: () => ({ ...data }),
  };
}

describe('G2 Privacy - share-usage preference', () => {
  it('defaults to false (privacy by default) when unset', () => {
    expect(getShareUsagePreference(makeStore())).toBe(false);
  });

  it('returns true after setShareUsagePreference(true)', () => {
    const store = makeStore();
    setShareUsagePreference(store, true);
    expect(getShareUsagePreference(store)).toBe(true);
  });

  it('returns false after setShareUsagePreference(false)', () => {
    const store = makeStore();
    setShareUsagePreference(store, true);
    setShareUsagePreference(store, false);
    expect(getShareUsagePreference(store)).toBe(false);
  });

  it('persists under ctv_pref_share_usage', () => {
    const store = makeStore();
    setShareUsagePreference(store, true);
    expect(store.get('ctv_pref_share_usage')).toBe('true');
  });

  it('tolerates stale/invalid stored values (returns false)', () => {
    const store = makeStore();
    store.set('ctv_pref_share_usage', 'yes');
    expect(getShareUsagePreference(store)).toBe(false);
  });
});
