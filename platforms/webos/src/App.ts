import { bindMediaRemote, toggleFocusedVideo } from '@ctv/shared/ui/MediaRemote';
import { startOverhangClock, type OverhangClock } from '@ctv/shared/ui/OverhangClock';
import { formatOverhangClock } from './ui/Overhang';
/**
 * WebOS App — Root application entry point.
 * Initializes core modules, platform adapters, and mounts the UI.
 *
 * Performance: screen loading uses lazy dynamic imports via screenLoader
 * so Vite emits separate chunks per screen. The CI code-splitting gate
 * verifies this on every build.
 */

import './styles.css';
import { createStartupRecovery } from '@ctv/shared/ui/StartupRecovery';
import { fitViewport, enableLegacyLayout } from '@ctv/shared/ui/Viewport';
window.addEventListener('resize', fitViewport);

import {
  Analytics,
  saveServerConfig,
  loadServerConfig,
  validateServerConfig,
  getShareUsagePreference,
  ensureClientConfig,
  getEffectiveConfig,
  resolveAnalyticsEndpoint,
  startConfigRefresh,
} from '@ctv/core';
import type { AnalyticsEvent } from '@ctv/shared/contracts/analytics';
import { createStorage } from './modules/initStorage';
import { createVideoPlayer } from './modules/initVideoPlayer';
import { createRemoteControl } from './modules/initRemoteControl';
import { createAnalytics } from './modules/initAnalytics';
import { createAnalyticsExport } from './Adapter/Analytics';
import { createCrashReporter } from './modules/initCrashReporting';
import { showScreen, hideScreen, getActiveScreenId } from './screens/visibility';
import type { FeedVideo, ScreenActionMap } from './screens/HomeScreen';
import { flushCrashReports } from './Adapter/CrashReporter';
import { initSplashScreen } from './ui/SplashScreen';
import { routeDpadKey } from './ui/GridNav';
import { initDeepLinking, type DeepLinkResult } from '@ctv/shared/ui/DeepLinking';
import {
  readWebOSLaunchParams,
  onWebOSLaunchParams,
  webOSLaunchParamsResult,
  type WebOSLaunchParams,
} from '@ctv/shared/ui/LaunchParams.webos';
import * as screenLoader from './screenLoader';

// ─── Public State ──────────────────────────────────────────────────────────────

export let videoPlayer: ReturnType<typeof createVideoPlayer> | null = null;
export let remoteControl: ReturnType<typeof createRemoteControl> | null = null;
export let analytics: Analytics | null = null;

// ─── Internal State ────────────────────────────────────────────────────────────

let platformStorage: ReturnType<typeof createStorage>;
let exportFn: ((events: unknown[]) => Promise<void>) | null = null;
let categories: FeedVideo[] = [];
// Newest parameters seen from a webOSLaunch / webOSRelaunch document event. The pull
// API covers the cold start; these cover the far more common case on a TV, where the
// app is suspended rather than closed and the launcher hands over a new contentId to
// the running instance. See shared/ui/LaunchParams.webos.ts for the documented source.
let launchParamsEvent: WebOSLaunchParams | undefined;
let unsubscribeLaunchParams: (() => void) | undefined;

/**
 * Resolve the real playable stream URL for a feed video by id.
 * The feed provides either MP4 or HLS (.m3u8) URLs; we must use that real
 * URL — pointing the player at a fabricated `/stream/<id>.mp4` path (which
 * does not exist) is what made video playback fail. Falls back to the legacy
 * fabricated path only when the id is unknown (e.g. a deep link that arrived
 * before the feed loaded) so callers always receive a string.
 */
function resolveStreamUrl(videoId: string): string {
  const found = categories.find((v) => v.videoId === videoId);
  return found?.streamUrl || `/stream/${videoId}.mp4`;
}
let deepLinkController: {
  checkAndNavigate: (videos: Array<{ videoId: string; title: string }>) => boolean;
  getDeepLink: () => DeepLinkResult;
} | null = null;

