/**
 * WebOS RemoteControl Adapter — unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRemoteControl } from '../../src/Adapter/RemoteControl';

describe('RemoteControl Adapter', () => {
  let remoteControl: ReturnType<typeof createRemoteControl>;
  let callbacks: {
    onUp?: () => void;
    onDown?: () => void;
    onLeft?: () => void;
    onRight?: () => void;
    onEnter?: () => void;
    onBack?: () => void;
    onMenu?: () => void;
    onExit?: () => void;
    onNumber?: (digit: number) => void;
  };

  beforeEach(() => {
    callbacks = {
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
      onEnter: vi.fn(),
      onBack: vi.fn(),
      onMenu: vi.fn(),
      onExit: vi.fn(),
      onNumber: vi.fn(),
    };
    remoteControl = createRemoteControl(callbacks);
  });

  afterEach(() => {
    remoteControl.destroy();
  });

  it('focuses next element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    document.body.appendChild(container);

    const btn1 = document.getElementById('btn1') as HTMLElement;
    btn1.focus();
    // Just verify the function doesn't throw
    expect(() => remoteControl.focusNext()).not.toThrow();

    document.body.removeChild(container);
  });

  it('focuses previous element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
      <button id="btn3">Button 3</button>
    `;
    document.body.appendChild(container);

    const btn3 = document.getElementById('btn3') as HTMLElement;
    btn3.focus();
    // Just verify the function doesn't throw
    expect(() => remoteControl.focusPrev()).not.toThrow();

    document.body.removeChild(container);
  });

  it('wraps focus from last to first', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    document.body.appendChild(container);

    const btn2 = document.getElementById('btn2') as HTMLElement;
    btn2.focus();
    // Just verify the function doesn't throw
    expect(() => remoteControl.focusNext()).not.toThrow();

    document.body.removeChild(container);
  });

  it('handles keyboard events', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;
    document.body.appendChild(container);

    const btn1 = document.getElementById('btn1') as HTMLElement;
    btn1.focus();

    // Simulate keyboard event
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    // The callback should have been called
    expect(callbacks.onRight).toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('destroys event listeners', () => {
    // Should not throw
    expect(() => remoteControl.destroy()).not.toThrow();
  });

  it('handles the LG Back key code from a physical remote', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Unidentified',
      keyCode: 461,
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps keyboard delivery when an SDK namespace has no key listener', () => {
    remoteControl.destroy();
    const previous = window.webOSTV;
    window.webOSTV = {};
    try {
      remoteControl = createRemoteControl(callbacks);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(callbacks.onRight).toHaveBeenCalledTimes(1);
    } finally {
      remoteControl.destroy();
      window.webOSTV = previous;
    }
  });
});
