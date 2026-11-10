import { describe, it, expect } from 'vitest';
import { renderScheduleScreen, type ScheduleEntry } from '../../src/ui/ScheduleScreen';

describe('ScheduleScreen', () => {
  it('should render schedule screen', () => {
    const html = renderScheduleScreen([]);

    expect(html).toContain('schedule-screen');
    expect(html).toContain('Schedule');
  });

  it('should show empty state when no items', () => {
    const html = renderScheduleScreen([]);

    expect(html).toContain('No upcoming programs scheduled');
  });

  it('should render schedule items', () => {
    const items: ScheduleEntry[] = [
      {
        title: 'Sunday Service',
        description: 'Weekly service',
        startTime: '2026-07-12T10:00:00Z',
        endTime: '2026-07-12T12:00:00Z',
        isLive: false,
        programId: 'v1',
      },
    ];

    const html = renderScheduleScreen(items);

    expect(html).toContain('Sunday Service');
    expect(html).toContain('Weekly service');
    expect(html).toContain('v1');
    expect(html).toContain('schedule-item');
  });

  it('should show live badge for live items', () => {
    const items: ScheduleEntry[] = [
      {
        title: 'Live Service',
        description: 'Live broadcast',
        startTime: '2026-07-12T10:00:00Z',
        endTime: '2026-07-12T12:00:00Z',
        isLive: true,
        programId: 'v2',
      },
    ];

    const html = renderScheduleScreen(items);

    expect(html).toContain('LIVE');
    expect(html).toContain('schedule-screen__live-count');
  });

  it('should not show live badge for non-live items', () => {
    const items: ScheduleEntry[] = [
      {
        title: 'Recorded Service',
        description: 'Recorded',
        startTime: '2026-07-11T10:00:00Z',
        endTime: '2026-07-11T12:00:00Z',
        isLive: false,
        programId: 'v3',
      },
    ];

    const html = renderScheduleScreen(items);

    expect(html).not.toContain('LIVE');
  });
});
