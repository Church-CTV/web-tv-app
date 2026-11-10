/**
 * Analytics — Public API for the analytics engine.
 *
 * Combines EventTracker, ExportPayload, RetryQueue, and DeviceManager
 * into a single cohesive API that platforms call directly.
 *
 * ## Usage
 * ```ts
 * const analytics = new Analytics();
 * analytics.init(config, exportFn);
 * analytics.trackScreenView('Home');
 * await analytics.flush();
 * analytics.shutdown();
 * ```
 */

import type {
  AnalyticsEvent,
  ExportConfig,
  DeviceInfo,
  InteractionEvent,
} from '@ctv/shared/contracts/analytics';
import { buildExportPayload, type AnalyticsExportPayload } from './ExportPayload';
import { RetryQueue } from './RetryQueue';
import { DeviceManager } from './DeviceManager';
import { redactSensitive } from './Redact';

const MAX_SCREEN_VIEWS = 50;
const MAX_PLAYS = 100;
const MAX_INTERACTIONS = 50;
const MAX_PLAYBACK_STATE = 50;
const MAX_DEEP_LINKS = 50;
const MAX_ERRORS = 50;

export class Analytics {
  private pendingEvents: AnalyticsEvent[] = [];
  private exportConfig: ExportConfig | null = null;
  private exportFn: ((events: AnalyticsEvent[]) => Promise<void>) | null = null;
  private retryQueue: RetryQueue;
  private deviceManager: DeviceManager;
  private sessionStart: string;
  // The delivered `analytics.exportIntervalSeconds` is what puts this timer on
  // the wall clock. Without it a television that is never closed never exports.
  private exportTimer: ReturnType<typeof setInterval> | null = null;
  private activeScreen: string = 'unknown';
  private optedOut: boolean = true;

  constructor() {
    this.deviceManager = new DeviceManager();
    this.retryQueue = new RetryQueue();
    this.sessionStart = new Date().toISOString();
  }

  /** Whether analytics collection is disabled (opted out) */
  isOptedOut(): boolean {
    return this.optedOut;
  }

  /** Set opt-out state. Defaults to true (privacy by default). */
  setOptOut(optedOut: boolean): void {
    this.optedOut = optedOut;
    // Consent and the profile kill switch both land here, so the schedule follows
    // them. A path that cannot send must not schedule either: an interval that
    // only wakes the engine to discard the batch is a cost a disabled viewer
    // still pays, and it is a timer the platform soak gate has to explain.
    // `startExportSchedule` is idempotent, so repeated calls cannot stack one.
    if (optedOut) this.stopExportSchedule();
    else this.startExportSchedule();
  }

  /**
   * Initialize analytics with export configuration.
   * @param config — Export settings (URL, interval, batch size, etc.)
   * @param exportFn — Callback to send events to server
   */
  init(config: ExportConfig, exportFn: (events: AnalyticsEvent[]) => Promise<void>): void {
    this.exportConfig = config;
    this.exportFn = exportFn;
    // Recover any previously queued events
    this.recoverQueuedEvents();
    // Only a telemetry path that can actually send gets a wall-clock timer.
    // The apps call `setOptOut` right after `init`, which arms it from there.
    if (!this.optedOut) this.startExportSchedule();
  }

  /**
   * Arm the periodic export from the delivered config. `exportIntervalSeconds`
   * of 0 or less is the documented off switch: no timer is created at all, so a
   * switched-off client holds nothing on the wall clock. Arming twice must not
   * replace a live timer with a new one: consent can flip repeatedly over a
   * session, and a clear-and-recreate each time is churn the platform timer
   * audits are written to catch.
   */
  private startExportSchedule(): void {
    if (this.exportTimer !== null) return;
    const seconds = this.exportConfig?.exportIntervalSeconds ?? 0;
    if (!this.exportConfig || seconds <= 0) return;
    this.exportTimer = setInterval(() => {
      // doFlush is a no-op while opted out or while nothing is queued, so an
      // idle client sends nothing on the tick.
      void this.doFlush().catch(() => {
        /* retry queue holds what did not land; never throw into a timer */
      });
    }, seconds * 1000);
  }

