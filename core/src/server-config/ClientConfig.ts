/**
 * Client config (CONFIGURATION.md, owner mandate 2026-11-07).
 *
 * One shared implementation per platform builds every channel; a channel is a
 * versioned JSON profile, never a code fork. The effective value of any
 * config-driven field resolves as:
 *
 *   code/schema fallback (DEFAULT_CLIENT_CONFIG)
 *     < bundled channel/environment profile (build-time import)
 *       < validated server config delivered to this client (GET /api/v2/config)
 *
 * The remote document is validated whole before it is applied: an unknown key,
 * an unsupported API version, a wrong type or an out-of-range tunable is
 * refused with a machine-readable reason and the previous effective config
 * survives untouched (last-known-good). Endpoints a remote document may name
 * are origin-checked against the server the client is already configured for -
 * a remote config is data, not a way to point the client somewhere else.
 *
 * The live shape this module ingests is captured verbatim in
 * `shared/test-fixtures/live-2026-11-09/` (see PROVENANCE.json there), so the
 * schema is pinned against what production actually emits, not against a guess.
 */

import { buildEndpointUrl } from './ServerConfig';

/** Path the current ctv-platform-server answers the client profile on. */
export const CLIENT_CONFIG_ENDPOINT = '/api/v2/config';

/** Storage key holding the effective config record (last-known-good). */
export const CONFIG_STORAGE_KEY = 'ctv_client_config';

export type ConfigSource = 'code-defaults' | 'bundled-profile' | 'server' | 'last-known-good';

export interface ClientConfig {
  channel: {
    name: string;
    description: string;
    language: string;
    copyright: string;
  };
  features: {
    layoutPreference: string;
    search: boolean;
    deepLinking: boolean;
    analytics: boolean;
    crashReporting: boolean;
    overhangLogo: boolean;
    overhangClock: boolean;
    overhangOptions: boolean;
  };
  content: {
    /** Empty means "the configured server's legacy /feed document". */
    sourceUrl: string;
    maxRows: number;
    maxItemsPerRow: number;
    retryAttempts: number;
    retryDelayMs: number;
    fetchTimeout: number;
  };
  analytics: {
    enabled: boolean;
    exportUrl: string;
    exportIntervalSeconds: number;
    maxEventsPerBatch: number;
    flushOnError: boolean;
  };
  client: {
    /**
     * How often a running client re-reads the server profile. This is the
     * bounded refresh that carries an operational kill switch to a client that
     * is already on; 0 disables polling, so a flag change then needs a restart.
     */
    refreshIntervalSeconds: number;
    /**
     * Ceiling on the one config request made during startup. It is shorter than
     * `content.fetchTimeout` on purpose: an unreachable server must not add half
     * a minute to launching the channel, and the content already on screen is
     * governed by its own timeouts.
     */
    configFetchTimeoutSeconds: number;
  };
  [section: string]: unknown;
}

export interface ClientConfigDocument {
  apiVersion: number;
  configVersion: string;
  config: Record<string, unknown>;
}

export interface ResolvedClientConfig {
  config: ClientConfig;
  source: ConfigSource;
  configVersion: string | null;
  errors: string[];
}

export interface ClientConfigRecord extends ResolvedClientConfig {
  fetchedAt: number | null;
  etag: string | null;
  /** The server this record was read from, so a server change invalidates it. */
  baseUrl: string | null;
  /** 'applied' or 'refused' - a refusal keeps the previous config and says so. */
  status: 'applied' | 'refused';
}

/**
 * Code/schema fallbacks. `channel.name` is deliberately empty: an organisation
 * name is not a code constant, it comes from the profile or the feed.
 */
export const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  channel: { name: '', description: '', language: 'en', copyright: '' },
  features: {
    layoutPreference: 'leftnav',
    search: true,
    deepLinking: true,
    analytics: true,
    crashReporting: true,
    overhangLogo: true,
    overhangClock: true,
    overhangOptions: true,
  },
  content: {
    sourceUrl: '',
    maxRows: 20,
    maxItemsPerRow: 12,
    retryAttempts: 3,
    retryDelayMs: 2000,
    fetchTimeout: 30,
  },
  analytics: {
    enabled: true,
    exportUrl: '',
    exportIntervalSeconds: 300,
    maxEventsPerBatch: 50,
    flushOnError: true,
  },
  client: { refreshIntervalSeconds: 900, configFetchTimeoutSeconds: 5 },
};

