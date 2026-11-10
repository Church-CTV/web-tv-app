/**
 * Resume points: where a viewer stopped, and whether it is worth sending them
 * back there.
 *
 * The rule set lives here, in the shared layer, so every platform inherits the
 * same behaviour instead of each one re-deciding it (the tier-2 rail: a
 * platform is a view over the core, never a fork of it). Tizen had the pieces —
 * the adapter can seek, the shared video screen can show a "Resuming from 12:34"
 * banner — but nothing ever wrote a position down, so every programme started
 * from zero. Samsung's MF-09 asks for continue-watching; this is the part that
 * makes it true.
 *
 * Deliberate rules, each one a defect avoided:
 *   - live content (no finite duration) is never resumable: "resume" on a live
 *     stream would mean jumping back into a slot that already aired;
 *   - the first seconds and the last few seconds are not stored: a resume point
 *     at 0:02 advertises a restart, and one at the very end replays the outro;
 *   - a stored point is clamped against the duration it is replayed into,
 *     because the file on the server may have been re-encoded since;
 *   - a point older than the retention window is dropped: someone returning
 *     after three months wants the programme, not the last two minutes of it.
 */

/** The minimal persistence shape both platform storages satisfy. */
export interface ResumeStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface ResumePoint {
  videoId: string;
  position: number;
  duration: number;
  /** Epoch ms of the last write, so age can be judged. */
  savedAt: number;
}

/** Storage namespace. One key per programme, so a library never collides. */
export const RESUME_KEY_PREFIX = 'ctv.resume.';

/** Don't store a position in the first or last N seconds. */
export const RESUME_MIN_SECONDS = 15;
export const RESUME_EDGE_SECONDS = 10;

/** A resume point stops being useful after this many days. */
export const RESUME_RETENTION_DAYS = 30;

/** Storage key for one programme. */
export function resumeKey(videoId: string): string {
  return `${RESUME_KEY_PREFIX}${videoId}`;
}

/**
 * Should this position be remembered?
 *
 * @param position - seconds played
 * @param duration - total seconds, or `Infinity`/`NaN` for a live stream
 */
export function isResumable(position: number, duration: number): boolean {
  if (!Number.isFinite(position) || !Number.isFinite(duration)) return false;
  if (duration <= 0) return false;
  if (position < RESUME_MIN_SECONDS) return false;
  if (position > duration - RESUME_EDGE_SECONDS) return false;
  return true;
}

/**
 * Remember where the viewer stopped.
 *
 * @returns true when something was written (and so, when the caller can trust a
 *          later read to find it)
 */
export function saveResumePoint(
  store: ResumeStore,
  videoId: string,
  position: number,
  duration: number,
  savedAt: number = Date.now()
): boolean {
  if (!videoId || !isResumable(position, duration)) return false;
  try {
    store.set(
      resumeKey(videoId),
      JSON.stringify({ videoId, position, duration, savedAt } satisfies ResumePoint)
    );
    return true;
  } catch {
    // A full or unavailable store is a reason to forget resume, not to break
    // playback: the viewer keeps watching, they just start from the top next time.
    return false;
  }
}

/**
 * Read a resume point and decide whether it is still usable.
 *
 * @param now - epoch ms to judge age against (injectable so the 30-day rule is
 *              testable without time travel)
 * @returns the point, clamped into `duration`, or `null` when there is nothing
 *          worth seeking to
 */
export function loadResumePoint(
  store: ResumeStore,
  videoId: string,
  now: number = Date.now(),
  retentionDays: number = RESUME_RETENTION_DAYS
): ResumePoint | null {
  if (!videoId) return null;
  let raw: string | null = null;
  try {
    raw = store.get(resumeKey(videoId));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const point = parsed as Partial<ResumePoint>;
  if (point.videoId !== undefined && point.videoId !== videoId) return null;
  if (!Number.isFinite(point.position) || !Number.isFinite(point.duration)) return null;
  if ((point.position as number) < 0 || (point.duration as number) <= 0) return null;

  const ageMs = now - (Number.isFinite(point.savedAt) ? (point.savedAt as number) : now);
  if (ageMs > retentionDays * 24 * 60 * 60 * 1000) return null;

  const duration = point.duration as number;
  const position = Math.min(point.position as number, Math.max(0, duration - RESUME_EDGE_SECONDS));
  if (!isResumable(position, duration)) return null;
  return { videoId, position, duration, savedAt: point.savedAt as number };
}

/** Forget a programme's position (watched to the end, or cleared by the user). */
export function clearResumePoint(store: ResumeStore, videoId: string): void {
  if (!videoId) return;
  try {
    store.remove(resumeKey(videoId));
  } catch {
    // Nothing to do: an unwritable store has nothing to forget.
  }
}

/**
 * "Resuming from 12:34" in the words the banner shows. Kept here so the banner
 * and the seek agree on one number instead of formatting the same value twice.
 */
export function formatResumeTime(position: number): string {
  if (!Number.isFinite(position) || position < 0) return '0:00';
  const total = Math.floor(position);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