  private stopExportSchedule(): void {
    if (this.exportTimer !== null) {
      clearInterval(this.exportTimer);
      this.exportTimer = null;
    }
  }

  /** How many events are still owed after failed exports (support/diagnostics). */
  getRetryQueueCount(): number {
    return this.retryQueue.countEvents();
  }

  /**
   * Events held for one category. The caps in `MEMORY_CAPS` are per category
   * (screen views 50, plays 100, deep links 50, errors 50, and the same for
   * interactions and playback state); measuring them against the whole queue
   * silently turned every category's cap into one shared 100-event budget, so a
   * busy session stopped recording telemetry of every kind once it hit 50
   * interactions.
   */
  private categoryCount(eventType: AnalyticsEvent['eventType']): number {
    let count = 0;
    for (const event of this.pendingEvents) if (event.eventType === eventType) count++;
    return count;
  }

  /** Track a screen view event */
  trackScreenView(screenName: string, previousScreen?: string): void {
    if (this.optedOut) return;
    if (this.categoryCount('screen_view') >= MAX_SCREEN_VIEWS) return;
    const event: AnalyticsEvent = {
      eventType: 'screen_view',
      timestamp: new Date().toISOString(),
      screenName,
    };
    if (previousScreen) event.previousScreen = previousScreen;
    this.pendingEvents.push(event);
    this.activeScreen = screenName;
  }

  /** Track an interaction event */
  trackInteraction(action: string, target?: string, details?: string): void {
    if (this.optedOut) return;
    if (this.categoryCount('interaction') >= MAX_INTERACTIONS) return;
    const event: AnalyticsEvent = {
      eventType: 'interaction',
      timestamp: new Date().toISOString(),
      action: action as InteractionEvent['action'],
    };
    if (target) event.target = target;
    if (details) event.details = redactSensitive(details) ?? details;
    this.pendingEvents.push(event);
  }

  /** Track a content play event */
  trackContentPlay(
    contentId: string,
    contentTitle?: string,
    contentDuration?: number,
    sourceScreen?: string
  ): void {
    if (this.optedOut) return;
    if (this.categoryCount('content_play') >= MAX_PLAYS) return;
    const event: AnalyticsEvent = {
      eventType: 'content_play',
      timestamp: new Date().toISOString(),
      contentId,
    };
    if (contentTitle) event.contentTitle = contentTitle;
    if (contentDuration) event.contentDuration = contentDuration;
    if (sourceScreen) event.sourceScreen = sourceScreen;
    this.pendingEvents.push(event);
  }

  /** Track a playback state change event */
  trackPlaybackState(state: 'play' | 'pause' | 'resume', contentId?: string): void {
    if (this.optedOut) return;
    if (this.categoryCount('playback_state') >= MAX_PLAYBACK_STATE) return;
    const event: AnalyticsEvent = {
      eventType: 'playback_state',
      timestamp: new Date().toISOString(),
      state,
    };
    if (contentId) event.contentId = contentId;
    this.pendingEvents.push(event);
  }

  /** Track a deep link event */
  trackDeepLink(
    contentId: string,
    mediaType: 'video' | 'series' | 'episode' | 'live' | 'movie',
    source?: 'input_launch' | 'rowlist' | 'schedule' | 'search' | 'continue' | 'watchlater'
  ): void {
    if (this.optedOut) return;
    if (this.categoryCount('deep_link') >= MAX_DEEP_LINKS) return;
    const event: AnalyticsEvent = {
      eventType: 'deep_link',
      timestamp: new Date().toISOString(),
      contentId,
      mediaType,
    };
    if (source) event.source = source;
    this.pendingEvents.push(event);
  }

  /** Track an error event */
  trackError(
    errorType: 'network' | 'player' | 'feed' | 'ui' | 'unknown',
    errorMessage?: string,
    context?: string
  ): void {
    if (this.optedOut) return;
    if (this.categoryCount('error') >= MAX_ERRORS) return;
    const event: AnalyticsEvent = {
      eventType: 'error',
      timestamp: new Date().toISOString(),
      errorType,
    };
    if (errorMessage) event.errorMessage = redactSensitive(errorMessage) ?? errorMessage;
    if (context) event.context = redactSensitive(context) ?? context;
    this.pendingEvents.push(event);
  }

