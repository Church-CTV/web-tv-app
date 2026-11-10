/**
 * Tizen home screen loader — renders content grid and left nav.
 * J2b-3: Uses @ctv/core get() (HttpClient with bounded backoff + abort
 * support) instead of raw fetch. Maps HttpError → actionable error screen
 * via mapHttpError/isUserFacingError. Aborts in-flight request on re-entry.
 */

import {
  get,
  getServerBaseUrl,
  ensureClientConfig,
  validateFeed,
  resolvePlayableUrl,
  getMonthKeys,
  groupVideosByMonth,
  mapHttpError,
  isUserFacingError,
  isRetryable,
} from '@ctv/core';
import type { ScreenError } from '@ctv/core';
import { renderContentGrid, initContentGrid } from '../ui/ContentGrid';
import { renderLeftNav, initLeftNav } from '../ui/LeftNav';
import { renderErrorScreen, initErrorScreen, getErrorScreen } from '@ctv/shared/ErrorHandling';
import { showScreen } from './visibility';

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
  progress: number;
  streamUrl?: string;
  description?: string;
  isLive?: boolean;
}

// Track the active AbortController for the grid container so a re-entry
// (retry click, navigation) aborts the previous in-flight feed request.
const activeControllers = new WeakMap<HTMLDivElement, AbortController>();

