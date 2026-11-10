/**
 * Data contracts — shared types mirroring the Roku-Server-Template API.
 * These types define the EXACT contract between the server and all CTV clients.
 * Changes must be coordinated between server and all client platforms.
 */

// ─── Feed Contract ────────────────────────────────────────────────────────────

/**
 * Root feed object as produced by feedGenerator.js
 * Mirrors the exact structure output to output/roku_feed.json
 */
export interface Feed {
  /** Channel/organization name */
  providerName: string;

  /** ISO 8601 timestamp of last feed generation */
  lastUpdated: string;

  /** ISO 639-1 language code (e.g., "en") */
  language: string;

  /** Card display configuration */
  cardStyle: CardStyle;

  /** Embedded config sent to client */
  config: ClientConfig;

  /**
   * Month-year keys like "January 2026", "February 2026".
   * Values are arrays of video items grouped by release month.
   */
  [monthKey: string]: VideoItem[] | string | CardStyle | ClientConfig | object;
}

/**
 * Card display configuration — matches config/cardStyle and feed.config.cardStyle
 */
export interface CardStyle {
  showTitle: boolean;
  showDescription: boolean;
  titleFont: string;
  descriptionFont: string;
  titleColor: string;
  descriptionColor: string;
  titleNumLines: number;
  descriptionNumLines: number;
  showDetailTitle: boolean;
  showDetailDescription: boolean;
  detailTitleFont: string;
  detailDescriptionFont: string;
  detailTitleColor: string;
  detailDescriptionColor: string;
  detailTitleNumLines: number;
  detailDescriptionNumLines: number;
}

/**
 * Video item — each entry in a month array
 * Mirrors the structure produced by feedGenerator.js buildVideoEntry()
 */
export interface VideoItem {
  /** Unique identifier: "video-{sanitized-filename}" — used for deep linking */
  id: string;

  /** Video title */
  title: string;

  /** Short description */
  shortDescription: string;

  /** Thumbnail URL (also used for hdPosterUrl and sdPosterUrl) */
  thumbnail: string;

  /** HD poster URL */
  hdPosterUrl: string;

  /** SD poster URL */
  sdPosterUrl: string;

  /** Stream URL (uses /stream/ endpoint prefix) */
  url: string;

  /** Release date in YYYY-MM-DD format */
  releaseDate: string;

  /** Genre tags */
  genres: string[];

  /** Content metadata including duration and stream variants */
  content: Content;

  /** Date the item was added to the feed */
  dateAdded?: string;
}

/**
 * Content metadata — duration and stream variants
 */
export interface Content {
  /** Duration in seconds (integer) */
  duration: number;

  /** Array of stream variants (usually one) */
  videos: StreamEntry[];
}

/**
 * A single stream variant
 */
export interface StreamEntry {
  /** Stream URL */
  url: string;

  /** Quality label (e.g., "FHD", "HD", "SD") */
  quality: string;

  /** Video format (e.g., "MP4", "MKV") */
  videoType: string;
}

/**
 * Embedded client config — mirrored from server config.json
 */
export interface ClientConfig {
  channel: ChannelConfig;
  branding: BrandingConfig;
  cardStyle: CardStyle;
  features: FeatureFlags;
  ui: UIConfig;
  server: FeedServerConfig;
  content: ContentConfig;
  analytics: AnalyticsConfig;
  sermon?: SermonConfig;
  navItems?: NavItem[];
  pageRegistry?: Record<string, PageConfig>;
  offline?: OfflineConfig;
  giving?: GivingConfig;
  heartbeat?: HeartbeatConfig;
}

export interface ChannelConfig {
  name: string;
  description: string;
  language: string;
  copyright: string;
}

export interface BrandingConfig {
  colors: ColorConfig;
  images: ImageConfig;
  fonts: FontConfig;
  spacing: SpacingConfig;
  animation: AnimationConfig;
}

export interface ColorConfig {
  background: string;
  surface: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  focus: string;
  error: string;
}

export interface ImageConfig {
  overhangLogo: string;
  backgroundImage: string;
  iconFocus: string;
}

export interface FontConfig {
  title: string;
  body: string;
  caption: string;
  heading: string;
}

export interface SpacingConfig {
  marginHorizontal: number;
  marginVertical: number;
}