// ─── Navigation Handlers ───────────────────────────────────────────────────────

/**
 * The app's persistent <video id="video-player"> (index.html, inside
 * #screen-video) is re-parented into a video screen's overlay at play time so
 * it is the single element that is actually shown and focused. Before a video
 * screen is removed from the DOM we must move that element back out to a
 * stable home (#screen-video), otherwise removing the overlay would delete the
 * persistent video element and there would be nothing to play next cycle.
 */
function rehomePersistentVideo(host: HTMLElement): void {
  const v = document.getElementById('video-player') as HTMLVideoElement | null;
  if (v && v.parentElement && host.contains(v) && v.parentElement !== host) {
    host.appendChild(v);
  }
}

/**
 * Show/hide the channel chrome (overhang header + left nav rail) for full
 * -screen video playback. Roku hides its channel overhang/nav while a video
 * plays; we mirror that by toggling .video-playing on #app (see styles.css).
 * Without this the chrome paints over the video's top-left back button.
 */
function setVideoPlaying(on: boolean): void {
  document.getElementById('app')?.classList.toggle('video-playing', on);
}

/**
 * Handle back/exit navigation.
 */
export function handleBackNavigation(): void {
  if (analytics) analytics.trackInteraction('back');

  const activeId = getActiveScreenId();
  if (activeId === 'screen-grid') {
    try {
      (window as Window & { webOS?: { platformBack?: () => void } }).webOS?.platformBack?.();
    } catch {
      return;
    }
    return;
  }

  if (activeId === 'screen-video') {
    // Leaving the video screen: restore channel chrome (overhang + nav rail)
    // now that the video overlay is going away.
    setVideoPlaying(false);
    // Clean up the active video screen before leaving so its
    // positionSaveTimer and event listeners are released. Without
    // this, each back-navigation from the video screen leaks a
    // running setInterval and stale handler closures (J3c).
    // Also REMOVE the element from the DOM so it does not intercept
    // pointer events on the home grid during the next navigation cycle
    // (J3d: browser soak revealed old video-screen <video> was intercepting
    // clicks on home-grid cards, breaking repeated play cycles).
    // The video overlay (progress bar, back button) lives inside #screen-video
    // on top of the persistent #video-player. Remove only the overlay so the
    // shared video element survives for the next play cycle. (J3c: release
    // timers/listeners; J3d: don't leave an overlay intercepting clicks.)
    const videoScreenHost = document.getElementById('screen-video');
    if (videoScreenHost) {
      const prevScreen = videoScreenHost.querySelector(':scope > .video-screen') as
        (HTMLElement & { cleanup?: () => void }) | null;
      if (prevScreen) {
        prevScreen.cleanup?.();
        // Move the persistent video element back out of the overlay before
        // removing it, so it survives for the next play cycle.
        rehomePersistentVideo(videoScreenHost);
        prevScreen.remove();
      }
    }
    // Stop the shared video player so it stops downloading/buffering
    // in the background once the user leaves the video screen.
    if (videoPlayer) videoPlayer.stop();
  }

  // Back from video, search, settings, or any non-home screen returns to the
  // home grid. (Previously back-from-video went to the ContentDetail title
  // screen, but selection now plays directly, so the detail screen is
  // bypassed and video exits straight to the grid.)
  if (activeId && activeId !== 'screen-grid' && activeId !== 'screen-loading') {
    showScreen('screen-grid');
    // Restore focus to a grid card when returning to the home screen
    requestAnimationFrame(() => {
      const gridContainer = document.getElementById('content-grid');
      const firstCard = gridContainer?.querySelector<HTMLElement>('.content-card');
      firstCard?.focus();
    });
  }
}

/**
 * A card selection plays the video directly, with no intermediate title/detail
 * screen (user directive 2026-09-22). This used to build a ContentDetail and
 * park the user there until they pressed Play; now it goes straight to
 * fullscreen playback. handlePlay builds its own video screen from the feed's
 * resolved stream URL, so the detail step added nothing the user wanted.
 */
