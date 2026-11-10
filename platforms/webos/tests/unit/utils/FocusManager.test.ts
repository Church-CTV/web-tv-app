/**
 * FocusManager — unit tests.
 * Tests createFocusManager and applyFocusStyle.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFocusManager, applyFocusStyle } from '../../../src/utils/FocusManager';

describe('FocusManager', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'focus-test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates a focus manager for a container', () => {
    const fm = createFocusManager(container);
    expect(fm).toBeDefined();
    expect(typeof fm.focusNext).toBe('function');
    expect(typeof fm.focusPrev).toBe('function');
    expect(typeof fm.focusFirst).toBe('function');
    expect(typeof fm.focusLast).toBe('function');
    expect(typeof fm.getCurrentFocus).toBe('function');
    expect(typeof fm.hasFocus).toBe('function');
  });

  it('focuses first element when no element is focused', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.id).toBe('btn1');
  });

  it('focuses next element in sequence', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.id).toBe('btn1');

    fm.focusNext();
    expect(document.activeElement?.id).toBe('btn2');

    fm.focusNext();
    expect(document.activeElement?.id).toBe('btn3');
  });

  it('wraps focusNext from last to first', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    fm.focusNext(); // btn2 (last)
    fm.focusNext(); // should wrap to btn1
    expect(document.activeElement?.id).toBe('btn1');
  });

  it('focuses previous element in sequence', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    const fm = createFocusManager(container);
    fm.focusLast();
    expect(document.activeElement?.id).toBe('btn3');

    fm.focusPrev();
    expect(document.activeElement?.id).toBe('btn2');
  });

  it('wraps focusPrev from first to last', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    fm.focusPrev(); // should wrap to btn2
    expect(document.activeElement?.id).toBe('btn2');
  });

  it('focuses last element', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    const fm = createFocusManager(container);
    fm.focusLast();
    expect(document.activeElement?.id).toBe('btn3');
  });

  it('returns null getCurrentFocus when no focusable elements', () => {
    container.innerHTML = '';
    const fm = createFocusManager(container);
    expect(fm.getCurrentFocus()).toBeNull();
  });

  it('returns current focus element', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    const current = fm.getCurrentFocus();
    expect(current?.id).toBe('btn1');
  });

  it('hasFocus returns true for focused element', () => {
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    const btn1 = container.querySelector('#btn1') as HTMLElement;
    expect(fm.hasFocus(btn1)).toBe(true);
    const btn2 = container.querySelector('#btn2') as HTMLElement;
    expect(fm.hasFocus(btn2)).toBe(false);
  });

  it('only focuses elements matching FOCUSABLE_SELECTORS', () => {
    container.innerHTML = `
      <div>Not focusable</div>
      <button id="btn1">Button</button>
      <div tabindex="0" id="tab-focus">Tab focusable</div>
      <input id="txt-input" type="text" />
      <a href="#" id="link">Link</a>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.id).toBe('btn1');
    fm.focusNext();
    expect(document.activeElement?.id).toBe('tab-focus');
    fm.focusNext();
    expect(document.activeElement?.id).toBe('txt-input');
    fm.focusNext();
    expect(document.activeElement?.id).toBe('link');
  });

  it('does nothing when there are no focusable elements', () => {
    container.innerHTML = '<div>No focusable content</div>';
    const fm = createFocusManager(container);
    fm.focusFirst();
    fm.focusNext();
    fm.focusPrev();
    fm.focusLast();
    // In jsdom, activeElement may be body or container when nothing is focusable
    expect(fm.getCurrentFocus()).toBeNull();
  });

  it('focuses disabled elements matching selectors but ignores them via :not', () => {
    container.innerHTML = `
      <button id="enabled">Enabled</button>
      <button id="disabled" disabled>Disabled</button>
      <button id="also-enabled">Also Enabled</button>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.id).toBe('enabled');
    fm.focusNext();
    expect(document.activeElement?.id).toBe('also-enabled');
  });

  it('focuses video elements', () => {
    container.innerHTML = `
      <button id="btn">Button</button>
      <video id="vid" tabindex="0">Video</video>
    `;
    const fm = createFocusManager(container);
    fm.focusFirst();
    expect(document.activeElement?.id).toBe('btn');
    fm.focusNext();
    // video with tabindex="0" is focusable via the [tabindex] selector
    expect(document.activeElement?.id).toBe('vid');
  });
});

describe('applyFocusStyle', () => {
  it('adds focused class and removes unfocused when focused=true', () => {
    const el = document.createElement('button');
    applyFocusStyle(el as any, true);
    expect(el.classList.contains('focused')).toBe(true);
    expect(el.classList.contains('unfocused')).toBe(false);
  });

  it('removes focused class and adds unfocused when focused=false', () => {
    const el = document.createElement('button');
    el.classList.add('focused');
    el.classList.add('unfocused');
    applyFocusStyle(el as any, false);
    expect(el.classList.contains('focused')).toBe(false);
    expect(el.classList.contains('unfocused')).toBe(true);
  });
});
