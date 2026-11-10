/**
 * Home screen loader — renders the main content grid and left nav.
 * Extracted from App.ts to reduce monolith.
 *
 * J2b-2: Uses @ctv/core get() (HttpClient with bounded backoff + abort
 * support) instead of raw fetch. Maps HttpError → actionable error screen
 * via mapHttpError/isUserFacingError. Aborts in-flight request on re-entry.
 *
 * K4a: Renders an intentional empty state when the feed is valid but
 * contains zero videos.
 */

import {
  get,
  getServerBaseUrl,
  ensureClientConfig,
  validateFeed,
  getMonthKeys,
  groupVideosByMonth,
  resolvePlayableUrl,
  mapHttpError,
  isUserFacingError,
  isRetryable,
} from '@ctv/core';
import type { ScreenError } from '@ctv/core';
import { createContentGrid, focusFirstCard } from '../ui/ContentGrid';
import { createLeftNav } from '../ui/LeftNav';
import { renderErrorScreen, initErrorScreen, getErrorScreen } from '../utils/ErrorHandling';
import { showScreen } from './visibility';
import { getPlatformI18n } from '../utils/PlatformI18n';
import { escapeHtml } from '../utils/HtmlEscape';

export type NavItemId =
  'home' | 'search' | 'schedule' | 'continue' | 'watch-later' | 'subscribe' | 'settings';

export interface ScreenActionMap {
  onVideoSelect: (videoId: string, title: string) => void;
  onSearch: () => void;
  onSettings: () => void;
  onRetry: () => void;
  /** Called after the feed is loaded with all videos (for deep link handling) */
  onFeedLoaded?: (videos: FeedVideo[]) => void;
}

export interface FeedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  description?: string;
  progress: number;
  /** Real playable stream URL resolved from the feed (MP4 or HLS .m3u8). */
  streamUrl?: string;
}

export interface FeedCategory {
  id: string;
  name: string;
  videos: FeedVideo[];
}

// Track the active AbortController for the grid container so a re-entry
// (retry click, navigation) aborts the previous in-flight feed request.
const activeControllers = new WeakMap<HTMLDivElement, AbortController>();

/**
 * Map a ScreenError type to the webOS ErrorHandling error type.
 */
function screenErrorToErrorType(se: ScreenError): 'network' | 'feed' | 'auth' | 'generic' {
  switch (se.type) {
    case 'network':
    case 'timeout':
    case 'serverError':
      return 'network';
    case 'feed':
      return 'feed';
    case 'notFound':
      return 'feed';
    case 'rateLimited':
      return 'generic';
    case 'auth':
      return 'auth';
    default:
      return 'generic';
  }
}