/**
 * Map a ScreenError type to the shared ErrorHandling error type.
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
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    getAll(): Record<string, string>;
  },
  analytics: {
    trackInteraction: (action: string, target?: string, details?: string) => void;
  } | null,
  actions: ScreenActionMap
): Promise<void> {
  const gridContainer = document.getElementById('content-grid') as HTMLDivElement | null;
  if (!gridContainer) return;

  const serverUrl = getServerBaseUrl(storage);
  // The delivered channel profile (CONFIGURATION.md), read before the nav is
  // rendered so a feature the operator switched off never reaches the screen.
  const profile = await ensureClientConfig(storage, serverUrl);
  const effective = profile.config;
  const feedUrl = effective.content.sourceUrl || `${serverUrl}/feed`;

  const navItemsBase: Array<{ id: string; label: string; icon: string; screen: string }> = [
    { id: 'home', label: 'Home', icon: 'home', screen: 'screen-grid' },
    { id: 'search', label: 'Search', icon: 'search', screen: 'screen-search' },
    { id: 'settings', label: 'Settings', icon: 'settings', screen: 'screen-settings' },
  ];
  const navItems = navItemsBase.filter(
    (item) => item.id !== 'search' || effective.features.search !== false
  );
  const onItemClick = (item: { id: string; label: string; icon: string; screen: string }) => {
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
  };
  const leftNavContainer = document.getElementById('left-nav') as HTMLDivElement | null;
  if (leftNavContainer) {
    leftNavContainer.innerHTML = renderLeftNav({
      items: navItems,
      activeItem: 'home',
      onItemClick,
    });
    initLeftNav(navItems, undefined, onItemClick);
  }

  gridContainer.innerHTML = '<div class="main-grid"><h1>Loading content...</h1></div>';

  // Abort any previously in-flight feed request for this container
  const existing = activeControllers.get(gridContainer);
  if (existing && !existing.signal.aborted) {
    existing.abort();
  }
  const controller = new AbortController();
  activeControllers.set(gridContainer, controller);

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
      // Hide the static #screen-error panel and activate grid so the dynamic
      // error UI rendered into #content-grid is the visible (and clickable)
      // one. See D6 parity fix.
      showScreen('screen-grid');
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
    const videos: FeedVideo[] = [];
    for (const mk of monthKeys) {
      const items = (grouped as Record<string, Record<string, unknown>[]>)[mk] || [];
      for (const v of items) {
        videos.push({
          videoId: String(v.id || videos.length + 1),
          title: String(v.title || ''),
          thumbnail: String(v.thumbnail || v.sdPosterUrl || ''),
          progress: 0,
          streamUrl: resolvePlayableUrl(v),
          description: String(v.shortDescription || ''),
          isLive: Boolean(v.isLive),
        });
      }
    }

    const onVideoSelect = (videoId: string) => {
      const video = videos.find((v) => v.videoId === videoId);
      if (video) actions.onVideoSelect(video.videoId, video.title);
    };

    const categories = monthKeys.map((mk) => ({
      id: mk,
      name: mk,
      videos: ((grouped as Record<string, Record<string, unknown>[]>)[mk] || []).map((v) => ({
        id: String(v.id || ''),
        title: String(v.title || ''),
        thumbnail: String(v.thumbnail || v.sdPosterUrl || ''),
        shortDescription: String(v.shortDescription || ''),
        isLive: Boolean(v.isLive),
      })),
    }));

    const gridHtml = renderContentGrid({
      categories,
      onVideoSelect,
    });

    gridContainer.innerHTML = '';

    // K4a: intentional empty state - valid feed with zero videos.
    if (videos.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'home-empty-state';
      emptyEl.setAttribute('role', 'status');
      emptyEl.innerHTML =
        `<h2 class="home-empty-state__title">No content available</h2>` +
        `<p class="home-empty-state__hint">Content from your channel will appear here.</p>`;
      gridContainer.appendChild(emptyEl);
      console.log('[Tizen App] Feed loaded with 0 videos - empty state shown');
      if (actions.onFeedLoaded) {
        actions.onFeedLoaded(videos);
      }
      showScreen('screen-grid');
      return;
    }

    const gridEl = document.createElement('div');
    gridEl.innerHTML = gridHtml;
    gridContainer.appendChild(gridEl);
    initContentGrid(gridEl as HTMLDivElement, onVideoSelect);

    const meta = document.createElement('div');
    meta.className = 'focus-meta';
    meta.innerHTML = '<h2 class="focus-meta__title"></h2><p class="focus-meta__desc"></p>';
    gridContainer.insertBefore(meta, gridContainer.firstChild);
    const setMeta = (video: FeedVideo | undefined) => {
      const titleNode = meta.querySelector('.focus-meta__title');
      const descNode = meta.querySelector('.focus-meta__desc');
      if (titleNode) titleNode.textContent = video?.title || '';
      if (descNode) descNode.textContent = video?.description || '';
    };
    setMeta(videos[0]);
    gridEl.addEventListener('focusin', (event) => {
      const card = (event.target as HTMLElement).closest('[data-video-id]');
      if (!card) return;
      const id = card.getAttribute('data-video-id') || '';
      setMeta(videos.find((item) => item.videoId === id));
    });

    // Notify the app that the feed is loaded (used for deep link handling)
    if (actions.onFeedLoaded) {
      actions.onFeedLoaded(videos);
    }

    console.log(`[Tizen App] Loaded ${monthKeys.length} categories with ${videos.length} videos`);
    // Activate the grid screen so the loading overlay (which ships active in
    // index.html) is hidden. See webOS A7 parity.
    showScreen('screen-grid');
    const firstCard = gridContainer.querySelector('[data-video-id]') as HTMLElement | null;
    firstCard?.focus();
  } catch (error) {
    const se = mapHttpError(error);

    // Abort: screen was superseded (retry/navigation) — not user-facing.
    if (se.type === 'abort') {
      console.error('[Tizen App] Feed load aborted (not user-facing)');
      return;
    }

    if (!isUserFacingError(se)) return;

    console.error('[Tizen App] Failed to load feed:', error);
    const errorType = screenErrorToErrorType(se);
    const errData = getErrorScreen(errorType);
    errData.retryable = isRetryable(se);
    // Non-retryable errors (auth, notFound) render a static error state —
    // no retry button. See J2b screen error contract.
    const retryFn = isRetryable(se) ? actions.onRetry : undefined;
    gridContainer.innerHTML = renderErrorScreen(errData, retryFn);
    if (retryFn) initErrorScreen(retryFn);
    // Show the grid screen (which holds the dynamic error UI) instead of the
    // static #screen-error panel that overlays it with a second retry button.
    showScreen('screen-grid');
  }
}
