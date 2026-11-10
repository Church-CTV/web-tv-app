/**
 * Vizio initRemoteControl — unit tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { createRemoteControl } from '../../src/modules/initRemoteControl';

describe('Vizio initRemoteControl', () => {
  it('handles keydown events', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);

    // Simulate Enter key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(events.onEnter).toHaveBeenCalled();
  });

  it('maps Backspace to back event', () => {
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

  it('maps Escape to back event', () => {
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

  it('maps arrow keys to corresponding events', () => {
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

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(events.onDown).toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(events.onLeft).toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(events.onRight).toHaveBeenCalled();
  });

  it('registers a keydown listener on document', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    // The function should add a keydown listener without throwing
    expect(() => createRemoteControl(events)).not.toThrow();
  });

  it('does not fire unrelated key events', () => {
    const events = {
      onBack: vi.fn(),
      onEnter: vi.fn(),
      onUp: vi.fn(),
      onDown: vi.fn(),
      onLeft: vi.fn(),
      onRight: vi.fn(),
    };

    createRemoteControl(events);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));

    expect(events.onBack).not.toHaveBeenCalled();
    expect(events.onEnter).not.toHaveBeenCalled();
  });
});
