/**
 * XSS regression tests — feed/user strings must be escaped before innerHTML.
 * Covers the three renderers that had unescaped sinks (C2):
 *  - shared/ui/ContentGrid.ts          (category.id, category.name)
 *  - shared/ui/WatchLaterScreen.ts     (item.videoId, item.title)
 *  - shared/ui/ContinueWatchingVideoScreen.ts (title)
 *
 * Assert on absence of the raw payload and presence of escaped entities.
 * An injection like '"><img ...>' is neutralized once '<' becomes '&lt;'
 * and '"' becomes '&quot;'.
 */

import { describe, it, expect } from 'vitest';
import { renderContentGrid } from '@ctv/shared/ui/ContentGrid';
import { renderWatchLaterScreen } from '@ctv/shared/ui/WatchLaterScreen';
import { renderContinueWatchingVideoScreen } from '@ctv/shared/ui/ContinueWatchingVideoScreen';
import { renderContinueWatchingScreen } from '@ctv/shared/ui/ContinueWatchingScreen';

const XSS_TITLE = '"><img src=x onerror=alert(1)>';

const safeVideo = () => ({ id: 'v1', title: 'Safe title' });

describe('C2 XSS: ContentGrid', () => {
  it('escapes malicious category.name so no live <img> node can be injected', () => {
    const html = renderContentGrid({
      categories: [{ id: 'cat1', name: XSS_TITLE, videos: [safeVideo()] }],
    });
    expect(html).not.toContain('><img'); // would create an element if unescaped
    expect(html).not.toContain('<img src=x onerror'); // raw script vector
    expect(html).toContain('&lt;img'); // escaped, inert
  });

  it('escapes malicious category.id attribute value', () => {
    const html = renderContentGrid({
      categories: [{ id: `cat${XSS_TITLE}x`, name: 'Safe name', videos: [safeVideo()] }],
    });
    expect(html).not.toContain('><img');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });
});

describe('C2 XSS: WatchLaterScreen', () => {
  it('escapes malicious item.title so no live <img> node can be injected', () => {
    const html = renderWatchLaterScreen({
      items: [{ videoId: 'v1', title: XSS_TITLE, addedAt: '2026-08-27T00:00:00.000Z' }],
    });
    expect(html).not.toContain('><img');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });

  it('escapes malicious item.videoId in data attributes', () => {
    const html = renderWatchLaterScreen({
      items: [
        { videoId: `v1${XSS_TITLE}`, title: 'Safe title', addedAt: '2026-08-27T00:00:00.000Z' },
      ],
    });
    expect(html).not.toContain('><img');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });
});

describe('C2 XSS: ContinueWatchingVideoScreen', () => {
  it('escapes malicious video title in the info block', () => {
    const html = renderContinueWatchingVideoScreen({
      videoId: 'v1',
      title: XSS_TITLE,
      streamUrl: 'https://cdn.example.com/stream.mp4',
      duration: 100,
      position: 10,
    });
    expect(html).not.toContain('><img');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });
});

describe('C2 XSS: ContinueWatchingScreen', () => {
  it('escapes malicious item.title and item.videoId', () => {
    const html = renderContinueWatchingScreen({
      items: [
        {
          videoId: `v1${XSS_TITLE}`,
          title: XSS_TITLE,
          position: 10,
          duration: 100,
        },
      ],
    });
    expect(html).not.toContain('><img');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });
});
