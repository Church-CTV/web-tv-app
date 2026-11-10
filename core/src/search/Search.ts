/**
 * Search module — full-text search across feed content with debouncing.
 */

import type { VideoItem } from '@ctv/shared/contracts/feed';

interface SearchResult {
  video: VideoItem;
  score: number;
  matches: string[];
}

/**
 * Search videos by keyword (case-insensitive, partial match across title and description).
 * Results ranked by relevance score.
 */
export function searchVideos(videos: VideoItem[], keyword: string): SearchResult[] {
  if (!keyword || keyword.trim().length === 0) return [];

  const query = keyword.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const video of videos) {
    const score = calculateRelevance(video, query);
    if (score > 0) {
      results.push({ video, score, matches: findMatches(video, query) });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Calculate relevance score for a video against a query.
 * Title matches score higher than description matches.
 */
function calculateRelevance(video: VideoItem, query: string): number {
  let score = 0;

  // Title match (weighted higher)
  const titleLower = (video.title || '').toLowerCase();
  if (titleLower.includes(query)) score += 10;
  // Exact word match bonus
  if (titleLower === query) score += 5;

  // Description match
  const descLower = (video.shortDescription || '').toLowerCase();
  if (descLower.includes(query)) score += 5;
  if (descLower === query) score += 3;

  // ID match
  if ((video.id || '').toLowerCase().includes(query)) score += 2;

  // Genre match
  for (const genre of video.genres || []) {
    if (genre.toLowerCase().includes(query)) score += 3;
  }

  return score;
}

/**
 * Find which fields matched the query.
 */
function findMatches(video: VideoItem, query: string): string[] {
  const matches: string[] = [];
  const queryLower = query.toLowerCase();

  if ((video.title || '').toLowerCase().includes(queryLower)) matches.push('title');
  if ((video.shortDescription || '').toLowerCase().includes(queryLower))
    matches.push('description');
  if ((video.id || '').toLowerCase().includes(queryLower)) matches.push('id');
  for (const genre of video.genres || []) {
    if (genre.toLowerCase().includes(queryLower)) matches.push(`genre:${genre}`);
  }

  return matches;
}

/**
 * Debounce function for search input.
 * Returns a function with a cancel method to clear the pending timer.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): { fn: T; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn: T = function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  } as T;

  return {
    fn: debouncedFn,
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
