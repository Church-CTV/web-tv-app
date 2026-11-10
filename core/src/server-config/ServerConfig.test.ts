/**
 * Server Config tests — save/load, URL validation, endpoint building, config polling.
 */

import { describe, it, expect } from 'vitest';
import {
  saveServerConfig,
  loadServerConfig,
  getServerBaseUrl,
  isUrlValid,
  isUrlValidForEnvironment,
  validateServerConfig,
  buildEndpointUrl,
  buildPollHeaders,
  updateConfigFromResponse,
} from './ServerConfig';

function makeMockStore() {
  const store: Record<string, string> = {};
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, val: string) => {
      store[key] = val;
    },
  };
}

describe('ServerConfig', () => {
  it('saves and loads server config', () => {
    const store = makeMockStore();
    saveServerConfig(store, { baseUrl: 'http://localhost:3000', timeout: 15 });
    const config = loadServerConfig(store);
    expect(config?.baseUrl).toBe('http://localhost:3000');
    expect(config?.timeout).toBe(15);
  });

  it('returns null when no config is set', () => {
    const store = makeMockStore();
    expect(loadServerConfig(store)).toBeNull();
  });

  it('returns empty string as fallback (relative URLs work from root)', () => {
    const store = makeMockStore();
    expect(getServerBaseUrl(store)).toBe('');
  });

  it('strips trailing slashes from configured base URL', () => {
    const store = makeMockStore();
    saveServerConfig(store, { baseUrl: 'https://example.com/', timeout: 15 });
    expect(getServerBaseUrl(store)).toBe('https://example.com');
  });

  it('returns config base URL when available', () => {
    const store = makeMockStore();
    saveServerConfig(store, { baseUrl: 'http://example.com', timeout: 15 });
    expect(getServerBaseUrl(store)).toBe('http://example.com');
  });

  it('validates valid URLs', () => {
    expect(isUrlValid('http://localhost:3000')).toBe(true);
    expect(isUrlValid('https://example.com/feed')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isUrlValid('not-a-url')).toBe(false);
    expect(isUrlValid('')).toBe(false);
    expect(isUrlValid('ftp://invalid')).toBe(false);
  });

  describe('isUrlValidForEnvironment', () => {
    it('allows http and https in dev mode', () => {
      expect(isUrlValidForEnvironment('http://example.com/feed', false)).toBe(true);
      expect(isUrlValidForEnvironment('https://example.com/feed', false)).toBe(true);
      expect(isUrlValidForEnvironment('http://localhost:3000', false)).toBe(true);
    });

    it('rejects http (non-loopback) in production mode', () => {
      expect(isUrlValidForEnvironment('http://example.com/feed', true)).toBe(false);
      expect(isUrlValidForEnvironment('http://192.168.1.10:8080/feed', true)).toBe(false);
    });

    it('allows https in production mode', () => {
      expect(isUrlValidForEnvironment('https://example.com/feed', true)).toBe(true);
      expect(isUrlValidForEnvironment('https://example.com', true)).toBe(true);
    });

    it('allows loopback http in production mode', () => {
      expect(isUrlValidForEnvironment('http://localhost:3000', true)).toBe(true);
      expect(isUrlValidForEnvironment('http://127.0.0.1:3000/feed', true)).toBe(true);
      expect(isUrlValidForEnvironment('http://[::1]:3000/feed', true)).toBe(true);
    });

    it('rejects invalid URLs in both modes', () => {
      expect(isUrlValidForEnvironment('not-a-url', true)).toBe(false);
      expect(isUrlValidForEnvironment('not-a-url', false)).toBe(false);
      expect(isUrlValidForEnvironment('', true)).toBe(false);
      expect(isUrlValidForEnvironment('ftp://example.com', true)).toBe(false);
      expect(isUrlValidForEnvironment('ftp://example.com', false)).toBe(false);
    });
  });

  it('builds endpoint URLs', () => {
    expect(buildEndpointUrl('http://localhost:3000', '/feed')).toBe('http://localhost:3000/feed');
    expect(buildEndpointUrl('http://localhost:3000/', '/feed')).toBe('http://localhost:3000/feed');
    expect(buildEndpointUrl('http://localhost:3000', 'feed')).toBe('http://localhost:3000/feed');
  });

  it('returns empty headers when no config exists', () => {
    const result = buildPollHeaders(null);
    expect(result).toEqual({});
  });

  it('returns ETag header when config has etag', () => {
    const config = { baseUrl: 'http://localhost:3000', timeout: 15, etag: 'abc123' };
    const result = buildPollHeaders(config);
    expect(result.ifNoneMatch).toBe('abc123');
    expect(result.ifModifiedSince).toBeUndefined();
  });

  it('returns lastModified header when config has lastModified', () => {
    const config = {
      baseUrl: 'http://localhost:3000',
      timeout: 15,
      lastModified: '2026-07-06',
    };
    const result = buildPollHeaders(config);
    expect(result.ifModifiedSince).toBe('2026-07-06');
    expect(result.ifNoneMatch).toBeUndefined();
  });

  it('returns both headers when config has both', () => {
    const config = {
      baseUrl: 'http://localhost:3000',
      timeout: 15,
      etag: 'abc',
      lastModified: '2026-07-06',
    };
    const result = buildPollHeaders(config);
    expect(result.ifNoneMatch).toBe('abc');
    expect(result.ifModifiedSince).toBe('2026-07-06');
  });

  it('updates config with response ETag', () => {
    const config = { baseUrl: 'http://localhost:3000', timeout: 15 };
    const updated = updateConfigFromResponse(config, { etag: 'new-etag', lastModified: null });
    expect(updated.etag).toBe('new-etag');
  });

  it('updates config with response lastModified', () => {
    const config = { baseUrl: 'http://localhost:3000', timeout: 15 };
    const updated = updateConfigFromResponse(config, { etag: null, lastModified: '2026-07-06' });
    expect(updated.lastModified).toBe('2026-07-06');
  });

  it('preserves existing headers when response omits them', () => {
    const config = {
      baseUrl: 'http://localhost:3000',
      timeout: 15,
      etag: 'old',
      lastModified: '2026-07-01',
    };
    const updated = updateConfigFromResponse(config, { etag: null, lastModified: null });
    expect(updated.etag).toBe('old');
    expect(updated.lastModified).toBe('2026-07-01');
  });

  describe('validateServerConfig', () => {
    it('returns null for null config in dev mode', () => {
      const store = makeMockStore();
      expect(validateServerConfig(store, false)).toBeNull();
    });

    it('returns null for null config in production mode', () => {
      const store = makeMockStore();
      expect(validateServerConfig(store, true)).toBeNull();
    });

    it('returns null for valid dev config', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: 'http://localhost:3000', timeout: 15 });
      expect(validateServerConfig(store, false)).toBeNull();
    });

    it('returns null for valid production config (HTTPS)', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: 'https://api.example.com', timeout: 15 });
      expect(validateServerConfig(store, true)).toBeNull();
    });

    it('returns null for valid production config (loopback)', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: 'http://localhost:3000', timeout: 15 });
      expect(validateServerConfig(store, true)).toBeNull();
    });

    it('returns error for invalid production config (non-loopback HTTP)', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: 'http://api.example.com', timeout: 15 });
      const error = validateServerConfig(store, true);
      expect(error).not.toBeNull();
      expect(error).toContain('http://');
      expect(error).toContain('localhost');
    });

    it('returns error for malformed URL in production', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: 'not-a-url', timeout: 15 });
      const error = validateServerConfig(store, true);
      expect(error).not.toBeNull();
      expect(error).toContain('not-a-url');
    });

    it('returns null for empty URL in production (relative URLs are valid)', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: '', timeout: 15 });
      const error = validateServerConfig(store, true);
      expect(error).toBeNull();
    });

    it('returns error for FTP URL in production', () => {
      const store = makeMockStore();
      saveServerConfig(store, { baseUrl: 'ftp://example.com', timeout: 15 });
      const error = validateServerConfig(store, true);
      expect(error).not.toBeNull();
      expect(error).toContain('http');
    });
  });
});
