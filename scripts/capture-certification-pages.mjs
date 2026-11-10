import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
export const platforms = ['webos', 'tizen', 'vizio'];
export const screens = ['home', 'search', 'settings', 'error'];
export const requiredPages = platforms.flatMap((platform) =>
  screens.map((screen) => `${platform}-${screen}`)
);

/** Browser-serializable; clone preserves original DOM and associated labels. */
export function serializeActivePanel(doc = document) {
  const panel = doc.querySelector('.screen.screen-active');
  if (!panel || !panel.textContent.trim()) throw new Error('Missing rendered active panel');
  const clone = doc.documentElement.cloneNode(false);
  const head = doc.head.cloneNode(true);
  head.querySelectorAll('script').forEach((node) => node.remove());
  const body = doc.createElement('body');
  body.appendChild(panel.cloneNode(true));
  clone.append(head, body);
  return '<!doctype html>\n' + clone.outerHTML;
}
export function loadCertificationPages(dir) {
  return requiredPages.map((platform) => {
    const file = path.join(dir, `${platform}.html`);
    if (!fs.existsSync(file))
      throw new Error(`Missing required rendered page: ${platform} (${file})`);
    const htmlContent = fs.readFileSync(file, 'utf8');
    if (!htmlContent.trim()) throw new Error(`Empty rendered page: ${platform}`);
    return { platform, htmlContent };
  });
}
export function assertAxeResults(name, result) {
  const failures = result.violations.map(
    (rule) =>
      `${rule.id}: ${rule.nodes.map((node) => `${node.target.join(', ')} ${node.failureSummary}`).join('; ')}`
  );
  failures.push(...(result.incomplete ?? []).map((rule) => `incomplete ${rule.id}`));
  if (failures.length) throw new Error(`${name}: accessibility failed\n${failures.join('\n')}`);
}

/** No listener or external network: browser requests resolve to production files and existing fixture data. */
export async function captureCertificationPages({
  root = process.cwd(),
  outDir = path.join(root, 'tmp-sample-pages'),
} = {}) {
  const { chromium } = await import('@playwright/test');
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  const feed = JSON.parse(
    fs.readFileSync(path.join(root, 'shared/test-fixtures/mock-feed.json'), 'utf8')
  );
  // Validate build inputs before removing prior evidence. CI invokes this only after fresh successful builds.
  for (const platform of platforms)
    fs.accessSync(path.join(root, 'platforms', platform, 'dist/index.html'));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const evidence = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const platform of platforms) {
      const dist = path.join(root, 'platforms', platform, 'dist');
      const hashes = {};
      for (const screen of screens) {
        const name = `${platform}-${screen}`;
        const context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          serviceWorkers: 'block',
        });
        try {
          const page = await context.newPage();
          await page.route('**/*', async (route) => {
            const url = new URL(route.request().url());
            if (/\/feed\/?$/.test(url.pathname))
              return route.fulfill({
                status: screen === 'error' ? 503 : 200,
                json: screen === 'error' ? { error: 'simulated network failure' } : feed,
              });
            if (/\/schedule\/?$/.test(url.pathname)) return route.fulfill({ json: [] });
            if (/\/api\/(analytics|heartbeat)$/.test(url.pathname))
              return route.fulfill({ json: { ok: true } });
            if (
              url.origin === 'http://certification.invalid' &&
              url.pathname === '/__certification/axe.js'
            )
              return route.fulfill({
                contentType: 'application/javascript',
                body: fs.readFileSync(require.resolve('axe-core/axe.min.js')),
              });
            if (url.origin !== 'http://certification.invalid')
              return route.abort('blockedbyclient');
            const file = path.resolve(
              dist,
              '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
            );
            if (
              !file.startsWith(dist + path.sep) ||
              !fs.existsSync(file) ||
              !fs.statSync(file).isFile()
            )
              return route.fulfill({ status: 404, body: 'Missing production asset' });
            const body = fs.readFileSync(file);
            hashes[path.relative(dist, file)] = createHash('sha256').update(body).digest('hex');
            return route.fulfill({
              body,
              contentType: mime[path.extname(file)] ?? 'application/octet-stream',
            });
          });
          await page.goto('http://certification.invalid/', { waitUntil: 'domcontentloaded' });
          if (screen === 'error')
            await page.locator('.error-screen').waitFor({ state: 'visible', timeout: 30000 });
          else {
            await page
              .locator('#content-grid .content-card')
              .first()
              .waitFor({ state: 'visible', timeout: 20000 });
            await page.locator('#splash-screen').waitFor({ state: 'detached', timeout: 15000 });
            if (screen !== 'home')
              await page
                .locator(
                  `.left-nav__item:has-text("${screen === 'search' ? 'Search' : 'Settings'}")`
                )
                .click();
          }
          const expected =
            screen === 'home' || screen === 'error' ? 'screen-grid' : `screen-${screen}`;
          await page.locator(`#${expected}.screen-active`).waitFor({ state: 'visible' });
          await page.screenshot({
            path: path.join(outDir, `${name}.png`),
            animations: 'disabled',
            mask: [page.locator('#overhang-clock')],
          });
          const html = await page.evaluate(serializeActivePanel);
          fs.writeFileSync(path.join(outDir, `${name}.html`), html);
          await page.addScriptTag({ url: '/__certification/axe.js' });
          const result = await page.evaluate(async () => {
            const panel = document.querySelector('.screen.screen-active');
            return window.axe.run(panel);
          });
          fs.writeFileSync(path.join(outDir, `${name}.axe.json`), JSON.stringify(result, null, 2));
          assertAxeResults(name, result);
          evidence.push({ platform, screen, activePanel: expected });
        } catch (error) {
          failures.push(`${name}: ${error.message}`);
        } finally {
          await context.close();
        }
      }
      fs.writeFileSync(
        path.join(outDir, `${platform}.sources.json`),
        JSON.stringify(hashes, null, 2)
      );
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(outDir, 'capture-manifest.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), pages: evidence }, null, 2)
  );
  if (failures.length) throw new Error(failures.join('\n'));
  return loadCertificationPages(outDir);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  captureCertificationPages().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
