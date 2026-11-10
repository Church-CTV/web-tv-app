/**
 * Shared ScheduleScreen — live broadcast schedule with program listings.
 * Pure render/init: no @ctv/core imports, no platform SDKs.
 */

export interface ScheduleEntry {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  isLive: boolean;
  streamUrl?: string;
  thumbnail?: string;
  programId?: string;
  isRecording?: boolean;
}

export interface ScheduleScreenCallbacks {
  onRemind?: (programId: string) => void;
  onCancelRemind?: (programId: string) => void;
  onPlay?: (programId: string, title: string) => void;
  onSwitchToGuide?: () => void;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function calcDuration(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const mins = Math.floor((e - s) / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/**
 * Render the schedule screen as an HTML string.
 */
export function renderScheduleScreen(entries: ScheduleEntry[]): string {
  const liveCount = entries.filter((e) => e.isLive).length;

  let html = '<div class="schedule-screen">';

  // Header
  html += '<div class="schedule-screen__header">';
  html += '<h2 class="schedule-screen__title">Schedule</h2>';
  if (liveCount > 0) {
    html += `<span class="schedule-screen__live-count">${liveCount} Live</span>`;
  }
  html += '</div>';

  // Empty state
  if (entries.length === 0) {
    html += '<div class="schedule-screen__empty">No upcoming programs scheduled.</div>';
    html += '</div>';
    return html;
  }

  // Program list
  html += '<div class="schedule-list">';
  for (const entry of entries) {
    const time = formatTime(entry.startTime);
    const duration = calcDuration(entry.startTime, entry.endTime);
    const liveBadge = entry.isLive ? '<span class="badge live" aria-label="Live">LIVE</span>' : '';
    const recBadge = entry.isRecording
      ? '<span class="badge reminder" aria-label="Reminder set">REMINDER</span>'
      : '';

    html += `<div class="schedule-item${entry.isLive ? ' live' : ''}" data-program-id="${escapeAttr(entry.programId || entry.title)}" data-program-title="${escapeAttr(entry.title)}">`;
    html += `<div class="schedule-item__meta">${liveBadge}${recBadge}</div>`;
    html += `<div class="schedule-item__time">${escapeHtml(time)}</div>`;
    html += `<div class="schedule-item__info"><div class="schedule-item__title">${escapeHtml(entry.title)}</div><div class="schedule-item__desc">${escapeHtml(entry.description)}</div></div>`;
    html += `<div class="schedule-item__duration">${escapeHtml(duration)}</div>`;
    if (entry.programId) {
      if (entry.isRecording) {
        html += `<button class="schedule-item__btn schedule-item__btn--cancel" data-action="cancel-remind" data-program-id="${escapeAttr(entry.programId)}">Cancel Reminder</button>`;
      } else {
        html += `<button class="schedule-item__btn schedule-item__btn--remind" data-action="remind" data-program-id="${escapeAttr(entry.programId)}">Remind Me</button>`;
      }
    }
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

/**
 * Initialize schedule screen interactivity.
 */
export function initScheduleScreen(
  container: HTMLDivElement,
  callbacks?: ScheduleScreenCallbacks
): void {
  const items = container.querySelectorAll('.schedule-item');
  items.forEach((item) => {
    item.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="remind"]') && callbacks?.onRemind) {
        const pid = item.getAttribute('data-program-id');
        if (pid) callbacks.onRemind(pid);
      } else if (target.closest('[data-action="cancel-remind"]') && callbacks?.onCancelRemind) {
        const pid = item.getAttribute('data-program-id');
        if (pid) callbacks.onCancelRemind(pid);
      } else if (callbacks?.onPlay) {
        const pid = item.getAttribute('data-program-id') || '';
        const title = item.getAttribute('data-program-title') || pid;
        callbacks.onPlay(pid, title);
      }
    });
  });
}
