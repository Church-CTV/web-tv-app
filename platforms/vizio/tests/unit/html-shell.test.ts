/**
 * Vizio HTML shell contract test.
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

// Screen container IDs that Vizio screen loaders + App navigation reference.
// Mirrors getElementById() calls in platforms/vizio/src/screens/*.ts and App.ts.
const REQUIRED_SCREEN_IDS = [
  'screen-loading',
  'screen-grid',
  'screen-video',
  'screen-search',
  'screen-settings',
  'screen-error',
];

// Child containers the loaders look up inside screen wrappers.
const DISABLED_SCREEN_IDS = [
  'screen-schedule',
  'screen-continue-watching',
  'screen-watch-later',
  'screen-subscribe',
];

describe('Vizio HTML shell - screen containers (E5)', () => {
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

  it.each(DISABLED_SCREEN_IDS)('does not mount disabled Roku destination "%s"', (id) => {
    expect(htmlContainsId(readIndexHtml(), id)).toBe(false);
  });
  it('does not mount an unreachable subscription container', () => {
    expect(htmlContainsId(readIndexHtml(), 'subscription-container')).toBe(false);
  });
});
