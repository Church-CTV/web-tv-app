/**
 * WEB-054 analytics-envelope E2E, shared by the three CTV platform specs
 * (webos-*.spec.ts / tizen-*.spec.ts / vizio-*.spec.ts select which project runs
 * which file, so the same assertions are installed three times on purpose).
 *
 * The built production bundle, in a real browser, against a delivered channel
 * profile that names a v2 analytics endpoint.
 *
 * The unit suites prove the decision (core) and the transport (per platform).
 * This one proves the shipped bundle actually asks for the profile url, sends the
 * envelope that url takes, and carries a device id - the body shape a real
 * ctv-platform-server refused with `invalid-event-envelope` when the adapters
 * posted a bare array (shared/test-fixtures/live-2026-11-09/analytics-v2-probe.json).
 *
 * Nothing leaves the machine: every server url is intercepted, including the
 * channel host the bundle has hardcoded.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test, waitForAppReady } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROFILE_V2 = path.join(
  REPO_ROOT,
  'shared',
  'test-fixtures',
  'mock-client-config-v2-analytics.json'
);
// The field allow-list is read from the recorded server contract, not from this
// repo's own copy of it, so the assertion cannot agree with a client-side mistake.
const SERVER_CONTRACT = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'shared', 'test-fixtures', 'live-2026-11-09', 'analytics-v2-probe.json'),
    'utf-8'
  )
) as { server_rule_behind_the_answer: { allowed_event_fields: string[] } };
const EXPORT_URL = 'https://channel.example.test/api/v2/analytics';
const PROFILE_LEGACY = path.join(
  REPO_ROOT,
  'shared',
  'test-fixtures',
  'mock-client-config-legacy-analytics.json'
);

export function defineAnalyticsEnvelopeTests(): void {
  interface CapturedExport {
    url: string;
    body: unknown;
  }

  test('the built app posts telemetry to the endpoint the profile names, in the v2 envelope', async ({
    page,
  }) => {
    const captured: CapturedExport[] = [];

    // Consent is the viewer's own persisted preference; seed it the way the app
    // would have written it, then let the delivered profile do the rest.
    await page.addInitScript(() => {
      window.localStorage.setItem('ctv_pref_share_usage', 'true');
    });

    // Registered after the fixture routes, so these win over the default mocks.
    await page.route('**/api/v2/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fs.readFileSync(PROFILE_V2, 'utf-8'),
      })
    );
    // The real server answers this route with credentialed CORS (`vary: Origin`,
    // `access-control-allow-credentials: true` in the recorded contract
    // evidence), and a cross-origin JSON POST is preflighted. Answer both halves
    // or the POST never leaves the browser and the test measures a CORS failure
    // instead of the client.
    const corsHeaders = (request: { headers: () => Record<string, string> }) => {
      const origin = request.headers()['origin'] ?? '*';
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
      };
    };
    // Matched by pattern rather than by exact string: the same url is reached
    // over XHR (webOS, Tizen, Vizio) and the exact-string form has proved fragile
    // against how the route table resolves globs per platform suite.
    await page.route(/\/api\/v2\/analytics$/, (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({
          status: 204,
          headers: {
            ...corsHeaders(route.request()),
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Max-Age': '600',
          },
        });
      }
      captured.push({
        url: route.request().url(),
        body: JSON.parse(route.request().postData() ?? 'null') as unknown,
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders(route.request()),
        body: JSON.stringify({ accepted: 1, rejected: 0 }),
      });
    });
    // (Captured in the route handler above: an XHR the browser has already
    // handed to the network stack is what the server sees, and the handler is
    // the one place that cannot miss it.)

    await page.goto('/');
    await waitForAppReady(page);

    // Generate activity the way a viewer does: a nav item (HomeScreen tracks a
    // 'navigate' interaction) and a content card selection.
    // Selecting a card is what a viewer does, and it is what queues events
    // (`trackContentPlay` + a `play` interaction). No nav click first: that
    // changes screens and the grid the assertion needs is the home grid.
    await page.locator('#content-grid .content-card').first().click();

    // The delivered profile sets exportIntervalSeconds: 1, so the scheduled
    // export - not a page close - is what puts the batch on the wire.
    await expect
      .poll(() => captured.length, { timeout: 15_000, message: 'no v2 analytics POST observed' })
      .toBeGreaterThan(0);

    const export_ = captured[0];
    expect(export_.url).toBe(EXPORT_URL);

    const body = export_.body as Record<string, unknown>;
    expect(Array.isArray(export_.body)).toBe(false);
    const deviceInfo = body.deviceInfo as Record<string, unknown>;
    expect(typeof deviceInfo?.deviceId).toBe('string');
    expect((deviceInfo.deviceId as string).length).toBeGreaterThan(0);
    expect(Array.isArray(body.events)).toBe(true);
    expect((body.events as unknown[]).length).toBeGreaterThan(0);

    // Every field must be one the server's route accepts; one extra key is a 400.
    const allowed = new Set(SERVER_CONTRACT.server_rule_behind_the_answer.allowed_event_fields);
    for (const event of body.events as Record<string, unknown>[]) {
      for (const key of Object.keys(event)) {
        expect(allowed.has(key), `event field ${key} is not in the server allow-list`).toBe(true);
      }
    }
  });

  test('a profile that names no v2 endpoint keeps the legacy plain-array export', async ({
    page,
  }) => {
    const posts: { url: string; body: unknown }[] = [];
    await page.addInitScript(() => {
      window.localStorage.setItem('ctv_pref_share_usage', 'true');
    });
    // A profile that names no v2 endpoint: same 1 s schedule, legacy route and
    // legacy body. Deliberately not driven by a page close - the adapters abort
    // in-flight exports on unload by design, so an unload-driven assertion would
    // measure that guard instead of the body shape.
    await page.route('**/api/v2/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fs.readFileSync(PROFILE_LEGACY, 'utf-8'),
      })
    );
    await page.route(/\/api\/analytics$/, (route) => {
      if (route.request().method() === 'POST') {
        posts.push({
          url: route.request().url(),
          body: JSON.parse(route.request().postData() ?? 'null') as unknown,
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ received: true }),
      });
    });

    await page.goto('/');
    await waitForAppReady(page);
    await page.locator('#content-grid .content-card').first().click();
    await expect
      .poll(() => posts.length, { timeout: 15_000, message: 'no legacy analytics POST observed' })
      .toBeGreaterThan(0);
    expect(Array.isArray(posts[0].body)).toBe(true);
    expect(posts[0].url).not.toBe(EXPORT_URL);
  });
}
