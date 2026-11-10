/**
 * Vizio ScreenShell — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderScreenShell } from '../../../../shared/ui/ScreenShell';

describe('Vizio ScreenShell', () => {
  it('renders screen shell with title and body', () => {
    const html = renderScreenShell('Test Title', '<p>Body content</p>');
    expect(html).toContain('screen-shell');
    expect(html).toContain('Test Title');
    expect(html).toContain('Body content');
  });

  it('renders header with screen-shell__title', () => {
    const html = renderScreenShell('My Screen', '<div>content</div>');
    expect(html).toContain('screen-shell__title');
    expect(html).toContain('My Screen');
  });

  it('renders body with screen-shell__body', () => {
    const html = renderScreenShell('Title', '<span>body text</span>');
    expect(html).toContain('screen-shell__body');
  });

  it('renders footer', () => {
    const html = renderScreenShell('Title', 'body');
    expect(html).toContain('screen-shell__footer');
  });

  it('escapes HTML in title', () => {
    const html = renderScreenShell('<b>Bold Title</b>', 'body');
    expect(html).toContain('&lt;b&gt;');
  });
});
