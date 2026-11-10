/**
 * Continue Watching module — track playback position for partially watched content.
 */

const CONTINUE_KEY = 'ctv_continue_watching';

interface ContinueWatchingItem {
  videoId: string;
  title: string;
  position: number;
  duration: number;
  lastWatched: string;
}

export interface ContinueWatchingStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * Save playback position for a video
 */
export function savePosition(
  store: ContinueWatchingStore,
  videoId: string,
  title: string,
  position: number,
  duration: number
): void {
  const items = getContinueWatching(store);
  // Update existing or add new
  const idx = items.findIndex((i) => i.videoId === videoId);
  if (idx >= 0) {
    items[idx].position = position;
    items[idx].duration = duration;
    items[idx].title = title;
    items[idx].lastWatched = new Date().toISOString();
  } else {
    items.push({ videoId, title, position, duration, lastWatched: new Date().toISOString() });
  }
  store.set(CONTINUE_KEY, JSON.stringify(items));
}

/**
 * Get playback position for a video
 */
export function getPosition(store: ContinueWatchingStore, videoId: string): number {
  const item = getContinueWatching(store).find((i) => i.videoId === videoId);
  return item ? item.position : 0;
}

/**
 * Check if a video has been partially watched
 */
export function hasPartiallyWatched(store: ContinueWatchingStore, videoId: string): boolean {
  const item = getContinueWatching(store).find((i) => i.videoId === videoId);
  return item !== undefined && item.position > 0 && item.position < item.duration;
}

/**
 * Get all continue watching items (only partially watched, sorted by lastWatched desc)
 */
export function getContinueWatching(store: ContinueWatchingStore): ContinueWatchingItem[] {
  try {
    const data = store.get(CONTINUE_KEY);
    if (!data) return [];
    const items = JSON.parse(data) as ContinueWatchingItem[];
    // Only include partially watched
    const partial = items.filter((i) => i.position < i.duration);
    // Sort by last watched (newest first)
    return partial.sort((a, b) => b.lastWatched.localeCompare(a.lastWatched));
  } catch {
    return [];
  }
}

/**
 * Remove a video from continue watching (completed or removed)
 */
export function removeFromContinueWatching(store: ContinueWatchingStore, videoId: string): void {
  const all = JSON.parse(store.get(CONTINUE_KEY) || '[]') as ContinueWatchingItem[];
  const filtered = all.filter((i) => i.videoId !== videoId);
  store.set(CONTINUE_KEY, JSON.stringify(filtered));
}

/**
 * Clear all continue watching data
 */
export function clearContinueWatching(store: ContinueWatchingStore): void {
  store.remove(CONTINUE_KEY);
}
