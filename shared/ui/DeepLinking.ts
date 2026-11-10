/**
 * Shared DeepLinking — platform-agnostic deep link parser.
 *
 * Parses a target video ID from the current URL so all platforms can support
 * direct links (e.g. from a remote, a share, or a web companion app).
 *
 * Supported forms (in priority order):
 *   1. Launch params: platform SDK launch parameters (TV launchers)
 *   2. Hash:        #content-{videoId}
 *   3. Query param: ?contentId={videoId}
 *   4. Query param: ?videoId={videoId}
 *
 * Mirrors the Roku channel launch parameter `input.contentID`.
 */

export interface DeepLinkResult {
  /** The parsed video content ID */
  videoId: string | null;
  /** The type of deep link source */
  source: 'launchParams' | 'hash' | 'queryContentId' | 'queryVideoId' | null;
  /** Whether a deep link was found */
  found: boolean;
}

export interface ParseDeepLinkOptions {
  /**
   * Optional platform launch-parameter resolver.
   * Platforms call this with their own reader (webOS `webOSDev.launchParams()` plus
   * the `webOSLaunch`/`webOSRelaunch` document events, Tizen
   * `getRequestedAppControl`). When it reports a videoId, it takes priority over
   * URL parsing.
   */
  getLaunchParams?: () => { videoId: string | null; found: boolean };
}

const HASH_PREFIX = '#content-';

/**
 * Parse a deep link from the current URL and/or platform launch params.
 *
 * Priority:
 *   1. Platform launch params (if resolver provided and found)
 *   2. Hash (#content-{videoId})
 *   3. Query param (?contentId=...)
 *   4. Query param (?videoId=...)
 *
 * Returns the parsed result or `found: false` if no deep link is present.
 */
export function parseDeepLink(opts?: ParseDeepLinkOptions): DeepLinkResult {
  // Check platform launch params first (TV launchers pass these)
  if (opts?.getLaunchParams) {
    try {
      const lp = opts.getLaunchParams();
      if (lp && lp.found && lp.videoId) {
        return { videoId: lp.videoId, source: 'launchParams', found: true };
      }
    } catch {
      // SDK access can fail (e.g. wrong context) - fall through to URL parsing
    }
  }

  // Check URL hash first: #content-video123
  const hash = window.location.hash;
  if (hash.startsWith(HASH_PREFIX)) {
    const videoId = hash.slice(HASH_PREFIX.length);
    if (videoId) {
      return { videoId, source: 'hash', found: true };
    }
  }

  const params = new URLSearchParams(window.location.search);

  // Check query param: ?contentId=video123
  const contentId = params.get('contentId');
  if (contentId) {
    return { videoId: contentId, source: 'queryContentId', found: true };
  }

  // Check query param: ?videoId=video123
  const videoIdParam = params.get('videoId');
  if (videoIdParam) {
    return { videoId: videoIdParam, source: 'queryVideoId', found: true };
  }

  return { videoId: null, source: null, found: false };
}

/**
 * Initialize deep linking on app startup.
 * Returns a controller that can be called once the feed is loaded to find
 * and navigate to the target video.
 */
export function initDeepLinking(
  onNavigate: (videoId: string, title: string) => void,
  onError: (message: string) => void,
  opts?: ParseDeepLinkOptions
): {
  /** Check for deep link and attempt navigation; returns true if handled */
  checkAndNavigate: (videos: Array<{ videoId: string; title: string }>) => boolean;
  /** Get current deep link without navigating */
  getDeepLink: () => DeepLinkResult;
} {
  return {
    checkAndNavigate: (videos: Array<{ videoId: string; title: string }>): boolean => {
      const result = parseDeepLink(opts);
      if (!result.found) return false;

      const video = videos.find((v) => v.videoId === result.videoId);
      if (video) {
        onNavigate(video.videoId, video.title);
        return true;
      }

      onError(`Content "${result.videoId}" not found. Please try again later.`);
      return false;
    },
    getDeepLink: (): DeepLinkResult => parseDeepLink(opts),
  };
}
