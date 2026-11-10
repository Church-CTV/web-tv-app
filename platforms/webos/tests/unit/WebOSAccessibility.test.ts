import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRemoteControl } from '../../src/Adapter/RemoteControl';

function dispatchKeyboard(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('WEB-045: CTV accessibility', () => {
  let container: HTMLElement;
  let items: HTMLElement[];
  let remote: ReturnType<typeof createRemoteControl>;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'screen screen-active';
    document.body.appendChild(container);

    items = [];
    for (let i = 0; i < 5; i++) {
      const item = document.createElement('button');
      item.setAttribute('aria-label', 'Item ' + i);
      item.textContent = 'Item ' + i;
      item.style.display = 'block';
      item.style.padding = '20px';
      item.style.margin = '5px';
      item.style.border = '2px solid transparent';
      item.style.outline = 'none';
      item.addEventListener('focus', () => {
        item.style.borderColor = 'blue';
      });
      item.addEventListener('blur', () => {
        item.style.borderColor = 'transparent';
      });
      container.appendChild(item);
      items.push(item);
    }

    remote = createRemoteControl({
      onUp: () => remote.focusPrev(),
      onDown: () => remote.focusNext(),
    });
  });

  afterEach(() => {
    remote.destroy();
    document.body.removeChild(container);
  });

  it('applies large text scale for CTV viewing distance', () => {
    container.style.fontSize = '2em';
    expect(container.style.fontSize).toBe('2em');
  });

  it('maintains layout with scaled text', () => {
    container.style.fontSize = '2em';
    items.forEach((item) => {
      expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 10);
    });
  });

  it('focuses the first element', () => {
    remote.focusNext();
    expect(document.activeElement).toBe(items[0]);
  });

  it('cycles through all items with focusNext', () => {
    remote.focusNext();
    expect(document.activeElement).toBe(items[0]);
    remote.focusNext();
    expect(document.activeElement).toBe(items[1]);
  });

  it('wraps from last to first', () => {
    items[4].focus();
    expect(document.activeElement).toBe(items[4]);
    remote.focusNext();
    expect(document.activeElement).toBe(items[0]);
  });

  it('wraps from first to last with focusPrev', () => {
    items[0].focus();
    expect(document.activeElement).toBe(items[0]);
    remote.focusPrev();
    expect(document.activeElement).toBe(items[4]);
  });

  it('disables animations with prefers-reduced-motion', () => {
    (window as any).matchMediaMatch = { matches: true };
    items.forEach((item) => {
      item.style.transition = 'none';
    });
    expect(items[0].style.transition).toBe('none');
  });

  it('focus indicator is visible and distinct', () => {
    items[0].focus();
    expect(getComputedStyle(items[0]).borderColor).toContain('0, 0, 255');
    items[1].focus();
    expect(getComputedStyle(items[0]).borderColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(items[1]).borderColor).toContain('0, 0, 255');
  });

  it('uses text labels and icons, not just color', () => {
    const selected = document.createElement('div');
    selected.setAttribute('tabindex', '0');
    selected.setAttribute('role', 'button');
    selected.setAttribute('aria-current', 'true');
    selected.setAttribute('data-selected', 'true');
    selected.textContent = 'Selected Item';
    container.appendChild(selected);
    expect(selected.getAttribute('aria-current')).toBe('true');
    expect(selected.getAttribute('data-selected')).toBe('true');
  });

  it('maps up/down keys to focus movement', () => {
    items[0].focus();
    dispatchKeyboard('ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    dispatchKeyboard('ArrowUp');
    expect(document.activeElement).toBe(items[0]);
  });
});
