import { bindMediaRemote, toggleFocusedVideo } from '@ctv/shared/ui/MediaRemote';
import { formatOverhangClock } from './ui/Overhang';
import { APP_VERSION } from './version';
/**
 * Vizio App — Root application entry point.
 * Screen logic extracted to src/screens/ for modularity.
 */

import './styles.css';
import { createStartupRecovery } from '@ctv/shared/ui/StartupRecovery';
import { startOverhangClock, type OverhangClock } from '@ctv/shared/ui/OverhangClock';
import { fitViewport, enableLegacyLayout } from '@ctv/shared/ui/Viewport';
window.addEventListener('resize', fitViewport);

import {
  Analytics,
  saveServerConfig,
  loadServerConfig,
  validateServerConfig,
  addToWatchLater,
  getShareUsagePreference,
  ensureClientConfig,
  getEffectiveConfig,
  resolveAnalyticsEndpoint,
  startConfigRefresh,
} from '@ctv/core';
import type { AnalyticsEvent } from '@ctv/shared/contracts/analytics';
import { createStorage } from './modules/initStorage';
import { createVideoPlayer } from './modules/initVideoPlayer';
import { createAnalytics } from './modules/initAnalytics';
import { createAnalyticsExport } from './Adapter/Analytics';
import { createCrashReporter } from './modules/initCrashReporting';
import * as screenLoader from './screenLoader';
import type { ScreenActionMap, FeedVideo } from './screens/HomeScreen';
import { showScreen, hideScreen, getActiveScreenId } from './screens/visibility';
import { createRemoteControl, type VizioKey } from './Adapter/RemoteControl';
import { popScreen as navPopScreen, getScreenStack, clearStack } from './ui/Navigation';
import { initDeepLinking, type DeepLinkResult } from '@ctv/shared/ui/DeepLinking';

// ─── Public State ──────────────────────────────────────────────────────────────

export let videoPlayer: ReturnType<typeof createVideoPlayer> | null = null;
export let analytics: Analytics | null = null;

// ─── Internal State ────────────────────────────────────────────────────────────

let platformStorage: ReturnType<typeof createStorage>;
let feedVideos: FeedVideo[] = [];
let remoteControl: ReturnType<typeof createRemoteControl> | null = null;
let selectionGeneration = 0;

function handleRemoteKey(key: VizioKey): void {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return;
  const screen = document.querySelector<HTMLElement>('.screen.screen-active');
  const card = active.closest<HTMLElement>('[data-video-id]');
  const nav = active.closest('#left-nav');
  let target: HTMLElement | undefined | null;
  if (key === 'enter') {
    if (toggleFocusedVideo(videoPlayer, getActiveScreenId() === 'screen-video')) return;
    if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') active.click();
    return;
  }
  if (nav) {
    const buttons = Array.from(nav.querySelectorAll<HTMLElement>('button'));
    const index = buttons.indexOf(active);
    if (key === 'up' || key === 'down')
      target =
        buttons[Math.max(0, Math.min(buttons.length - 1, index + (key === 'down' ? 1 : -1)))];
    if (key === 'right') target = screen?.querySelector<HTMLElement>('[data-video-id]');
  } else if (card) {
    const row = card.closest('.content-category__row');
    const rows = Array.from(screen?.querySelectorAll('.content-category__row') ?? []);
    const cards = Array.from(row?.querySelectorAll<HTMLElement>('[data-video-id]') ?? []);
    const index = cards.indexOf(card);
    if (key === 'left')
      target =
        index > 0 ? cards[index - 1] : document.querySelector<HTMLElement>('#left-nav button');
    if (key === 'right') target = cards[index + 1];
    if (key === 'up' || key === 'down') {
      const next = rows[rows.indexOf(row!) + (key === 'down' ? 1 : -1)];
      const nextCards = next?.querySelectorAll<HTMLElement>('[data-video-id]');
      if (nextCards?.length) target = nextCards[Math.min(index, nextCards.length - 1)];
    }
  } else if (key === 'up' || key === 'down') {
    const controls = Array.from(
      screen?.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]') ?? []
    );
    const index = controls.indexOf(active);
    target =
      controls[Math.max(0, Math.min(controls.length - 1, index + (key === 'down' ? 1 : -1)))];
  }
  target?.focus();
}

let videoErrorCleanup: (() => void) | null = null;
let videoErrorRendererPromise: Promise<typeof import('@ctv/shared/ui/VideoErrorRenderer')> | null =
  null;

let deepLinkController: {
  checkAndNavigate: (videos: Array<{ videoId: string; title: string }>) => boolean;
  getDeepLink: () => DeepLinkResult;
} | null = null;