type LeafType =
  'string' | 'boolean' | 'integer' | 'number' | 'uri' | 'color' | 'font' | 'stringArray';

interface LeafSpec {
  t: LeafType;
  required?: boolean;
  min?: number;
  max?: number;
}

type Spec = { [key: string]: LeafSpec | Spec };

/**
 * The field table. Anything not listed here is refused, so a typo or a field
 * this client does not implement cannot look like support it does not have.
 * `client` is optional: today's server does not send it, and a client default
 * owns the value until it does.
 */
const CONFIG_SCHEMA: Spec = {
  apiVersion: { t: 'integer', required: true, min: 2, max: 2 },
  configVersion: { t: 'string', required: true },
  // The server's own fail-closed reporting: keys in the operator's profile it
  // refused, and a machine-readable notice. The client keeps them and surfaces
  // them, so "the profile is shorter than the operator wrote" is visible.
  refusedKeys: { t: 'stringArray' },
  configNotice: { t: 'string' },
  config: {
    channel: {
      name: { t: 'string', required: true },
      description: { t: 'string' },
      language: { t: 'string' },
      copyright: { t: 'string' },
    },
    branding: {
      colors: {
        background: { t: 'color' },
        surface: { t: 'color' },
        accent: { t: 'color' },
        textPrimary: { t: 'color' },
        textSecondary: { t: 'color' },
        focus: { t: 'color' },
        error: { t: 'color' },
      },
      images: {
        overhangLogo: { t: 'uri' },
        backgroundImage: { t: 'uri' },
        iconFocus: { t: 'uri' },
        liveStreamUrl: { t: 'uri' },
      },
      fonts: {
        title: { t: 'font' },
        body: { t: 'font' },
        caption: { t: 'font' },
        heading: { t: 'font' },
      },
      spacing: {
        marginHorizontal: { t: 'integer', min: 0 },
        marginVertical: { t: 'integer', min: 0 },
      },
      animation: {
        cardScale: { t: 'number', min: 0, max: 3 },
        transitionDuration: { t: 'number', min: 0, max: 10 },
      },
    },
    features: {
      layoutPreference: { t: 'string' },
      search: { t: 'boolean' },
      deepLinking: { t: 'boolean' },
      analytics: { t: 'boolean' },
      crashReporting: { t: 'boolean' },
      overhangLogo: { t: 'boolean' },
      overhangClock: { t: 'boolean' },
      overhangOptions: { t: 'boolean' },
    },
    ui: {
      backgroundColor: { t: 'color' },
      welcome: {
        enabled: { t: 'boolean' },
        title: { t: 'string' },
        subtitle: { t: 'string' },
      },
      error: {
        title: { t: 'string' },
        message: { t: 'string' },
        retryLabel: { t: 'string' },
      },
      loading: { message: { t: 'string' } },
    },
    cardStyle: {
      showTitle: { t: 'boolean' },
      showDescription: { t: 'boolean' },
      titleFont: { t: 'font' },
      descriptionFont: { t: 'font' },
      titleColor: { t: 'color' },
      descriptionColor: { t: 'color' },
      titleNumLines: { t: 'integer', min: 0 },
      descriptionNumLines: { t: 'integer', min: 0 },
      showDetailTitle: { t: 'boolean' },
      showDetailDescription: { t: 'boolean' },
      detailTitleFont: { t: 'font' },
      detailDescriptionFont: { t: 'font' },
      detailTitleColor: { t: 'color' },
      detailDescriptionColor: { t: 'color' },
      detailTitleNumLines: { t: 'integer', min: 0 },
      detailDescriptionNumLines: { t: 'integer', min: 0 },
    },
    content: {
      sourceUrl: { t: 'uri', required: true },
      userAgent: { t: 'string' },
      maxRows: { t: 'integer', required: true, min: 1 },
      maxItemsPerRow: { t: 'integer', required: true, min: 1 },
      retryAttempts: { t: 'integer', min: 0 },
      retryDelayMs: { t: 'integer', min: 0 },
      fetchTimeout: { t: 'integer', min: 1 },
      sslCertificates: { t: 'string' },
    },
    analytics: {
      enabled: { t: 'boolean' },
      exportUrl: { t: 'uri', required: true },
      exportIntervalSeconds: { t: 'integer', min: 1 },
      maxEventsPerBatch: { t: 'integer', min: 1 },
      flushOnError: { t: 'boolean' },
    },
    server: { baseUrl: { t: 'uri', required: true } },
    client: {
      refreshIntervalSeconds: { t: 'integer', min: 0 },
      configFetchTimeoutSeconds: { t: 'integer', min: 1 },
    },
  },
};

