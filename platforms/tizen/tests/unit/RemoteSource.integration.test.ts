import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteControl } from '../../src/Adapter/RemoteControl';

afterEach(() => {
  delete window.tizen;
});

describe('remote input source selection', () => {
  it.each([
    ['ArrowRight', 'KEY_RIGHT', 'right'],
    ['Enter', 'KEY_ENTER', 'enter'],
    ['Back', 'KEY_BACK', 'back'],
  ])('delivers %s once in either native/DOM ordering on modern Tizen', (key, code, expected) => {
    for (const nativeFirst of [true, false]) {
      const callbacks = new Map<string, () => void>();
      const handler = vi.fn();
      const back = vi.fn();
      window.tizen = {
        tvinputdevice: { registerKey: vi.fn(), unregisterKey: vi.fn() },
        keys: { registerlockevent: (name, callback) => callbacks.set(name, callback) },
      };
      const remote = createRemoteControl(handler, back);
      const native = () => callbacks.get(code)?.();
      const dom = () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        );
        document.dispatchEvent(
          new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true })
        );
      };
      if (nativeFirst) {
        native();
        dom();
      } else {
        dom();
        native();
      }
      remote.destroy();
      expect(expected === 'back' ? back : handler).toHaveBeenCalledTimes(1);
      if (expected !== 'back') expect(handler).toHaveBeenCalledWith(expected);
      expect(callbacks.size).toBe(0);
    }
  });

  it('preserves directional repeats and rapid presses while suppressing Enter repeat', () => {
    window.tizen = {
      tvinputdevice: { registerKey: vi.fn(), unregisterKey: vi.fn() },
      keys: { registerlockevent: vi.fn() },
    };
    const handler = vi.fn();
    const remote = createRemoteControl(handler);
    for (const repeat of [false, true, true, false]) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', repeat, bubbles: true })
      );
    }
    for (const repeat of [false, true, false]) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', repeat, bubbles: true, cancelable: true })
      );
    }
    expect(handler.mock.calls.filter(([key]) => key === 'right')).toHaveLength(4);
    expect(handler.mock.calls.filter(([key]) => key === 'enter')).toHaveLength(2);
    remote.destroy();
  });

  it('retains native callbacks when only legacy keys are available', () => {
    const callbacks = new Map<string, () => void>();
    window.tizen = { keys: { registerlockevent: (key, callback) => callbacks.set(key, callback) } };
    const handler = vi.fn();
    const back = vi.fn();
    const remote = createRemoteControl(handler, back);
    callbacks.get('KEY_RIGHT')?.();
    callbacks.get('KEY_RIGHT')?.();
    callbacks.get('KEY_ENTER')?.();
    callbacks.get('KEY_BACK')?.();
    expect(handler.mock.calls).toEqual([['right'], ['right'], ['enter']]);
    expect(back).toHaveBeenCalledTimes(1);
    remote.destroy();
  });
});
