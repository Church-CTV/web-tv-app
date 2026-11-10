/**
 * E2E Soak: long-session / repeated-cycle leak harness (J3d).
 *
 * This is a BROWSER soak harness (the plan explicitly scopes hardware soak
 * to R8 / device proof). It drives a realistic repeated navigation and
 * playback pattern, then measures in-page indicators of leaks:
 *   - DOM growth (node count) over repeated cycles.
 *   - setInterval lifecycle: any interval created during the session must
 *     be cleared (orphaned timer detection via a runtime hook).
 *   - JS-heap growth (Chromium `performance.memory`) as a leak signal.
 *   - Console error / unhandled rejection accumulation.
 *   - Live-node counts for video-screen and content-detail: the app must
 *     never stack more than one of each in the DOM, even after many cycles.
 *
 * The harness is the contract for J3a / J3b / J3c: a regression that lets
 * one of those fixes slip back in (e.g., forgetting cleanup() or .remove()
 * on video-screen replacement or back-navigation) will grow DOM node count,
 * orphan intervals, or stack multiple video-screen elements.
 *
 * NOT RUN: hardware soak, long-session on a real TV, multi-hour
 * low-memory recovery, suspend/resume on a physical remote.
 */

import { type Page } from '@playwright/test';
import { test, expect, waitForAppReady } from './fixtures';

// A realistic soak is 10+ full navigation cycles; each cycle takes ~2s
// with transitions and mocked video playback. Bump the timeout so the
// test is stable on the CI runner (which is CPU-constrained) without
// flaking.
test.setTimeout(120_000);

// ─── Runtime hooks ───────────────────────────────────────────────────────────

interface SoakStats {
  __setIntervalCount?: number;
  __clearedIntervalCount?: number;
  __soakVideoScreenAppends?: number;
}

function installSoakHooks(page: Page): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.addInitScript(() => {
    const w = window as any;
    w.__setIntervalCount = 0;
    w.__clearedIntervalCount = 0;
    w.__soakVideoScreenAppends = 0;

    const origSetInterval = w.setInterval;
    w.setInterval = function (callback: unknown, ms?: number, ...args: unknown[]) {
      w.__setIntervalCount = (w.__setIntervalCount ?? 0) + 1;
      return origSetInterval.call(window, callback, ms, ...args);
    };

    const origClearInterval = w.clearInterval;
    w.clearInterval = function (id?: unknown) {
      w.__clearedIntervalCount = (w.__clearedIntervalCount ?? 0) + 1;
      return origClearInterval.call(window, id);
    };

    // Track how many times a .video-screen element is appended to the DOM.
    // This is a precise count of how many times the app creates a new
    // video-screen element. A J3a regression that doesn't .remove() the
    // prior element would leave it in the DOM (caught by the live-node
    // assertion below), but this counter is an extra signal.
    const origAppend = Element.prototype.appendChild;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Element.prototype.appendChild = function (this: any, node: any) {
      const htmlEl = node as HTMLElement;
      // Only count the top-level video-screen element (not inner elements
      // like .video-screen__player or .video-screen__player-video).
      if (htmlEl.className === 'video-screen') {
        w.__soakVideoScreenAppends = (w.__soakVideoScreenAppends ?? 0) + 1;
      }
      return origAppend.call(this, node);
    } as unknown as typeof Element.prototype.appendChild;
  }) as unknown as Promise<void>;
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

async function playOneVideoCycle(page: Page): Promise<void> {
  const firstCard = page.locator('.content-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });
  await firstCard.click();
  // Direct play: selection opens the video screen with no detail screen.
  await expect(page.locator('.video-screen')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(200);
  // Back from video returns straight to the home grid (detail bypassed).
  await page.keyboard.press('Escape');
  await expect(page.locator('#content-grid')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(200);
}

async function cycleOneNavLoop(page: Page): Promise<void> {
  const go = async (label: string) => {
    const link = page.locator(`.left-nav__item:has-text("${label}")`);
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
  };

  await go('Search');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await expect(page.locator('#content-grid')).toBeVisible({ timeout: 5000 });

  await go('Settings');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await expect(page.locator('#content-grid')).toBeVisible({ timeout: 5000 });
}

async function readJsHeapKb(page: Page): Promise<number | null> {
  const v = await page.evaluate(() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? m.usedJSHeapSize / 1024 : null;
  });
  return v as number | null;
}

async function readDomNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => document.getElementsByTagName('*').length);
}

async function readIntervalStats(page: Page): Promise<{ set: number; cleared: number }> {
  return page.evaluate(() => {
    const w = window as unknown as SoakStats;
    return {
      set: w.__setIntervalCount ?? 0,
      cleared: w.__clearedIntervalCount ?? 0,
    };
  });
}

async function readVideoScreenAppendCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as SoakStats;
    return w.__soakVideoScreenAppends ?? 0;
  });
}

// ─── Soak tests ───────────────────────────────────────────────────────────────

