/**
 * Feed Parser — parses and validates the server feed JSON.
 * Mirrors feedGenerator.js output structure from Roku-Server-Template.
 */

// Inline type definitions — shared/contracts is not a workspace module
export type VideoItem = {
  id: string;
  title: string;
  shortDescription: string;
  thumbnail: string;
  hdPosterUrl: string;
  sdPosterUrl: string;
  url: string;
  releaseDate: string;
  genres: string[];
  content: { duration: number; videos: { url: string; quality: string; videoType: string }[] };
  dateAdded?: string;
};

type ClientConfig = {
  channel: { name: string };
  features: Record<string, unknown>;
  [key: string]: unknown;
};

type CardStyle = {
  showTitle: boolean;
  titleFont: string;
  [key: string]: unknown;
};

const META_KEYS = ['providerName', 'lastUpdated', 'language', 'cardStyle', 'config'];

/**
 * Check if a key is a month-year key (not a meta key)
 */
function isMonthKey(key: string): boolean {
  if (META_KEYS.includes(key)) return false;
  // Month names: January through December
  const monthPattern =
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/;
  return monthPattern.test(key);
}

/**
 * Extract month-year keys from a feed object
 * Returns keys in natural chronological order (not lexicographic)
 */
export function getMonthKeys(feed: Record<string, unknown>): string[] {
  const keys = Object.keys(feed).filter(isMonthKey);

  // Sort chronologically: June 2026 > July 2026 (newest first)
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  keys.sort((a, b) => {
    const [aMonth, aYear] = a.match(/^([A-Z][a-z]+)\s+(\d{4})$/)?.slice(1) ?? [];
    const [bMonth, bYear] = b.match(/^([A-Z][a-z]+)\s+(\d{4})$/)?.slice(1) ?? [];

    if (!aMonth || !bMonth) return 0;

    const aIdx = months.indexOf(aMonth);
    const bIdx = months.indexOf(bMonth);

    if (aIdx === -1 || bIdx === -1) return 0;
    const yearDiff = parseInt(bYear, 10) - parseInt(aYear, 10);
    if (yearDiff !== 0) return yearDiff;
    return bIdx - aIdx;
  });

  return keys;
}

/** Display legacy title/speaker/date delimiters without changing feed identity. */
function normalizeVideoTitle(video: VideoItem): VideoItem {
  if (typeof video?.title !== 'string' || !video.title.includes('\\')) return video;
  return {
    ...video,
    title: video.title
      .split(/\\+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' · '),
  };
}

/**
 * Extract all video items from a feed across all month keys.
 *
 * Dedupes by video id (first occurrence wins — feeds are ordered newest
 * month first, so the newest entry is kept). Duplicate ids across month keys
 * would otherwise render two grid cards that both resolve to the same video
 * via the selection lookup (`.find(v => v.videoId === id)`).
 */
export function getAllVideos(feed: Record<string, unknown>): VideoItem[] {
  const videos: VideoItem[] = [];
  const seen = new Set<string>();
  const monthKeys = getMonthKeys(feed);

  for (const key of monthKeys) {
    const value = feed[key];
    if (!Array.isArray(value)) continue;
    for (const video of value) {
      if (video?.id) {
        if (seen.has(video.id)) continue;
        seen.add(video.id);
      }
      videos.push(normalizeVideoTitle(video));
    }
  }

  return videos;
}

/**
 * Group videos by their release month (from releaseDate or month key)
 */
export function groupVideosByMonth(feed: Record<string, unknown>): Record<string, VideoItem[]> {
  const result: Record<string, VideoItem[]> = {};
  const monthKeys = getMonthKeys(feed);

  for (const key of monthKeys) {
    const value = feed[key];
    if (Array.isArray(value)) {
      result[key] = value.map(normalizeVideoTitle);
    }
  }

  return result;
}

/**
 * Filter videos by category/genre
 */
export function filterByGenre(videos: VideoItem[], genre: string): VideoItem[] {
  return videos.filter((v) => v.genres?.some((g) => g.toLowerCase() === genre.toLowerCase()));
}

/**
 * Filter videos by series/series ID.
 * Uses exact match on the video id field.
 */
export function filterBySeries(videos: VideoItem[], seriesId: string): VideoItem[] {
  return videos.filter((v) => v.id === seriesId);
}

/**
 * Filter videos by pastor/presenter.
 * Pastor info is in config.sermon.pastors — this filters based on exact id match.
 */
export function filterByPastor(videos: VideoItem[], pastorId: string): VideoItem[] {
  return videos.filter((v) => v.id === pastorId);
}

/**
 * Sort videos by release date (descending — newest first)
 */
export function sortByReleaseDate(videos: VideoItem[]): VideoItem[] {
  return [...videos].sort((a, b) => {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return b.releaseDate.localeCompare(a.releaseDate);
  });
}

/**
 * Playable URL for a video: top-level `url` if present, else first content.videos[].url.
 * Some legacy Roku feeds omit top-level url.
 */
export function resolvePlayableUrl(video: {
  url?: string;
  content?: { videos?: Array<{ url?: string }> };
}): string {
  const direct = typeof video.url === 'string' ? video.url.trim() : '';
  if (direct) return direct;
  const nested = video.content?.videos?.find(
    (entry) => typeof entry?.url === 'string' && entry.url.trim()
  );
  return nested?.url?.trim() ?? '';
}

/**
 * Validate a feed. Legacy Roku month-keyed JSON is valid without cardStyle/config
 * or a top-level video.url. Those fields are used when present.
 */
export function validateFeed(feed: Record<string, unknown>): {
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
    const playable = resolvePlayableUrl(video);
    if (!playable) {
      errors.push(`Video ${video.id || 'unknown'} missing playable url`);
    } else if (!video.url) {
      warnings.push(`Video ${video.id} using content.videos url`);
    }
    if (!video.content || !Array.isArray(video.content?.videos)) {
      if (playable) warnings.push(`Video ${video.id || 'unknown'} missing content.videos`);
      else errors.push(`Video ${video.id || 'unknown'} missing content.videos`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, videoCount: videos.length };
}

/**
 * Extract card style from feed
 */
export function getCardStyle(feed: Record<string, unknown>): CardStyle | undefined {
  const cs = feed.cardStyle;
  if (!cs || typeof cs !== 'object') return undefined;
  return cs as CardStyle;
}

/**
 * Extract client config from feed
 */
export function getClientConfig(feed: Record<string, unknown>): ClientConfig | undefined {
  const config = feed.config;
  if (!config || typeof config !== 'object') return undefined;
  return config as ClientConfig;
}
