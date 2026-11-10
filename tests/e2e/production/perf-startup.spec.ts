/**
 * L1a: Startup performance budget gate.
 *
 * Measures real startup timing via the Navigation Timing API and first
 * content-visible time, taking the median of 3 runs to reduce noise.
 * Budgets live in scripts/perf-budgets.json so they can be tuned without
 * a code change.
 *
 * These budgets are sized for CI (self-hosted runner, cold cache) — they
 * represent the maximum acceptable startup cost, not an optimization target.
 */

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGETS_PATH = path.join(REPO_ROOT, 'scripts', 'perf-budgets.json');

const RUNS = 3;
const VIEWPORT = { width: 1920, height: 1080 };

function readBudgets() {
  const raw = fs.readFileSync(BUDGETS_PATH, 'utf-8');
  return JSON.parse(raw).webos;
}

async function stubRoutes(page) {
  const FIXTURE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed.json');
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/vendor/webOSTV.js')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '/* webOSTV.js stubbed */',
      });
    }
    if (/\/feed\/?(?:\?|#|$)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fs.readFileSync(FIXTURE_FEED, 'utf-8'),
      });
    }
    if (/\/schedule\/?(?:\?|#|$)/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (/\/api\/(analytics|heartbeat)/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}',
      });
    }
    await route.continue();
  });
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

test.describe('L1a: startup performance budgets', () => {
  test('domcontentloaded is within budget', async ({ page: _page }) => {
    const budgets = readBudgets();
    const samples: number[] = [];

    // Use a fresh context per run so we get clean Navigation Timing entries.
    const browser = _page.context().browser();
    if (!browser) throw new Error('No browser instance');
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const page = await ctx.newPage();
      await stubRoutes(page);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const dcl = await page.evaluate(
        () => performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? 0
      );
      samples.push(dcl);
      await ctx.close();
    }

    const med = median(samples);
    console.log(
      `  [perf] DCL samples: ${samples.map((s) => s.toFixed(0)).join(', ')}ms (median ${med.toFixed(0)}ms, budget ${budgets.domContentLoadedMs}ms)`
    );
    expect(
      med,
      `DCL ${med.toFixed(0)}ms exceeds budget ${budgets.domContentLoadedMs}ms`
    ).toBeLessThan(budgets.domContentLoadedMs);
  });

  test('first meaningful content visible within budget', async ({ page }) => {
    const budgets = readBudgets();
    const samples: number[] = [];

    for (let i = 0; i < RUNS; i++) {
      const ctx = await page.context();
      const pg = i === 0 ? page : await ctx.newPage();
      await stubRoutes(pg);
      await pg.setViewportSize(VIEWPORT);
      const t0 = Date.now();
      await pg.goto('/', { waitUntil: 'domcontentloaded' });
      await pg.locator('#content-grid').waitFor({ state: 'visible', timeout: 15000 });
      const fmc = Date.now() - t0;
      samples.push(fmc);
      if (i > 0) await pg.close();
    }

    const med = median(samples);
    console.log(
      `  [perf] FMC samples: ${samples.map((s) => s.toFixed(0)).join(', ')}ms (median ${med.toFixed(0)}ms, budget ${budgets.firstContentVisibleMs}ms)`
    );
    expect(
      med,
      `FMC ${med.toFixed(0)}ms exceeds budget ${budgets.firstContentVisibleMs}ms`
    ).toBeLessThan(budgets.firstContentVisibleMs);
  });

  test('no long tasks (>300ms) on startup', async ({ page }) => {
    const budgets = readBudgets();
    await stubRoutes(page);
    await page.setViewportSize(VIEWPORT);

    await page.addInitScript(
      `
      window.__longTasks = [];
      if ('PerformanceLongTaskTiming' in window) {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__longTasks.push(entry.duration);
          }
        });
        obs.observe({ type: 'longtask', buffered: true });
      }`
    );

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#content-grid').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);

    const longTasks = await page.evaluate(() => window.__longTasks || []);
    console.log(
      `  [perf] Long tasks: ${longTasks.length ? longTasks.map((t: number) => `${t.toFixed(0)}ms`).join(', ') : 'none detected'}`
    );
    const oversized = longTasks.filter((t: number) => t > budgets.longTaskThresholdMs);
    expect(
      oversized,
      `Found ${oversized.length} task(s) exceeding ${budgets.longTaskThresholdMs}ms: ${oversized.map((t: number) => `${t.toFixed(0)}ms`).join(', ')}`
    ).toHaveLength(0);
  });
});
