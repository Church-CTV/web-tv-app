/**
 * Server connection and API contract — mirroring the Roku-Server-Template API surface.
 * All platforms share this contract for server communication.
 */

export interface ServerEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  contentType?: string;
  requiresAuth?: boolean;
  rateLimit?: { max: number; windowMs: number };
}

export interface ServerConfig {
  /** Base URL of the server */
  baseUrl: string;

  /** Request timeout in seconds */
  timeout: number;

  /** Retry configuration */
  retry: {
    maxAttempts: number;
    baseDelayMs: number;
  };
}

/** All server endpoints — matches the actual API surface from Roku-Server-Template */
export const SERVER_ENDPOINTS: Record<string, ServerEndpoint> = {
  feed: { method: 'GET', path: '/feed' },
  stream: { method: 'GET', path: '/stream/{videoName}' },
  live: { method: 'GET', path: '/live' },
  health: { method: 'GET', path: '/health' },

  analytics: {
    method: 'POST',
    path: '/api/analytics',
    contentType: 'application/json',
    rateLimit: { max: 100, windowMs: 60000 },
  },
  analyticsV1: {
    method: 'POST',
    path: '/api/v1/analytics',
    contentType: 'application/json',
    rateLimit: { max: 100, windowMs: 60000 },
  },
  analyticsEvents: {
    method: 'GET',
    path: '/api/v1/analytics/events',
  },
  analyticsStats: {
    method: 'GET',
    path: '/api/v1/analytics/stats',
  },
  analyticsDevices: {
    method: 'GET',
    path: '/api/v1/analytics/devices',
  },
  heartbeat: {
    method: 'POST',
    path: '/api/heartbeat',
    contentType: 'application/json',
  },

  schedule: { method: 'GET', path: '/api/schedule' },
  scheduleLive: { method: 'GET', path: '/api/schedule/live' },
  scheduleNext: { method: 'GET', path: '/api/schedule/next' },
  scheduleUpcoming: { method: 'GET', path: '/api/schedule/upcoming' },
};

/**
 * Build a full URL for a server endpoint
 */
export function buildUrl(baseUrl: string, endpointPath: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = endpointPath.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Server health check response
 */
export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

/**
 * Analytics stats response
 */
export interface AnalyticsStatsResponse {
  period: string;
  groupBy: string;
  summary: {
    totalEvents: number;
    uniqueDevices: number;
  };
  eventsOverTime: { period: string; count: number }[];
  typeBreakdown: { event_type: string; count: number }[];
  topScreens: { screenName: string; contentTitle: string | null; count: number }[];
  topContent: { contentTitle: string; contentId: string | null; count: number }[];
  errorBreakdown: { errorType: string; context: string; count: number }[];
}

/**
 * Device info from server registry
 */
export interface DeviceInfoResponse {
  id: string;
  channel_name: string | null;
  app_version: string | null;
  first_seen: string;
  last_seen: string;
  event_count: number;
}
