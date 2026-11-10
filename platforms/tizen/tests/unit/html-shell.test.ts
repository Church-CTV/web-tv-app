/**
 * Tizen HTML shell contract test.
 *
 * The screen loaders in src/screens/*.ts call document.getElementById()
 * on specific container IDs. Those containers must be present in
 * index.html or the loaders silently no-op on a real TV.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const INDEX_HTML = path.resolve(__dirname, '../../index.html');

function readIndexHtml(): string {
  return fs.readFileSync(INDEX_HTML, 'utf-8');
}

function htmlContainsId(html: string, id: string): boolean {
  return new RegExp(`id=["']${id}["']`, 'i').test(html);
}

// Screen container IDs that Tizen screen loaders + App navigation reference.
// Mirrors getElementById() calls in platforms/tizen/src/screens/*.ts and App.ts.
// Roku parity: only Home grid / Search / Settings / Video / Error remain
// (Schedule, ContinueWatching, WatchLater, Subscription were removed).
const REQUIRED_SCREEN_IDS = [
  'screen-loading',
  'screen-grid',
  'screen-video',
  'screen-search',
  'screen-settings',
  'screen-error',
];

// Child containers the loaders look up inside screen wrappers.
const REQUIRED_CHILD_IDS = ['content-grid', 'video-player', 'search-input', 'settings-list'];

describe('Tizen HTML shell - screen containers (E5)', () => {
  it('index.html exists and is valid HTML', () => {
    const html = readIndexHtml();
    expect(html).toMatch(/<!doctype html/i);
    expect(html).toMatch(/<html[^>]*lang=/i);
    expect(html).toMatch(/<main/i);
  });

  it.each(REQUIRED_SCREEN_IDS)('has screen container id="%s"', (id) => {
    const html = readIndexHtml();
    expect(htmlContainsId(html, id), `index.html missing id="${id}"`).toBe(true);
  });

  it.each(REQUIRED_CHILD_IDS)('has child container id="%s"', (id) => {
    const html = readIndexHtml();
    expect(htmlContainsId(html, id), `index.html missing id="${id}"`).toBe(true);
  });

  it('renders the overhang logo as an <img> (webOS parity)', () => {
    const html = readIndexHtml();
    expect(html).toMatch(/<img[^>]*class="overhang-logo"/i);
    expect(html).toMatch(/class="overhang-logo"[^>]*src="\/overhang-logo\.webp"/i);
  });
});
