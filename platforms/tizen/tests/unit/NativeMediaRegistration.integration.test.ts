import { afterEach, expect, it, vi } from 'vitest';
import { createRemoteControl } from '../../src/Adapter/RemoteControl';

afterEach(() => {
  delete window.tizen;
});
it('registers optional transport keys and unregisters exactly once per lifecycle', () => {
  const registerKey = vi.fn();
  const unregisterKey = vi.fn();
  Object.assign(window, { tizen: { tvinputdevice: { registerKey, unregisterKey } } });
  const remote = createRemoteControl(vi.fn());
  expect(registerKey.mock.calls.map(([key]) => key)).toEqual([
    'MediaPlayPause',
    'MediaPlay',
    'MediaPause',
    'MediaStop',
    'MediaFastForward',
    'MediaRewind',
  ]);
  remote.destroy();
  remote.destroy();
  expect(unregisterKey).toHaveBeenCalledTimes(6);
  const next = createRemoteControl(vi.fn());
  next.destroy();
  expect(unregisterKey).toHaveBeenCalledTimes(12);
});
it('survives optional-key failures and releases successful registrations on unload', () => {
  const registerKey = vi.fn((key: string) => {
    if (key === 'MediaPause') throw Error('unsupported');
  });
  const unregisterKey = vi.fn(() => {
    throw Error('unavailable');
  });
  Object.assign(window, { tizen: { tvinputdevice: { registerKey, unregisterKey } } });
  const remote = createRemoteControl(vi.fn());
  expect(registerKey).toHaveBeenCalledTimes(6);
  expect(() => window.dispatchEvent(new Event('beforeunload'))).not.toThrow();
  expect(unregisterKey).toHaveBeenCalledTimes(5);
  remote.destroy();
  expect(unregisterKey).toHaveBeenCalledTimes(5);
});
