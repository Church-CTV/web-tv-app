/**
 * Vizio RemoteControl Adapter — unit tests.
 * Tests createRemoteControl from Vizio's own Adapter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRemoteControl } from '../../src/Adapter/RemoteControl';

describe('RemoteControl Adapter', () => {
  let handler = vi.fn();
  let onBack = vi.fn();
  let remoteControl: ReturnType<typeof createRemoteControl>;

  beforeEach(() => {
    handler = vi.fn();
    onBack = vi.fn();
    remoteControl = createRemoteControl(handler, onBack);
  });

  afterEach(() => {
    remoteControl.destroy();
  });

  it('dispatches Back once and removes the listener on destroy', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
    remoteControl.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles ArrowUp key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(handler).toHaveBeenCalledWith('up');
  });

  it('handles ArrowDown key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(handler).toHaveBeenCalledWith('down');
  });

  it('handles ArrowLeft key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(handler).toHaveBeenCalledWith('left');
  });

  it('handles ArrowRight key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(handler).toHaveBeenCalledWith('right');
  });

  it('handles Enter key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(handler).toHaveBeenCalledWith('enter');
  });

  it('handles Return key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Return' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onBack for Escape key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls handler back when no onBack provided', () => {
    const ctrl = createRemoteControl(handler);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).toHaveBeenCalledWith('back');
    ctrl.destroy();
  });

  it('handles Digit1 key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Digit1' }));
    expect(handler).toHaveBeenCalledWith('red');
  });

  it('handles Digit2 key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Digit2' }));
    expect(handler).toHaveBeenCalledWith('green');
  });

  it('handles Digit3 key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Digit3' }));
    expect(handler).toHaveBeenCalledWith('yellow');
  });

  it('handles Digit4 key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Digit4' }));
    expect(handler).toHaveBeenCalledWith('blue');
  });
});