function isLeaf(spec: LeafSpec | Spec): spec is LeafSpec {
  return typeof (spec as LeafSpec).t === 'string';
}

const COLOR_RE = /^0x[0-9a-fA-F]{6}$/;
const FONT_RE = /^font:/;

function typeOf(value: unknown): LeafType | 'object' | 'array' | 'null' | 'undefined' | 'number' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value as 'string' | 'boolean' | 'undefined';
}

function checkLeaf(path: string, value: unknown, spec: LeafSpec): string[] {
  const actual = typeOf(value);
  if (spec.t === 'stringArray') {
    if (actual !== 'array') return [`invalid-type:${path} expected array of strings`];
    const bad = (value as unknown[]).filter((entry) => typeof entry !== 'string');
    return bad.length ? [`invalid-type:${path}[] expected strings`] : [];
  }
  if (spec.t === 'uri' || spec.t === 'color' || spec.t === 'font') {
    if (actual !== 'string') return [`invalid-type:${path} expected ${spec.t} string`];
    if (spec.t === 'color' && !COLOR_RE.test(value as string)) {
      return [`invalid-format:${path} expected 0xRRGGBB`];
    }
    if (spec.t === 'font' && !FONT_RE.test(value as string)) {
      return [`invalid-format:${path} expected font:<name>`];
    }
    return [];
  }
  if (actual !== spec.t && !(spec.t === 'number' && actual === 'integer')) {
    return [`invalid-type:${path} expected ${spec.t}`];
  }
  const errors: string[] = [];
  const num = value as number;
  if (spec.min !== undefined && num < spec.min) {
    errors.push(`out-of-range:${path} must be >= ${spec.min}`);
  }
  if (spec.max !== undefined && num > spec.max) {
    errors.push(`out-of-range:${path} must be <= ${spec.max}`);
  }
  return errors;
}

function walk(spec: Spec, value: Record<string, unknown>, prefix: string): string[] {
  const errors: string[] = [];
  for (const [key, child] of Object.entries(spec)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in value)) {
      if (isLeaf(child) && child.required) errors.push(`missing-required:${path}`);
      continue;
    }
    const actual = value[key];
    if (isLeaf(child)) {
      if (actual === undefined || actual === null) {
        if (child.required) errors.push(`missing-required:${path}`);
        continue;
      }
      errors.push(...checkLeaf(path, actual, child));
      continue;
    }
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      errors.push(`invalid-type:${path} expected object`);
      continue;
    }
    errors.push(...walk(child, actual as Record<string, unknown>, path));
  }
  for (const key of Object.keys(value)) {
    if (!(key in spec)) {
      errors.push(`unknown-config-key:${prefix ? `${prefix}.${key}` : key}`);
    }
  }
  return errors;
}

/**
 * Validate a delivered profile. Fail closed: an unknown key, an unsupported
 * API version, a wrong type, a bad format or an out-of-range value each produce
 * a machine-readable reason naming the path.
 */
export function validateClientConfig(raw: unknown): { valid: boolean; errors: string[] } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['invalid-type:<root> expected object'] };
  }
  const doc = raw as Record<string, unknown>;
  const errors = walk(CONFIG_SCHEMA, doc, '');
  return { valid: errors.length === 0, errors };
}

