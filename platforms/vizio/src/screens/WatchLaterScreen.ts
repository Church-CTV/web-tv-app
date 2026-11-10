/**
 * Vizio watch later screen loader.
 */

import { getWatchLater, removeFromWatchLater } from '@ctv/core/watch-later/WatchLater';
import { renderWatchLaterScreen, initWatchLaterScreen } from '../ui/WatchLaterScreen';

export async function loadWatchLaterScreen(storage: {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}): Promise<void> {
  const container = document.getElementById('screen-watch-later') as HTMLDivElement | null;
  if (!container) return;

  const items = getWatchLater(storage);
  const props = {
    items,
    onRemove: (videoId: string) => {
      removeFromWatchLater(storage, videoId);
      loadWatchLaterScreen(storage);
    },
  };

  container.innerHTML = renderWatchLaterScreen(props);
  initWatchLaterScreen(props);
}
