/**
 * Vizio Overhang — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderOverhang } from '../../../../shared/ui/Overhang';

describe('Vizio Overhang', () => {
  it('renders overhang with title', () => {
    const html = renderOverhang({ title: 'App Title' });
    expect(html).toContain('overhang');
    expect(html).toContain('App Title');
  });

  it('renders overhang with logo URL', () => {
    const html = renderOverhang({ title: 'App', logoUrl: '/logo.png' });
    expect(html).toContain('overhang__logo');
    expect(html).toContain('/logo.png');
  });

  it('renders with back button', () => {
    const html = renderOverhang({ title: 'App', showBackButton: true });
    expect(html).toContain('overhang__btn--back');
    expect(html).toContain('overhang-back');
  });

  it('renders with actions', () => {
    const html = renderOverhang({
      title: 'App',
      actions: [{ icon: '🔔', label: 'Notifications', action: 'notifications' }],
    });
    expect(html).toContain('Notifications');
    expect(html).toContain('data-action');
  });

  it('escapes HTML in title', () => {
    const html = renderOverhang({ title: '<b>Bold</b>' });
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders title in h1', () => {
    const html = renderOverhang({ title: 'My App' });
    expect(html).toContain('overhang__title');
    expect(html).toContain('My App');
  });
});
