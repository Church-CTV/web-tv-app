/**
 * Continue Watching card progress and remaining time.
 *
 * Why this file exists: Vizio ships this screen
 * (`platforms/vizio/src/screens/ContinueWatchingScreen.ts:39`) and it draws the
 * same resume ratio as the video screen. A stored position that has drifted past
 * the end of the media — routine after a feed re-encode shortens a duration, and
 * exactly the data this screen is built from — used to render `width:125%` on the
 * card bar and a negative `-30s remaining` line, because neither value was
 * clamped (`shared/ui/ContinueWatchingScreen.ts:66,67`). A non-finite stored
 * position rendered `width:NaN%`, which a webview drops and leaves the bar stuck
 * at its previous width.
 *
 * Contract: the fill width and the remaining label are both derived from one
 * clamped ratio, and every non-finite input collapses to the empty/full ends
 * instead of leaking an invalid CSS value or a negative duration.
 */
import { describe, it, expect } from 'vitest';
import { renderContinueWatchingScreen, type ContinueWatchingItem } from './ContinueWatchingScreen';

function render(position: number, duration: number): string {
  const item: ContinueWatchingItem = { videoId: 'v1', title: 'Sermon', position, duration };
  return renderContinueWatchingScreen({ items: [item] });
}

function fillWidth(html: string): string {
  const m = html.match(/class="progress-fill" style="width:([^"]+)"/);
  if (!m) throw new Error(`no progress-fill width found in: ${html.slice(0, 200)}`);
  return m[1];
}

function metaLine(html: string): string {
  const m = html.match(/class="continue-watching-item__meta">([^<]*)</);
  if (!m) throw new Error(`no meta line found in: ${html.slice(0, 200)}`);
  return m[1];
}

describe('ContinueWatchingScreen resume progress', () => {
  it('caps the card fill at 100% when the stored position is past the end', () => {
    expect(fillWidth(render(150, 120))).toBe('100%');
  });

  it('never reports a negative remaining time', () => {
    const meta = metaLine(render(150, 120));
    expect(meta).not.toMatch(/-\s*\d/);
    expect(meta).toContain('0s remaining');
  });

  it('floors the card fill at 0% for a negative stored position', () => {
    expect(fillWidth(render(-5, 120))).toBe('0%');
    expect(metaLine(render(-5, 120))).toContain('2m remaining');
  });

  it('renders an empty bar when the duration is unknown', () => {
    expect(fillWidth(render(30, 0))).toBe('0%');
  });

  it('renders an empty bar, never width:NaN%, for a non-finite position', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const html = render(bad, 120);
      expect(fillWidth(html)).toBe('0%');
      expect(html).not.toContain('NaN');
    }
  });

  it('renders an empty bar, never width:Infinity%, for a live (infinite) duration', () => {
    const html = render(30, Number.POSITIVE_INFINITY);
    expect(fillWidth(html)).toBe('0%');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('still reports honest progress for a normal resume point', () => {
    expect(fillWidth(render(60, 120))).toBe('50%');
    expect(metaLine(render(60, 120))).toContain('1m remaining');
  });
});
