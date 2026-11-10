import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStartupRecovery } from './StartupRecovery';

describe('startup recovery', () => {
  afterEach(() => document.body.replaceChildren());

  it('focuses recovery, deduplicates Enter, and cleans up after success', async () => {
    let finish: () => void = () => {};
    const start = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid configuration'))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      );
    const reset = vi.fn();
    const run = createStartupRecovery(start, reset);
    await expect(run()).rejects.toThrow('Invalid configuration');
    expect(reset).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'Invalid configuration'
    );
    expect(document.activeElement?.textContent).toContain('Use default server and retry');
    document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 13, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(reset).toHaveBeenCalledTimes(1);
    finish();
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('keeps reset and asynchronous startup failures actionable', async () => {
    const reset = vi
      .fn()
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockResolvedValue(undefined);
    const start = vi.fn().mockRejectedValue(new Error('Startup unavailable'));
    const run = createStartupRecovery(start, reset);
    await expect(run()).rejects.toThrow('Startup unavailable');
    (document.activeElement as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
        'Storage unavailable'
      )
    );
    (document.activeElement as HTMLButtonElement).click();
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    expect(document.querySelector('button')?.disabled).toBe(false);
  });
});
