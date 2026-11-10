/**
 * Vizio schedule screen loader.
 * J2b-3: Uses @ctv/core get() (HttpClient with bounded backoff + abort
 * support) instead of raw fetch. Maps HttpError → actionable error screen
 * via mapHttpError/isUserFacingError. Aborts in-flight request on re-entry.
 */

import { get, getServerBaseUrl, mapHttpError, isUserFacingError, isRetryable } from '@ctv/core';
import type { ScreenError } from '@ctv/core';
import { renderScheduleScreen, initScheduleScreen } from '../ui/ScheduleScreen';
import { renderErrorScreen, initErrorScreen, getErrorScreen } from '@ctv/shared/ErrorHandling';
import type { ScheduleEntry } from '@ctv/shared/ui/ScheduleScreen';
import { showScreen } from './visibility';

export interface ScreenActions {
  onPlay: (programId: string, title: string) => void;
}

// Track the active AbortController for the schedule container so a re-entry
// (retry click, navigation) aborts the previous in-flight schedule request.
const activeControllers = new WeakMap<HTMLDivElement, AbortController>();

/**
 * Map a ScreenError type to the shared ErrorHandling error type.
 */
function screenErrorToErrorType(se: ScreenError): 'network' | 'feed' | 'auth' | 'generic' {
  switch (se.type) {
    case 'network':
    case 'timeout':
      return 'network';
    case 'feed':
    case 'notFound':
    case 'rateLimited':
    case 'serverError':
      return 'feed';
    case 'auth':
      return 'auth';
    default:
      return 'generic';
  }
}

export async function loadScheduleScreen(
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  },
  actions: ScreenActions
): Promise<void> {
  const container = document.getElementById('screen-schedule') as HTMLDivElement | null;
  if (!container) return;

  const serverUrl = getServerBaseUrl(storage);
  const scheduleUrl = `${serverUrl}/schedule`;

  // Abort any previously in-flight schedule request for this container
  const existing = activeControllers.get(container);
  if (existing && !existing.signal.aborted) {
    existing.abort();
  }
  const controller = new AbortController();
  activeControllers.set(container, controller);

  try {
    const { data } = await get(scheduleUrl, { signal: controller.signal });

    // Request was aborted (navigation/retry superseded it) — do nothing.
    if (controller.signal.aborted) return;

    const scheduleData = data as { programs?: ScheduleEntry[] } | ScheduleEntry[];
    const scheduleEntries = Array.isArray(scheduleData)
      ? scheduleData
      : scheduleData.programs || [];

    const html = renderScheduleScreen(scheduleEntries);
    container.innerHTML = '';
    const el = document.createElement('div');
    el.innerHTML = html;
    container.appendChild(el);
    initScheduleScreen(container, {
      onPlay: actions.onPlay,
    });
    showScreen('screen-schedule');
  } catch (err) {
    const se = mapHttpError(err);

    // Abort: screen was superseded (retry/navigation) — not user-facing.
    if (se.type === 'abort') {
      console.error('[Vizio App] Schedule load aborted (not user-facing)');
      return;
    }

    if (!isUserFacingError(se)) return;

    console.error('[Vizio App] Failed to load schedule:', err);
    const errorType = screenErrorToErrorType(se);
    const errData = getErrorScreen(errorType);
    errData.message = 'Failed to load schedule. Please try again.';
    errData.retryable = isRetryable(se);
    const retryFn = isRetryable(se) ? () => loadScheduleScreen(storage, actions) : undefined;
    container.innerHTML = renderErrorScreen(errData, retryFn);
    if (retryFn) initErrorScreen(retryFn);
  }
}
