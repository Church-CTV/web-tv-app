/**
 * screenLoader.ts — Lazy screen and UI loaders for Tizen.
 *
 * This module encapsulates all dynamic imports so App.ts stays clean.
 * Vite will create separate chunks for each dynamically imported module,
 * which is verified in CI by the code-splitting gate.
 */

import type { FeedVideo, ScreenActionMap } from './screens/HomeScreen';

export type ScreenStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getAll(): Record<string, string>;
};

export type ScreenAnalytics = {
  trackInteraction: (action: string, target?: string, details?: string) => void;
} | null;

export type VideoItem = {
  id: string;
  title: string;
  shortDescription: string;
  hdPosterUrl: string;
  sdPosterUrl: string;
};

// ─── Screen Loaders ────────────────────────────────────────────────────────────

export async function loadMainView(
  storage: ScreenStorage,
  analytics: ScreenAnalytics,
  actions: ScreenActionMap
): Promise<void> {
  const { loadMainView: impl } = await import('./screens/HomeScreen');
  await impl(storage, analytics, actions);
}

export async function loadSettingsScreen(
  storage: ScreenStorage,
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
  await impl(
    videos.map((v) => ({
      id: v.videoId,
      title: v.title,
      shortDescription: v.description || '',
      hdPosterUrl: v.thumbnail,
      sdPosterUrl: v.thumbnail,
    })),
    onVideoSelect
  );
}
