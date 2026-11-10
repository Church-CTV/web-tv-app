/**
 * ScreenShell — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderScreenShell, setShellTitle } from '../../../../shared/ui/ScreenShell';

describe('ScreenShell', () => {
  it('renders a screen shell with title and body', () => {
    const html = renderScreenShell('Test Title', '<div>Body content</div>');
    expect(html).toContain('screen-shell');
    expect(html).toContain('Test Title');
    expect(html).toContain('Body content');
  });

  it('renders with empty body', () => {
    const html = renderScreenShell('Empty', '');
    expect(html).toContain('screen-shell');
    expect(html).toContain('Empty');
  });

  it('escapes HTML in title', () => {
    const html = renderScreenShell('<script>alert("xss")</script>', 'safe');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders header, main, and footer', () => {
    const html = renderScreenShell('Title', 'Body');
    expect(html).toContain('screen-shell__header');
    expect(html).toContain('screen-shell__body');
    expect(html).toContain('screen-shell__footer');
  });

  it('sets shell title via DOM', () => {
    document.body.innerHTML = renderScreenShell('Old Title', 'Body');
    const container = document.getElementById('screen-shell');
    expect(container).toBeTruthy();
    setShellTitle(container!, 'New Title');
    expect(container.innerHTML).toContain('New Title');
    expect(container.innerHTML).not.toContain('Old Title');
  });

  it('sets shell title when container exists', () => {
    document.body.innerHTML = renderScreenShell('Old Title', 'Body');
    const container = document.getElementById('screen-shell');
    expect(container).toBeTruthy();
    if (!container) return;
    setShellTitle(container, 'New Title');
    expect(container.innerHTML).toContain('New Title');
    expect(container.innerHTML).not.toContain('Old Title');
  });
});
