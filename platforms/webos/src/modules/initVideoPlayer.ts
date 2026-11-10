/**
 * Video player initialization module.
 * Creates the HTML5 video player from the DOM element.
 */

import {
  createVideoPlayer as createVideoPlayerAdapter,
  type VideoPlayer,
} from '../Adapter/VideoPlayer';

export type { VideoPlayer } from '../Adapter/VideoPlayer';

export function createVideoPlayer(containerId?: string): VideoPlayer | null {
  const el = containerId
    ? (document.getElementById(containerId) as HTMLVideoElement | null)
    : (document.getElementById('video-player') as HTMLVideoElement | null);

  if (!el) return null;
  return createVideoPlayerAdapter(el);
}
