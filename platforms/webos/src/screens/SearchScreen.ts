/**
 * Search screen loader.
 */

import { createSearchScreen } from '../ui/SearchScreen';
import type { FeedVideo } from './HomeScreen';
import type { VideoItem } from '@ctv/core';

import { showScreen } from './visibility';

export async function loadSearchScreen(
  videos: FeedVideo[],
  onVideoSelect: (videoId: string, title: string) => void
): Promise<void> {
  const container = document.getElementById('screen-search') as HTMLDivElement | null;
  if (!container) return;

  // Convert FeedVideo to VideoItem format expected by createSearchScreen
  const searchVideos: VideoItem[] = videos.map((v) => ({
    id: v.videoId,
    title: v.title,
    shortDescription: '',
    thumbnail: v.thumbnail,
    hdPosterUrl: v.thumbnail,
    sdPosterUrl: v.thumbnail,
    url: v.streamUrl || `/stream/${v.videoId}.mp4`,
    releaseDate: '',
    genres: [],
    content: {
      duration: 0,
      videos: v.streamUrl ? [{ url: v.streamUrl, quality: '', videoType: 'video' }] : [],
    },
  }));

  const el = createSearchScreen({
    videos: searchVideos,
    onVideoSelect: (videoId: string) => {
      const video = videos.find((v) => v.videoId === videoId);
      if (video) onVideoSelect(videoId, video.title);
    },
  });

  container.innerHTML = '';
  container.appendChild(el);
  showScreen('screen-search');
  // Roku parity: opening Search lands focus on the query field, not the nav
  // icon. createSearchScreen()'s searchInput.focus() runs before the node is
  // in the document, where it no-ops; re-focus after mount.
  el.querySelector<HTMLInputElement>('.search-screen__input')?.focus();
}
