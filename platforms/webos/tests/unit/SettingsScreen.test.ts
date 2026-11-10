/**
 * WebOS SettingsScreen — unit tests
 *
 * The settings screen now renders only the Channel section (church name +
 * version) and the Give section. The Appearance, Server, Data, and Privacy
 * sections (and the "Content Source" row) were removed by design, so these
 * tests assert they are absent and the remaining sections are present.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSettingsScreen, initSettingsScreen } from '../../src/ui/SettingsScreen';

describe('SettingsScreen', () => {
  let onSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    onSave = vi.fn();
  });

  it('renders the settings screen as an HTMLElement', () => {
    const el = renderSettingsScreen();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toContain('settings-screen');
  });

  it('renders no unconfigured giving destination or QR', () => {
    const el = renderSettingsScreen();
    expect(el.querySelector('.settings-give__link')).toBeNull();
    expect(el.querySelector('#settings-qr')).toBeNull();
  });

  it('renders an explicitly configured HTTPS link safely', () => {
    const link = renderSettingsScreen({ givingUrl: 'https://giving.example.test/donate' }).querySelector('a')!;
    expect(link.href).toBe('https://giving.example.test/donate');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
    expect(renderSettingsScreen({ givingUrl: 'javascript:alert(1)' }).querySelector('a')).toBeNull();
  });

  it('does NOT render the removed Appearance section', () => {
    const el = renderSettingsScreen();
    expect(el.textContent).not.toContain('Appearance');
    expect(el.querySelector('[data-setting="layout"]')).toBeFalsy();
    expect(el.querySelector('[data-setting="theme"]')).toBeFalsy();
    expect(el.querySelector('[data-setting="language"]')).toBeFalsy();
  });

  it('does NOT render the removed Server section', () => {
    const el = renderSettingsScreen();
    expect(el.textContent).not.toContain('Server');
    expect(el.querySelector('[data-setting="server-url"]')).toBeFalsy();
    expect(el.querySelector('.settings-input')).toBeFalsy();
    expect(el.querySelector('#server-url-input')).toBeFalsy();
  });

  it('does NOT render the removed Data section', () => {
    const el = renderSettingsScreen();
    expect(el.textContent).not.toContain('Clear Cache');
    expect(el.querySelector('[data-setting="clear-cache"]')).toBeFalsy();
  });

  it('does NOT render the removed Privacy section', () => {
    const el = renderSettingsScreen();
    expect(el.textContent).not.toContain('Share Usage Data');
    expect(el.querySelector('[data-setting-checkbox="share-usage"]')).toBeFalsy();
    expect(el.querySelector('#setting-optout')).toBeFalsy();
  });

  it('does NOT render a "Content Source" row', () => {
    const el = renderSettingsScreen({
      channelName: 'Example Channel',
      version: '1.0.0',
      contentSource: 'https://channel.example.test',
    });
    expect(el.textContent).not.toContain('Content Source');
    // The channel name and version still render.
    expect(el.textContent).toContain('Example Channel');
    expect(el.textContent).toContain('1.0.0');
  });

  it('initSettingsScreen does not throw with no rendered options', () => {
    const store = {
      get: (key: string) => {
        if (key === 'ctv_pref_layout') return 'leftnav';
        if (key === 'ctv_pref_theme') return 'dark';
        return null;
      },
      set: vi.fn(),
      remove: vi.fn(),
      getAll: () => ({}),
    };

    const el = renderSettingsScreen();
    document.getElementById('app')?.appendChild(el);
    expect(() => initSettingsScreen(store, onSave)).not.toThrow();
  });

  it('language re-render path stays stable when no locale change happens', () => {
    // initSettingsScreen must tolerate a screen that has no data-setting
    // elements (all removed), i.e. re-init is a safe no-op on the current DOM.
    const setMock = vi.fn();
    const store = {
      get: (key: string) => null,
      set: setMock,
      remove: vi.fn(),
      getAll: () => ({}),
    };
    const el = renderSettingsScreen();
    document.getElementById('app')?.appendChild(el);
    expect(() => initSettingsScreen(store, onSave)).not.toThrow();
    // No interactive options exist, so no writes occur on init.
    expect(setMock).not.toHaveBeenCalled();
  });
});
