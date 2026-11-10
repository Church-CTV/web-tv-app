/**
 * Tizen SettingsScreen — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderSettingsScreen } from '../../../../shared/ui/SettingsScreen';

describe('Tizen SettingsScreen', () => {
  it('renders settings screen', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('settings-screen');
    expect(html).toContain('Settings');
  });

  it('renders appearance section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Appearance');
    expect(html).toContain('Layout');
    expect(html).toContain('Theme');
  });

  it('renders server section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Server');
    expect(html).toContain('Server URL');
  });

  it('renders data section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Data');
    expect(html).toContain('Clear Cache');
  });

  it('renders layout value', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Left Nav');
  });

  it('renders theme value', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Dark');
  });
});
