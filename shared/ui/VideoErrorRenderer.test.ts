/**
 * The shared error path used by Tizen and Vizio.
 *
 * `attachVideoErrorHandling` overlays a dimmed dialog on a failing stream, but
 * it never touched the element itself, so a transient error left the buffered
 * picture advancing behind the "Playback Error" card. The overlay dims the
 * background; only pausing makes the screen agree with its own message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  attachVideoErrorHandling,
  createVideoErrorI18n,
  type TranslateFn,
} from './VideoErrorRenderer';

describe('attachVideoErrorHandling', () => {
  let videoEl: HTMLVideoElement;
  let container: HTMLDivElement;
  let t: TranslateFn;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'screen-video';
    videoEl = document.createElement('video');
    container.appendChild(videoEl);
    document.body.appendChild(container);
    vi.spyOn(videoEl, 'play').mockResolvedValue(undefined as never);
    vi.spyOn(videoEl, 'pause').mockImplementation(() => {});
    t = createVideoErrorI18n();
  });

  it('pauses the element before showing the dialog', () => {
    const cleanup = attachVideoErrorHandling(videoEl, t);
    videoEl.dispatchEvent(new Event('error'));
    expect(videoEl.pause).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.error-dialog-container .error-dialog')).not.toBeNull();
    cleanup();
  });

  it('removes the dialog and the listener on cleanup', () => {
    const cleanup = attachVideoErrorHandling(videoEl, t);
    videoEl.dispatchEvent(new Event('error'));
    cleanup();
    expect(container.querySelector('.error-dialog-container')).toBeNull();
    videoEl.dispatchEvent(new Event('error'));
    expect(container.querySelector('.error-dialog-container')).toBeNull();
    expect(videoEl.pause).toHaveBeenCalledTimes(1);
  });
  it('detects existing errors, focuses a named modal and reloads only failed media', async () => {
    const previous = document.createElement('button');
    document.body.append(previous);
    previous.focus();
    Object.defineProperty(videoEl, 'error', { configurable: true, value: { code: 2 } });
    const load = vi.spyOn(videoEl, 'load').mockImplementation(() => {});
    const cleanup = attachVideoErrorHandling(videoEl, t);
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Playback Error');
    const retry = dialog.querySelector('button')!;
    expect(document.activeElement).toBe(retry);
    previous.focus();
    expect(document.activeElement).toBe(retry);
    retry.click();
    await vi.waitFor(() => expect(container.querySelector('.error-dialog')).toBeNull());
    expect(load).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(previous);
    cleanup();
  });

  it('keeps one pending retry, preserves failure, catches throws and ignores cleanup completion', async () => {
    let resolve!: () => void;
    vi.mocked(videoEl.play).mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const load = vi.spyOn(videoEl, 'load').mockImplementation(() => {});
    const cleanup = attachVideoErrorHandling(videoEl, t);
    videoEl.dispatchEvent(new Event('error'));
    const retry = container.querySelector('button')!;
    retry.click();
    retry.click();
    expect(videoEl.play).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    resolve();
    await vi.waitFor(() => expect(container.querySelector('.error-dialog')).toBeNull());
    videoEl.dispatchEvent(new Event('error'));
    vi.mocked(videoEl.play).mockImplementationOnce(() => {
      throw new Error('refused');
    });
    container.querySelector('button')!.click();
    await vi.waitFor(() => expect(container.querySelector('button')!.disabled).toBe(false));
    expect(container.querySelector('.error-dialog')).not.toBeNull();
    vi.mocked(videoEl.play).mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    container.querySelector('button')!.click();
    cleanup();
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.activeElement).toBe(elsewhere);
    expect(container.querySelector('.error-dialog-container')).toBeNull();
  });
});
