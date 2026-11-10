/**
 * G2 Privacy - Shared Settings UI tests
 *
 * Verifies:
 * 1. Privacy section renders with the share-usage checkbox
 * 2. Toggling the checkbox invokes onOptOutChange with the new state
 * 3. Checkbox reflects stored preference
 * 4. Privacy section omitted when onOptOutChange not provided (backward compat)
 * 5. loadShareUsage/saveShareUsage work with the correct storage key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderSettingsScreen,
  renderPrivacySection,
  initSettingsScreen,
  loadShareUsage,
  saveShareUsage,
  PRIVACY_STORAGE_KEY,
  type SettingsStore,
} from './SettingsScreen';

function makeStore(initial: Record<string, string> = {}): SettingsStore {
  const data: Record<string, string> = { ...initial };
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

describe('G2 Privacy - Shared Settings UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a privacy section with the share-usage checkbox when store is provided', () => {
    const html = renderSettingsScreen(makeStore());
    expect(html).toContain('settings-privacy');
    expect(html).toContain('setting-optout');
  });

  it('omits the privacy section when store is not provided (backward compat)', () => {
    const html = renderSettingsScreen();
    expect(html).not.toContain('settings-privacy');
  });

  it('checkbox is unchecked when share-usage is not stored (privacy by default)', () => {
    const html = renderSettingsScreen(makeStore());
    const checkbox = html.match(/<input[^>]*id="setting-optout"[^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toContain('checked');
  });

  it('checkbox is checked when share-usage stored as true', () => {
    const html = renderSettingsScreen(makeStore({ [PRIVACY_STORAGE_KEY]: 'true' }));
    const checkbox = html.match(/<input[^>]*id="setting-optout"[^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    expect(checkbox).toContain('checked');
  });

  it('initSettingsScreen binds a change handler when onOptOutChange is provided', () => {
    const store = makeStore();
    document.body.innerHTML = renderSettingsScreen(store);
    const onOptOutChange = vi.fn();
    initSettingsScreen(store, () => {}, onOptOutChange);

    const checkbox = document.querySelector('#setting-optout') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(onOptOutChange).toHaveBeenCalledTimes(1);
    expect(onOptOutChange).toHaveBeenCalledWith(true);
    // persisted
    expect(store.get(PRIVACY_STORAGE_KEY)).toBe('true');
  });

  it('initSettingsScreen does not bind a change handler without onOptOutChange', () => {
    const store = makeStore({ [PRIVACY_STORAGE_KEY]: 'true' });
    document.body.innerHTML = renderSettingsScreen(store);
    initSettingsScreen(store, () => {});

    const checkbox = document.querySelector('#setting-optout') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    // no persistence, no callback
    expect(store.get(PRIVACY_STORAGE_KEY)).toBe('true');
  });

  it('loadShareUsage returns false when unset (privacy by default)', () => {
    expect(loadShareUsage(makeStore())).toBe(false);
  });

  it('loadShareUsage returns true when stored as true', () => {
    expect(loadShareUsage(makeStore({ [PRIVACY_STORAGE_KEY]: 'true' }))).toBe(true);
  });

  it('saveShareUsage writes true and false correctly', () => {
    const store = makeStore();
    saveShareUsage(store, true);
    expect(store.get(PRIVACY_STORAGE_KEY)).toBe('true');
    saveShareUsage(store, false);
    expect(store.get(PRIVACY_STORAGE_KEY)).toBe('false');
  });

  it('renderPrivacySection includes the privacy note text', () => {
    const html = renderPrivacySection(false);
    expect(html).toContain('Privacy');
    expect(html).toContain('Share Usage Data');
    expect(html).toContain('No personal data is collected');
  });
});
