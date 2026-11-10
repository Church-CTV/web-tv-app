/**
 * Vizio ScheduleIntegration — unit tests.
 */

import { describe, it, expect } from 'vitest';
import { renderScheduleScreen } from '../../../../shared/ui/ScheduleScreen';
import type { ScheduleEntry } from '../../../../shared/ui/ScheduleScreen';

describe('Vizio ScheduleIntegration', () => {
  it('renders schedule screen with programs', () => {
    const html = renderScheduleScreen([]);
    expect(html).toContain('schedule-screen');
    expect(html).toContain('Schedule');
  });

  it('renders schedule with programs', () => {
    const programs: ScheduleEntry[] = [
      {
        title: 'Show 1',
        description: '',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T00:30:00Z',
      },
    ];
    const html = renderScheduleScreen(programs);
    expect(html).toContain('Show 1');
    expect(html).toContain('schedule-list');
  });

  it('renders empty schedule', () => {
    const html = renderScheduleScreen([]);
    expect(html).toContain('No upcoming programs scheduled');
  });

  it('renders live indicator', () => {
    const programs: ScheduleEntry[] = [
      {
        title: 'Live Show',
        description: '',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
        isLive: true,
      },
    ];
    const html = renderScheduleScreen(programs);
    expect(html).toContain('1 Live');
  });
});