async function handleSelection(videoId: string, title: string): Promise<void> {
  if (analytics) analytics.trackInteraction('select', 'content-card', videoId);
  await handlePlay(videoId, title);
}

async function handlePlay(videoId: string, title: string): Promise<void> {
  if (analytics) {
    analytics.trackContentPlay(videoId, title);
    analytics.trackInteraction('play', 'content-detail', videoId);
  }

  // Clean up any previously active video screen before creating a new one.
  // This prevents DOM, event listener, and timer leaks on repeated plays.
  const screenContainer = document.getElementById('screen-container');
  if (screenContainer) {
    const prevScreen = screenContainer.querySelector('.video-screen') as
      (HTMLDivElement & { cleanup?: () => void }) | null;
    if (prevScreen) {
      prevScreen.cleanup?.();
      prevScreen.remove();
    }
  }

  const videoScreen = await screenLoader.createVideoScreen({
    videoId,
    title,
    streamUrl: resolveStreamUrl(videoId),
    onBack: () => handleBackNavigation(),
    storage: platformStorage,
    player: videoPlayer ?? undefined,
    // J5: re-parent the app's persistent #video-player into this overlay's
    // video container. The overlay is appended into #screen-video below, so
    // the single live <video> ends up INSIDE the active screen (shown,
    // focused, and driven by the shared player). Without this, VideoScreen
    // would create a second <video> and the visible one would never play.
    videoElId: 'video-player',
  });

  // J5: mount the overlay INSIDE #screen-video (the .screen that becomes
  // active) so the active screen contains its own content. This guarantees a
  // focused element always exists on the visible screen, so the focus guard
  // and remote navigation work on the video screen too.
  const videoScreenEl = document.getElementById('screen-video');
  if (videoScreenEl) {
    // Clear any stale overlay from a previous play first. Re-home the
    // persistent #video-player back to #screen-video before removing the old
    // overlay, so the shared element survives and this play re-parents it in.
    videoScreenEl.querySelectorAll(':scope > .video-screen').forEach((n) => {
      (n as HTMLDivElement & { cleanup?: () => void }).cleanup?.();
      rehomePersistentVideo(videoScreenEl);
      n.remove();
    });
    videoScreenEl.appendChild(videoScreen);
    showScreen('screen-video');
    setVideoPlaying(true);
    if (videoPlayer) videoPlayer.play(resolveStreamUrl(videoId));
    // Move focus onto the progress bar (first focusable in the overlay).
    // Focusing the bare <video> would show the native focus ring and put the
    // remote's cursor on a non-CTV target; the progress bar is the natural
    // "playback focused" position and its ring is the Roku-style one.
    requestAnimationFrame(() => {
      const target =
        videoScreen.querySelector<HTMLElement>('.video-screen__progress') ||
        (videoScreen.querySelector('video') as HTMLElement | null);
      target?.focus();
    });
  }
}

// ─── Screen Loaders (re-exported for test compatibility) ──────────────────────

export async function loadMainViewWrapper(): Promise<void> {
  const actions: ScreenActionMap = {
    onVideoSelect: (id, title) => handleSelection(id, title),
    onSearch: () => {
      // features.search is an operational switch, not a button to hide: while it
      // is off the search screen is never loaded, so it does no work.
      if (getEffectiveConfig(platformStorage).features.search === false) return;
      loadSearchScreenWrapper();
    },
    onSettings: () => loadSettingsScreenWrapper(),
    onRetry: () => loadMainViewWrapper(),
    onFeedLoaded: (videos) => {
      categories = videos;
      if (deepLinkController) {
        deepLinkController.checkAndNavigate(videos);
      }
    },
  };
  await screenLoader.loadMainView(platformStorage, analytics, actions);
}

export async function loadSettingsScreenWrapper(): Promise<void> {
  await screenLoader.loadSettingsScreen(platformStorage, analytics);
}

export async function loadSearchScreenWrapper(): Promise<void> {
  await screenLoader.loadSearchScreen(categories, (id, title) => handleSelection(id, title));
}

