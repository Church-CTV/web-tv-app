// Core library — platform-agnostic shared logic
// Re-exports all major modules for convenient imports

// Analytics
export { Analytics } from './analytics/Analytics';
export {
  getAnalyticsInstance,
  setAnalyticsInstance,
  createAnalyticsInstance,
} from './analytics/EventTracker';
export { redactSensitive, redactURLParams } from './analytics/Redact';
export {
  ANALYTICS_LEGACY_PATH,
  analyticsEnvelopeErrors,
  buildExportBody,
  buildV2ExportEnvelope,
  resolveAnalyticsEndpoint,
} from './analytics/AnalyticsEndpoint';
export type { AnalyticsEndpoint, AnalyticsTransportMode } from './analytics/AnalyticsEndpoint';

// Feed Parser
export {
  getMonthKeys,
  getAllVideos,
  groupVideosByMonth,
  filterByGenre,
  filterBySeries,
  filterByPastor,
  sortByReleaseDate,
  validateFeed,
  resolvePlayableUrl,
  getCardStyle,
  getClientConfig,
} from './feed/FeedParser';

// Search
export { searchVideos, debounce } from './search/Search';

// Preferences
export {
  savePreference,
  loadPreference,
  removePreference,
  getAllPreferences,
  setLayoutPreference,
  getLayoutPreference,
  setThemePreference,
  getThemePreference,
  setPlaybackPosition,
  getPlaybackPosition,
  setShareUsagePreference,
  getShareUsagePreference,
} from './preferences/Preferences';

// Watch Later
export {
  addToWatchLater,
  removeFromWatchLater,
  isInWatchLater,
  getWatchLater,
  clearWatchLater,
  getWatchLaterCount,
} from './watch-later/WatchLater';

// Continue Watching
export {
  savePosition,
  getPosition,
  hasPartiallyWatched,
  getContinueWatching,
  removeFromContinueWatching,
  clearContinueWatching,
} from './continue-watching/ContinueWatching';

// Crash Reporting
export {
  captureError,
  saveCrash,
  getPendingCrashes,
  clearCrashes,
  handleUnhandledError,
} from './crash-reporting/CrashReporter';

// Support Bundle
export { createSupportBundle } from './support-bundle/SupportBundle';

// Server Config
export {
  saveServerConfig,
  loadServerConfig,
  getServerBaseUrl,
  isUrlValid,
  isUrlValidForEnvironment,
  validateServerConfig,
  buildEndpointUrl,
  buildPollHeaders,
  updateConfigFromResponse,
} from './server-config/ServerConfig';

// HTTP Client
export { get, post, HttpError } from './utils/HttpClient';
export type { HttpClientConfig, HttpErrorCode } from './utils/HttpClient';
export { mapHttpError, isUserFacingError, isRetryable } from './utils/HttpErrorMapping';
export type { ScreenError, ScreenErrorType } from './utils/HttpErrorMapping';

// Accessibility / WCAG contrast utilities
export {
  contrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  meetsWCAGAALargeText,
  parseColor,
} from './utils/ContrastRatio';

// Types
export type { VideoItem } from './feed/FeedParser';
export type {
  LayoutPreference,
  ThemePreference,
  PreferencesStore,
} from './preferences/Preferences';
export type { WatchLaterStore } from './watch-later/WatchLater';
export type { ContinueWatchingStore } from './continue-watching/ContinueWatching';
export type { CrashReport, CrashReporterStore } from './crash-reporting/CrashReporter';
export type { ServerConfigEntry } from './server-config/ServerConfig';

// Delivered client profile (CONFIGURATION.md): validation, precedence,
// last-known-good retention and the bounded refresh that carries a kill switch.
export {
  CLIENT_CONFIG_ENDPOINT,
  CONFIG_STORAGE_KEY,
  DEFAULT_CLIENT_CONFIG,
  validateClientConfig,
  endpointOriginErrors,
  mergeClientConfig,
  resolveClientConfig,
  fetchClientConfig,
  saveEffectiveConfig,
  loadEffectiveConfig,
  getEffectiveConfig,
  ensureClientConfig,
  startConfigRefresh,
} from './server-config/ClientConfig';
export type {
  ClientConfig,
  ClientConfigDocument,
  ClientConfigRecord,
  ConfigSource,
  ResolvedClientConfig,
} from './server-config/ClientConfig';
