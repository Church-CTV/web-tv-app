/** Synthetic fixtures exercise client behavior without live-server access. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { CLIENT_CONFIG_ENDPOINT, CONFIG_STORAGE_KEY } from '@ctv/core';

const FIXTURES = path.resolve(__dirname, '..', '..', 'shared', 'test-fixtures', 'synthetic');
const read = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf-8')) as Record<string, unknown>;

const BASE = 'https://channel.example.test';
const SECOND_BASE = 'https://second.example.test';
const firstConfig = read('one.config.json');
const firstFeed = read('one.feed.json');
const v2Feed = read('one.feed-v2.json');
const secondFeed = read('two.feed.json');
const secondConfig = read('two.config.json');

type Route = { url: string; body: unknown; status?: number };

function makeStorage(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    get: (key: string) => values.get(key) ?? null,
    set: (key: string, value: string) => {
      values.set(key, value);
    },
    remove: (key: string) => {
      values.delete(key);
    },
    getAll: () => Object.fromEntries(values),
  };
}

/** Serve a route table by URL, exactly as a synthetic server answers it. */
function serve(routes: Route[]) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = routes.find((r) => url === r.url || url.startsWith(r.url));
    if (!hit) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => 'Cannot GET ' + url,
      };
    }
    return {
      ok: (hit.status ?? 200) < 400,
      status: hit.status ?? 200,
      headers: { get: () => null },
      json: async () => structuredClone(hit.body),
      text: async () => JSON.stringify(hit.body),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

/**
 * Synthetic routes for a channel: the profile, the legacy
 * /feed document the published channels still read, and the feed the profile
 * itself declares. A client that follows the delivered profile uses the second.
 */
function productionRoutes(profile: Record<string, unknown>): Route[] {
  return [
    { url: `${BASE}${CLIENT_CONFIG_ENDPOINT}`, body: profile },
    { url: `${BASE}/api/v2/feed`, body: v2Feed },
    { url: `${BASE}/feed`, body: firstFeed },
  ];
}

function shell(channelFallback: string) {
  document.body.innerHTML = `<header id="overhang"><h1 class="overhang__title">${channelFallback}</h1><span id="overhang-clock"></span></header>
    <nav id="left-nav"></nav><div id="screen-grid" class="screen"><div id="content-grid"></div></div>`;
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

const actions = () => ({
  onVideoSelect: vi.fn(),
  onSearch: vi.fn(),
  onSettings: vi.fn(),
  onRetry: vi.fn(),
  onSchedule: vi.fn(),
  onContinueWatching: vi.fn(),
  onWatchLater: vi.fn(),
});

describe.each(['webos', 'tizen', 'vizio'] as const)(
  '%s honours the delivered server config',
  (platform) => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    async function load(storage: ReturnType<typeof makeStorage>, acts = actions()) {
      const { loadMainView } = await import(
        `../../platforms/${platform}/src/screens/HomeScreen.ts`
      );
      await loadMainView(storage as never, null as never, acts as never);
      return acts;
    }

    it('takes the channel name from the delivered config, not only the feed', async () => {
      shell('Chroma Channel');
      const calls = serve([...productionRoutes(firstConfig)]);
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      await load(storage);
      expect(calls).toContain(`${BASE}${CLIENT_CONFIG_ENDPOINT}`);
      expect(document.querySelector('.overhang__title')?.textContent).toBe(
        'Example Channel'
      );
      expect(storage.get(CONFIG_STORAGE_KEY)).toContain(firstConfig.configVersion as string);
    });

    it('renders its synthetic feed', async () => {
      shell('Chroma Channel');
      serve(productionRoutes(firstConfig));
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      await load(storage);
      const cards = Array.from(document.querySelectorAll('[data-video-id]'));
      expect(cards.length).toBeGreaterThan(0);
      expect(document.querySelector('[data-video-id="video-test-1"]')).not.toBeNull();
    });

    it('follows the feed source the config declares', async () => {
      shell('Chroma Channel');
      const calls = serve(productionRoutes(firstConfig));
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      await load(storage);
      expect(calls).toContain(`${BASE}/api/v2/feed`);
      expect(document.querySelectorAll('[data-video-id]').length).toBeGreaterThan(0);
    });

    it('a kill switch in the config removes the feature, not just its button', async () => {
      shell('Chroma Channel');
      const off = structuredClone(firstConfig) as Record<string, unknown>;
      (off.config as Record<string, { features: Record<string, unknown> }>).features.search = false;
      // This channel's profile declares the legacy feed document, which is also
      // what the route table below answers.
      (off.config as Record<string, { content: Record<string, unknown> }>).content.sourceUrl =
        `${BASE}/feed`;
      (off as { configVersion: string }).configVersion = 'kill-switch-search-off';
      serve([
        { url: `${BASE}${CLIENT_CONFIG_ENDPOINT}`, body: off },
        { url: `${BASE}/feed`, body: firstFeed },
      ]);
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      const acts = await load(storage);
      expect(document.querySelector('[data-nav-id="search"]')).toBeNull();
      expect(document.querySelector('[data-nav-id="home"]')).not.toBeNull();
      expect(acts.onSearch).not.toHaveBeenCalled();
    });

    it('a second channel profile drives a second channel from the same build', async () => {
      // One build, two channels: what changes is the server it is pointed at and
      // the profile that server delivers. The first channel's profile naming a
      // second channel's origin is refused by policy, so the channel boundary is
      // the server, not the document.
      shell('Chroma Channel');
      serve([
        { url: `${SECOND_BASE}${CLIENT_CONFIG_ENDPOINT}`, body: secondConfig },
        { url: `${SECOND_BASE}/api/v2/feed`, body: secondFeed },
        { url: `${SECOND_BASE}/feed`, body: secondFeed },
      ]);
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: SECOND_BASE, timeout: 15 }),
      });
      await load(storage);
      expect(document.querySelector('.overhang__title')?.textContent).toBe(
        'Second Example Channel'
      );
      expect(storage.get(CONFIG_STORAGE_KEY)).toContain(secondConfig.configVersion as string);
      expect(document.querySelectorAll('[data-video-id]').length).toBeGreaterThan(0);
    });

    it('a profile naming another origin is refused, not followed', async () => {
      shell('Chroma Channel');
      const hijack = structuredClone(firstConfig) as Record<string, unknown>;
      (hijack.config as Record<string, { content: Record<string, unknown> }>).content.sourceUrl =
        'https://someone-else.example/feed';
      const calls = serve(productionRoutes(hijack));
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      await load(storage);
      // The refused profile must not rename the channel, and no request leaves
      // for a foreign origin.
      expect(document.querySelector('.overhang__title')?.textContent).toBe(
        'Example Channel'
      );
      expect(calls.some((url) => url.includes('someone-else.example'))).toBe(false);
      const record = JSON.parse(storage.get(CONFIG_STORAGE_KEY) ?? '{}');
      expect(record.errors.some((e: string) => e.includes('origin-not-allowed'))).toBe(true);
    });

    it('a server with no config endpoint still serves content (legacy fallback)', async () => {
      shell('Chroma Channel');
      const calls = serve([{ url: `${BASE}/feed`, body: firstFeed }]);
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      await load(storage);
      expect(calls).toContain(`${BASE}/feed`);
      expect(document.querySelectorAll('[data-video-id]').length).toBeGreaterThan(0);
      // No config, but the feature defaults stay on.
      expect(document.querySelector('[data-nav-id="search"]')).not.toBeNull();
    });

    it('an invalid config is refused whole and reported, and the app keeps working', async () => {
      shell('Chroma Channel');
      const broken = structuredClone(firstConfig) as Record<string, unknown>;
      (broken.config as Record<string, { features: Record<string, unknown> }>).features.search =
        'yes';
      (broken.config as Record<string, { channel: Record<string, unknown> }>).channel.name =
        'Should-Never-Appear';
      serve([
        { url: `${BASE}${CLIENT_CONFIG_ENDPOINT}`, body: broken },
        { url: `${BASE}/feed`, body: firstFeed },
      ]);
      const storage = makeStorage({
        ctv_server_config: JSON.stringify({ baseUrl: BASE, timeout: 15 }),
      });
      await load(storage);
      expect(document.querySelector('.overhang__title')?.textContent).toBe(
        'Example Channel'
      );
      expect(document.querySelectorAll('[data-video-id]').length).toBeGreaterThan(0);
      expect(document.querySelector('[data-nav-id="search"]')).not.toBeNull();
      const recorded = storage.get(CONFIG_STORAGE_KEY) ?? '';
      expect(recorded).toContain('refused');
    });
  }
);
