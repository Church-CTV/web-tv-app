/** @vitest-environment-options {"url":"https://app.example/"} */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/screenLoader', () => ({
  loadMainView: vi.fn(async () => {}),
  loadSettingsScreen: vi.fn(),
  loadSearchScreen: vi.fn(),
}));
vi.mock('../../src/modules/initAnalytics', () => ({
  createAnalytics: vi.fn(() => ({
    init: vi.fn(),
    shutdown: vi.fn(),
    trackInteraction: vi.fn(),
    setOptOut: vi.fn(),
  })),
}));
vi.mock('../../src/modules/initCrashReporting', () => ({ createCrashReporter: vi.fn() }));
vi.mock('../../src/Adapter/CrashReporter', () => ({ flushCrashReports: vi.fn() }));
vi.mock('../../src/modules/initVideoPlayer', () => ({ createVideoPlayer: vi.fn(() => ({})) }));
vi.mock('../../src/modules/initRemoteControl', () => ({
  createRemoteControl: vi.fn(() => ({ onKeyPress: vi.fn(), destroy: vi.fn() })),
}));
vi.mock('../../src/ui/SplashScreen', () => ({
  initSplashScreen: vi.fn(() => ({ dismiss: vi.fn() })),
}));

const { initApp } = await import('../../src/App');
const { loadMainView } = await import('../../src/screenLoader');
const { createRemoteControl } = await import('../../src/modules/initRemoteControl');

describe('webos startup recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML =
      '<div id="app"><div id="screen-loading">Loading</div><div id="screen-grid"></div></div>';
    vi.clearAllMocks();
    vi.stubEnv('PROD', true);
    vi.stubGlobal('fetch', vi.fn());
  });

  it.each([
    '{"baseUrl":"not-a-url","timeout":15}',
    '{invalid',
    '{"baseUrl":42}',
    '{"baseUrl":""}',
    '{"baseUrl":"http://insecure.example","timeout":15}',
  ])('preserves invalid saved configuration and offers remote recovery: %s', async (saved) => {
    localStorage.setItem('ctv_server_config', saved);
    await expect(initApp()).rejects.toThrow();
    expect(localStorage.getItem('ctv_server_config')).toBe(saved);
    expect(fetch).not.toHaveBeenCalled();
    expect(loadMainView).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Use default server and retry');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(loadMainView).toHaveBeenCalledTimes(1));
    expect(JSON.parse(localStorage.getItem('ctv_server_config')!).baseUrl).toBe(
      'http://localhost:3000'
    );
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull());
  });

  it('recovers from an asynchronous startup failure without stacking remote listeners', async () => {
    vi.mocked(loadMainView).mockRejectedValueOnce(new Error('Startup network failure'));
    await expect(initApp()).rejects.toThrow('Startup network failure');
    const remote = vi.mocked(createRemoteControl).mock.results.at(-1)?.value;
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'Startup network failure'
    );
    (document.activeElement as HTMLButtonElement).click();
    await vi.waitFor(() => expect(loadMainView).toHaveBeenCalledTimes(2));
    expect(remote.destroy).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull());
  });

  it('starts normally with valid saved configuration', async () => {
    localStorage.setItem(
      'ctv_server_config',
      JSON.stringify({ baseUrl: 'http://localhost:3000', timeout: 15 })
    );
    await initApp();
    expect(loadMainView).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