export async function loadMainView(
  storage: { get(key: string): string | null; set(key: string, value: string): void },
  analytics: {
    trackInteraction: (action: string, target?: string, details?: string) => void;
  } | null,
  actions: ScreenActionMap
): Promise<void> {
  const gridContainer = document.getElementById('content-grid') as HTMLDivElement | null;
  if (!gridContainer) return;

  gridContainer.innerHTML = `<div class="main-grid"><h1>${getPlatformI18n().t('loading.content')}</h1></div>`;

  // Abort any previously in-flight feed request for this container
  const existing = activeControllers.get(gridContainer);
  if (existing && !existing.signal.aborted) {
    existing.abort();
  }
  const controller = new AbortController();
  activeControllers.set(gridContainer, controller);

  const serverUrl = getServerBaseUrl(storage);
  // The delivered channel profile (CONFIGURATION.md). Read before anything is
  // rendered so a flag the operator switched off is off before its work starts.
  // It never throws: an unreachable or unusable profile resolves to defaults or
  // to the last profile that was accepted.
  const profile = await ensureClientConfig(storage, serverUrl, { signal: controller.signal });
  if (controller.signal.aborted) return;
  const effective = profile.config;
  const feedUrl = effective.content.sourceUrl || `${serverUrl}/feed`;
  try {
    const { data } = await get(feedUrl, { signal: controller.signal });

    // Request was aborted (navigation/retry superseded it) — do nothing.
    if (controller.signal.aborted) return;

    const feed = data as Record<string, unknown>;
    const validation = validateFeed(feed);
    if (!validation.valid) {
      console.error('Feed validation failed:', validation.errors);
      const errData = getErrorScreen('feed');
      gridContainer.innerHTML = renderErrorScreen(errData, actions.onRetry);
      initErrorScreen(actions.onRetry);
      return;
    }

    const providerName = typeof feed.providerName === 'string' ? feed.providerName.trim() : '';
    // Precedence: the validated profile names the channel; the feed document's
    // providerName is the fallback for a server that delivers no profile.
    const channelName = effective.channel.name.trim() || providerName;
    if (channelName) {
      const titleEl = document.querySelector('.overhang-title, .overhang__title');
      if (titleEl) titleEl.textContent = channelName;
      try {
        storage.set('ctv_channel_name', channelName);
      } catch (error) {
        void error;
      }
    }

    const monthKeys = getMonthKeys(feed);
    const grouped = groupVideosByMonth(feed);
    const categories: FeedCategory[] = monthKeys.map((mk) => ({
      id: mk,
      name: mk,
      videos: (grouped[mk] || []).map((v: Record<string, unknown>) => ({
        videoId: (v.id as string) || '',
        title: v.title as string,
        thumbnail: (v.thumbnail as string) || (v.sdPosterUrl as string),
        description: (v.shortDescription as string) || (v.description as string) || '',
        progress: 0,
        // Real playable stream URL from the feed (MP4 or HLS .m3u8). Without
        // this the player is pointed at a fabricated /stream/<id>.mp4 path
        // that does not exist, so nothing plays. Mirrors Tizen's
        // resolvePlayableUrl(v) (platform parity).
        streamUrl: resolvePlayableUrl(
          v as { url?: string; content?: { videos?: Array<{ url?: string }> } }
        ),
      })),
    }));

    const i18n = getPlatformI18n();
    const navItems = [
      // Roku parity (KISS): the live Roku channel's left nav is exactly
      // three icons — Home, Search, Settings. The webos app's extra
      // Schedule/Continue/Watch Later/Subscribe screens were removed to
      // match 1:1 (user directive 2026-09-20).
      { id: 'home', label: i18n.t('nav.home'), icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: i18n.t('nav.search'), icon: 'search', screen: 'screen-search' },
      {
        id: 'settings',
        label: i18n.t('nav.settings'),
        icon: 'settings',
        screen: 'screen-settings',
      },
    ].filter((item) => item.id !== 'search' || effective.features.search !== false);
    const leftNav = createLeftNav({
      items: navItems,
      onItemClick: (item) => {
        if (analytics) analytics.trackInteraction('navigate', item.id);
        switch (item.id) {
          case 'search':
            actions.onSearch();
            break;
          case 'settings':
            actions.onSettings();
            break;
          default:
            showScreen(item.screen);
        }
      },
    });

    const leftNavContainer = document.getElementById('left-nav') as HTMLDivElement | null;
    if (leftNavContainer) {
      leftNavContainer.innerHTML = '';
      leftNavContainer.appendChild(leftNav);
    }

    // Flatten all videos for selection lookup
    const allVideos: FeedVideo[] = categories.reduce<FeedVideo[]>(
      (all, category) => all.concat(category.videos),
      []
    );

    gridContainer.innerHTML = '';

    // K4a: intentional empty state — valid feed with zero videos.
    if (allVideos.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'home-empty-state';
      emptyEl.setAttribute('role', 'status');
      emptyEl.innerHTML =
        `<h2 class="home-empty-state__title">${escapeHtml(i18n.t('home.empty'))}</h2>` +
        `<p class="home-empty-state__hint">${escapeHtml(i18n.t('home.empty_hint'))}</p>`;
      gridContainer.appendChild(emptyEl);
      showScreen('screen-grid');
      console.log('[WebOS App] Feed loaded with 0 videos - empty state shown');
      if (actions.onFeedLoaded) {
        actions.onFeedLoaded(allVideos);
      }
      return;
    }

    // Create grid with all categories (uses DocumentFragment for batch DOM ops)
    const grid = createContentGrid({
      categories,
      onVideoSelect: (videoId: string) => {
        const video = allVideos.find((v) => v.videoId === videoId);
        if (video) actions.onVideoSelect(video.videoId, video.title);
      },
    });

    gridContainer.appendChild(grid);
    showScreen('screen-grid');

    // Roku parity: the header above the grid shows the FOCUSED card's title
    // (bold white, ~48px) and description (gray, wrapping). Roku GridScreen
    // updates titleLabel/descriptionLabel on OnItemFocused. Mirror it by
    // tracking focusin on the grid. Attach BEFORE focusing so the initial
    // focus populates the header.
    const headerTitle = document.getElementById('grid-header-title');
    const headerDesc = document.getElementById('grid-header-desc');
    const updateHeader = (cardEl: HTMLElement) => {
      const vid = cardEl.getAttribute('data-video-id') || '';
      const video = allVideos.find((v) => v.videoId === vid);
      if (headerTitle) headerTitle.textContent = video ? video.title : '';
      if (headerDesc) headerDesc.textContent = video?.description || '';
    };
    const onGridFocusIn = (ev: FocusEvent) => {
      const card = (ev.target as HTMLElement).closest?.('.content-card') as HTMLElement | null;
      if (card) updateHeader(card);
    };
    gridContainer.addEventListener('focusin', onGridFocusIn);

    focusFirstCard(gridContainer as HTMLDivElement);
    // Ensure the header reflects the first card even if focusin did not fire
    // (e.g. non-focusable environment).
    const firstCardEl = gridContainer.querySelector<HTMLElement>('.content-card');
    if (firstCardEl) {
      // Start the grid in the SAME vertical translation the D-pad nav path
      // uses, so the first Down press does not lurch the whole grid up. The
      // nav path (scrollToFocused / scrollIntoView, block:'start') aligns the
      // focused row's top to the viewport top; applying that identical
      // alignment to the first card on load means row 0 begins where it
      // settles after navigating, instead of starting low (scrollTop 0) and
      // jumping up on the first row change. Instant (no smooth animation on
      // load).
      firstCardEl.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
      updateHeader(firstCardEl);
    }

    // Notify the app that the feed is loaded (used for deep link handling)
    if (actions.onFeedLoaded) {
      actions.onFeedLoaded(allVideos);
    }

    console.log(
      `[WebOS App] Loaded ${monthKeys.length} categories with ${allVideos.length} videos`
    );
  } catch (error) {
    const se = mapHttpError(error);

    // Abort: screen was superseded (retry/navigation) — not user-facing.
    if (se.type === 'abort') {
      console.error('[WebOS App] Feed load aborted (not user-facing)');
      return;
    }

    if (!isUserFacingError(se)) return;

    console.error('[WebOS App] Failed to load feed:', error);
    const errorType = screenErrorToErrorType(se);
    const errData = getErrorScreen(errorType);
    errData.retryable = isRetryable(se);
    gridContainer.innerHTML = renderErrorScreen(errData, actions.onRetry);
    initErrorScreen(actions.onRetry);
    // The error screen is rendered INTO #content-grid, so the grid screen is
    // the one that must be active. showScreen('screen-error') would activate
    // the static (dead) #screen-error panel that overlays and intercepts
    // clicks on the dynamic #btn-retry button.
    showScreen('screen-grid');
  }
}
