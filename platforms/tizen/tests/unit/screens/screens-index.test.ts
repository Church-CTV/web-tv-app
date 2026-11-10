/**
 * Tizen screens barrel — verify the public loader exports are present and callable.
 */

import { describe, it, expect, vi } from 'vitest';

describe('Tizen screens barrel (index.ts)', () => {
  it('exports all screen loaders as functions', async () => {
    const mod = await import('../../../src/screens');

    expect(typeof mod.loadMainView).toBe('function');
    expect(typeof mod.loadSettingsScreen).toBe('function');
    expect(typeof mod.loadSearchScreen).toBe('function');
  });

  it('exports visibility helpers as functions', async () => {
    const mod = await import('../../../src/screens');

    expect(typeof mod.showScreen).toBe('function');
    expect(typeof mod.hideScreen).toBe('function');
    expect(typeof mod.getActiveScreenId).toBe('function');

    vi.clearAllMocks();
    mod.showScreen('screen-home');
    mod.hideScreen('screen-home');
  });
});
