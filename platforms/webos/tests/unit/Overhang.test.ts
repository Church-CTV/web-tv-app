/**
 * WebOS Overhang — unit tests
 */

import { describe, it, expect, vi } from 'vitest';
import { renderOverhang, initOverhang } from '../../src/ui/Overhang';

describe('Overhang', () => {
  it('renders the overhang with title', () => {
    const html = renderOverhang({ title: 'Chroma Channel' });
    expect(html).toContain('Chroma Channel');
  });

  it('renders the overhang class', () => {
    const html = renderOverhang({ title: 'Test' });
    expect(html).toContain('overhang');
  });

  it('renders logo when provided', () => {
    const html = renderOverhang({
      title: 'Test',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(html).toContain('logo.png');
    expect(html).toContain('overhang__logo');
  });

  it('renders back button when showBackButton is true', () => {
    const html = renderOverhang({
      title: 'Test',
      showBackButton: true,
    });
    expect(html).toContain('overhang__btn--back');
    expect(html).toContain('id="overhang-back"');
  });

  it('does not render back button when showBackButton is false', () => {
    const html = renderOverhang({ title: 'Test', showBackButton: false });
    expect(html).not.toContain('overhang-back');
  });

  it('renders custom actions', () => {
    const html = renderOverhang({
      title: 'Test',
      actions: [
        { icon: 'search', label: 'Search', action: 'search' },
        { icon: 'settings', label: 'Settings', action: 'settings' },
      ],
    });
    expect(html).toContain('Search');
    expect(html).toContain('data-action="search"');
    expect(html).toContain('data-action="settings"');
  });

  it('escapes HTML in title', () => {
    const html = renderOverhang({ title: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('escapes HTML in action label', () => {
    const html = renderOverhang({
      title: 'Test',
      actions: [{ icon: 'x', label: '<b>Bad</b>', action: 'test' }],
    });
    expect(html).toContain('&lt;b&gt;');
  });

  it('initOverhang wires up back button click', () => {
    document.body.innerHTML = renderOverhang({
      title: 'Test',
      showBackButton: true,
    });
    const onBack = vi.fn();
    initOverhang(onBack);

    const backBtn = document.getElementById('overhang-back');
    backBtn?.dispatchEvent(new MouseEvent('click'));
    expect(onBack).toHaveBeenCalled();
  });

  it('initOverhang handles missing elements gracefully', () => {
    document.body.innerHTML = '<div>no overhang</div>';
    const onBack = vi.fn();
    const onAction = vi.fn();
    expect(() => initOverhang(onBack, onAction)).not.toThrow();
  });
});
