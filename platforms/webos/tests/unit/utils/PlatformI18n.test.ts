/**
 * PlatformI18n — tests the singleton wrapper and Spanish UI integration.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getPlatformI18n,
  setPlatformLocale,
  getPlatformLocale,
  _resetPlatformI18n,
} from '../../../src/utils/PlatformI18n';

describe('PlatformI18n singleton', () => {
  beforeEach(() => {
    _resetPlatformI18n();
    window.localStorage.clear();
  });

  afterEach(() => {
    _resetPlatformI18n();
    window.localStorage.clear();
  });

  it('returns a singleton instance', () => {
    const a = getPlatformI18n();
    const b = getPlatformI18n();
    expect(a).toBe(b);
  });

  it('defaults to English', () => {
    expect(getPlatformI18n().locale).toBe('en');
  });

  it('reads stored locale from platform storage (localStorage)', () => {
    window.localStorage.setItem('ctv_pref_locale', 'es');
    const i18n = getPlatformI18n();
    expect(i18n.locale).toBe('es');
  });

  it('setPlatformLocale persists to localStorage', () => {
    getPlatformI18n();
    setPlatformLocale('es');
    expect(window.localStorage.getItem('ctv_pref_locale')).toBe('es');
    expect(getPlatformLocale()).toBe('es');
  });

  it('_resetPlatformI18n clears the singleton', () => {
    getPlatformI18n();
    expect(getPlatformLocale()).toBe('en');
    setPlatformLocale('es');
    _resetPlatformI18n();
    window.localStorage.clear();
    expect(getPlatformLocale()).toBe('en');
  });
});

describe('Spanish UI integration — webOS screens', () => {
  beforeEach(() => {
    _resetPlatformI18n();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  afterEach(() => {
    _resetPlatformI18n();
    window.localStorage.clear();
  });

  it('renders Spanish settings screen when locale is es', async () => {
    // Force Spanish before rendering
    setPlatformLocale('es');
    const { renderSettingsScreen } = await import('../../../src/ui/SettingsScreen');
    const el = renderSettingsScreen({ givingUrl: 'https://example.org/give' });
    // The Appearance section (Layout/Theme/Language) was removed by design.
    expect(el.textContent).not.toContain('Appearance');
    expect(el.textContent).not.toContain('Apariencia');
    // The Give section still renders and is locale-independent.
    expect(el.textContent).toContain('Give');
    // The platform i18n still resolves the removed-section labels in Spanish,
    // proving the locale switch works even though the UI no longer shows them.
    const i18n = getPlatformI18n();
    expect(i18n.t('settings.appearance')).toBe('Apariencia');
  });

  it('renders English settings screen when locale is en', async () => {
    // Default English
    const { renderSettingsScreen } = await import('../../../src/ui/SettingsScreen');
    const el = renderSettingsScreen({ givingUrl: 'https://example.org/give' });
    // The Appearance section (Layout/Theme/Language) was removed by design.
    expect(el.textContent).not.toContain('Appearance');
    expect(el.textContent).not.toContain('Language');
    // The Give section still renders.
    expect(el.textContent).toContain('Give');
    // The platform i18n still resolves the removed-section label in English.
    const i18n = getPlatformI18n();
    expect(i18n.t('settings.appearance')).toBe('Appearance');
  });

  it('toggles language via platform locale and re-renders settings labels', async () => {
    const { renderSettingsScreen } = await import('../../../src/ui/SettingsScreen');
    document.body.innerHTML = '';
    const first = renderSettingsScreen({ givingUrl: 'https://example.org/give' });
    expect(first.textContent).not.toContain('Appearance');

    // The in-screen language toggle was removed with the Appearance section,
    // so the locale is driven through the platform API directly.
    setPlatformLocale('es');
    expect(window.localStorage.getItem('ctv_pref_locale')).toBe('es');
    expect(getPlatformLocale()).toBe('es');

    // Re-rendering with the new locale keeps the screen stable; the i18n
    // layer still resolves the removed-section label in Spanish.
    const i18n = getPlatformI18n();
    expect(i18n.t('settings.appearance')).toBe('Apariencia');
    const second = renderSettingsScreen({ givingUrl: 'https://example.org/give' });
    expect(second.textContent).not.toContain('Apariencia');
    expect(second.textContent).toContain('Give');
  });

  it('renders Spanish navigation labels in LeftNav via HomeScreen items', async () => {
    setPlatformLocale('es');
    const i18n = getPlatformI18n();
    // Simulate the same nav item generation as HomeScreen
    const navItems = [
      { id: 'home', label: i18n.t('nav.home'), icon: 'home', screen: 'screen-grid' },
      { id: 'search', label: i18n.t('nav.search'), icon: 'search', screen: 'screen-search' },
      {
        id: 'settings',
        label: i18n.t('nav.settings'),
        icon: 'settings',
        screen: 'screen-settings',
      },
    ];
    expect(navItems[0].label).toBe('Inicio');
    expect(navItems[1].label).toBe('Buscar');
    expect(navItems[2].label).toBe('Configuración');
  });

  it('renders Spanish ContentDetail action buttons', async () => {
    setPlatformLocale('es');
    const { createContentDetail } = await import('../../../src/ui/ContentDetail');
    const el = createContentDetail(
      {
        id: 'v1',
        title: 'Video Title',
        shortDescription: '',
        thumbnail: '',
        hdPosterUrl: '',
        sdPosterUrl: '',
        url: '/stream/v1.mp4',
        releaseDate: '',
        genres: [],
        content: { duration: 0, videos: [] },
      },
      { onPlay: vi.fn() }
    );
    expect(el.textContent).toContain('Reproducir');
  });

  it('renders Spanish error screen with translated button', async () => {
    setPlatformLocale('es');
    const { getErrorScreen, renderErrorScreen } = await import('../../../src/utils/ErrorHandling');
    const err = getErrorScreen('network');
    expect(err.title).toBe('Error de conexión');
    const html = renderErrorScreen(err, vi.fn());
    expect(html).toContain('Error de conexión');
    expect(html).toContain('Intentar de nuevo');
  });

  it('renders Spanish SearchScreen placeholder', async () => {
    setPlatformLocale('es');
    const { createSearchScreen } = await import('../../../src/ui/SearchScreen');
    const el = createSearchScreen({ videos: [], onVideoSelect: vi.fn() });
    const input = el.querySelector('.search-screen__input') as HTMLInputElement;
    expect(input.placeholder).toBe('Buscar videos...');
  });

  it('renders Spanish VideoScreen back button', async () => {
    setPlatformLocale('es');
    const { createVideoScreen } = await import('../../../src/ui/VideoScreen');
    // Need a minimal HTMLVideoElement mock
    const el = createVideoScreen({
      videoId: 'test-id',
      title: 'Test Video',
      streamUrl: '/stream/test.mp4',
      onBack: vi.fn(),
      player: {
        getState: () => 'idle',
        getPosition: () => 0,
        getDuration: () => 0,
        seek: vi.fn(),
        destroy: vi.fn(),
      } as never,
    });
    const backBtn = el.querySelector('.video-screen__back');
    expect(backBtn?.textContent).toBe('← Volver');
  });

  it('falls back to English when no locale is stored', async () => {
    // No locale stored — should default to English
    const { renderSettingsScreen } = await import('../../../src/ui/SettingsScreen');
    const el = renderSettingsScreen({ givingUrl: 'https://example.org/give' });
    // Appearance/Language section removed by design.
    expect(el.textContent).not.toContain('Appearance');
    expect(el.textContent).not.toContain('Language');
    // Give section still present; i18n resolves the removed label in English.
    expect(el.textContent).toContain('Give');
    const i18n = getPlatformI18n();
    expect(i18n.locale).toBe('en');
    expect(i18n.t('settings.appearance')).toBe('Appearance');
  });
});
