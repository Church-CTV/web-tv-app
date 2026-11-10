/**
 * Client config resolution contract (CONFIGURATION.md mandate, 2026-11-07).
 *
 * Fixtures are synthetic and do not describe a live deployment.
 *
 * Mandate clauses covered: precedence (code fallback < bundled profile <
 * validated server config), nested merge without deleting unrelated defaults,
 * explicit false/zero overriding a truthy default, fail-closed validation with
 * machine-readable reasons, invalid/unavailable remote config keeping the
 * last-known-good document, per-channel profiles, and the effective config
 * version/source being recorded for support.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  validateClientConfig,
  mergeClientConfig,
  resolveClientConfig,
  fetchClientConfig,
  saveEffectiveConfig,
  loadEffectiveConfig,
  ensureClientConfig,
  CLIENT_CONFIG_ENDPOINT,
  CONFIG_STORAGE_KEY,
  DEFAULT_CLIENT_CONFIG,
  startConfigRefresh,
} from '@ctv/core';

const FIXTURES = path.resolve(__dirname, '..', '..', 'shared', 'test-fixtures', 'synthetic');
const read = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf-8')) as Record<string, unknown>;

const firstProfile = read('one.config.json');
const secondProfile = read('two.config.json');

function makeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    get: (key: string) => (key in data ? data[key] : null),
    set: (key: string, value: string) => {
      data[key] = value;
    },
    remove: (key: string) => {
      delete data[key];
    },
    getAll: () => ({ ...data }),
  };
}

describe('validateClientConfig - fail closed, machine-readable reasons', () => {
  it('accepts both synthetic profiles', () => {
    for (const profile of [firstProfile, secondProfile]) {
      const result = validateClientConfig(profile);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('refuses an unknown key with a reason that names the key', () => {
    const mutated = structuredClone(firstProfile) as Record<string, unknown>;
    (mutated.config as Record<string, unknown>).notAField = true;
    const result = validateClientConfig(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('notAField'))).toBe(true);
  });

  it('refuses an unsupported api version instead of guessing', () => {
    const mutated = structuredClone(firstProfile) as Record<string, unknown>;
    mutated.apiVersion = 3;
    const result = validateClientConfig(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /apiVersion/.test(e))).toBe(true);
  });

  it('refuses a wrong type with the path named', () => {
    const mutated = structuredClone(firstProfile) as Record<string, unknown>;
    (mutated.config as Record<string, { features: Record<string, unknown> }>).features.search =
      'yes-please';
    const result = validateClientConfig(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('features.search'))).toBe(true);
  });

  it('refuses an out-of-range numeric tunable', () => {
    const mutated = structuredClone(firstProfile) as Record<string, unknown>;
    (mutated.config as Record<string, { content: Record<string, unknown> }>).content.maxRows = 0;
    const result = validateClientConfig(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('content.maxRows'))).toBe(true);
  });

  it('refuses a missing required field', () => {
    const mutated = structuredClone(firstProfile) as Record<string, unknown>;
    delete (mutated.config as Record<string, { channel: Record<string, unknown> }>).channel.name;
    const result = validateClientConfig(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('channel.name'))).toBe(true);
  });
});

describe('mergeClientConfig - precedence and nested merge', () => {
  it('keeps unrelated defaults that the partial override does not mention', () => {
    const merged = mergeClientConfig(
      { features: { search: true, overhangClock: true }, content: { maxRows: 20 } },
      { features: { search: false } }
    );
    expect(merged).toEqual({
      features: { search: false, overhangClock: true },
      content: { maxRows: 20 },
    });
  });

  it('honours explicit false, zero and empty string', () => {
    const merged = mergeClientConfig(
      {
        features: { analytics: true },
        content: { retryDelayMs: 2000, sourceUrl: 'https://a/feed' },
      },
      { features: { analytics: false }, content: { retryDelayMs: 0, sourceUrl: '' } }
    );
    expect(merged.features.analytics).toBe(false);
    expect(merged.content.retryDelayMs).toBe(0);
    expect(merged.content.sourceUrl).toBe('');
  });

  it('ignores undefined so an absent key never erases a default', () => {
    const merged = mergeClientConfig(
      { channel: { name: 'A', language: 'en' } },
      {
        channel: { name: undefined },
      }
    );
    expect(merged.channel).toEqual({ name: 'A', language: 'en' });
  });
});

describe('resolveClientConfig - three levels of precedence', () => {
  it('bundled profile beats code defaults, server config beats both', () => {
    const bundled = structuredClone(firstProfile) as Record<string, unknown>;
    (bundled.config as Record<string, { channel: Record<string, unknown> }>).channel.name =
      'Bundled Name';
    const remote = structuredClone(firstProfile) as Record<string, unknown>;
    (remote.config as Record<string, { channel: Record<string, unknown> }>).channel.name =
      'Server Name';

    const fromCode = resolveClientConfig({ bundled: null, remote: null });
    expect(fromCode.config.channel.name).toBe(DEFAULT_CLIENT_CONFIG.channel.name);
    expect(fromCode.source).toBe('code-defaults');

    const fromBundle = resolveClientConfig({ bundled, remote: null });
    expect(fromBundle.config.channel.name).toBe('Bundled Name');
    expect(fromBundle.source).toBe('bundled-profile');

    const fromServer = resolveClientConfig({ bundled, remote });
    expect(fromServer.config.channel.name).toBe('Server Name');
    expect(fromServer.source).toBe('server');
    expect(fromServer.configVersion).toBe(firstProfile.configVersion);
  });

  it('a second, distinct channel profile resolves independently', () => {
    const resolved = resolveClientConfig({ bundled: null, remote: secondProfile });
    expect(resolved.config.channel.name).toBe('Second Example Channel');
    expect(resolved.config.features.analytics).toBe(true);
    expect(resolved.configVersion).toBe(secondProfile.configVersion);
    expect(resolved.errors).toEqual([]);
  });

  it('an invalid remote document never partially applies - the bundle survives whole', () => {
    const bundled = structuredClone(firstProfile) as Record<string, unknown>;
    const broken = structuredClone(firstProfile) as Record<string, unknown>;
    (broken.config as Record<string, { features: Record<string, unknown> }>).features.search =
      'nope';
    (broken.config as Record<string, { channel: Record<string, unknown> }>).channel.name =
      'Half-Applied';
    const resolved = resolveClientConfig({ bundled, remote: broken });
    expect(resolved.source).toBe('bundled-profile');
    expect(resolved.config.channel.name).not.toBe('Half-Applied');
    expect(resolved.config).toEqual(resolveClientConfig({ bundled, remote: null }).config);
    expect(resolved.errors.length).toBeGreaterThan(0);
  });
});

describe('fetchClientConfig - the real endpoint, fail closed', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('GETs <baseUrl>/api/v2/config and returns the parsed document plus its version', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h.toLowerCase() === 'etag' ? 'W/"900-x"' : null) },
      json: async () => structuredClone(firstProfile),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchClientConfig('https://channel.example.test/', {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://channel.example.test/api/v2/config');
    expect(result.status).toBe('ok');
    expect(result.configVersion).toBe(firstProfile.configVersion);
    expect(result.etag).toBe('W/"900-x"');
  });

  it('an unknown-path 404 (a server with no config endpoint) is not an error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => 'Cannot GET /api/v2/config',
      })
    );
    const result = await fetchClientConfig('https://legacy.example', {});
    expect(result.status).toBe('unsupported');
    expect(result.config).toBeUndefined();
  });

  it('a malformed document is refused with reasons, not applied', async () => {
    const broken = structuredClone(firstProfile) as Record<string, unknown>;
    (broken.config as Record<string, { branding: Record<string, unknown> }>).branding.colors =
      'red';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => broken,
      })
    );
    const result = await fetchClientConfig('https://channel.example.test', {});
    expect(result.status).toBe('invalid');
    expect(result.config).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('a network failure is reported, never silent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await fetchClientConfig('https://channel.example.test', {});
    expect(result.status).toBe('unavailable');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('sends the recorded ETag so an unchanged config costs a 304', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 304,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchClientConfig('https://channel.example.test', {
      etag: 'W/"900-x"',
    });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['If-None-Match']).toBe('W/"900-x"');
    expect(result.status).toBe('not-modified');
  });

  it('endpoint constant is the path the live server answers', () => {
    expect(CLIENT_CONFIG_ENDPOINT).toBe('/api/v2/config');
  });
});

describe('effective config is stored, and a bad remote keeps the last known good', () => {
  it('records the config version and source for support and analytics', () => {
    const store = makeStore();
    const resolved = resolveClientConfig({ bundled: null, remote: firstProfile });
    saveEffectiveConfig(store, resolved);
    const back = loadEffectiveConfig(store);
    expect(back?.config.channel.name).toBe('Example Channel');
    expect(store.data[CONFIG_STORAGE_KEY]).toContain(firstProfile.configVersion as string);
    expect(store.data[CONFIG_STORAGE_KEY]).toContain('"source":"server"');
  });

  it('a later invalid fetch falls back to the stored last-known-good, not to defaults', () => {
    const store = makeStore();
    saveEffectiveConfig(store, resolveClientConfig({ bundled: null, remote: firstProfile }));
    const recovered = loadEffectiveConfig(store);
    const resolved = resolveClientConfig({
      bundled: null,
      remote: { apiVersion: 999, config: {} },
      lastKnownGood: recovered ?? undefined,
    });
    expect(resolved.source).toBe('last-known-good');
    expect(resolved.config.channel.name).toBe('Example Channel');
  });
});

describe('the profile is read once per refresh window, not once per screen', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('a second screen load inside the window reuses the stored profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => structuredClone(firstProfile),
    });
    vi.stubGlobal('fetch', fetchMock);
    const store = makeStore();
    await ensureClientConfig(store, 'https://channel.example.test');
    await ensureClientConfig(store, 'https://channel.example.test');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a profile that switched polling off is re-read on the next load', async () => {
    const noPoll = structuredClone(firstProfile) as Record<string, unknown>;
    (noPoll.config as Record<string, Record<string, unknown>>).client = {
      refreshIntervalSeconds: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => structuredClone(noPoll),
    });
    vi.stubGlobal('fetch', fetchMock);
    const store = makeStore();
    await ensureClientConfig(store, 'https://channel.example.test');
    await ensureClientConfig(store, 'https://channel.example.test');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('bounded refresh carries a kill switch to a running client', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('re-applies a flipped feature flag inside the configured interval', async () => {
    const served = structuredClone(firstProfile);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => structuredClone(served),
      }))
    );
    const applied: boolean[] = [];
    const stop = startConfigRefresh({
      baseUrl: 'https://channel.example.test',
      intervalSeconds: 60,
      onChange: (resolved) => applied.push(resolved.config.features.search === true),
    });
    // The first interval elapses after the startup fetch already applied the
    // config, so the poll - not an immediate second request - carries the change.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(applied).toEqual([true]);
    (served.config as Record<string, { features: Record<string, unknown> }>).features.search =
      false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(applied).toEqual([true, false]);
    stop();
    vi.unstubAllGlobals();
  });

  it('intervalSeconds <= 0 disables polling entirely', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => structuredClone(firstProfile),
    });
    vi.stubGlobal('fetch', fetchMock);
    const stop = startConfigRefresh({
      baseUrl: 'https://channel.example.test',
      intervalSeconds: 0,
      onChange: () => {},
    });
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).not.toHaveBeenCalled();
    stop();
    vi.unstubAllGlobals();
  });
});
