/**
 * F132 — a live stall must be acknowledged on screen (Vizio).
 *
 * The adapter already reports `buffering` on `waiting`/`stalled` (see
 * VideoPlayer.L2b2.stall.test.ts) and webOS turns that state into a visible
 * status row (platforms/webos/src/ui/VideoScreen.ts L68-78, L200-203). On
 * Vizio nothing subscribed, so on a real set a network stall was a frozen
 * frame with zero acknowledgement — the exact defect webOS fixed in 6459c83.
 *
 * The row ships through the lazy `attachVideoErrorHandling` call App already
 * makes (platforms/vizio/src/App.ts L64-66), so this test drives that exact
 * call path plus the shipped stylesheet: a mechanism that exists but never
 * reaches the screen is the failure mode being guarded against.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attachVideoErrorHandling, createVideoErrorI18n } from '@ctv/shared/ui/VideoErrorRenderer';
import { EN, ES } from '@ctv/core/i18n/I18n';

const STYLE_PATH = resolve(__dirname, '../../src/styles.css');

function mount(locale: 'en' | 'es' = 'en') {
  document.body.innerHTML =
    '<div id="screen-video" class="screen"><video id="video-player"></video></div>';
  const video = document.getElementById('video-player') as HTMLVideoElement;
  const store = { get: (_key: string): string | null => locale };
  const cleanup = attachVideoErrorHandling(video, createVideoErrorI18n(store));
  return { video, cleanup };
}

describe('Vizio F132: the viewer sees stall feedback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('the attachment App performs creates a hidden status row in #screen-video', () => {
    const { cleanup } = mount();
    const row = document.querySelector('#screen-video .video-buffering') as HTMLElement | null;
    expect(row, 'no .video-buffering row was added next to the player').not.toBeNull();
    expect(row!.getAttribute('role')).toBe('status');
    expect(row!.getAttribute('aria-live')).toBe('polite');
    expect(row!.style.display).toBe('none');
    expect(row!.textContent).toBe(EN['video.buffering']);
    cleanup();
  });

  it('shows the row while the stream is stalled or buffering', () => {
    const { video, cleanup } = mount();
    const row = document.querySelector('#screen-video .video-buffering') as HTMLElement;

    video.dispatchEvent(new Event('waiting'));
    expect(row.style.display).toBe('flex');

    video.dispatchEvent(new Event('playing'));
    expect(row.style.display).toBe('none');

    video.dispatchEvent(new Event('stalled'));
    expect(row.style.display).toBe('flex');

    video.dispatchEvent(new Event('canplay'));
    expect(row.style.display).toBe('none');
    cleanup();
  });

  it('cleanup removes the row and stops responding to media events', () => {
    const { video, cleanup } = mount();
    cleanup();
    expect(document.querySelector('#screen-video .video-buffering')).toBeNull();
    // A late event after teardown must not resurrect the row or throw.
    expect(() => video.dispatchEvent(new Event('waiting'))).not.toThrow();
    expect(document.querySelector('.video-buffering')).toBeNull();
  });

  it('localizes the row and matches core i18n', () => {
    const { cleanup } = mount('es');
    const row = document.querySelector('.video-buffering') as HTMLElement;
    expect(row.textContent).toBe(ES['video.buffering']);
    cleanup();
  });

  it('the shipped Vizio stylesheet actually paints the row', () => {
    const css = readFileSync(STYLE_PATH, 'utf8');
    const rule = css.match(/\.video-buffering\s*{[^}]*}/);
    expect(rule, 'the shipped sheet has no .video-buffering rule at all').not.toBeNull();
    const background = rule![0].match(/background(?:-color)?:\s*([^;]+);/);
    expect(background, '.video-buffering declares no background').not.toBeNull();
    expect(background![1].trim()).toMatch(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0?\.\d+\s*\)$/);
    expect(rule![0]).toMatch(/position:\s*absolute/);
  });
});
