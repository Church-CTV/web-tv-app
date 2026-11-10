/**
 * Watch Later module — manage a queue of videos to watch later.
 */

const WATCH_LATER_KEY = 'ctv_watch_later';

interface WatchLaterItem {
  videoId: string;
  title: string;
  addedAt: string;
}

export interface WatchLaterStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * Add a video to the watch later queue
 */
export function addToWatchLater(store: WatchLaterStore, videoId: string, title: string): void {
  const items = getWatchLater(store);
  // Don't add duplicates
  if (items.some((i) => i.videoId === videoId)) return;

  items.push({ videoId, title, addedAt: new Date().toISOString() });
  store.set(WATCH_LATER_KEY, JSON.stringify(items));
}

/**
 * Remove a video from the watch later queue
 */
export function removeFromWatchLater(store: WatchLaterStore, videoId: string): void {
  const items = getWatchLater(store);
  const filtered = items.filter((i) => i.videoId !== videoId);
  store.set(WATCH_LATER_KEY, JSON.stringify(filtered));
}

/**
 * Check if a video is in the watch later queue
 */
export function isInWatchLater(store: WatchLaterStore, videoId: string): boolean {
  return getWatchLater(store).some((i) => i.videoId === videoId);
}

/**
 * Get all items in the watch later queue
 */
export function getWatchLater(store: WatchLaterStore): WatchLaterItem[] {
  try {
    const data = store.get(WATCH_LATER_KEY);
    if (!data) return [];
    return JSON.parse(data) as WatchLaterItem[];
  } catch {
    return [];
  }
}

/**
 * Clear the entire watch later queue
 */
export function clearWatchLater(store: WatchLaterStore): void {
  store.remove(WATCH_LATER_KEY);
}

/**
 * Get the count of items in watch later
 */
export function getWatchLaterCount(store: WatchLaterStore): number {
  return getWatchLater(store).length;
}