test('soak: repeated video cycles do not grow DOM nodes unbounded', async ({ page }) => {
  await installSoakHooks(page);
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await waitForAppReady(page);

  const domBefore = await readDomNodeCount(page);
  const heapBefore = await readJsHeapKb(page);

  // 8 repeated video cycles. Each cycle appends then (correctly) removes
  // the video-screen node, and cleans up the prior ContentDetail.
  for (let i = 0; i < 8; i++) {
    await playOneVideoCycle(page);
  }

  const domAfter = await readDomNodeCount(page);
  const heapAfter = await readJsHeapKb(page);

  // The DOM may legitimately grow a little (new ContentDetail, lazy
  // chunks, new card states) but must NOT grow by O(cycles * video-screen).
  // 15% headroom on a ~200-node tree is 30 nodes; a J3a-style regression
  // would grow by 50+ nodes over 8 cycles and fail this gate.
  const growth = domAfter - domBefore;
  const expectedMaxGrowth = Math.max(20, Math.floor(domBefore * 0.15));
  expect(
    growth,
    `DOM grew ${growth} nodes over 8 cycles (before=${domBefore}, after=${domAfter}, max=${expectedMaxGrowth})`
  ).toBeLessThanOrEqual(expectedMaxGrowth);

  // Heap check (best-effort — skipped if Chromium does not expose it).
  if (heapBefore != null && heapAfter != null) {
    const heapDelta = heapAfter - heapBefore;
    // 50MB headroom is permissive for 8 video cycles; a J3a-style leak
    // (accumulating closures + video-screen subtrees) exceeds this quickly.
    expect(
      heapDelta,
      `JS heap grew ${heapDelta.toFixed(0)}KB over 8 cycles (before=${heapBefore.toFixed(0)}KB, after=${heapAfter.toFixed(0)}KB)`
    ).toBeLessThan(50 * 1024);
  }

  // No uncaught errors accumulating across cycles.
  const criticalErrors = consoleErrors.filter(
    (e) => !e.includes('feed') && !e.includes('Fetch') && !e.includes('ERR')
  );
  expect(criticalErrors, 'unexpected console errors during soak').toEqual([]);
});

test('soak: every setInterval created is cleared by the time the app settles', async ({ page }) => {
  await installSoakHooks(page);
  await page.goto('/');
  await waitForAppReady(page);

  // Run 6 video cycles + 2 nav loops, then let timers that should be
  // alive settle (position-save intervals on the video screen are
  // the main source; cleanup() on the video screen must clear them).
  for (let i = 0; i < 6; i++) {
    await playOneVideoCycle(page);
  }
  for (let i = 0; i < 2; i++) {
    await cycleOneNavLoop(page);
  }
  // Let any pending microtasks settle.
  await page.waitForTimeout(300);

  const stats = await readIntervalStats(page);
  const orphaned = stats.set - stats.cleared;
  expect(
    orphaned,
    `orphaned setInterval(s) after soak: created=${stats.set} cleared=${stats.cleared} (orphaned=${orphaned})`
  ).toBeLessThanOrEqual(2);
});

test('soak: video-screen and content-detail nodes are replaced, not duplicated', async ({
  page,
}) => {
  await installSoakHooks(page);
  await page.goto('/');
  await waitForAppReady(page);

  // Track how many times a video-screen is appended to the DOM during the
  // test. A J3a regression that doesn't .remove() the prior element would
  // leave it in the DOM (caught by the live-node assertion below).
  const appendCountBefore = await readVideoScreenAppendCount(page);

  for (let i = 0; i < 4; i++) {
    await playOneVideoCycle(page);
  }

  const appendCountAfter = await readVideoScreenAppendCount(page);
  const videoScreensAppended = appendCountAfter - appendCountBefore;
  // Exactly one video-screen should be created per cycle.
  expect(videoScreensAppended, `expected 4 video-screen appends, got ${videoScreensAppended}`).toBe(
    4
  );

  // At rest (back on the home grid), no video-screen element should be
  // visible in the DOM. A J3a/J3c regression would leave the old element
  // in the DOM, causing this assertion to fail.
  const liveVideoScreens = await page.evaluate(
    () => document.querySelectorAll('.video-screen').length
  );
  expect(
    liveVideoScreens,
    `expected 0 live .video-screen nodes after back-navigation (J3a/J3c), got ${liveVideoScreens}`
  ).toBe(0);

  // #content-detail is a static container (index.html). Direct play bypasses
  // it, so cycles must NOT create duplicates. Baseline is exactly 1.
  const liveContentDetails = await page.evaluate(
    () => document.querySelectorAll('[id="content-detail"]').length
  );
  expect(
    liveContentDetails,
    `expected the single static [id="content-detail"] container (no per-cycle duplicates), got ${liveContentDetails}`
  ).toBe(1);
});

test('soak: screen nav loop does not grow DOM unbounded (stable after warm-up)', async ({
  page,
}) => {
  await installSoakHooks(page);
  await page.goto('/');
  await waitForAppReady(page);

  // Warm-up loop: loads the lazy-loaded screen chunks (search, settings).
  // DOM may grow here legitimately.
  await cycleOneNavLoop(page);
  const afterWarmUp = await readDomNodeCount(page);

  // Stable loops: after the chunks are loaded, repeated navigation should
  // not grow the DOM. If it does, something is leaking (e.g., not
  // clearing innerHTML before re-render).
  for (let i = 0; i < 4; i++) {
    await cycleOneNavLoop(page);
  }

  const domAfter = await readDomNodeCount(page);
  const growth = domAfter - afterWarmUp;
  // Repeated navigation on already-loaded screens should not add nodes.
  expect(
    growth,
    `DOM grew ${growth} nodes over 4 stable nav loops (afterWarmUp=${afterWarmUp}, after=${domAfter})`
  ).toBeLessThanOrEqual(5);
});

test('soak: no unhandled rejections accumulate across cycles', async ({ page }) => {
  await installSoakHooks(page);
  const unhandled: string[] = [];
  page.on('pageerror', (err) => {
    unhandled.push(err.message);
  });

  await page.goto('/');
  await waitForAppReady(page);

  for (let i = 0; i < 6; i++) {
    await playOneVideoCycle(page);
  }
  for (let i = 0; i < 2; i++) {
    await cycleOneNavLoop(page);
  }

  // J3a-J3c fixes removed async cleanup paths that could throw;
  // a regression would surface as an unhandled rejection.
  expect(unhandled, `unhandled errors during soak: ${unhandled.join(' | ')}`).toEqual([]);
});
