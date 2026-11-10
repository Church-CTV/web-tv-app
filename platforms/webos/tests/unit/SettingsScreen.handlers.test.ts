/**
 * SettingsScreen handlers — unit tests
 *
 * The render function no longer emits the interactive [data-setting] elements
 * (the WIP removed those sections from the rendered output), but the handler
 * code paths (bindSettingsHandlers, updateSettingsDisplay, cleanup) are still
 * live in the module. These tests build the expected DOM by hand so each
 * handler branch is covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderSettingsScreen,
  initSettingsScreen,
  cleanupSettingsScreen,
} from '../../src/ui/SettingsScreen';

// Mock i18n
vi.mock('../../src/utils/PlatformI18n', () => ({
  getPlatformI18n: () => ({
    locale: 'en',
    t: (key: string) => key,
    setLocale: vi.fn(),
  }),
}));

// Mock ConfirmDialog
let confirmCallback: (() => void) | null = null;
vi.mock('@ctv/shared/ui/ConfirmDialog', () => ({
  createConfirmDialog: (config: any) => ({ config }),
  showConfirmDialog: (dialog: any, cb: { onConfirm: () => void }) => {
    confirmCallback = cb.onConfirm;
  },
}));

function makeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
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

function buildFullSettingsDOM() {
  const app = document.getElementById('app')!;
  app.innerHTML = '';

  // Channel section (from renderSettingsScreen with info)
  const rendered = renderSettingsScreen({
    channelName: 'Test Church',
    version: '2.0.0',
  });
  app.appendChild(rendered);

  // Add the interactive elements that renderSettingsScreen no longer emits
  const section = document.createElement('div');
  section.innerHTML = `
    <div data-setting="layout"><span id="layout-value">LeftNav</span></div>
    <div data-setting="theme"><span id="theme-value">Dark</span></div>
    <div data-setting="language"><span id="language-value">English</span></div>
    <div data-setting="server-url"><span id="server-url-value">/</span>
      <input id="server-url-input" type="text" style="display:none" />
    </div>
    <div data-setting="clear-cache">Clear</div>
    <input type="checkbox" data-setting-checkbox="share-usage" id="setting-optout" />
  `;
  app.appendChild(section);
}

describe('SettingsScreen handlers', () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onOptOut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    onSave = vi.fn();
    onOptOut = vi.fn();
    confirmCallback = null;
  });

  afterEach(() => {
    cleanupSettingsScreen();
  });

  it('layout toggle: leftnav -> grid', () => {
    buildFullSettingsDOM();
    const store = makeStore({ ctv_pref_layout: 'leftnav' });
    initSettingsScreen(store, onSave);

    const layoutEl = document.querySelector('[data-setting="layout"]')!;
    layoutEl.dispatchEvent(new MouseEvent('click'));

    expect(store.data.ctv_pref_layout).toBe('grid');
    expect(onSave).toHaveBeenCalled();
  });

  it('layout toggle: grid -> leftnav', () => {
    buildFullSettingsDOM();
    const store = makeStore({ ctv_pref_layout: 'grid' });
    initSettingsScreen(store, onSave);

    const layoutEl = document.querySelector('[data-setting="layout"]')!;
    layoutEl.dispatchEvent(new MouseEvent('click'));

    expect(store.data.ctv_pref_layout).toBe('leftnav');
  });

  it('theme toggle: dark -> light -> auto -> dark', () => {
    buildFullSettingsDOM();
    const store = makeStore({ ctv_pref_theme: 'dark' });
    initSettingsScreen(store, onSave);
    const themeEl = document.querySelector('[data-setting="theme"]')!;

    themeEl.dispatchEvent(new MouseEvent('click'));
    expect(store.data.ctv_pref_theme).toBe('light');

    themeEl.dispatchEvent(new MouseEvent('click'));
    expect(store.data.ctv_pref_theme).toBe('auto');

    themeEl.dispatchEvent(new MouseEvent('click'));
    expect(store.data.ctv_pref_theme).toBe('dark');
  });

  it('language toggle re-renders screen and preserves info', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave);

    const langEl = document.querySelector('[data-setting="language"]')!;
    langEl.dispatchEvent(new MouseEvent('click'));

    // After re-render, the screen should still have the channel name
    const screen = document.getElementById('settings-screen');
    expect(screen).toBeTruthy();
  });

  it('server URL: click reveals input, blur saves valid URL', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave);

    const serverEl = document.querySelector('[data-setting="server-url"]')!;
    const input = document.getElementById('server-url-input')! as HTMLInputElement;

    serverEl.dispatchEvent(new MouseEvent('click'));
    expect(input.style.display).toBe('block');

    input.value = 'https://example.com';
    input.dispatchEvent(new FocusEvent('blur'));
    expect(store.data.ctv_server_config).toContain('https://example.com');
    expect(onSave).toHaveBeenCalled();
  });

  it('server URL: empty blur does not save', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave);

    const serverEl = document.querySelector('[data-setting="server-url"]')!;
    const input = document.getElementById('server-url-input')! as HTMLInputElement;

    serverEl.dispatchEvent(new MouseEvent('click'));
    input.value = '   ';
    input.dispatchEvent(new FocusEvent('blur'));
    expect(store.data.ctv_server_config).toBeUndefined();
  });

  it('server URL: Enter key blurs input', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave);

    const serverEl = document.querySelector('[data-setting="server-url"]')!;
    const input = document.getElementById('server-url-input')! as HTMLInputElement;

    serverEl.dispatchEvent(new MouseEvent('click'));
    input.value = 'https://valid.com';
    const keyDown = new KeyboardEvent('keydown', { key: 'Enter' });
    input.dispatchEvent(keyDown);
    // blur should have been called internally; the input should be hidden
    expect(input.style.display).toBe('none');
  });

  it('server URL: Escape clears and hides input', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave);

    const serverEl = document.querySelector('[data-setting="server-url"]')!;
    const input = document.getElementById('server-url-input')! as HTMLInputElement;

    serverEl.dispatchEvent(new MouseEvent('click'));
    input.value = 'https://valid.com';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('');
    expect(input.style.display).toBe('none');
  });

  it('clear cache: confirm removes all keys', () => {
    buildFullSettingsDOM();
    const store = makeStore({ key1: 'val1', key2: 'val2' });
    initSettingsScreen(store, onSave);

    const clearEl = document.querySelector('[data-setting="clear-cache"]')!;
    clearEl.dispatchEvent(new MouseEvent('click'));
    expect(confirmCallback).toBeTruthy();
    confirmCallback!();
    expect(Object.keys(store.data)).toHaveLength(0);
  });

  it('share-usage checkbox: toggles and calls onOptOutChange', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave, onOptOut);

    const optOutEl = document.querySelector(
      '[data-setting-checkbox="share-usage"]'
    )! as HTMLInputElement;
    optOutEl.checked = true;
    optOutEl.dispatchEvent(new Event('change'));
    expect(store.data.ctv_pref_share_usage).toBe('true');
    expect(onOptOut).toHaveBeenCalledWith(true);
    expect(onSave).toHaveBeenCalled();
  });

  it('cleanupSettingsScreen removes handlers', () => {
    buildFullSettingsDOM();
    const store = makeStore();
    initSettingsScreen(store, onSave);

    const layoutEl = document.querySelector('[data-setting="layout"]')!;
    cleanupSettingsScreen();

    // After cleanup, clicking layout should not save
    const callsBefore = onSave.mock.calls.length;
    layoutEl.dispatchEvent(new MouseEvent('click'));
    expect(onSave.mock.calls.length).toBe(callsBefore);
  });

  it('keyboard Enter on data-setting element dispatches click', () => {
    buildFullSettingsDOM();
    const store = makeStore({ ctv_pref_layout: 'leftnav' });
    initSettingsScreen(store, onSave);

    const layoutEl = document.querySelector('[data-setting="layout"]')!;
    layoutEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(store.data.ctv_pref_layout).toBe('grid');
  });

  it('updateSettingsDisplay reflects stored values', () => {
    buildFullSettingsDOM();
    const store = makeStore({
      ctv_pref_layout: 'grid',
      ctv_pref_theme: 'light',
      ctv_server_config: JSON.stringify({ baseUrl: 'https://stored.com' }),
    });
    initSettingsScreen(store, onSave);

    expect(document.getElementById('layout-value')!.textContent).toBe('layout.grid');
    expect(document.getElementById('theme-value')!.textContent).toBe('theme.light');
    expect(document.getElementById('language-value')!.textContent).toBe('English');
    expect(document.getElementById('server-url-value')!.textContent).toBe('https://stored.com');
  });

  it('loadServerUrl handles corrupt JSON gracefully', () => {
    buildFullSettingsDOM();
    const store = makeStore({ ctv_server_config: 'not-valid-json' });
    initSettingsScreen(store, onSave);
    // Should not throw
    expect(document.getElementById('server-url-value')!.textContent).toBe('/');
  });
});