/**
 * Origin policy: a remote profile may name endpoints on the server the client
 * is already configured for, and nowhere else.
 */
export function endpointOriginErrors(
  config: Record<string, unknown>,
  allowedBaseUrl: string
): string[] {
  let allowed: URL;
  try {
    allowed = new URL(allowedBaseUrl);
  } catch {
    return [`invalid-base-url:${allowedBaseUrl}`];
  }
  const errors: string[] = [];
  const check = (path: string) => {
    const section = path.split('.')[0];
    const leaf = path.split('.')[1];
    const value = (config[section] as Record<string, unknown> | undefined)?.[leaf];
    if (typeof value !== 'string' || value === '') return;
    try {
      const parsed = new URL(value);
      if (parsed.origin !== allowed.origin) {
        errors.push(`origin-not-allowed:${path} ${parsed.origin} != ${allowed.origin}`);
      }
    } catch {
      errors.push(`invalid-url:${path}`);
    }
  };
  check('content.sourceUrl');
  check('analytics.exportUrl');
  return errors;
}

/**
 * Deep merge that keeps unrelated defaults and respects explicit false, zero
 * and empty-string overrides. `undefined`/`null` in the override mean "not
 * specified" and never erase a default.
 */
export function mergeClientConfig<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | null | undefined
): T {
  if (!override) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) continue;
    const current = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      out[key] = mergeClientConfig(
        current as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Read a validated document's payload without asserting its shape. Validation
 * has already refused anything malformed; this only narrows for the compiler.
 */
function readDocument(doc: Record<string, unknown>): {
  config: Record<string, unknown>;
  configVersion: string | null;
} {
  return {
    config:
      typeof doc.config === 'object' && doc.config !== null && !Array.isArray(doc.config)
        ? (doc.config as Record<string, unknown>)
        : {},
    configVersion: typeof doc.configVersion === 'string' ? doc.configVersion : null,
  };
}

/**
 * Resolve the effective config for this client. Levels are applied in order and
 * only whole documents are applied, so a rejected remote profile can never
 * leave half-applied values behind.
 */
export function resolveClientConfig(input: {
  bundled?: Record<string, unknown> | null;
  remote?: Record<string, unknown> | null;
  lastKnownGood?: ClientConfigRecord | null;
  allowedBaseUrl?: string;
}): ResolvedClientConfig {
  const { bundled = null, remote = null, lastKnownGood = null, allowedBaseUrl } = input;

  const codeOnly: ClientConfig = mergeClientConfig(
    DEFAULT_CLIENT_CONFIG as unknown as Record<string, unknown>,
    {}
  ) as unknown as ClientConfig;

  let config = codeOnly;
  let source: ConfigSource = 'code-defaults';
  let configVersion: string | null = null;

  if (bundled) {
    const bundledCheck = validateClientConfig(bundled);
    if (bundledCheck.valid) {
      const doc = readDocument(bundled);
      config = mergeClientConfig(
        config as unknown as Record<string, unknown>,
        doc.config
      ) as unknown as ClientConfig;
      source = 'bundled-profile';
      configVersion = doc.configVersion;
    }
  }

  if (remote) {
    const errors = [
      ...validateClientConfig(remote).errors,
      ...(allowedBaseUrl ? endpointOriginErrors(readDocument(remote).config, allowedBaseUrl) : []),
    ];
    if (errors.length === 0) {
      const doc = readDocument(remote);
      config = mergeClientConfig(
        config as unknown as Record<string, unknown>,
        doc.config
      ) as unknown as ClientConfig;
      source = 'server';
      configVersion = doc.configVersion;
      return { config, source, configVersion, errors: [] };
    }
    // Refused whole. Fall back to the last document that was accepted.
    if (lastKnownGood) {
      return {
        config: lastKnownGood.config,
        source: 'last-known-good',
        configVersion: lastKnownGood.configVersion,
        errors,
      };
    }
    return { config, source, configVersion, errors };
  }

  if (source === 'code-defaults' && lastKnownGood && !bundled) {
    return {
      config: lastKnownGood.config,
      source: 'last-known-good',
      configVersion: lastKnownGood.configVersion,
      errors: [],
    };
  }
  return { config, source, configVersion, errors: [] };
}

export interface FetchClientConfigResult {
  status: 'ok' | 'not-modified' | 'unsupported' | 'invalid' | 'unavailable';
  config?: Record<string, unknown>;
  configVersion?: string;
  etag?: string | null;
  /** Keys the server itself refused while building this profile. */
  refusedKeys?: string[];
  configNotice?: string;
  errors: string[];
}

interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * GET the client profile. A server that has no such endpoint (404/403) is
 * `unsupported`, not a failure; a document we cannot accept is `invalid`; a
 * transport problem is `unavailable`. Nothing is applied here.
 */
export async function fetchClientConfig(
  baseUrl: string,
  options: { etag?: string | null; signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<FetchClientConfigResult> {
  const url = buildEndpointUrl(baseUrl, CLIENT_CONFIG_ENDPOINT);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.etag) headers['If-None-Match'] = options.etag;

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onOuterAbort);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const etag = response.headers?.get?.('etag') ?? null;
    if (response.status === 304) {
      return { status: 'not-modified', etag, errors: [] };
    }
    if (response.status === 404 || response.status === 403) {
      return { status: 'unsupported', etag, errors: [`config-endpoint-${response.status}:${url}`] };
    }
    if (!response.ok) {
      return { status: 'unavailable', etag, errors: [`http-${response.status}:${url}`] };
    }
    let doc: unknown;
    try {
      doc = await response.json();
    } catch {
      return { status: 'invalid', etag, errors: ['invalid-json'] };
    }
    const validation = validateClientConfig(doc);
    if (!validation.valid) {
      return { status: 'invalid', etag, errors: validation.errors };
    }
    const typed = doc as ClientConfigDocument & { refusedKeys?: string[]; configNotice?: string };
    return {
      status: 'ok',
      config: typed.config,
      configVersion: typed.configVersion,
      etag,
      refusedKeys: Array.isArray(typed.refusedKeys) ? typed.refusedKeys : undefined,
      configNotice: typeof typed.configNotice === 'string' ? typed.configNotice : undefined,
      errors: [],
    };
  } catch (error) {
    return {
      status: 'unavailable',
      errors: [error instanceof Error ? `transport:${error.message}` : 'transport:unknown'],
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}

type StorageLike =
  Store | { get(key: string): string | null; set(key: string, value: string): void };

export function saveEffectiveConfig(
  store: StorageLike,
  resolved: ResolvedClientConfig,
  meta: {
    fetchedAt?: number | null;
    etag?: string | null;
    baseUrl?: string | null;
    status?: 'applied' | 'refused';
  } = {}
): ClientConfigRecord {
  const record: ClientConfigRecord = {
    config: resolved.config,
    source: resolved.source,
    configVersion: resolved.configVersion,
    errors: resolved.errors,
    fetchedAt: meta.fetchedAt ?? Date.now(),
    etag: meta.etag ?? null,
    baseUrl: meta.baseUrl ?? null,
    status: meta.status ?? (resolved.errors.length ? 'refused' : 'applied'),
  };
  store.set(CONFIG_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function loadEffectiveConfig(store: {
  get(key: string): string | null;
}): ClientConfigRecord | null {
  try {
    const raw = store.get(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientConfigRecord;
    if (!parsed || typeof parsed !== 'object' || !parsed.config) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Synchronous read of the effective config, for render paths that cannot await. */
export function getEffectiveConfig(store: { get(key: string): string | null }): ClientConfig {
  const record = loadEffectiveConfig(store);
  if (!record) return DEFAULT_CLIENT_CONFIG;
  return mergeClientConfig(
    DEFAULT_CLIENT_CONFIG as unknown as Record<string, unknown>,
    record.config as unknown as Record<string, unknown>
  ) as unknown as ClientConfig;
}

/**
 * Read the server profile for this client and make it the effective config,
 * at most once per `client.refreshIntervalSeconds` per server.
 *
 * A rejected or unavailable remote profile never clears what is already on
 * screen: the last accepted document is kept and the failure is recorded in the
 * same storage record, where support tooling can read it.
 */
export async function ensureClientConfig(
  store: StorageLike,
  baseUrl: string,
  options: {
    bundled?: Record<string, unknown> | null;
    force?: boolean;
    signal?: AbortSignal;
    now?: number;
    timeoutMs?: number;
  } = {}
): Promise<ResolvedClientConfig> {
  const previous = loadEffectiveConfig(store);
  const refreshIntervalSeconds = getEffectiveConfig(store).client.refreshIntervalSeconds;
  const now = options.now ?? Date.now();

  if (
    !options.force &&
    previous &&
    previous.baseUrl === baseUrl &&
    refreshIntervalSeconds > 0 &&
    previous.fetchedAt !== null &&
    now - previous.fetchedAt < refreshIntervalSeconds * 1000 &&
    previous.status === 'applied'
  ) {
    return {
      config: previous.config,
      source: previous.source,
      configVersion: previous.configVersion,
      errors: previous.errors,
    };
  }

  const fetched = await fetchClientConfig(baseUrl, {
    etag: previous?.baseUrl === baseUrl ? previous.etag : null,
    signal: options.signal,
    timeoutMs:
      (options.timeoutMs ?? getEffectiveConfig(store).client.configFetchTimeoutSeconds ?? 5) * 1000,
  });

  if (fetched.status === 'not-modified' && previous) {
    return saveEffectiveConfig(
      store,
      {
        config: previous.config,
        source: previous.source,
        configVersion: previous.configVersion,
        errors: [],
      },
      { fetchedAt: now, etag: fetched.etag ?? previous.etag, baseUrl, status: 'applied' }
    );
  }

  // Only a document the server actually delivered as the profile can be
  // applied. 404/403/5xx/transport failures resolve from defaults or the
  // last accepted document, never from the failing response body.
  const resolved = resolveClientConfig({
    bundled: options.bundled ?? null,
    remote:
      fetched.status === 'ok'
        ? { apiVersion: 2, configVersion: fetched.configVersion, config: fetched.config }
        : null,
    lastKnownGood: previous,
    allowedBaseUrl: baseUrl,
  });

  return saveEffectiveConfig(
    store,
    {
      config: resolved.config,
      source: resolved.source,
      configVersion: resolved.configVersion,
      errors: [
        ...resolved.errors,
        ...fetched.errors,
        ...(fetched.refusedKeys ?? []).map((key) => `server-refused:${key}`),
      ],
    },
    {
      fetchedAt: now,
      etag: fetched.etag ?? (previous?.baseUrl === baseUrl ? previous.etag : null),
      baseUrl,
      // A profile we were handed but cannot accept is a refusal; a server that
      // has no profile endpoint, or that we could not reach, is a fallback.
      status: fetched.status === 'invalid' ? 'refused' : 'applied',
    }
  );
}

/**
 * Bounded refresh: a running client re-reads the profile on an interval, so an
 * operational kill switch reaches a set that is already on air. `intervalSeconds
 * <= 0` disables polling and returns a no-op stop.
 */
export function startConfigRefresh(input: {
  baseUrl: string;
  intervalSeconds: number;
  onChange: (resolved: ResolvedClientConfig) => void;
  bundled?: Record<string, unknown> | null;
}): () => void {
  const { baseUrl, intervalSeconds, onChange, bundled } = input;
  if (!(intervalSeconds > 0)) return () => {};
  const timer = setInterval(() => {
    void (async () => {
      const fetched = await fetchClientConfig(baseUrl, {});
      if (fetched.status === 'not-modified') return;
      if (fetched.status !== 'ok') return;
      const resolved = resolveClientConfig({
        bundled: bundled ?? null,
        remote: { apiVersion: 2, configVersion: fetched.configVersion, config: fetched.config },
        allowedBaseUrl: baseUrl,
      });
      if (resolved.errors.length === 0) onChange(resolved);
    })();
  }, intervalSeconds * 1000);
  return () => clearInterval(timer);
}
