/**
 * Vizio continue watching screen loader.
 */

import { getContinueWatching } from '@ctv/core/continue-watching/ContinueWatching';
import {
  renderContinueWatchingScreen,
  initContinueWatchingScreen,
} from '../ui/ContinueWatchingScreen';
import { showScreen } from './visibility';

export async function loadContinueWatchingScreen(
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  },
  player: import('../Adapter/VideoPlayer').VideoPlayer | undefined
): Promise<void> {
  const container = document.getElementById('screen-continue-watching') as HTMLDivElement | null;
  if (!container) return;

  const items = getContinueWatching(storage);
  const props = {
    items,
    onVideoSelect: (videoId: string, position: number) => {
      const videoScreenEl = document.createElement('div');
      videoScreenEl.className = 'video-screen';
      videoScreenEl.setAttribute('data-video-id', videoId);
      container?.parentElement?.appendChild(videoScreenEl);
      showScreen('screen-video');
      if (player) {
        player.seek(position);
        player.play(`/stream/${videoId}.mp4`);
      }
    },
  };

  const html = renderContinueWatchingScreen(props);
  container.innerHTML = html;
  initContinueWatchingScreen(props);
  showScreen('screen-continue-watching');
}
