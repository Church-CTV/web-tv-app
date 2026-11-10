/**
 * Owner decision 2026-11-09: "Delete subscription. We don't have that in app."
 *
 * The billing model question (`HUM-001`) was open with two answers - wire IAP
 * authority, or remove subscription actions permanently. The owner chose removal,
 * so a subscription path anywhere in this repository is now a defect rather than a
 * pending feature: it advertises a transaction the channel cannot complete, on
 * televisions whose stores charge us for a broken purchase flow.
 *
 * What is asserted here is the *surface*, because most of the remaining code was
 * already unreachable - the left nav has been Home/Search/Settings on every
 * platform since the Roku-parity pass (user directive 2026-09-20). Unreachable is
 * not the same as absent: an exported `startCheckout`, a `/api/subscription/plans`
 * route, a screen loader reachable by deep link and a dictionary key that says
 * "Failed to load subscription plans" all invite the next contributor to rebuild
 * the thing the owner just declined.
 *
 * The runtime checks are the ones that matter to a viewer. The two source-text
 * checks exist because a union member and a reference-service route are erased at
 * runtime or only exist as text, and the point of the row is that the *word* stops
 * appearing in code we ship.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as core from '@ctv/core';
import * as sharedUi from '@ctv/shared/ui';
import { SERVER_ENDPOINTS } from '../../shared/contracts/server';
import { EN, ES } from '../../core/src/i18n/I18n';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function subscriptionKeys(mod: Record<string, unknown>): string[] {
  return Object.keys(mod).filter((k) => /subscri/i.test(k));
}

describe('no subscription surface in the shipped app', () => {
  it('the core barrel exports nothing subscription-shaped', () => {
    // getPlans / startCheckout / checkStatus / cancelSubscription / saveSubscription /
    // loadSubscription / parseWebhookEvent / buildCheckoutUrl / formatPrice.
    expect(subscriptionKeys(core as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('the shared UI barrel exports no subscription renderer', () => {
    // renderSubscriptionUI, SubscriptionScreen, SubscriptionPlan, ...
    expect(subscriptionKeys(sharedUi as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('the server contract names no subscription endpoint', () => {
    const named = Object.entries(SERVER_ENDPOINTS)
      .filter(([name, ep]) => /subscri/i.test(name) || /\/subscription/i.test(ep.path))
      .map(([name, ep]) => `${name} -> ${ep.method} ${ep.path}`);
    expect(named).toEqual([]);
  });

  it('neither locale dictionary carries a subscription string', () => {
    // `subscribe.failed_to_load` ("Failed to load subscription plans") and
    // `subscribe.unknown_plan` were shown to viewers in both locales.
    for (const [locale, dict] of [
      ['en', EN],
      ['es', ES],
    ] as const) {
      const keys = Object.keys(dict).filter((k) => /subscri/i.test(k));
      expect(keys, `${locale} dictionary keys`).toEqual([]);
      const values = Object.values(dict).filter((v) => /subscri/i.test(String(v)));
      expect(values, `${locale} dictionary strings`).toEqual([]);
    }
  });

  it('the Vizio app exposes no subscription screen at any layer', async () => {
    const app = await import('../../platforms/vizio/src/App');
    expect(app.loadSubscriptionScreenWrapper).toBeUndefined();

    const screens = await import('../../platforms/vizio/src/screens');
    expect(screens.loadSubscriptionScreen).toBeUndefined();

    const loader = await import('../../platforms/vizio/src/screenLoader');
    expect(loader.loadSubscriptionScreen).toBeUndefined();
  });

  it('the Vizio home screen has no subscription action in its options', async () => {
    const src = readFileSync(
      path.join(REPO_ROOT, 'platforms/vizio/src/screens/HomeScreen.ts'),
      'utf-8'
    );
    // `onSubscription?: () => void` in HomeScreenOptions.
    expect(src).not.toMatch(/[Ss]ubscription/);
  });

  it('the webOS analytics vocabulary has no subscription events', async () => {
    const { analyticsEvents } = await import('../../platforms/webos/src/utils/AnalyticsEvents');
    const bag = analyticsEvents as unknown as Record<string, unknown>;
    for (const name of ['subscriptionView', 'subscriptionStart', 'subscriptionCancel']) {
      expect(bag[name], name).toBeUndefined();
    }
    // Non-vacuity: the vocabulary itself must still exist, or the loop above
    // would pass by asserting against an empty import.
    expect(typeof bag.contentPlay).toBe('function');
  });

  it('a subscription screen is not a name the shared screen stack can push', () => {
    // `ScreenName` is a type, so this is a source check on both copies of the
    // navigation module (shared, and the webOS mirror the parity gate compares).
    for (const rel of ['shared/ui/Navigation.ts', 'platforms/webos/src/ui/Navigation.ts']) {
      const src = readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      expect(src, rel).not.toMatch(/'subscription'/);
    }
  });

  it('the reference service answers no subscription route', () => {
    // The reference service is what our contract fixtures are validated against;
    // keeping `/api/subscription/*` there is how the client code stayed alive.
    const rel = 'core/reference-service/server.ts';
    expect(existsSync(path.join(REPO_ROOT, rel))).toBe(true);
    const src = readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
    expect(src).not.toMatch(/\/api\/subscription/i);
  });
});