export interface AnimationConfig {
  cardScale: number;
  transitionDuration: number;
}

export interface FeatureFlags {
  layoutPreference?: 'leftnav' | 'grid';
  search: boolean;
  deepLinking: boolean;
  analytics: boolean;
  crashReporting: boolean;
  overhangLogo: boolean;
  overhangClock: boolean;
  overhangOptions: boolean;
  continueWatching?: boolean;
  liveService?: boolean;
  offlineMode?: boolean;
  sermonCategories?: boolean;
  serviceSchedule?: boolean;
  watchLater?: boolean;
}

export interface UIConfig {
  backgroundColor: string;
  welcome: WelcomeConfig;
  error: ErrorConfig;
  loading: LoadingConfig;
}

export interface WelcomeConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
}

export interface ErrorConfig {
  title: string;
  message: string;
  retryLabel: string;
}

export interface LoadingConfig {
  message: string;
}

export interface FeedServerConfig {
  baseUrl: string;
  timeout?: number;
}

export interface ContentConfig {
  maxRows?: number;
  maxItemsPerRow?: number;
}

export interface AnalyticsConfig {
  enabled: boolean;
  exportUrl: string;
  exportIntervalSeconds: number;
  maxEventsPerBatch: number;
  flushOnError: boolean;
}

export interface SermonConfig {
  scheduleUrl: string;
  liveStreamUrl: string;
  categories: SermonCategory[];
  pastors: SermonPerson[];
  series: SermonSeries[];
}

export interface SermonCategory {
  id: string;
  name: string;
  order?: number;
}

export interface SermonPerson {
  id: string;
  name: string;
}

export interface SermonSeries {
  id: string;
  name: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  screen: string;
  order?: number;
}

export interface PageConfig {
  title: string;
  components: string[];
  config?: Record<string, unknown>;
}

export interface OfflineConfig {
  maxDownloads: number;
  preferredQuality: string;
  wifiOnly: boolean;
}

export interface GivingConfig {
  donationUrl: string;
}

export interface HeartbeatConfig {
  intervalSeconds: number;
  exportUrl: string;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Extract month-year keys from a feed (non-meta keys)
 */
export function getMonthKeys(feed: Feed): string[] {
  const metaKeys = ['providerName', 'lastUpdated', 'language', 'cardStyle', 'config'];
  return Object.keys(feed).filter(
    (k) =>
      !metaKeys.includes(k) &&
      typeof feed[k as keyof Feed] !== 'string' &&
      !(k in { cardStyle: 1, config: 1 })
  ) as string[];
}

/**
 * Extract all video items from a feed
 */
export function getAllVideos(feed: Feed): VideoItem[] {
  const videos: VideoItem[] = [];
  for (const key of getMonthKeys(feed)) {
    const value = (feed as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      videos.push(...value);
    }
  }
  return videos;
}

/**
 * Validate a feed has the required structure
 */
export function validateFeed(feed: Feed): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  videoCount: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!feed.providerName) warnings.push('Missing providerName');
  if (!feed.lastUpdated) warnings.push('Missing lastUpdated');
  if (!feed.language) warnings.push('Missing language');
  if (!feed.cardStyle) warnings.push('Missing cardStyle');
  if (!feed.config) warnings.push('Missing config');

  const monthKeys = getMonthKeys(feed);
  if (monthKeys.length === 0) warnings.push('No month keys found in feed');

  const videos = getAllVideos(feed);
  for (const video of videos) {
    if (!video.id) errors.push(`Video missing id: ${JSON.stringify(video).substring(0, 80)}`);
    if (!video.title) warnings.push(`Video ${video.id || 'unknown'} missing title`);
    const nestedUrl = video.content?.videos?.find((entry) => entry?.url)?.url;
    const playable = (video.url && video.url.trim()) || nestedUrl || '';
    if (!playable) errors.push(`Video ${video.id || 'unknown'} missing playable url`);
    if (!video.content || !Array.isArray(video.content?.videos)) {
      if (playable) warnings.push(`Video ${video.id || 'unknown'} missing content.videos`);
      else errors.push(`Video ${video.id || 'unknown'} missing content.videos`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, videoCount: videos.length };
}
