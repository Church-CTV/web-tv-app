/**
 * WEB-003: Measure 120-item load phases with per-phase budgets.
 *
 * Breaks total load time into distinct phases to isolate regressions:
 *   - readiness: feed fetch → first card element exists
 *   - render: first card → all 120 cards rendered
 *   - dom: total DOM node count after render
 *   - latency: key press → UI update after full render
 *
 * Budgets (measurement-based, not absolute):
 *   - readiness < 2000ms
 *   - render < 3000ms (120 cards total)
 *   - dom nodes < 5000 (regression guard for unbounded rendering)
 *   - key latency < 500ms
 */

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { waitForAppReady } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LARGE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed-large.json');

// Per-phase budgets for 120-item catalog
const MAX_READINESS_MS = 2000;
const MAX_RENDER_MS = 3000;
const MAX_DOM_NODES = 5000;
const MAX_KEY_LATENCY_MS = 500;

async function mockLargeFeed(page: import('@playwright/test').Page): Promise<void> {
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) => {
    const feed = JSON.parse(fs.readFileSync(LARGE_FEED, 'utf-8'));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(feed),
    });
  });
  // Mock thumbnail URLs to isolate render time from network latency
  await page.route(/\/output\/thumbnails\/.+\.jpg$/, async (route) => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
}

test.describe('WEB-003: 120-item load phase budgets', () => {
  test('readiness phase: feed fetch to first card', async ({ page }) => {
    await mockLargeFeed(page);

    let feedRequestStart = 0;
    let feedResponseEnd = 0;
    let firstCardVisible = 0;

    page.on('request', (req) => {
      if (req.url().includes('/feed')) {
        feedRequestStart = Date.now();
      }
    });

    page.on('response', async (resp) => {
      if (resp.url().includes('/feed')) {
        feedResponseEnd = Date.now();
        // Wait for first card to appear after feed response
        try {
          await page.waitForSelector('.content-card', { timeout: 10000 });
          firstCardVisible = Date.now();
        } catch {
          firstCardVisible = feedResponseEnd;
        }
      }
    });

    await page.goto('/');
    await waitForAppReady(page);

    const fetchTime = feedResponseEnd - feedRequestStart;
    const parseAndFirstCard = firstCardVisible - feedResponseEnd;
    const readinessTotal = firstCardVisible - feedRequestStart;

    console.log(`[WEB-003] fetch: ${fetchTime}ms`);
    console.log(`[WEB-003] parse+first card: ${parseAndFirstCard}ms`);
    console.log(`[WEB-003] readiness total: ${readinessTotal}ms`);

    expect(fetchTime).toBeGreaterThan(0);
    expect(parseAndFirstCard).toBeGreaterThan(0);
    expect(readinessTotal).toBeLessThan(MAX_READINESS_MS);
  });

  test('render phase: first card to all 120 cards', async ({ page }) => {
    await mockLargeFeed(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Now measure render phase: count cards over time
    const firstCardTime = Date.now();
    let allCardsTime = 0;

    // Wait for all 120 cards with time tracking
    while (Date.now() - firstCardTime < 15000) {
      const count = await page.locator('.content-card').count();
      if (count >= 120) {
        allCardsTime = Date.now();
        break;
      }
      await page.waitForTimeout(100);
    }

    const renderTime = allCardsTime - firstCardTime;
    const cardCount = await page.locator('.content-card').count();

    console.log(`[WEB-003] render phase: ${renderTime}ms for ${cardCount} cards`);

    expect(cardCount).toBe(120);
    expect(renderTime).toBeGreaterThan(0);
    expect(renderTime).toBeLessThan(MAX_RENDER_MS);
  });

  test('dom complexity: node count after full render', async ({ page }) => {
    await mockLargeFeed(page);
    await page.goto('/');
    await waitForAppReady(page);

    const totalNodes = await page.evaluate(() => {
      const all = document.body.querySelectorAll('*');
      return all.length;
    });

    console.log(`[WEB-003] total DOM nodes: ${totalNodes}`);

    expect(totalNodes).toBeGreaterThan(0);
    expect(totalNodes).toBeLessThan(MAX_DOM_NODES);
  });

  test('interaction latency: key press after full render', async ({ page }) => {
    await mockLargeFeed(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Wait for all cards to be rendered before measuring latency
    await page.waitForFunction(() => document.querySelectorAll('.content-card').length >= 120, {
      timeout: 15000,
    });

    // Measure key press latency
    const latency = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        let resolved = false;

        const onFrame = () => {
          if (resolved) return;
          resolved = true;
          cancelAnimationFrame(frameId);
          const elapsed = performance.now() - start;
          resolve(elapsed);
        };

        let frameId = 0;
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          code: 'ArrowRight',
          bubbles: true,
        });
        document.dispatchEvent(event);
        frameId = requestAnimationFrame(onFrame);

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cancelAnimationFrame(frameId);
            resolve(1000);
          }
        }, 1000);
      });
    });

    console.log(`[WEB-003] key-to-paint latency: ${latency}ms`);

    expect(latency).toBeLessThan(MAX_KEY_LATENCY_MS);
  });

  test('total load budget: end-to-end for 120 items', async ({ page }) => {
    await mockLargeFeed(page);

    const start = Date.now();
    await page.goto('/');
    await waitForAppReady(page);

    // Wait for all cards
    await page.waitForFunction(() => document.querySelectorAll('.content-card').length >= 120, {
      timeout: 15000,
    });

    const total = Date.now() - start;
    const cardCount = await page.locator('.content-card').count();
    const totalNodes = await page.evaluate(() => document.body.querySelectorAll('*').length);

    console.log(
      `[WEB-003] total load: ${total}ms for ${cardCount} cards (${totalNodes} DOM nodes)`
    );

    expect(cardCount).toBe(120);
    // Total budget: ~15s observed on CI, 20s max to account for variance
    expect(total).toBeLessThan(20000);
  });
});
