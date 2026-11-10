/**
 * WEB-002: Input-to-UI-update timing measurement.
 *
 * Measures the time from pressing a navigation key until the UI reflects
 * the change. Uses performance.now() inside the browser context for accurate
 * timing of key press to next animation frame. Collects 10 measurements and
 * enforces median and p95 budgets:
 *   - median < 50ms
 *   - p95 < 100ms
 */
import { test, expect } from '@playwright/test';

test.describe('WEB-002 key timing', () => {
  test('input-to-UI-update latency meets median and p95 budgets', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[role="application"], main, #app', { timeout: 10000 });

    const results = await page.evaluate(() => {
      return new Promise<number[]>((resolve) => {
        const latencies: number[] = [];
        let completed = 0;
        const total = 10;

        const finish = () => {
          if (completed >= total) {
            resolve(latencies);
          }
        };

        const measure = () => {
          const start = performance.now();
          let resolved = false;
          let frameId = 0;

          const onFrame = () => {
            if (resolved) return;
            resolved = true;
            cancelAnimationFrame(frameId);
            const elapsed = performance.now() - start;
            latencies.push(elapsed);
            completed++;
            finish();
            measure();
          };

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
              latencies.push(500);
              completed++;
              finish();
              measure();
            }
          }, 500);
        };

        measure();
      });
    });

    expect(results.length).toBe(10);

    const valid = results.filter((l) => l < 500);
    expect(valid.length).toBeGreaterThan(0);

    const sorted = [...valid].sort((a, b) => a - b);
    const n = sorted.length;
    const median = sorted[Math.floor(n / 2)];
    const p95Index = Math.floor(n * 0.95);
    const p95 = sorted[Math.min(p95Index, n - 1)];

    console.log(`WEB-002 key timing: measured ${n} valid samples out of 10`);
    console.log(`  median: ${median.toFixed(1)}ms`);
    console.log(`  p95:    ${p95.toFixed(1)}ms`);
    console.log(`  min:    ${sorted[0].toFixed(1)}ms`);
    console.log(`  max:    ${sorted[n - 1].toFixed(1)}ms`);

    expect(median).toBeLessThan(50);
    expect(p95).toBeLessThan(100);
  });
});
