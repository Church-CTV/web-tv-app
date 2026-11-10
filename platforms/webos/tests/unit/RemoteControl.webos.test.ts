/**
 * WebOS RemoteControl — webOSTV.js path tests.
 *
 * Covers:
 * - webOSTV.keysListener.onKeyPress registration and delegation
 * - All KEY_MAP entries routing to the correct callbacks
 * - prevHandler chaining (existing listener is preserved)
 * - Number key handling (fallback path)
 * - onKeyPress override method
 * - destroy() with webOSTV path (no-op, keydownHandler null)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRemoteControl, type WebOSKey } from '../../src/Adapter/RemoteControl';

type WebOSTVShape = {
  keysListener: { onKeyPress?: (key: string) => void };
};

function getWebOSTVKeyHandler(): ((key: string) => void) | undefined {
  const w = window as unknown as { webOSTV?: WebOSTVShape };
  return w.webOSTV?.keysListener?.onKeyPress;
}

describe('RemoteControl webOSTV.js path', () => {
  let prevHandlerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    delete (window as unknown as { webOSTV?: unknown }).webOSTV;
  });

  afterEach(() => {
    delete (window as unknown as { webOSTV?: unknown }).webOSTV;
  });

  function installWebOSTV(prev?: (key: string) => void) {
    (window as unknown as { webOSTV: WebOSTVShape }).webOSTV = {
      keysListener: prev ? { onKeyPress: prev } : {},
    };
  }

  function createWithCallbacks(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const cbs: Record<string, ReturnType<typeof vi.fn>> = {
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
      onEnter: vi.fn(),
      onBack: vi.fn(),
      onMenu: vi.fn(),
      onExit: vi.fn(),
      onNumber: vi.fn(),
      ...overrides,
    };
    const rc = createRemoteControl(cbs as never);
    return { rc, cbs };
  }

  it('registers a key handler with webOSTV', () => {
    installWebOSTV();
    const handlerBefore = getWebOSTVKeyHandler();
    expect(handlerBefore).toBeUndefined();

    createWithCallbacks();

    const handlerAfter = getWebOSTVKeyHandler();
    expect(handlerAfter).toBeDefined();
    expect(typeof handlerAfter).toBe('function');
  });

  it('routes up/down/left/right keys to correct callbacks', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_UP');
    expect(cbs.onUp).toHaveBeenCalledTimes(1);

    handler('KEY_DOWN');
    expect(cbs.onDown).toHaveBeenCalledTimes(1);

    handler('KEY_LEFT');
    expect(cbs.onLeft).toHaveBeenCalledTimes(1);

    handler('KEY_RIGHT');
    expect(cbs.onRight).toHaveBeenCalledTimes(1);
  });

  it('routes D-pad keys to correct callbacks', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_DPAD_UP');
    expect(cbs.onUp).toHaveBeenCalledTimes(1);

    handler('KEY_DPAD_DOWN');
    expect(cbs.onDown).toHaveBeenCalledTimes(1);

    handler('KEY_DPAD_LEFT');
    expect(cbs.onLeft).toHaveBeenCalledTimes(1);

    handler('KEY_DPAD_RIGHT');
    expect(cbs.onRight).toHaveBeenCalledTimes(1);
  });

  it('routes enter and menu keys to onEnter', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_ENTER');
    expect(cbs.onEnter).toHaveBeenCalledTimes(1);

    handler('KEY_MENU');
    expect(cbs.onEnter).toHaveBeenCalledTimes(2);
  });

  it('routes return and back keys to onBack', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_RETURN');
    expect(cbs.onBack).toHaveBeenCalledTimes(1);

    handler('KEY_BACK');
    expect(cbs.onBack).toHaveBeenCalledTimes(2);
  });

  it('routes menu button to onMenu', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_MENU_BTN');
    expect(cbs.onMenu).toHaveBeenCalledTimes(1);
  });

  it('routes exit key to onExit', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_EXIT');
    expect(cbs.onExit).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown keys', () => {
    installWebOSTV();
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_UNKNOWN');

    expect(cbs.onUp).not.toHaveBeenCalled();
    expect(cbs.onDown).not.toHaveBeenCalled();
    expect(cbs.onLeft).not.toHaveBeenCalled();
    expect(cbs.onRight).not.toHaveBeenCalled();
    expect(cbs.onEnter).not.toHaveBeenCalled();
    expect(cbs.onBack).not.toHaveBeenCalled();
    expect(cbs.onMenu).not.toHaveBeenCalled();
    expect(cbs.onExit).not.toHaveBeenCalled();
  });

  it('calls prevHandler after routing the key', () => {
    prevHandlerSpy = vi.fn();
    installWebOSTV(prevHandlerSpy);
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_UP');

    expect(cbs.onUp).toHaveBeenCalledTimes(1);
    expect(prevHandlerSpy).toHaveBeenCalledWith('KEY_UP');
  });

  it('does not call prevHandler for unknown keys', () => {
    prevHandlerSpy = vi.fn();
    installWebOSTV(prevHandlerSpy);
    const { cbs } = createWithCallbacks();
    const handler = getWebOSTVKeyHandler()!;

    handler('KEY_UNKNOWN');

    // Unknown keys return early, before prevHandler is called
    expect(cbs.onUp).not.toHaveBeenCalled();
    expect(prevHandlerSpy).not.toHaveBeenCalled();
  });

  it('works when webOSTV has no keysListener', () => {
    // webOSTV exists but no keysListener — createRemoteControl should not throw
    (window as unknown as { webOSTV: unknown }).webOSTV = {};
    expect(() => createWithCallbacks()).not.toThrow();
  });

  it('uses fallback keyboard listener when webOSTV not available', () => {
    const { rc, cbs } = createWithCallbacks();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(cbs.onUp).toHaveBeenCalled();

    rc.destroy();
  });

  it('handles number keys in fallback mode', () => {
    const { rc, cbs } = createWithCallbacks();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
    expect(cbs.onNumber).toHaveBeenCalledWith(5);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
    expect(cbs.onNumber).toHaveBeenCalledWith(0);

    rc.destroy();
  });

  it('ignores unmapped non-digit keys in fallback mode without onNumber', () => {
    const rc = createRemoteControl({} as never);

    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    }).not.toThrow();

    rc.destroy();
  });

  it('prevents default on mapped keys in fallback mode', () => {
    const { rc } = createWithCallbacks();

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    rc.destroy();
  });

  it('does not prevent default for unmapped keys in fallback mode', () => {
    const { rc } = createWithCallbacks();

    const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);

    rc.destroy();
  });

  it('onKeyPress method exists and does not throw', () => {
    const { rc } = createWithCallbacks();
    const handler = vi.fn();

    // Should not throw in either path
    expect(() => rc.onKeyPress('up' as WebOSKey, handler)).not.toThrow();

    rc.destroy();
  });

  it('destroys cleanly when using webOSTV path', () => {
    installWebOSTV();
    const { rc } = createWithCallbacks();

    // destroy() should not throw (keydownHandler is null in webOSTV path)
    expect(() => rc.destroy()).not.toThrow();
  });

  it('destroys cleanly when using fallback path', () => {
    const { rc } = createWithCallbacks();

    expect(() => rc.destroy()).not.toThrow();
    // Calling destroy again should not throw
    expect(() => rc.destroy()).not.toThrow();
  });
});