// ─── Screen visibility helpers (re-exported for test compatibility) ───────────

function retryFeedLoad(): void {
  loadMainViewWrapper();
}

export { showScreen, hideScreen, retryFeedLoad };

// ─── Focus guard (J5) ─────────────────────────────────────────────────────────

/**
 * Global focus guard: a CTV app must ALWAYS have a focused element on the
 * VISIBLE screen. If focus ever lands on (or falls back to) an element that
 * is not visible in the active screen, move it to the best candidate on the
 * visible screen. This is the safety net that makes focus work rock solid
 * across every screen transition, no matter which path moved focus
 * (remote keys, clicks, screen swaps, focus() on a removed element).
 *
 * Runs once per animation frame while a check is pending (set by the
 * focusout listener and by showScreen transitions).
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), video';

let focusGuardScheduled = false;

export function scheduleFocusGuard(): void {
  if (focusGuardScheduled) return;
  focusGuardScheduled = true;
  requestAnimationFrame(() => {
    focusGuardScheduled = false;
    runFocusGuard();
  });
}

export function runFocusGuard(): void {
  const active = document.querySelector<HTMLElement>('.screen.screen-active');
  if (!active) return;

  const el: Element | null = document.activeElement;
  const focusableAndVisible = (e: Element): boolean => {
    const he = e as HTMLElement;
    if (!he.matches(FOCUSABLE_SELECTOR)) return false;
    // Zero client rects = invisible (display:none ancestor, zero size, or
    // outside the document). Works for position:fixed elements too.
    return he.getClientRects().length > 0;
  };

  const isOnVisibleScreen = (e: Element | null): boolean => {
    if (!e) return false;
    const nav = document.getElementById('left-nav');
    return active.contains(e) || (nav ? nav.contains(e) : false);
  };

  if (!el || !isOnVisibleScreen(el) || !focusableAndVisible(el)) {
    const candidates = Array.from(active.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (c) => c.getClientRects().length > 0
    );
    const target = candidates[0];
    if (target) target.focus();
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

// Roku parity: live HH:MM overhang clock (Roku ChannelOverhang clockLabel).
// Roku parity: live HH:MM overhang clock (Roku ChannelOverhang clockLabel).
// The shared helper owns the tick and the operational switch: with
// features.overhangClock off it draws nothing and schedules nothing.
let overhangClock: OverhangClock | null = null;
let configRefreshStop: (() => void) | null = null;
function startOverhangClockFromProfile(enabled: boolean): void {
  overhangClock = startOverhangClock({
    element: document.getElementById('overhang-clock'),
    format: formatOverhangClock,
    enabled,
  });
}

const runStartup = createStartupRecovery(initializeApp, () => {
  const storage = createStorage();
  const config = { baseUrl: 'http://localhost:3000', timeout: 15 };
  saveServerConfig(storage, config);
  if (loadServerConfig(storage)?.baseUrl !== config.baseUrl) {
    throw new Error('Unable to save the default server. Check device storage and retry.');
  }
});

export function initApp(): Promise<void> {
  return runStartup();
}

async function initializeApp(): Promise<void> {
  fitViewport();
  enableLegacyLayout();
  remoteControl?.destroy();
  remoteControl = null;
  platformStorage = createStorage();
  let config = loadServerConfig(platformStorage);
  if (
    platformStorage.get('ctv_server_config') !== null &&
    (!config || typeof config.baseUrl !== 'string' || !config.baseUrl.trim())
  ) {
    throw new Error('Saved server configuration is invalid.');
  }
  if (!config) {
    config = { baseUrl: 'http://localhost:3000', timeout: 15 };
    saveServerConfig(platformStorage, config);
  }

  // Validate production server config at startup and show a clear error
  // if the server URL is invalid or insecure (non-HTTPS, non-loopback).
  const configError = validateServerConfig(platformStorage, import.meta.env.PROD);
  if (configError) {
    console.error('[WebOS App] Server config error: ' + configError);
    throw new Error(`Server configuration error: ${configError}`);
  }

  const splash = initSplashScreen({
    title: 'Chroma Channel',
    subtitle: 'Streaming Entertainment',
    splashColor: '#000000',
    minDisplayMs: 1000,
    resolution: 'fhd',
  });

  // The delivered channel profile (CONFIGURATION.md): read after the splash is
  // up so a slow server cannot delay first paint, but before any feature with a
  // side effect starts, so what the operator switched off is off from the first
  // frame. Bounded and fail-closed; never throws.
  const profile = await ensureClientConfig(platformStorage, config.baseUrl);
  const effective = profile.config;
  if (profile.errors.length) {
    console.error('[WebOS App] Channel profile: ' + profile.errors.join('; '));
  }
  startOverhangClockFromProfile(effective.features.overhangClock !== false);

  // WEB-054: the analytics endpoint is the one the delivered channel profile
  // names, and the body is the envelope that endpoint answers. Both decisions
  // live in core (core/src/analytics/AnalyticsEndpoint.ts); the adapter is a
  // transport. A delivered url on another origin is reported and refused.
  const analyticsEndpoint = resolveAnalyticsEndpoint(effective, config.baseUrl);
  if (analyticsEndpoint.errors?.length) {
    console.error('[WebOS App] analytics endpoint: ' + analyticsEndpoint.errors.join('; '));
  }
  const analyticsTransport = createAnalyticsExport(analyticsEndpoint);
  // The v2 envelope carries deviceInfo, and the analytics engine owns the id,
  // so the id is read at send time; crash reports ride the same transport.
  const platformExportFn = (events: unknown[]): Promise<void> =>
    analyticsTransport(events as AnalyticsEvent[], analytics?.getDeviceInfo());
  analytics = createAnalytics(
    {
      exportUrl: analyticsEndpoint.url,
      exportIntervalSeconds: effective.analytics.exportIntervalSeconds,
      maxEventsPerBatch: effective.analytics.maxEventsPerBatch,
      flushOnError: effective.analytics.flushOnError,
      retryAttempts: effective.content.retryAttempts,
      retryBaseDelayMs: effective.content.retryDelayMs,
      exportTimeoutSeconds: effective.content.fetchTimeout,
    },
    platformExportFn
  );
  // Two layers decide whether telemetry runs: the delivered profile (an
  // operational kill switch) and the viewer's consent. Either one off is off.
  const telemetryConsented = getShareUsagePreference(platformStorage);
  const telemetryAllowed = effective.analytics.enabled && effective.features.analytics;
  analytics.setOptOut(!telemetryConsented || !telemetryAllowed);
  exportFn = platformExportFn;

  // Diagnostics disabled by default until user grants explicit consent.
  const shareUsage = telemetryConsented && telemetryAllowed;
  if (shareUsage) {
    createCrashReporter(platformStorage, exportFn);
  }
  videoPlayer = createVideoPlayer('video-player');

  // Route D-pad keys through the shared spatial handler (GridNav) so the
  // TV remote path matches the browser/E2E keyboard path exactly:
  // wrap-around within a row, grid <-> left-nav bridging, edge containment.
  // Falls back to global cycling when the home grid is not on screen.
  remoteControl = bindMediaRemote(
    createRemoteControl({
      onBack: () => handleBackNavigation(),
      onExit: () => handleBackNavigation(),
      onEnter: () => {
        if (toggleFocusedVideo(videoPlayer, getActiveScreenId() === 'screen-video')) return;
        const focused = document.activeElement;
        if (focused) {
          const videoId = focused.getAttribute('data-video-id');
          if (videoId) {
            const title = focused.textContent || '';
            handleSelection(videoId, title);
          } else if (focused instanceof HTMLButtonElement) {
            // Activate focused buttons (Play, Watch Later, Retry, etc.)
            focused.click();
          }
        }
      },
      onUp: () =>
        routeDpadKey(
          'up',
          () => remoteControl?.focusNext(),
          () => remoteControl?.focusPrev()
        ),
      onDown: () =>
        routeDpadKey(
          'down',
          () => remoteControl?.focusNext(),
          () => remoteControl?.focusPrev()
        ),
      onLeft: () => routeDpadKey('left'),
      onRight: () => routeDpadKey('right'),
    }),
    () => videoPlayer,
    () => getActiveScreenId() === 'screen-video',
    handleBackNavigation
  );

  // Create deep link controller BEFORE loading the main view so that
  // the onFeedLoaded callback can navigate to a deep-linked video.
  deepLinkController = initDeepLinking(
    (videoId, title) => handleSelection(videoId, title),
    (message) => {
      console.error('[WebOS App] Deep link error:', message);
      if (analytics) analytics.trackInteraction('deep_link_error', 'content', message);
    },
    {
      // Event parameters win when present: they are the newest hand-off, while the
      // pull API reports whatever started this run.
      getLaunchParams: () =>
        launchParamsEvent ? webOSLaunchParamsResult(launchParamsEvent) : readWebOSLaunchParams(),
    }
  );

  // Re-run the deep-link check against the feed we already hold whenever the launcher
  // hands over new parameters. Unsubscribe first so a re-initialised app (tests, or a
  // future hot restart) cannot stack duplicate listeners on the shared document.
  unsubscribeLaunchParams?.();
  unsubscribeLaunchParams = onWebOSLaunchParams((params) => {
    launchParamsEvent = params;
    if (categories.length > 0) {
      deepLinkController?.checkAndNavigate(categories);
    }
  });

  await loadMainViewWrapper();
  splash.dismiss();

  // Bounded refresh: a flag the operator flips reaches a set that is already on
  // air within client.refreshIntervalSeconds, without a relaunch.
  configRefreshStop?.();
  configRefreshStop = startConfigRefresh({
    baseUrl: config.baseUrl,
    intervalSeconds: effective.client.refreshIntervalSeconds,
    onChange: (next) => {
      const cfg = next.config;
      overhangClock?.apply(cfg.features.overhangClock !== false);
      if (!cfg.analytics.enabled || !cfg.features.analytics) {
        analytics?.setOptOut(true);
      }
      void loadMainViewWrapper().catch((error: unknown) => {
        console.error('[WebOS App] profile refresh reload failed: ' + String(error));
      });
    },
  });

  // J5: focus guard triggers. Any screen swap (class change on a .screen)
  // or any focus-out event schedules a check that the focused element is on
  // the visible screen; if not, focus moves to the first visible focusable
  // there. This makes focus recovery deterministic on every screen.
  window.addEventListener('focusout', scheduleFocusGuard);
  const screenObserver = new MutationObserver(() => scheduleFocusGuard());
  document.querySelectorAll('.screen').forEach((s) => {
    screenObserver.observe(s, { attributes: true, attributeFilter: ['class'] });
  });
  scheduleFocusGuard();

  console.log('[WebOS App] Initialized successfully');
}

// Flush analytics and crash reports on page unload
window.addEventListener('beforeunload', () => {
  remoteControl?.destroy();
  remoteControl = null;
  overhangClock?.stop();
  overhangClock = null;
  configRefreshStop?.();
  configRefreshStop = null;
  if (analytics) analytics.shutdown();
  // A final telemetry flush obeys the same two layers as the running app.
  const mayFlush =
    !!exportFn &&
    !!platformStorage &&
    getShareUsagePreference(platformStorage) &&
    getEffectiveConfig(platformStorage).analytics.enabled &&
    getEffectiveConfig(platformStorage).features.analytics;
  if (mayFlush && platformStorage && exportFn) {
    flushCrashReports(platformStorage, exportFn);
  }
});

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp().catch((error) => {
      console.error('[WebOS App] Initialization failed:', error);
    });
  });
} else {
  initApp().catch((error) => {
    console.error('[WebOS App] Initialization failed:', error);
  });
}
