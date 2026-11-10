import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindMediaRemote, toggleFocusedVideo } from './MediaRemote';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('native media remote', () => {
  it('routes transport keys once, bounds seeks, and releases on teardown', () => {
    const player = {
      resume: vi.fn(),
      pause: vi.fn(),
      isPlaying: () => true,
      seek: vi.fn(),
      getPosition: () => 95,
      getDuration: () => 100,
    };
    const stop = vi.fn();
    const create = () =>
      bindMediaRemote(
        { destroy: vi.fn() },
        () => player,
        () => true,
        stop
      );
    const remote = create();
    const send = (key: string, keyCode = 0, repeat = false) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key, keyCode, repeat, bubbles: true, cancelable: true })
      );
    send('MediaPlay');
    send('', 415);
    send('MediaPause');
    send('', 19);
    send('MediaPlayPause');
    send('', 10252);
    send('MediaFastForward');
    send('', 417);
    send('MediaRewind');
    send('', 412);
    send('MediaStop');
    send('', 413);
    expect(player.resume).toHaveBeenCalledTimes(2);
    expect(player.pause).toHaveBeenCalledTimes(4);
    expect(player.seek.mock.calls).toEqual([[100], [100], [85], [85]]);
    expect(stop).toHaveBeenCalledTimes(2);
    send('MediaPlayPause', 0, true);
    expect(player.pause).toHaveBeenCalledTimes(4);
    remote.destroy();
    send('MediaPlay');
    expect(player.resume).toHaveBeenCalledTimes(2);
    const next = create();
    send('MediaPlay');
    expect(player.resume).toHaveBeenCalledTimes(3);
    next.destroy();
  });

  it('honors local consumption, inactive screens and unknown duration', () => {
    const player = {
      resume: vi.fn(),
      pause: vi.fn(),
      isPlaying: () => false,
      seek: vi.fn(),
      getPosition: () => 5,
      getDuration: () => Infinity,
    };
    let active = false;
    const remote = bindMediaRemote(
      { destroy: vi.fn() },
      () => player,
      () => active,
      vi.fn()
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaPlay' }));
    active = true;
    const consumed = new KeyboardEvent('keydown', { key: 'MediaPlay', cancelable: true });
    consumed.preventDefault();
    document.dispatchEvent(consumed);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaFastForward' }));
    expect(player.resume).not.toHaveBeenCalled();
    expect(player.seek).not.toHaveBeenCalled();
    document.body.innerHTML = '<video tabindex="0"></video><button>Local</button>';
    document.querySelector('video')!.focus();
    expect(toggleFocusedVideo(player, true)).toBe(true);
    expect(player.resume).toHaveBeenCalledTimes(1);
    document.querySelector('button')!.focus();
    expect(toggleFocusedVideo(player, true)).toBe(false);
    remote.destroy();
  });
});
