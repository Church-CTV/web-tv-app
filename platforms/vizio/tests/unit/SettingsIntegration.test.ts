/**
 * Vizio SettingsIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderSettingsScreen } from '../../../../shared/ui/SettingsScreen';

describe('Vizio SettingsIntegration', () => {
  it('renders settings screen', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('settings-screen');
    expect(html).toContain('Settings');
  });

  it('renders layout option', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Layout');
  });

  it('renders theme option', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Theme');
  });

  it('renders server section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Server');
  });

  it('renders data section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Data');
    expect(html).toContain('Clear Cache');
  });
});
