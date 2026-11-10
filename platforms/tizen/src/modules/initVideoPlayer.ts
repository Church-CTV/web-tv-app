/**
 * Tizen Video player initialization module.
 */

import {
  createVideoPlayer as createVideoPlayerAdapter,
  type VideoPlayer,
  type VideoPlayerOptions,
} from '../Adapter/VideoPlayer';

/**
 * Resolve the player element and hand it to the adapter.
 *
 * @param containerId - id of the <video> element (falls back to `video-player`)
 * @param options - resume storage/identity, passed through unchanged; see the
 *   adapter for what happens when they are omitted
 */
export function createVideoPlayer(
  containerId?: string,
  options?: VideoPlayerOptions
): VideoPlayer | null {
  const el = containerId
    ? (document.getElementById(containerId) as HTMLVideoElement | null)
    : (document.getElementById('video-player') as HTMLVideoElement | null);

  if (!el) return null;
  return createVideoPlayerAdapter(el, options);
}
