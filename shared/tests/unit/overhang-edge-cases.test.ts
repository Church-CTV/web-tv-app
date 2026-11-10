/**
 * Overhang — edge-case tests.
 * Tests title rendering, XSS, and action buttons.
 */

import { describe, it, expect } from 'vitest';
import { renderOverhang, type OverhangConfig } from '@ctv/shared/ui/Overhang';

describe('Overhang edge cases', () => {
  it('renders minimal overhang with just title', () => {
    const html = renderOverhang({ title: 'App' });
    expect(html).toContain('overhang');
    expect(html).toContain('App');
  });

  it('handles very long title', () => {
    const longTitle = 'A'.repeat(1000);
    const html = renderOverhang({ title: longTitle });
    expect(html).toContain(longTitle);
    expect(html).toContain('overhang');
  });

  it('handles null title', () => {
    const html = renderOverhang({ title: '' });
    expect(html).toContain('overhang');
  });

  it('escapes XSS in title', () => {
    const html = renderOverhang({ title: '<img src=x onerror=alert(1)>' });
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });

  it('renders multiple actions', () => {
    const actions: OverhangConfig['actions'] = [
      { icon: '🔔', label: 'Alerts', action: 'alerts' },
      { icon: '⚙️', label: 'Config', action: 'config' },
    ];
    const html = renderOverhang({ title: 'App', actions });
    expect(html).toContain('Alerts');
    expect(html).toContain('Config');
  });

  it('renders logo and title together', () => {
    const html = renderOverhang({ title: 'My App', logoUrl: '/logo.svg' });
    expect(html).toContain('overhang__logo');
    expect(html).toContain('/logo.svg');
    expect(html).toContain('My App');
  });

  it('handles action with special characters', () => {
    const actions: OverhangConfig['actions'] = [
      { icon: '🏠', label: 'Home & Garden', action: 'home-garden' },
    ];
    const html = renderOverhang({ title: 'App', actions });
    expect(html).toContain('Home &amp; Garden');
  });

  it('escapes XSS in action label', () => {
    const actions: OverhangConfig['actions'] = [
      { icon: 'x', label: '<script>alert(1)</script>', action: 'bad' },
    ];
    const html = renderOverhang({ title: 'App', actions });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
