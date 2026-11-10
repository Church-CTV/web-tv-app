/**
 * Server Config module — manage server URL and configuration.
 * Supports config polling with If-Modified-Since / ETag.
 */

export interface ServerConfigEntry {
  baseUrl: string;
  timeout: number;
  etag?: string;
  lastModified?: string;
}

const CONFIG_KEY = 'ctv_server_config';

/**
 * Save server configuration
 */
export function saveServerConfig(
  store: { get(key: string): string | null; set(key: string, value: string): void },
  config: ServerConfigEntry
): void {
  store.set(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Load server configuration
 */
export function loadServerConfig(store: {
  get(key: string): string | null;
}): ServerConfigEntry | null {
  try {
    const data = store.get(CONFIG_KEY);
    if (!data) return null;
    return JSON.parse(data) as ServerConfigEntry;
  } catch {
    return null;
  }
}

/**
 * Get the base URL from config or fallback
 */
export function getServerBaseUrl(store: { get(key: string): string | null }): string {
  const config = loadServerConfig(store);
  if (config && config.baseUrl) {
    // Strip trailing slashes to prevent protocol-relative URLs like //feed
    // from being created when concatenated with endpoint paths.
    return config.baseUrl.replace(/\/+$/, '');
  }
  return '';
}

/**
 * Validate a server URL with optional production constraints.
 *
 * In production, only HTTPS or loopback (localhost/127.0.0.1) HTTP is allowed.
 * In dev/E2E, any valid http:// or https:// URL is permitted.
 *
 * @param url - The URL string to validate
 * @param isProduction - True if running in production mode (import.meta.env.PROD)
 */
export function isUrlValidForEnvironment(url: string, isProduction: boolean): boolean {
  if (!isUrlValid(url)) return false;
  if (!isProduction) return true;
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  return parsed.protocol === 'https:' || isLoopback;
}

/**
 * Validate the server configuration at startup and return a clear error
 * message if invalid, or null if valid. In production, validates that the
 * server URL is HTTPS or loopback. In dev, only checks URL format.
 *
 * @param store - Storage to load config from
 * @param isProduction - True if running in production mode
 * @returns Error message string if invalid, null if valid
 */
export function validateServerConfig(
  store: { get(key: string): string | null },
  isProduction: boolean
): string | null {
  const config = loadServerConfig(store);

  if (!config) {
    return null;
  }

  const url = config.baseUrl;

  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return `Server URL has invalid protocol (${url}); expected http:// or https://`;
      }
      if (isProduction) {
        const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
        const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
        if (parsed.protocol !== 'https:' && !isLoopback) {
          return `Production requires HTTPS or loopback; got ${url}. Use https:// or http://localhost`;
        }
      }
    } catch {
      return `Server URL is malformed: ${url}`;
    }
  }

  if (config.timeout != null && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    return `Server timeout must be a positive number, got ${config.timeout}`;
  }

  return null;
}

/**
 * Validate a server URL
 */
export function isUrlValid(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Build a full URL for an endpoint path
 */
export function buildEndpointUrl(baseUrl: string, endpointPath: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = endpointPath.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Build request headers for config polling with conditional requests.
 * Uses If-Modified-Since and If-None-Match headers from stored config.
 */
export function buildPollHeaders(config: ServerConfigEntry | null): {
  ifModifiedSince?: string;
  ifNoneMatch?: string;
} {
  if (!config) return {};

  const headers: { ifModifiedSince?: string; ifNoneMatch?: string } = {};

  if (config.lastModified) {
    headers.ifModifiedSince = config.lastModified;
  }

  if (config.etag) {
    headers.ifNoneMatch = config.etag;
  }

  return headers;
}

/**
 * Update stored config with response metadata from a successful fetch.
 * Call this after receiving a 200 response to persist ETag and lastModified.
 */
export function updateConfigFromResponse(
  config: ServerConfigEntry,
  response: { etag?: string | null; lastModified?: string | null }
): ServerConfigEntry {
  return {
    ...config,
    etag: response.etag || config.etag,
    lastModified: response.lastModified || config.lastModified,
  };
}
