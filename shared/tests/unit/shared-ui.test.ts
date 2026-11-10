/**
 * Shared UI — comprehensive unit tests for all 16 components.
 * Tests HTML-string rendering, escaping, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard, type SharedVideoItem } from '@ctv/shared/ui/ContentCard';
import { renderContentGrid, type ContentGridCategory } from '@ctv/shared/ui/ContentGrid';
import { renderContinueWatchingScreen } from '@ctv/shared/ui/ContinueWatchingScreen';
import { renderContinueWatchingVideoScreen } from '@ctv/shared/ui/ContinueWatchingVideoScreen';
import { renderLeftNav, type NavItem } from '@ctv/shared/ui/LeftNav';
import { renderOverhang, type OverhangConfig } from '@ctv/shared/ui/Overhang';
import { renderScheduleScreen } from '@ctv/shared/ui/ScheduleScreen';
import { renderScreenShell } from '@ctv/shared/ui/ScreenShell';
import { renderSearchScreen } from '@ctv/shared/ui/SearchScreen';
import { renderSettingsScreen } from '@ctv/shared/ui/SettingsScreen';
import { renderVideoScreen } from '@ctv/shared/ui/VideoScreen';
import { renderWatchLaterScreen } from '@ctv/shared/ui/WatchLaterScreen';
import { renderContentDetail } from '@ctv/shared/ui/ContentDetail';

// ─── ContentCard Tests ────────────────────────────────────────────────────────

describe('ContentCard', () => {
  it('renders card with title and poster', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test Video', sdPosterUrl: '/thumb.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('content-card');
    expect(html).toContain('Test Video');
    expect(html).toContain('v1');
  });

  it('renders description when provided', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', shortDescription: 'A description' };
    const html = renderContentCard(video);
    expect(html).toContain('A description');
    expect(html).toContain('content-card__description');
  });

  it('renders duration', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: 3661 };
    const html = renderContentCard(video);
    expect(html).toContain('1h 1m');
  });

  it('renders without duration when 0', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: 0 };
    const html = renderContentCard(video);
    expect(html).not.toContain('content-card__duration');
  });

  it('escapes HTML in title', () => {
    const video: SharedVideoItem = { id: 'xss', title: '<b>Bold</b>' };
    const html = renderContentCard(video);
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('uses hdPosterUrl over sdPosterUrl', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      hdPosterUrl: '/hd.jpg',
      sdPosterUrl: '/sd.jpg',
    };
    const html = renderContentCard(video);
    expect(html).toContain('/hd.jpg');
    expect(html).not.toContain('/sd.jpg');
  });

  it('falls back to thumbnail when no poster URLs', () => {
    const video: SharedVideoItem = { id: 'v1', title: 'Test', thumbnail: '/thumb.jpg' };
    const html = renderContentCard(video);
    expect(html).toContain('/thumb.jpg');
  });

  it('renders with progress indicator', () => {
    const video: SharedVideoItem = {
      id: 'v1',
      title: 'Test',
      sdPosterUrl: '/t.jpg',
      content: { videos: [{ url: '/stream.mp4' }] },
    };
    const html = renderContentCard(video);
    expect(html).toContain('data-progress="1"');
  });
});

// ─── ContentGrid Tests ────────────────────────────────────────────────────────

describe('ContentGrid', () => {
  it('renders grid with categories', () => {
    const cats: ContentGridCategory[] = [
      {
        id: 'cat1',
        name: 'Category 1',
        videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }],
      },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('main-grid');
    expect(html).toContain('Category 1');
  });

  it('skips empty categories', () => {
    const cats: ContentGridCategory[] = [{ id: 'empty', name: 'Empty', videos: [] }];
    const html = renderContentGrid({ categories: cats });
    expect(html).not.toContain('Empty');
  });

  it('renders multiple category rows', () => {
    const cats: ContentGridCategory[] = [
      { id: 'cat1', name: 'Animals', videos: [{ id: 'v1', title: 'V1', sdPosterUrl: '/t.jpg' }] },
      { id: 'cat2', name: 'Nature', videos: [{ id: 'v2', title: 'V2', sdPosterUrl: '/t.jpg' }] },
    ];
    const html = renderContentGrid({ categories: cats });
    expect(html).toContain('Animals');
    expect(html).toContain('Nature');
  });
});

// ─── ContinueWatchingScreen Tests ─────────────────────────────────────────────

describe('ContinueWatchingScreen', () => {
  it('renders with empty state', () => {
    const html = renderContinueWatchingScreen({ items: [] });
    expect(html).toContain('continue-watching-screen');
    expect(html).toContain('No items');
  });

  it('renders items with progress', () => {
    const html = renderContinueWatchingScreen({
      items: [{ videoId: 'v1', title: 'Video 1', position: 1800, duration: 3600 }],
    });
    expect(html).toContain('Video 1');
    expect(html).toContain('50%');
  });

  it('formats remaining time', () => {
    const html = renderContinueWatchingScreen({
      items: [{ videoId: 'v1', title: 'Video 1', position: 300, duration: 600 }],
    });
    expect(html).toContain('5m');
  });
});

// ─── ContinueWatchingVideoScreen Tests ────────────────────────────────────────

describe('ContinueWatchingVideoScreen', () => {
  it('renders video player', () => {
    const html = renderContinueWatchingVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('video-screen');
    expect(html).toContain('video-v1');
  });

  it('shows resume banner when position exists', () => {
    const html = renderContinueWatchingVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
      position: 120,
      duration: 600,
    });
    expect(html).toContain('Resume from 2m');
    expect(html).toContain('Resume');
    expect(html).toContain('Start Over');
  });

  it('does not show resume banner when no position', () => {
    const html = renderContinueWatchingVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
      position: 0,
      duration: 600,
    });
    expect(html).not.toContain('resume-banner');
  });

  it('renders back button when onBack provided', () => {
    const html = renderContinueWatchingVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
      onBack: () => {},
    });
    expect(html).toContain('video-screen__back');
  });
});

// ─── LeftNav Tests ────────────────────────────────────────────────────────────

describe('LeftNav', () => {
  it('renders nav items', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'search' },
    ];
    const html = renderLeftNav({ items, onItemClick: () => {} });
    expect(html).toContain('left-nav');
    expect(html).toContain('Home');
    expect(html).toContain('Search');
  });

  it('highlights active item', () => {
    const items: NavItem[] = [
      { id: 'home', label: 'Home', icon: 'home', screen: 'grid' },
      { id: 'search', label: 'Search', icon: 'search', screen: 'search' },
    ];
    const html = renderLeftNav({ items, activeItem: 'search', onItemClick: () => {} });
    expect(html).toContain('left-nav__item--active');
  });

  it('escapes HTML in labels', () => {
    const items: NavItem[] = [
      { id: 'xss', label: '<script>alert(1)</script>', icon: 'home', screen: 'grid' },
    ];
    const html = renderLeftNav({ items, onItemClick: () => {} });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

// ─── Overhang Tests ───────────────────────────────────────────────────────────

describe('Overhang', () => {
  it('renders overhang with title', () => {
    const html = renderOverhang({ title: 'My App' });
    expect(html).toContain('overhang');
    expect(html).toContain('My App');
  });

  it('renders logo when provided', () => {
    const html = renderOverhang({ title: 'App', logoUrl: '/logo.png' });
    expect(html).toContain('overhang__logo');
    expect(html).toContain('/logo.png');
  });

  it('renders back button', () => {
    const html = renderOverhang({ title: 'App', showBackButton: true });
    expect(html).toContain('overhang__btn--back');
  });

  it('renders actions', () => {
    const html = renderOverhang({
      title: 'App',
      actions: [{ icon: '🔔', label: 'Alerts', action: 'alerts' }],
    });
    expect(html).toContain('Alerts');
  });

  it('escapes HTML in title', () => {
    const html = renderOverhang({ title: '<b>Bold</b>' });
    expect(html).toContain('&lt;b&gt;');
  });
});

// ─── ScheduleScreen Tests ─────────────────────────────────────────────────────

describe('ScheduleScreen', () => {
  it('renders empty schedule', () => {
    const html = renderScheduleScreen([]);
    expect(html).toContain('schedule-screen');
    expect(html).toContain('No upcoming programs');
  });

  it('renders programs with times', () => {
    const programs = [
      {
        title: 'Show 1',
        description: 'Desc',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
      },
    ];
    const html = renderScheduleScreen(programs);
    expect(html).toContain('Show 1');
    expect(html).toContain('schedule-list');
  });

  it('renders live indicator', () => {
    const programs = [
      {
        title: 'Live',
        description: '',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
        isLive: true,
      },
    ];
    const html = renderScheduleScreen(programs);
    expect(html).toContain('1 Live');
  });

  it('renders recording badge', () => {
    const programs = [
      {
        title: 'Recorded',
        description: '',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
        isRecording: true,
      },
    ];
    const html = renderScheduleScreen(programs);
    expect(html).toContain('REMINDER');
  });
});

// ─── ScreenShell Tests ────────────────────────────────────────────────────────

describe('ScreenShell', () => {
  it('renders title and body', () => {
    const html = renderScreenShell('Test Title', '<p>Body</p>');
    expect(html).toContain('screen-shell');
    expect(html).toContain('Test Title');
    expect(html).toContain('Body');
  });

  it('escapes HTML in title', () => {
    const html = renderScreenShell('<b>Bold</b>', 'body');
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders header, body, footer sections', () => {
    const html = renderScreenShell('Title', 'content');
    expect(html).toContain('screen-shell__header');
    expect(html).toContain('screen-shell__body');
    expect(html).toContain('screen-shell__footer');
  });
});

// ─── SearchScreen Tests ───────────────────────────────────────────────────────

describe('SearchScreen', () => {
  it('renders search input', () => {
    const html = renderSearchScreen({
      videos: [],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-screen');
    expect(html).toContain('search-input');
  });

  it('renders results container', () => {
    const html = renderSearchScreen({
      videos: [],
      onVideoSelect: () => {},
    });
    expect(html).toContain('search-results');
  });

  it('includes placeholder text', () => {
    const html = renderSearchScreen({
      videos: [],
      onVideoSelect: () => {},
    });
    expect(html).toContain('Search videos');
  });
});

// ─── SettingsScreen Tests ─────────────────────────────────────────────────────

describe('SettingsScreen', () => {
  it('renders settings screen', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('settings-screen');
    expect(html).toContain('Settings');
  });

  it('renders appearance section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Appearance');
    expect(html).toContain('Layout');
    expect(html).toContain('Theme');
  });

  it('renders server section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Server');
    expect(html).toContain('Server URL');
  });

  it('renders data section', () => {
    const html = renderSettingsScreen();
    expect(html).toContain('Data');
    expect(html).toContain('Clear Cache');
  });
});

// ─── VideoScreen Tests ────────────────────────────────────────────────────────

describe('VideoScreen', () => {
  it('renders video player', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('video-screen');
    expect(html).toContain('video-v1');
    expect(html).toContain('controls');
  });

  it('renders autoplay', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('autoplay');
  });

  it('renders duration', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
      duration: 3600,
    });
    expect(html).toContain('1:00:00');
  });

  it('renders time display', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('video-screen__time');
    expect(html).toContain('0:00');
  });

  it('renders progress bar', () => {
    const html = renderVideoScreen({
      videoId: 'v1',
      title: 'Test',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('video-screen__progress');
    expect(html).toContain('video-screen__progress-bar');
  });
});

// ─── WatchLaterScreen Tests ───────────────────────────────────────────────────

describe('WatchLaterScreen', () => {
  it('renders watch later screen', () => {
    const html = renderWatchLaterScreen({ items: [] });
    expect(html).toContain('watch-later-screen');
    expect(html).toContain('Watch Later');
  });

  it('shows empty state', () => {
    const html = renderWatchLaterScreen({ items: [] });
    expect(html).toContain('No items in Watch Later');
  });

  it('renders items with remove', () => {
    const html = renderWatchLaterScreen({
      items: [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }],
      onRemove: () => {},
    });
    expect(html).toContain('Video 1');
    expect(html).toContain('Remove');
  });

  it('renders clear all button', () => {
    const html = renderWatchLaterScreen({
      items: [{ videoId: 'v1', title: 'Video 1', addedAt: '2026-01-01T00:00:00Z' }],
      onClearAll: () => {},
    });
    expect(html).toContain('Clear All');
  });
});

// ─── ContentDetail Tests ──────────────────────────────────────────────────────

describe('ContentDetail', () => {
  it('renders content detail', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test Video',
      description: 'Desc',
      thumbnail: '/t.jpg',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('content-detail');
    expect(html).toContain('Test Video');
  });

  it('renders play button', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test',
      description: '',
      thumbnail: '/t.jpg',
      streamUrl: '/stream.mp4',
      onPlay: () => {},
    });
    expect(html).toContain('btn-play');
    expect(html).toContain('Play');
  });

  it('renders watch later button', () => {
    const html = renderContentDetail({
      videoId: 'v1',
      title: 'Test',
      description: '',
      thumbnail: '/t.jpg',
      streamUrl: '/stream.mp4',
      onWatchLater: () => {},
    });
    expect(html).toContain('btn-watch-later');
  });

  it('escapes HTML in title', () => {
    const html = renderContentDetail({
      videoId: 'xss',
      title: '<b>Bold</b>',
      description: '',
      thumbnail: '/t.jpg',
      streamUrl: '/stream.mp4',
    });
    expect(html).toContain('&lt;b&gt;');
  });
});
