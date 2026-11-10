import { bindMediaRemote, toggleFocusedVideo } from '@ctv/shared/ui/MediaRemote';
import { formatOverhangClock } from './ui/Overhang';
/**
 * Tizen App — Root application entry point.
 * Screen logic extracted to src/screens/ for modularity.
 *
 * Performance: screen loading uses lazy dynamic imports via screenLoader
 * so Vite emits separate chunks per screen.
 */

import './styles.css';
import { enableLegacyLayout } from '@ctv/shared/ui/Viewport';
import { createStartupRecovery } from '@ctv/shared/ui/StartupRecovery';
import { startOverhangClock, type OverhangClock } from '@ctv/shared/ui/OverhangClock';

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
import { loadSamsungWebApis } from './Adapter/ScreenSaver';
import { createStorage } from './modules/initStorage';
import { createVideoPlayer } from './modules/initVideoPlayer';
import { createRemoteControl } from './modules/initRemoteControl';
import { createAnalyticsExport } from './Adapter/Analytics';
import { exitApplication } from './Adapter/RemoteControl';
import { showScreen, hideScreen, getActiveScreenId } from './screens/visibility';
import type { FeedVideo, ScreenActionMap } from './screens/HomeScreen';
import { initSplashScreen } from './ui/SplashScreen';
import { routeDpadKey } from './ui/GridNav';
import { initDeepLinking, type DeepLinkResult } from '@ctv/shared/ui/DeepLinking';
import { readTizenLaunchParams, getTizenAppControl } from '@ctv/shared/ui/LaunchParams.tizen';
import * as screenLoader from './screenLoader';

// ─── Public State ──────────────────────────────────────────────────────────────

export let videoPlayer: ReturnType<typeof createVideoPlayer> | null = null;

/** Programme the video screen is playing, for the resume store. */
let currentVideoId: string | null = null;
export let remoteControl: ReturnType<typeof createRemoteControl> | null = null;
export let analytics: Analytics | null = null;

// ─── Internal State ────────────────────────────────────────────────────────────

let platformStorage: ReturnType<typeof createStorage>;
let exportFn: ((events: unknown[]) => Promise<void>) | null = null;
let crashReporting: typeof import('./modules/initCrashReporting') | null = null;
let appLifetime = 0;
let feedVideos: FeedVideo[] = [];
let videoSelectionVersion = 0;
let videoErrorCleanup: (() => void) | null = null;
let videoErrorRendererPromise: Promise<typeof import('@ctv/shared/ui/VideoErrorRenderer')> | null =
  null;

let deepLinkController: {
  checkAndNavigate: (videos: Array<{ videoId: string; title: string }>) => boolean;
  getDeepLink: () => DeepLinkResult;
} | null = null;

function fitHdStage(): void {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fitHdStage);

// ─── Navigation Handlers ───────────────────────────────────────────────────────

/**
 * Handle back/exit navigation.
 *
 * Back from any non-home screen (video, search, settings) returns to the home
 * grid. (A screen stack previously let back land on Search/Settings after a
 * card played from those screens; the active-screen model guarantees
 * back-to-home, matching webOS.)
 */
export function handleBackNavigation(): void {
  if (analytics) analytics.trackInteraction('back');

  const activeId = getActiveScreenId();

  if (activeId === 'screen-video') {
    videoSelectionVersion++;
    // Leaving the video screen: stop the shared player so it stops
    // downloading/buffering in the background, and tear the shared video-error
    // renderer down with it. Without this the buffering row and its four media
    // listeners stay on #video-player showing whatever the last media event
    // painted, and they are only cleared if the viewer happens to select again.
    if (videoPlayer) videoPlayer.stop();
    if (videoErrorCleanup) {
      videoErrorCleanup();
      videoErrorCleanup = null;
    }
  }

  // Back from video, search, settings, or any non-home screen returns to the
  // home grid. Selection plays directly (no detail screen), so back always
  // lands on the grid.
  if (activeId && activeId !== 'screen-grid' && activeId !== 'screen-loading') {
    showScreen('screen-grid');
    // Restore focus to a grid card when returning to the home screen.
    requestAnimationFrame(() => {
      const gridContainer = document.getElementById('content-grid');
      const firstCard = gridContainer?.querySelector<HTMLElement>('.content-card');
      firstCard?.focus();
    });
    return;
  }

  // Tizen-specific (no webOS counterpart by design): remote-control keys are
  // locked via tizen.keys, so the platform never quits the app on its own.
  // Back at the root grid must exit the application — the Samsung launch
  // checklist expects back-at-root to close the app. exitApplication() is
  // guarded and a no-op in browser/E2E runs where window.tizen is absent.
  if (activeId === 'screen-grid') {
    exitApplication();
  }
}

