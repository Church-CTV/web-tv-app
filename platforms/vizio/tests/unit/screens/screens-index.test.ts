/**
 * Vizio screens barrel — verify the public loader exports are present and callable.
 */

import { describe, it, expect, vi } from 'vitest';

describe('Vizio screens barrel (index.ts)', () => {
  it('exports all screen loaders as functions', async () => {
    const mod = await import('../../../src/screens');

    expect(typeof mod.loadMainView).toBe('function');
    expect(typeof mod.loadScheduleScreen).toBe('function');
    expect(typeof mod.loadContinueWatchingScreen).toBe('function');
    expect(typeof mod.loadWatchLaterScreen).toBe('function');
    expect(typeof mod.loadSettingsScreen).toBe('function');
    expect(typeof mod.loadSearchScreen).toBe('function');
  });

  it('exports visibility helpers as functions', async () => {
    const mod = await import('../../../src/screens');

    expect(typeof mod.showScreen).toBe('function');
    expect(typeof mod.hideScreen).toBe('function');

    vi.clearAllMocks();
    mod.showScreen('screen-grid');
    mod.hideScreen('screen-grid');
  });
});