// ─── Navigation Handlers ───────────────────────────────────────────────────────

export function handleBackNavigation(): void {
  selectionGeneration++;
  if (analytics) analytics.trackInteraction('back');
  // Back out of the video screen has to stop playback and tear the shared video-error
  // renderer down. Nothing else on this platform calls stop(), so an un-stopped <video>
  // keeps playing audio over whatever screen back lands on, and the buffering row plus
  // its four media listeners survive on #video-player until some later selection clears
  // them (the row keeps whatever the last media event painted, visible on re-entry).
  if (getActiveScreenId() === 'screen-video') {
    if (videoPlayer) videoPlayer.stop();
    if (videoErrorCleanup) {
      videoErrorCleanup();
      videoErrorCleanup = null;
    }
  }
  const stack = getScreenStack();
  if (stack.length > 1) navPopScreen();
}

function handleSelection(videoId: string, _title: string): void {
  if (analytics) analytics.trackInteraction('select', 'content-card', videoId);
  const streamUrl = feedVideos.find((video) => video.videoId === videoId)?.streamUrl;
  const generation = ++selectionGeneration;
  showScreen('screen-video');
  // Clear any previous error overlay and error listeners before new playback
  if (videoErrorCleanup) {
    videoErrorCleanup();
    videoErrorCleanup = null;
  }
  document.getElementById('video-stream-error')?.remove();
  if (!streamUrl) {
    videoPlayer?.stop();
    const error = document.createElement('p');
    error.id = 'video-stream-error';
    error.setAttribute('role', 'alert');
    error.textContent =
      'This video has no playable stream. Press Back and choose another video, or reload the feed.';
    document.getElementById('screen-video')?.appendChild(error);
    return;
  }
  // Lazy-load the self-contained video error renderer (keeps the full app
  // i18n dictionaries out of the main bundle, honoring the bundle budget).
  const videoEl = document.getElementById('video-player') as HTMLVideoElement | null;
  if (videoEl) {
    void attachVideoErrorHandlingLazy(videoEl, platformStorage, generation);
  }
  if (videoPlayer) videoPlayer.play(streamUrl);
  videoEl?.focus();
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
  generation: number
): Promise<void> {
  videoErrorRendererPromise ??= import('@ctv/shared/ui/VideoErrorRenderer');
  const rendererMod = await videoErrorRendererPromise;
  // Re-check element is still attached (screen may have been switched)
  if (
    !videoEl.isConnected ||
    generation !== selectionGeneration ||
    getActiveScreenId() !== 'screen-video'
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
}

/**
 * Add a video to the Watch Later queue (analytics + core storage).
 */
export function handleWatchLater(videoId: string, title: string): void {
  if (analytics) analytics.trackInteraction('watch_later', 'content-card', videoId);
  addToWatchLater(platformStorage, videoId, title);
}

/**
 * Attach (or refresh) a Watch-Later button on the video screen so the feature
 * is reachable from the UI. Replaces any prior button so a single, current
 * button is always present.
 */
export function attachWatchLaterButton(videoId: string, title: string): HTMLButtonElement | null {
  const screen = document.getElementById('screen-video');
  if (!screen) return null;

  const existing = screen.querySelector<HTMLButtonElement>('#btn-watch-later-video');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.id = 'btn-watch-later-video';
  btn.className = 'video-screen__watch-later';
  btn.tabIndex = 0;
  btn.setAttribute('aria-label', 'Add to Watch Later');
  btn.textContent = '+ Watch Later';
  btn.addEventListener('click', () => handleWatchLater(videoId, title));
  screen.appendChild(btn);
  return btn;
}

/**
 * Test seam: set the platform storage (used by unit tests).
 * @internal
 */
export function __setPlatformStorageForTest(storage: ReturnType<typeof createStorage>): void {
  platformStorage = storage;
}

// ─── Screen Loaders (re-exported for test compatibility) ──────────────────────

async function openScreen(id: string, load: () => Promise<void>): Promise<void> {
  showScreen(id);
  const generation = selectionGeneration;
  await load();
  if (generation === selectionGeneration && getActiveScreenId() === id) {
    document
      .getElementById(id)
      ?.querySelector<HTMLElement>('input, button, [tabindex="0"]')
      ?.focus();
  }
}

export async function loadMainViewWrapper(): Promise<void> {
  const actions: ScreenActionMap = {
    onVideoSelect: handleSelection,
    onSearch: () => {
      // features.search is an operational switch, not a button to hide: while it
      // is off the search screen is never loaded, so it does no work.
      if (getEffectiveConfig(platformStorage).features.search === false) return;
      openScreen('screen-search', loadSearchScreenWrapper);
    },
    onSettings: () => openScreen('screen-settings', loadSettingsScreenWrapper),
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

export async function loadScheduleScreenWrapper(): Promise<void> {
  await screenLoader.loadScheduleScreen(platformStorage, { onPlay: handleSelection });
}

export async function loadContinueWatchingScreenWrapper(): Promise<void> {
  await screenLoader.loadContinueWatchingScreen(platformStorage, videoPlayer ?? undefined);
}

export async function loadWatchLaterScreenWrapper(): Promise<void> {
  await screenLoader.loadWatchLaterScreen(platformStorage);
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
    version.textContent = `Version: ${APP_VERSION}`;
    channel.append(name, version);
    if (!channel.parentElement) screen.prepend(channel);
  }
}

export async function loadSearchScreenWrapper(): Promise<void> {
  await screenLoader.loadSearchScreen(feedVideos, handleSelection);
}

// ─── Screen visibility helpers (re-exported for test compatibility) ───────────

export { showScreen, hideScreen, retryFeedLoad };

function retryFeedLoad(): void {
  loadMainViewWrapper();
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

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
  clearStack();
  selectionGeneration++;
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
  // On Vizio, import.meta.env is not available (not a Vite build). Detect
  // production from window.location.hostname instead.
  const isProduction =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';
  const configError = validateServerConfig(platformStorage, isProduction);
  if (configError) {
    console.error('[Vizio App] Server config error: ' + configError);
    throw new Error(`Server configuration error: ${configError}`);
  }

  // The delivered channel profile (CONFIGURATION.md): read before anything with
  // a side effect starts, so what the operator switched off is off from the
  // first frame. Bounded and fail-closed; never throws.
  const profile = await ensureClientConfig(platformStorage, config.baseUrl);
  const effective = profile.config;
  if (profile.errors.length) {
    console.error('[Vizio App] Channel profile: ' + profile.errors.join('; '));
  }
  startOverhangClockFromProfile(effective.features.overhangClock !== false);

  // WEB-054: the analytics endpoint is the one the delivered channel profile
  // names, and the body is the envelope that endpoint answers. Both decisions
  // live in core (core/src/analytics/AnalyticsEndpoint.ts); the adapter is a
  // transport. A delivered url on another origin is reported and refused.
  const analyticsEndpoint = resolveAnalyticsEndpoint(effective, config.baseUrl);
  if (analyticsEndpoint.errors?.length) {
    console.error('[Vizio App] analytics endpoint: ' + analyticsEndpoint.errors.join('; '));
  }
  const analyticsTransport = createAnalyticsExport(analyticsEndpoint);
  // The v2 envelope carries deviceInfo, and the analytics engine owns the id,
  // so the id is read at send time; crash reports ride the same transport.
  const platformExportFn = (events: unknown[]): Promise<void> =>
    analyticsTransport(events as AnalyticsEvent[], analytics?.getDeviceInfo());
  const exportFn = platformExportFn;
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
    createCrashReporter(platformStorage, exportFn);
  }
  videoPlayer = createVideoPlayer('video-player');
  remoteControl = bindMediaRemote(
    createRemoteControl(handleRemoteKey, handleBackNavigation),
    () => videoPlayer,
    () => getActiveScreenId() === 'screen-video',
    handleBackNavigation
  );

  console.log('[Vizio App] Initialized successfully');
  deepLinkController = initDeepLinking(
    (videoId, title) => handleSelection(videoId, title),
    (message) => {
      console.error('[Vizio App] Deep link error:', message);
      if (analytics) analytics.trackInteraction('deep_link_error', 'content', message);
    }
  );
  await loadMainViewWrapper();
  if (getActiveScreenId() === 'screen-grid') {
    (
      document.querySelector<HTMLElement>('#content-grid [data-video-id]') ||
      document.querySelector<HTMLElement>('#left-nav button')
    )?.focus();
  }

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
        console.error('[Vizio App] profile refresh reload failed: ' + String(error));
      });
    },
  });
}

window.addEventListener('beforeunload', () => {
  remoteControl?.destroy();
  remoteControl = null;
  overhangClock?.stop();
  overhangClock = null;
  configRefreshStop?.();
  configRefreshStop = null;
  if (analytics) analytics.shutdown();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp().catch((error) => {
      console.error('[Vizio App] Initialization failed:', error);
    });
  });
} else {
  initApp().catch((error) => {
    console.error('[Vizio App] Initialization failed:', error);
  });
}
