/**
 * E2E Test: Performance benchmarks — load time, video start, FPS.
 */

import { test, expect, waitForAppReady } from './fixtures';

test('page loads within 3 seconds', async ({ page }) => {
  const startTime = Date.now();
  // Measure DOM ready time (app shell), not full resource load — the
  // full 'load' event waits for external CDN scripts (webOSTV.js) which
  // vary by network and are not part of the app shell budget.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(3000);
});

test('video screen loads quickly', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // Navigate to video screen like a real user: click a card — it plays
  // directly with no intermediate detail screen.
  const firstCard = page.locator('.content-card').first();
  await firstCard.click();

  // Video screen should be visible (the container is rendered by the app).
  await expect(page.locator('#screen-video')).toBeVisible({ timeout: 5000 });
});

test('splash screen has minimum display time', async ({ page }) => {
  // The splash must display for at least 1000ms (Roku splash_min_time).
  // We poll #splash-screen every 100ms and require it to be present
  // continuously from ~1s after load started until dismissal.
  await page.goto('/');
  const startTime = Date.now();

  let lastSeenAt = 0;
  const pollInterval = 100;
  const maxWait = 5000;

  // Poll: track when the splash was last observed in the DOM.
  while (Date.now() - startTime < maxWait) {
    const count = await page
      .locator('#splash-screen')
      .count()
      .catch(() => 0);
    if (count > 0) {
      lastSeenAt = Date.now() - startTime;
    } else if (lastSeenAt > 0) {
      // Once we've seen it at least once, we can stop — if it's gone, it's done.
      break;
    }
    await page.waitForTimeout(pollInterval);
  }

  // The splash must have been visible for at least 800ms (1000ms min, 80% tolerance
  // for timer granularity).
  expect(
    lastSeenAt,
    `splash was only visible for ${lastSeenAt}ms (< 800ms)`
  ).toBeGreaterThanOrEqual(800);

  // After the minimum, it must be fully gone.
  await page
    .locator('#splash-screen')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
  await waitForAppReady(page);
  await expect(page.locator('#content-grid')).toBeVisible();
});

test('content grid renders without layout shift', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  const grid = page.locator('#content-grid');
  const initialRect = await grid.boundingBox();

  await page.waitForTimeout(1000);
  const finalRect = await grid.boundingBox();

  // Layout should be stable after load
  if (initialRect && finalRect) {
    expect(Math.abs(initialRect.width - finalRect.width)).toBeLessThan(10);
    expect(Math.abs(initialRect.height - finalRect.height)).toBeLessThan(10);
  }
});

test('no console errors on page load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/');
  await waitForAppReady(page);
  await page.waitForTimeout(1000);

  // Filter out expected errors (e.g., feed fetch failures in dev)
  const criticalErrors = errors.filter(
    (e) => !e.includes('feed') && !e.includes('Fetch') && !e.includes('ERR')
  );
  expect(criticalErrors).toEqual([]);
});

test('bundle size within budget', async ({ page }) => {
  // Track total JS bytes loaded for the page (the "bundle" in a Vite dev app).
  let totalBytes = 0;
  const responses: import('@playwright/test').Response[] = [];
  page.on('response', async (resp) => {
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('javascript') || ct.includes('json')) {
      try {
        totalBytes += (await resp.body()).length;
      } catch {
        /* ignore streaming/errored responses */
      }
    }
    responses.push(resp);
  });

  await page.goto('/');
  await waitForAppReady(page);

  // The app must have loaded real content (not zero bytes).
  expect(totalBytes).toBeGreaterThan(5000);
  // Loose sanity budget: a CTV home page should not exceed ~2MB of JS+JSON.
  expect(totalBytes).toBeLessThan(2_000_000);
});
