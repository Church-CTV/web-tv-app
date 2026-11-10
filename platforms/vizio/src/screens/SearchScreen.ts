/**
 * Vizio search screen loader.
 */

import { initSearchScreen } from '../ui/SearchScreen';
import type { SearchScreenProps } from '../ui/SearchScreen';

/** The live teardown for the mounted search screen, if one is mounted. */
let disposeSearch: (() => void) | undefined;

export async function loadSearchScreen(
  videos: Array<{
    id: string;
    title: string;
    shortDescription: string;
    hdPosterUrl: string;
    sdPosterUrl: string;
  }>,
  onVideoSelect: (videoId: string, title: string) => void
): Promise<void> {
  const container = document.getElementById('screen-search') as HTMLDivElement | null;
  if (!container) return;

  const props: SearchScreenProps = {
    videos: videos.map((video) => ({
      ...video,
      thumbnail: video.hdPosterUrl || video.sdPosterUrl,
    })) as unknown as SearchScreenProps['videos'],
    onVideoSelect: (videoId: string) => {
      const video = videos.find((v) => v.id === videoId);
      if (video) onVideoSelect(video.id, video.title);
    },
  };

  // initSearchScreen renders into the container and binds its D-pad handler to the
  // node it creates, so re-opening search replaces the previous screen and its handler
  // rather than stacking another handler on the permanent `#screen-search` element.
  // Disposing first also drops any debounced query that is still in flight.
  disposeSearch?.();
  disposeSearch = initSearchScreen(container, props);
}
