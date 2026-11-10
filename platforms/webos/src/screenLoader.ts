/**
 * screenLoader.ts — Lazy screen and UI loaders.
 *
 * This module encapsulates all dynamic imports so App.ts stays clean.
 * Vite will create separate chunks for each dynamically imported module,
 * which is verified in CI by the code-splitting gate.
 */

import type { FeedVideo, ScreenActionMap } from './screens/HomeScreen';
import type { VideoItem } from '@ctv/core/feed/FeedParser';
import type { ContentDetailCallbacks } from './ui/ContentDetail';
import type { VideoScreenProps } from './ui/VideoScreen';

// ─── Screen Loaders ────────────────────────────────────────────────────────────

export async function loadMainView(
  storage: { get(key: string): string | null; set(key: string, value: string): void },
  analytics: {
    trackInteraction: (action: string, target?: string, details?: string) => void;
  } | null,
  actions: ScreenActionMap
): Promise<void> {
  const { loadMainView: impl } = await import('./screens/HomeScreen');
  await impl(storage, analytics, actions);
}

export async function loadSettingsScreen(
  storage: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
    getAll(): Record<string, string>;
  },
  analytics?: { setOptOut: (enabled: boolean) => void } | null
): Promise<void> {
  const { loadSettingsScreen: impl } = await import('./screens/SettingsScreen');
  await impl(storage, analytics);
}

export async function loadSearchScreen(
  videos: FeedVideo[],
  onVideoSelect: (videoId: string, title: string) => void
): Promise<void> {
  const { loadSearchScreen: impl } = await import('./screens/SearchScreen');
  await impl(videos, onVideoSelect);
}

// ─── UI Component Loaders ──────────────────────────────────────────────────────

export async function createContentDetail(
  video: VideoItem,
  callbacks?: ContentDetailCallbacks
): Promise<HTMLElement & { cleanup: () => void }> {
  const { createContentDetail: impl } = await import('./ui/ContentDetail');
  return impl(video, callbacks);
}

export async function createVideoScreen(props: VideoScreenProps): Promise<HTMLDivElement> {
  const { createVideoScreen: impl } = await import('./ui/VideoScreen');
  return impl(props);
}