/**
 * A card selection plays the video directly, with no intermediate title/detail
 * screen. It shows the (persistent) video screen and starts playback with the
 * feed's resolved stream URL.
 */
function handleSelection(videoId: string, _title: string): void {
  if (analytics) analytics.trackInteraction('select', 'content-card', videoId);
  currentVideoId = videoId;
  showScreen('screen-video');
  const selectionVersion = ++videoSelectionVersion;
  // Clear any previous error overlay and error listeners before new playback.
  if (videoErrorCleanup) {
    videoErrorCleanup();
    videoErrorCleanup = null;
  }
  // Lazy-load the self-contained video error renderer (keeps the full app
  // i18n dictionaries out of the main bundle, honoring the bundle budget).
  const videoEl = document.getElementById('video-player') as HTMLVideoElement | null;
  if (videoEl) {
    void attachVideoErrorHandlingLazy(videoEl, platformStorage, selectionVersion);
  }
  if (videoPlayer) {
    const known = feedVideos.find((item) => item.videoId === videoId);
    videoPlayer.play(known?.streamUrl || `/stream/${videoId}.mp4`);
  }
}

/**
 * Lazy-load the video error handling renderer and wire it to the given video
 * element. The renderer is self-contained (embeds only the video-error i18n
 * strings and reads the active locale from storage), so this keeps the full
 * app i18n dictionaries out of the main bundle while preserving locale parity.
 */
async function attachVideoErrorHandlingLazy(
  videoEl: HTMLVideoElement,
  storage: ReturnType<typeof createStorage>,
  selectionVersion: number
): Promise<void> {
  videoErrorRendererPromise ??= import('@ctv/shared/ui/VideoErrorRenderer');
  const rendererMod = await videoErrorRendererPromise;
  // Re-check element is still attached (screen may have been switched)
  if (
    !videoEl.isConnected ||
    getActiveScreenId() !== 'screen-video' ||
    selectionVersion !== videoSelectionVersion
  )
    return;
  if (videoErrorCleanup) {
    videoErrorCleanup();
    videoErrorCleanup = null;
  }
  videoErrorCleanup = rendererMod.attachVideoErrorHandling(
    videoEl,
    rendererMod.createVideoErrorI18n(storage)
  );
  // Media may fail while the chunk loads; replay the current failure only
  // after the current selection has its listener attached.
  if (videoEl.error) videoEl.dispatchEvent(new Event('error'));
}

/**
 * Test seam: set the platform storage (used by unit tests).
 * @internal
 */
export function __setPlatformStorageForTest(storage: ReturnType<typeof createStorage>): void {
  platformStorage = storage;
}

// ─── Screen Loaders (re-exported for test compatibility) ──────────────────────

export async function loadMainViewWrapper(): Promise<void> {
  const actions: ScreenActionMap = {
    onVideoSelect: handleSelection,
    onSearch: () => {
      // features.search is an operational switch, not a button to hide: while it
      // is off the search screen is never loaded, so it does no work.
      if (getEffectiveConfig(platformStorage).features.search === false) return undefined;
      return (async () => {
        await loadSearchScreenWrapper();
        showScreen('screen-search');
        // Focus after activation; hidden panels cannot receive DOM focus.
        (document.querySelector('#screen-search .osk-key') as HTMLElement | null)?.focus();
      })();
    },
    onSettings: () => {
      return (async () => {
        await loadSettingsScreenWrapper();
        showScreen('screen-settings');
        (
          document.querySelector('#screen-settings .settings-give__link') as HTMLElement | null
        )?.focus();
      })();
    },
    onRetry: () => loadMainViewWrapper(),
    onFeedLoaded: (videos) => {
      feedVideos = videos;
      if (deepLinkController) {
        deepLinkController.checkAndNavigate(videos);
      }
    },
  };
  await screenLoader.loadMainView(platformStorage, analytics, actions);
}

export async function loadSettingsScreenWrapper(): Promise<void> {
  await screenLoader.loadSettingsScreen(platformStorage, analytics);
  const screen = document.querySelector('#screen-settings .settings-screen');
  if (screen) {
    const channel = screen.querySelector('.settings-channel') || document.createElement('section');
    channel.className = 'settings-channel';
    channel.textContent = '';
    const name = document.createElement('p');
    name.textContent = `Channel: ${platformStorage.get('ctv_channel_name') || document.querySelector('.overhang-title, .overhang__title')?.textContent?.trim() || ''}`;
    const version = document.createElement('p');
    version.textContent = 'Version: 1.0.0';
    channel.append(name, version);
    if (!channel.parentElement) screen.prepend(channel);
  }
}

