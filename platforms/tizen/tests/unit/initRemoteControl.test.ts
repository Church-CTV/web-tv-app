/**
 * Tizen initRemoteControl — unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRemoteControl } from '../../src/modules/initRemoteControl';

describe('Tizen initRemoteControl', () => {
  beforeEach(() => {
    // Mock tizen API to avoid ReferenceError in test environment
    (window as any).tizen = undefined;
  });

  it('creates a remote control with destroy method', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    const rc = createRemoteControl(events);
    expect(rc).toBeDefined();
    expect(typeof rc.destroy).toBe('function');
  });

  it('triggers onEnter when Enter key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(events.onEnter).toHaveBeenCalled();
  });

  it('triggers onUp when ArrowUp key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(events.onUp).toHaveBeenCalled();
  });

  it('triggers onDown when ArrowDown key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(events.onDown).toHaveBeenCalled();
  });

  it('triggers onBack when Escape key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(events.onBack).toHaveBeenCalled();
  });

  it('triggers onLeft when ArrowLeft key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(events.onLeft).toHaveBeenCalled();
  });

  it('triggers onRight when ArrowRight key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(events.onRight).toHaveBeenCalled();
  });

  it('triggers onBack when the hardware-style Backspace key is pressed', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(events.onBack).toHaveBeenCalled();
  });

  it('destroys event listeners', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    const rc = createRemoteControl(events);
    expect(() => rc.destroy()).not.toThrow();
  });
});
