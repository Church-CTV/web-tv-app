/**
 * L1c: Script execution time budget gate.
 *
 * Measures total script execution time (CPU parse + evaluate) excluding
 * network transfer, using the Resource Timing API. Budget lives in
 * scripts/perf-budgets.json under webos.scriptExecMs.
 *
 * Approach:
 * - Use `page.addInitScript` to install a PerformanceObserver that captures
 *   resource entries for all scripts (initiatorType 'script' or 'css').
 * - After page load, sum `duration` for script resources = total JS exec time.
 * - Take the median of 5 runs to reduce noise.
 *
 * The per-script ceiling is judged the same way: on the median duration per chunk across
 * the runs, never on a single sample, because one slow sample is runner contention rather
 * than bundle weight. The ceiling value itself stays pinned at 100 ms.
 *
 * This is the "time-to-first-frame minus network" component: it catches
 * regressions where a large bundle or heavy inline script blocks first paint
 * even when network delivery is fast.
 */

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BUDGETS_PATH = path.join(REPO_ROOT, 'scripts', 'perf-budgets.json');
const RUNS = 5;
// Pinned ceiling. It is a budget, not a knob: it stays 100 ms even though the verdict is
// now taken on the median of the runs instead of the worst single sample.
const PER_SCRIPT_CEILING_MS = 100;
const VIEWPORT = { width: 1920, height: 1080 };
const FIXTURE_FEED = path.join(REPO_ROOT, 'shared', 'test-fixtures', 'mock-feed.json');

function readBudgets() {
  const raw = fs.readFileSync(BUDGETS_PATH, 'utf-8');
  return JSON.parse(raw).webos as { scriptExecMs?: number };
}

async function stubRoutes(page: import('@playwright/test').Page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/vendor/webOSTV.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
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
    await route.continue();
  });
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

test.describe('L1c: script execution time budgets', () => {
  test('total script execution time within budget', async ({ page: _page }) => {
    const budgets = readBudgets();
    if (budgets.scriptExecMs === undefined) {
      throw new Error(
        'L1c: scriptExecMs budget not configured in scripts/perf-budgets.json — RED phase'
      );
    }
    const samples: number[] = [];
    const browser = _page.context().browser();
    if (!browser) throw new Error('No browser instance');

    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const pg = await ctx.newPage();
      await stubRoutes(pg);

      await pg.addInitScript(
        `
        window.__scriptExecTotal = 0;
        var obs = new PerformanceObserver(function(list) {
          for (var i = 0; i < list.getEntries().length; i++) {
            var e = list.getEntries()[i];
            if (e.initiatorType === 'script' && e.duration > 0) {
              window.__scriptExecTotal += e.duration;
            }
          }
        });
        obs.observe({ type: 'resource', buffered: true });
        `
      );

      await pg.goto('/', { waitUntil: 'networkidle' });
      await pg.waitForTimeout(500); // settle for lazy chunks

      const execTime = await pg.evaluate(() => (window as any).__scriptExecTotal ?? 0);
      samples.push(execTime);
      await ctx.close();
    }

    const med = median(samples);
    console.log(
      `  [perf] Script exec samples: [${samples.map((s) => s.toFixed(0)).join(', ')}]ms (median ${med.toFixed(0)}ms, budget ${budgets.scriptExecMs}ms)`
    );
    expect(
      med,
      `Script exec ${med.toFixed(0)}ms exceeds budget ${budgets.scriptExecMs}ms`
    ).toBeLessThan(budgets.scriptExecMs!);
  });

  test('no individual script exceeds 100ms median execution time', async ({ page: _page }) => {
    const browser = _page.context().browser();
    if (!browser) throw new Error('No browser instance');
    const durationsByName = new Map<string, number[]>();

    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      const pg = await ctx.newPage();
      await stubRoutes(pg);

      await pg.addInitScript(
        `
        window.__scriptDurations = [];
        var obs = new PerformanceObserver(function(list) {
          for (var i = 0; i < list.getEntries().length; i++) {
            var e = list.getEntries()[i];
            if (e.initiatorType === 'script' && e.duration > 0) {
              window.__scriptDurations.push({
                name: e.name.split('/').pop(),
                duration: e.duration
              });
            }
          }
        });
        obs.observe({ type: 'resource', buffered: true });
        `
      );

      await pg.goto('/', { waitUntil: 'networkidle' });
      await pg.waitForTimeout(500);

      const entries = await pg.evaluate(() => (window as any).__scriptDurations ?? []);
      for (const entry of entries) {
        const series = durationsByName.get(entry.name) ?? [];
        series.push(entry.duration);
        durationsByName.set(entry.name, series);
      }
      await ctx.close();
    }

    // Every duration is recorded and each chunk is judged on the median of its runs.
    // A single over-threshold sample is runner contention, not the bundle: run
    // 40502514601 failed a chunk that was byte-identical to the green run at 161 ms, while
    // the same chunk measures ~40 ms unloaded. A chunk over the ceiling in half its runs is
    // real, and that is what this gate has to keep catching.
    const overCeiling = [...durationsByName.entries()]
      .map(([name, durations]) => ({
        name,
        med: median(durations),
        runs: durations.length,
      }))
      .filter((row) => row.med > PER_SCRIPT_CEILING_MS)
      .sort((a, b) => b.med - a.med);

    if (overCeiling.length > 0) {
      const worst = overCeiling[0];
      const rest =
        overCeiling.length > 1
          ? `; also ${overCeiling
              .slice(1)
              .map((row) => `${row.name} ${row.med.toFixed(0)}ms`)
              .join(', ')}`
          : '';
      throw new Error(
        `Slow script detected: ${worst.name} median ${worst.med.toFixed(0)}ms over ` +
          `${worst.runs} runs (>${PER_SCRIPT_CEILING_MS}ms threshold)${rest}`
      );
    }
    console.log(
      `  [perf] No individual script exceeded ${PER_SCRIPT_CEILING_MS}ms median execution time`
    );
  });
});
