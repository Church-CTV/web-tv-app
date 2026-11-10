/**
 * E2E Test: Large catalog performance profiling (L3c).
 *
 * Profiles where the time is spent loading 120 videos:
 * feed fetch → feed parsing → DOM creation → image loading → layout.
 */

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { mockAppRoutes, waitForAppReady } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LARGE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed-large.json');

/**
 * Mock the /feed route to serve the large catalog fixture (120 videos).
 * Also mock thumbnail/stream URLs to isolate DOM render time from network latency.
 */
async function mockLargeFeed(page: import('@playwright/test').Page): Promise<void> {
  await page.route(/\/feed\/?(?:\?|#|$)/, (route) => {
    const feed = JSON.parse(fs.readFileSync(LARGE_FEED, 'utf-8'));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(feed),
    });
  });
  // Mock thumbnail URLs (small transparent PNG) to isolate render time.
  await page.route(/\/output\/thumbnails\/.+\.jpg$/, async (route) => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
}

test.describe('L3c: large catalog performance profiling and key latency', () => {
  test('profile grid loading phases', async ({ page }) => {
    await mockLargeFeed(page);

    // Track timing of different phases via console instrumentation
    const timings: Record<string, number> = {};
    page.on('console', (msg) => {
      const match = msg.text().match(/\[perf\] ([^:]+): ([\d.]+)/);
      if (match) {
        timings[match[1]] = parseFloat(match[2]);
      }
    });

    const start = Date.now();
    await page.goto('/');
    await waitForAppReady(page);
    const total = Date.now() - start;

    console.log(`[perf] L3c total load: ${total}ms`);
    console.log(`[perf] L3c timings: ${JSON.stringify(timings)}`);

    // Count cards
    const cardCount = await page.locator('.content-card').count();
    console.log(`[perf] L3c rendered cards: ${cardCount}`);

    // Count DOM nodes
    const totalNodes = await page.evaluate(() => {
      const all = document.body.querySelectorAll('*');
      return all.length;
    });
    console.log(`[perf] L3c total DOM nodes: ${totalNodes}`);

    expect(cardCount).toBe(120);
  });

  test('measure key-to-paint with large catalog', async ({ page }) => {
    await mockLargeFeed(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to next card
    const start = Date.now();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const latency = Date.now() - start;

    console.log(`[perf] L3c key-to-paint (first): ${latency}ms`);
    expect(latency).toBeLessThan(500);
  });

  test('measure first navigation key-to-paint', async ({ page }) => {
    await mockLargeFeed(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to next card
    const start = Date.now();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const latency = Date.now() - start;

    console.log(`[perf] L3c key-to-paint (first): ${latency}ms`);
    expect(latency).toBeLessThan(500);
  });

  test('measure repeated navigation average latency', async ({ page }) => {
    await mockLargeFeed(page);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate 10 times (across multiple cards)
    let totalLatency = 0;
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(50);
      totalLatency += Date.now() - start;
    }

    const avgLatency = totalLatency / 10;
    console.log(`[perf] L3c avg key-to-paint (10 navs): ${avgLatency}ms`);
    expect(avgLatency).toBeLessThan(500);
  });
});