export async function loadSearchScreenWrapper(): Promise<void> {
  await screenLoader.loadSearchScreen(feedVideos, handleSelection);
}

// ─── Screen visibility helpers (re-exported for test compatibility) ───────────

function retryFeedLoad(): void {
  loadMainViewWrapper();
}

export { showScreen, hideScreen, retryFeedLoad };

// ─── Focus guard ───────────────────────────────────────────────────────────────

/**
 * Global focus guard: a CTV app must ALWAYS have a focused element on the
 * VISIBLE screen. If focus ever lands on (or falls back to) an element that
 * is not visible in the active screen, move it to the best candidate on the
 * visible screen. This is the safety net that makes focus work rock solid
 * across every screen transition, no matter which path moved focus
 * (remote keys, clicks, screen swaps, focus() on a removed element).
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

// ─── Remote Control Handler ───────────────────────────────────────────────────

function triggerFocusedCard(): void {
  if (toggleFocusedVideo(videoPlayer, getActiveScreenId() === 'screen-video')) return;
  const focused = document.activeElement as HTMLElement | null;
  if (!focused) return;
  const videoId = focused.getAttribute('data-video-id');
  if (videoId) {
    const title = focused.textContent || '';
    handleSelection(videoId, title);
    return;
  }
  if (focused.matches('button, .osk-key, .left-nav__item, .settings-option, [data-setting]')) {
    focused.click();
  }
}

function navigateDpad(direction: 'up' | 'down' | 'left' | 'right'): void {
  const event = new CustomEvent('ctv-dpad', {
    bubbles: true,
    cancelable: true,
    detail: `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`,
  });
  if (document.activeElement?.dispatchEvent(event) !== false) routeDpadKey(direction);
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

// Roku parity: live HH:MM overhang clock (Roku ChannelOverhang clockLabel).
// The shared helper owns the tick and the operational switch: with
// features.overhangClock off it draws nothing and schedules nothing.
let overhangClock: OverhangClock | null = null;
let configRefreshStop: (() => void) | null = null;
let screenObserver: MutationObserver | null = null;
let dismissSplash: (() => void) | null = null;
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
  // Samsung serves its Web API layer from $WEBAPIS, which only resolves on a TV: ask for
  // it first, because the screensaver control (MF-04/MF-05) is silent until it lands.
  // Off a TV this touches nothing, so browser and e2e runs never request a 404.
  loadSamsungWebApis();
  enableLegacyLayout();
  remoteControl?.destroy();
  remoteControl = null;
  const lifetime = ++appLifetime;
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
  // On Tizen, import.meta.env is not available (not a Vite build). Detect
  // production from window.location.hostname instead.
  const isProduction =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';
  const configError = validateServerConfig(platformStorage, isProduction);
  if (configError) {
    console.error('[Tizen App] Server config error: ' + configError);
    throw new Error(`Server configuration error: ${configError}`);
  }

  const splash = initSplashScreen({
    title: 'Chroma Channel',
    subtitle: 'Streaming Entertainment',
    splashColor: '#000000',
    minDisplayMs: 1000,
    resolution: 'fhd',
  });

  dismissSplash = splash.dismiss;

  // The delivered channel profile (CONFIGURATION.md): read after the splash is
  // up, before anything with a side effect starts, so what the operator switched
  // off is off from the first frame. Bounded and fail-closed; never throws.
  const profile = await ensureClientConfig(platformStorage, config.baseUrl);
  if (lifetime !== appLifetime) return;
  const effective = profile.config;
  if (profile.errors.length) {
    console.error('[Tizen App] Channel profile: ' + profile.errors.join('; '));
  }
  startOverhangClockFromProfile(effective.features.overhangClock !== false);

  // WEB-054: the analytics endpoint is the one the delivered channel profile
  // names, and the body is the envelope that endpoint answers. Both decisions
  // live in core (core/src/analytics/AnalyticsEndpoint.ts); the adapter is a
  // transport. A delivered url on another origin is reported and refused.
  const analyticsEndpoint = resolveAnalyticsEndpoint(effective, config.baseUrl);
  if (analyticsEndpoint.errors?.length) {
    console.error('[Tizen App] analytics endpoint: ' + analyticsEndpoint.errors.join('; '));
  }
  const analyticsTransport = createAnalyticsExport(analyticsEndpoint);
  // The v2 envelope carries deviceInfo, and the analytics engine owns the id,
  // so the id is read at send time; crash reports ride the same transport.
  const platformExportFn = (events: unknown[]): Promise<void> =>
    analyticsTransport(events as AnalyticsEvent[], analytics?.getDeviceInfo());
  const { createAnalytics } = await import('./modules/initAnalytics');
  if (lifetime !== appLifetime) return;
  exportFn = platformExportFn;
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
    exportFn
  );
  // Two layers decide whether telemetry runs: the delivered profile (an
  // operational kill switch) and the viewer's consent. Either one off is off.
  const telemetryConsented = getShareUsagePreference(platformStorage);
  const telemetryAllowed = effective.analytics.enabled && effective.features.analytics;
  analytics.setOptOut(!telemetryConsented || !telemetryAllowed);

  // Diagnostics disabled by default until user grants explicit consent.
  const shareUsage = telemetryConsented && telemetryAllowed;
  if (shareUsage) {
    const storage = platformStorage;
    const exporter = exportFn;
    void import('./modules/initCrashReporting')
      .then((reporting) => {
        if (lifetime !== appLifetime || !getShareUsagePreference(storage)) return;
        reporting.createCrashReporter(storage, exporter);
        crashReporting = reporting;
      })
      .catch((error) => {
        console.error('[Tizen App] Diagnostics initialization failed:', error);
      });
  }
  videoPlayer = createVideoPlayer('video-player', {
    // MF-09: the viewer should land where they stopped, not at zero. The storage
    // and the current programme are handed to the adapter, which is the only
    // place that sees stop(), ended and timeupdate.
    storage: platformStorage,
    videoId: () => currentVideoId,
  });

  // Route D-pad keys through the shared spatial handler (GridNav) so the
  // TV remote path matches the browser/E2E keyboard path exactly:
  // wrap-around within a row, grid <-> left-nav bridging, edge containment.
  remoteControl = bindMediaRemote(
    createRemoteControl({
      onBack: () => handleBackNavigation(),
      onEnter: () => triggerFocusedCard(),
      onUp: () => navigateDpad('up'),
      onDown: () => navigateDpad('down'),
      onLeft: () => navigateDpad('left'),
      onRight: () => navigateDpad('right'),
    }),
    () => videoPlayer,
    () => getActiveScreenId() === 'screen-video',
    handleBackNavigation
  );

  fitHdStage();

  // Create deep link controller BEFORE loading the main view so that
  // the onFeedLoaded callback can navigate to a deep-linked video.
  deepLinkController = initDeepLinking(
    (videoId, title) => handleSelection(videoId, title),
    (message) => {
      console.error('[Tizen App] Deep link error:', message);
      if (analytics) analytics.trackInteraction('deep_link_error', 'content', message);
    },
    {
      getLaunchParams: () => readTizenLaunchParams(getTizenAppControl()),
    }
  );

  await loadMainViewWrapper();
  if (lifetime !== appLifetime) return;
  splash.dismiss();
  dismissSplash = null;

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
        console.error('[Tizen App] profile refresh reload failed: ' + String(error));
      });
    },
  });

  // Focus guard: any screen swap (class change on a .screen) or any focus-out
  // event schedules a check that the focused element is on the visible screen;
  // if not, focus moves to the first visible focusable there.
  window.addEventListener('focusout', scheduleFocusGuard);
  screenObserver?.disconnect();
  const observer = new MutationObserver(() => scheduleFocusGuard());
  screenObserver = observer;
  document.querySelectorAll('.screen').forEach((s) => {
    observer.observe(s, { attributes: true, attributeFilter: ['class'] });
  });
  scheduleFocusGuard();

  console.log('[Tizen App] Initialized successfully');
}

window.addEventListener('beforeunload', () => {
  dismissSplash?.();
  dismissSplash = null;
  overhangClock?.stop();
  overhangClock = null;
  configRefreshStop?.();
  configRefreshStop = null;
  window.removeEventListener('focusout', scheduleFocusGuard);
  screenObserver?.disconnect();
  screenObserver = null;
  remoteControl?.destroy();
  remoteControl = null;
  appLifetime++;
  if (analytics) analytics.shutdown();
  if (exportFn && platformStorage && getShareUsagePreference(platformStorage)) {
    crashReporting?.flushCrashReports(platformStorage, exportFn);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp().catch((error) => {
      console.error('[Tizen App] Initialization failed:', error);
    });
  });
} else {
  initApp().catch((error) => {
    console.error('[Tizen App] Initialization failed:', error);
  });
}
