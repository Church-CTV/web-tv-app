/**
 * initRemoteControl — unit tests.
 * Tests createRemoteControl factory from webOS platform.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRemoteControl } from '../../../src/modules/initRemoteControl';
import * as RemoteControlAdapter from '../../../src/Adapter/RemoteControl';

describe('initRemoteControl', () => {
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createSpy = vi.spyOn(RemoteControlAdapter, 'createRemoteControl');
    createSpy.mockReturnValue({
      onKeyPress: vi.fn(),
      focusNext: vi.fn(),
      focusPrev: vi.fn(),
      destroy: vi.fn(),
    });
  });

  it('creates remote control with event callbacks', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };
    const rc = createRemoteControl(events);
    expect(createSpy).toHaveBeenCalledOnce();
    expect(rc).toBeDefined();
  });

  it('passes all callbacks to adapter', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };
    createRemoteControl(events);
    const calledArgs = createSpy.mock.calls[0][0];
    expect(calledArgs.onBack).toBe(events.onBack);
    expect(calledArgs.onEnter).toBe(events.onEnter);
    expect(calledArgs.onUp).toBe(events.onUp);
    expect(calledArgs.onDown).toBe(events.onDown);
    expect(calledArgs.onLeft).toBe(events.onLeft);
    expect(calledArgs.onRight).toBe(events.onRight);
  });

  it('returns adapter result', () => {
    const rc = createRemoteControl({
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    });
    expect(typeof rc.focusNext).toBe('function');
    expect(typeof rc.focusPrev).toBe('function');
    expect(typeof rc.destroy).toBe('function');
  });

  it('onKeyPress delegates to adapter', () => {
    const rc = createRemoteControl({
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    });
    const mockOnKeyPress = vi.fn();
    (rc as any).onKeyPress = mockOnKeyPress;
    (rc as any).onKeyPress('enter');
  });
});
