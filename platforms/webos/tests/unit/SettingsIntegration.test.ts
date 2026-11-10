/**
 * SettingsScreen Integration — the settings screen no longer renders the
 * Appearance / Server / Data / Privacy interactive sections (removed by
 * design). These tests verify that initSettingsScreen remains a safe no-op
 * against a screen with no interactive options, and that the surviving
 * Channel + Give sections still render with storage-driven info.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderSettingsScreen,
  initSettingsScreen,
  type SettingsStore,
} from '../../src/ui/SettingsScreen';

function createMockStore(): SettingsStore {
  const data: Record<string, string> = {};
  return {
    get: (key: string) => data[key] ?? null,
    set: (key: string, value: string) => {
      data[key] = value;
    },
    remove: (key: string) => {
      delete data[key];
    },
    getAll: () => ({ ...data }),
  };
}

describe('SettingsScreen Integration', () => {
  let store: SettingsStore;
  let onSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    store = createMockStore();
    onSave = vi.fn();
  });

  it('renders settings screen with no interactive options', () => {
    const el = renderSettingsScreen();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toContain('settings-screen');
    // No interactive data-setting options remain.
    expect(el.querySelector('[data-setting]')).toBeFalsy();
    expect(el.querySelector('[data-setting-checkbox]')).toBeFalsy();
  });

  it('renders the Give section with storage-driven info', () => {
    const el = renderSettingsScreen({
      channelName: 'Example Channel',
      version: '2.0.0',
      givingUrl: 'https://giving.example.test/donate',
    });
    document.getElementById('app')?.appendChild(el);
    expect(el.textContent).toContain('Example Channel');
    expect(el.textContent).toContain('2.0.0');
    expect(el.querySelector('.settings-give__link')?.getAttribute('href')).toBe(
      'https://giving.example.test/donate'
    );
  });

  it('initSettingsScreen is a safe no-op with no options', () => {
    const settingsEl = renderSettingsScreen();
    document.getElementById('app')?.appendChild(settingsEl);
    expect(() => initSettingsScreen(store, onSave)).not.toThrow();
    // No interactive option was changed, so onSave must not fire on init.
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not leak a stale opt-out handler (privacy section removed)', () => {
    store.set('ctv_pref_share_usage', 'true');
    const settingsEl = renderSettingsScreen();
    document.getElementById('app')?.appendChild(settingsEl);
    const onOptOutChange = vi.fn();
    initSettingsScreen(store, onSave, onOptOutChange);
    // The share-usage checkbox no longer exists, so the handler is never wired.
    expect(document.querySelector('[data-setting-checkbox="share-usage"]')).toBeFalsy();
    expect(onOptOutChange).not.toHaveBeenCalled();
  });
});