  /** Get count of pending events */
  getPendingCount(): number {
    return this.pendingEvents.length;
  }

  /** Get all pending events */
  getPendingEvents(): AnalyticsEvent[] {
    return [...this.pendingEvents];
  }

  /** Flush pending events without retry — returns them */
  flushEvents(): import('@ctv/shared/contracts/analytics').AnalyticsEvent[] {
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    return events;
  }

  /** Flush all pending events for export */
  flush(): Promise<AnalyticsEvent[]> {
    return this.doFlush();
  }

  /**
   * Export everything queued, in batches no larger than the delivered
   * `analytics.maxEventsPerBatch`. Each batch is retried on its own and a batch
   * that never lands goes to the retry queue without stranding the batches
   * behind it: one 429 must not cost a whole session's telemetry.
   */
  private async doFlush(): Promise<AnalyticsEvent[]> {
    if (this.optedOut) return [];
    if (this.pendingEvents.length === 0) return [];

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    if (!this.exportFn || !this.exportConfig) {
      return events;
    }

    const maxAttempts = this.exportConfig.retryAttempts || 3;
    const baseDelay = this.exportConfig.retryBaseDelayMs || 1000;

    for (const batch of this.toBatches(events, this.exportConfig.maxEventsPerBatch)) {
      let delivered = false;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.exportFn(batch);
          delivered = true;
          break;
        } catch {
          if (attempt < maxAttempts) {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1))
            );
          }
        }
      }
      if (!delivered) {
        // Max retries exceeded for this batch — keep it, keep going.
        this.retryQueue.add(batch);
      }
    }

    // A batch that failed is held in the retry queue and the batches behind it
    // still went out, so this resolves instead of throwing: a timer tick must
    // never surface an unhandled rejection on a television.
    return events;
  }

  /** Split a queue into export batches honouring the delivered cap. */
  private toBatches(events: AnalyticsEvent[], maxEventsPerBatch: number): AnalyticsEvent[][] {
    const size =
      Number.isFinite(maxEventsPerBatch) && maxEventsPerBatch > 0
        ? Math.floor(maxEventsPerBatch)
        : events.length;
    if (size >= events.length) return [events];
    const batches: AnalyticsEvent[][] = [];
    for (let i = 0; i < events.length; i += size) batches.push(events.slice(i, i + size));
    return batches;
  }

  /**
   * Flush all pending events for shutdown.
   * Attempts one async export before discarding.
   */
  async flushForShutdown(): Promise<AnalyticsEvent[]> {
    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    if (!this.optedOut && this.exportFn && this.exportConfig) {
      // Attempt one async export without retry.
      // If it fails, events are lost on shutdown — unavoidable without
      // persistent storage for analytics events.
      try {
        await this.exportFn(events);
      } catch {
        // Export failed on shutdown; events are already drained.
      }
    }

    return events;
  }

  /** Shutdown — flush remaining events, stop periodic export */
  shutdown(): void {
    this.stopExportSchedule();
    this.flushForShutdown(); // fire-and-forget; caller can await if needed
    this.retryQueue.clear();
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.stopExportSchedule();
    this.pendingEvents = [];
    this.exportConfig = null;
    this.exportFn = null;
    this.retryQueue.clear();
    this.sessionStart = new Date().toISOString();
    this.activeScreen = 'unknown';
  }

  /** Get device info */
  getDeviceInfo(): DeviceInfo {
    return this.deviceManager.getDeviceInfo();
  }

  /** Get the export payload (for testing/inspection) */
  getExportPayload(): AnalyticsExportPayload | null {
    if (!this.exportConfig) return null;
    return buildExportPayload(
      this.pendingEvents,
      this.deviceManager.getDeviceInfo().appVersion || 'v1.0.0',
      this.activeScreen,
      this.sessionStart
    );
  }

  /** Recover events from retry queue on startup */
  private recoverQueuedEvents(): void {
    while (!this.retryQueue.isEmpty()) {
      const events = this.retryQueue.pop();
      if (events) {
        this.pendingEvents.push(...(events as AnalyticsEvent[]));
      }
    }
  }
}
