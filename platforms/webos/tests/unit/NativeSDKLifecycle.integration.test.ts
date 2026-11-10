import { afterEach, expect, it, vi } from 'vitest';
import { createRemoteControl } from '../../src/Adapter/RemoteControl';

afterEach(() => {
  delete window.webOSTV;
});
it('restores the prior SDK handler so reinitialization cannot activate stale callbacks', () => {
  const prior = vi.fn();
  const first = vi.fn();
  const second = vi.fn();
  const keysListener = { onKeyPress: prior };
  window.webOSTV = { keysListener };
  const remote = createRemoteControl({ onEnter: first });
  keysListener.onKeyPress('KEY_ENTER');
  expect(first).toHaveBeenCalledTimes(1);
  remote.destroy();
  expect(keysListener.onKeyPress).toBe(prior);
  const next = createRemoteControl({ onEnter: second });
  keysListener.onKeyPress('KEY_ENTER');
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledTimes(1);
  next.destroy();
  expect(keysListener.onKeyPress).toBe(prior);
});
