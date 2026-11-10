/**
 * Tizen Settings Integration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderSettingsScreen, initSettingsScreen } from '../../src/ui/SettingsScreen';
import { loadSettingsScreen } from '../../src/screens/SettingsScreen';

describe('Tizen Settings Integration', () => {
  it('renders settings screen HTML', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('settings-screen');
  });

  it('renders settings sections', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Settings');
  });

  it('renders channel metadata', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Channel:');
  });

  it('identifies giving as unconfigured', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Giving is not configured.');
  });

  it('renders the application version', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Version: 1.0.0');
  });

  it('keeps the Roku settings scope', () => {
    const html = renderSettingsScreen();
    expect(html).not.toMatch(/data-setting=|setting-optout|Appearance|Clear Cache/);
  });

  it('inits settings with callbacks', () => {
    let saved = false;
    const store = {
      get: () => null,
      set: () => {
        saved = true;
      },
      remove: () => {},
      getAll: () => ({}),
    };
    const container = document.createElement('div');
    container.innerHTML = renderSettingsScreen();
    initSettingsScreen(store, () => {
      saved = true;
    });
    expect(container.innerHTML).toContain('settings');
  });
});

describe('Give section (local pre-rendered QR, no third-party calls)', () => {
  const storage = {
    get: () => null,
    set: () => {},
    remove: () => {},
    getAll: () => ({}),
  };

  it('renders no unconfigured link or QR', async () => {
    document.body.innerHTML = '<div id="screen-settings"></div>';
    await loadSettingsScreen(storage as never, null);
    expect(document.querySelector('.settings-give__link')).toBeNull();
    expect(document.querySelector('#settings-qr')).toBeNull();
    expect(document.body.innerHTML).not.toContain('qrserver.com');
  });

  it('is idempotent: a second load does not duplicate the section', async () => {
    await loadSettingsScreen(storage as never, null);
    expect(document.querySelectorAll('.settings-screen').length).toBe(1);
  });
});
