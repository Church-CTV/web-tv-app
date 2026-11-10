/**
 * I18n — Internationalization for the CTV multi-platform app.
 *
 * Provides a minimal, dependency-free i18n layer that:
 * - Supports English (en) and Spanish (es)
 * - Uses a key-based lookup with optional params
 * - Stores the selected locale in a configurable store
 * - Exports a `createI18n` factory for platform-level use
 */

export type Locale = 'en' | 'es';

export interface I18nStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export type TranslationKey =
  // Navigation
  | 'nav.home'
  | 'nav.search'
  | 'nav.schedule'
  | 'nav.continue'
  | 'nav.watch_later'
  | 'nav.settings'
  // General
  | 'loading.content'
  | 'video.buffering'
  | 'back'
  | 'back.to_list'
  | 'try_again'
  | 'remove'
  | 'yes'
  | 'no'
  // Error screens
  | 'error.network.title'
  | 'error.network.message'
  | 'error.feed.title'
  | 'error.feed.message'
  | 'error.video.title'
  | 'error.video.message'
  | 'error.auth.title'
  | 'error.auth.message'
  | 'error.generic.title'
  | 'error.generic.message'
  // Video screen errors
  | 'video_error.unexpected'
  | 'video_error.aborted'
  | 'video_error.network'
  | 'video_error.playback'
  | 'video_error.unsupported'
  // Content detail
  | 'action.play'
  | 'action.watch_later'
  // Search
  | 'search.placeholder'
  | 'search.aria_label'
  | 'search.no_results'
  // Video screen
  | 'video.progress_bar'
  // Settings
  | 'settings.appearance'
  | 'settings.layout'
  | 'settings.theme'
  | 'settings.server'
  | 'settings.server_url'
  | 'settings.server_url_placeholder'
  | 'settings.data'
  | 'settings.language'
  | 'settings.language_label'
  | 'settings.clear_cache'
  | 'settings.clear_cache_desc'
  | 'settings.clear_cache_confirm'
  | 'settings.privacy'
  | 'settings.share_usage'
  | 'settings.share_usage_desc'
  | 'settings.privacy_note'
  // Layout values
  | 'layout.leftnav'
  | 'layout.grid'
  // Theme values
  | 'theme.dark'
  | 'theme.light'
  | 'theme.auto'
  // Schedule
  | 'schedule.title'
  | 'schedule.guide'
  | 'schedule.no_programs'
  // Program guide
  | 'guide.no_programs'
  | 'guide.rec'
  // Live stream
  | 'live.badge'
  | 'live.watch'
  | 'live.rec'
  // Continue watching
  | 'continue.empty'
  // Home empty state
  | 'home.empty'
  | 'home.empty_hint'
  // Watch later
  | 'watch_later.empty'
  // App title
  | 'app.title';

type LocaleDict = Record<TranslationKey, string>;

/**
 * English translations.
 */
export const EN: LocaleDict = {
  // Navigation
  'nav.home': 'Home',
  'nav.search': 'Search',
  'nav.schedule': 'Schedule',
  'nav.continue': 'Continue',
  'nav.watch_later': 'Watch Later',
  'nav.settings': 'Settings',
  // General
  'loading.content': 'Loading content...',
  back: '← Back',
  'back.to_list': '← Back to List',
  try_again: 'Try Again',
  remove: 'Remove',
  yes: 'Yes',
  no: 'No',
  // Error screens
  'error.network.title': 'Connection Error',
  'error.network.message':
    'Unable to connect to the server. Please check your internet connection.',
  'error.feed.title': 'Content Error',
  'error.feed.message': 'Failed to load content. Please try again later.',
  'error.video.title': 'Playback Error',
  'error.video.message': 'Unable to play this content.',
  'error.auth.title': 'Authentication Error',
  'error.auth.message': 'Please sign in to continue.',
  'error.generic.title': 'Error',
  'error.generic.message': 'Something went wrong. Please try again.',
  // Video screen errors
  'video.buffering': 'Buffering…',
  'video_error.unexpected':
    'Something went wrong. Try again, or restart the app if it keeps happening.',
  'video_error.aborted': 'Video playback was aborted.',
  'video_error.network':
    'Network error while loading video. Please check your connection and try again.',
  'video_error.playback': 'Video format is not supported or corrupted.',
  'video_error.unsupported': 'Video source is not supported.',
  // Content detail
  'action.play': '▶ Play',
  'action.watch_later': '⏰ Watch Later',
  // Search
  'search.placeholder': 'Search videos...',
  'search.aria_label': 'Search videos',
  'search.no_results': 'No results found',
  // Video screen
  'video.progress_bar': 'Video progress',
  // Settings
  'settings.appearance': 'Appearance',
  'settings.layout': 'Layout',
  'settings.theme': 'Theme',
  'settings.server': 'Server',
  'settings.server_url': 'Server URL',
  'settings.server_url_placeholder': 'Enter server URL',
  'settings.data': 'Data',
  'settings.language': 'Language',
  'settings.language_label': 'Language',
  'settings.clear_cache': 'Clear Cache',
  'settings.clear_cache_desc': 'Clear all cached data',
  'settings.clear_cache_confirm':
    'Clear all cached data? This will reset preferences, watch later, and continue watching.',
  'settings.privacy': 'Privacy',
  'settings.share_usage': 'Share Usage Data',
  'settings.share_usage_desc': 'Help improve the app by sharing anonymous usage and error reports.',
  'settings.privacy_note': 'No personal data is collected. You can change this at any time.',
  // Layout values
  'layout.leftnav': 'Left Nav',
  'layout.grid': 'Grid',
  // Theme values
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'theme.auto': 'Auto',
  // Schedule
  'schedule.title': 'Schedule',
  'schedule.guide': 'TV Guide',
  'schedule.no_programs': 'No upcoming programs scheduled.',
  // Program guide
  'guide.no_programs': 'No programs scheduled.',
  'guide.rec': '● REC',
  // Live stream
  'live.badge': 'LIVE',
  'live.watch': 'Watch Live',
  'live.rec': '● REC',
  // Continue watching
  'continue.empty': 'No recently watched content.',
  // Home empty state
  'home.empty': 'No content available',
  'home.empty_hint': 'Content from your channel will appear here.',
  // Watch later
  'watch_later.empty': 'No items in Watch Later',
  // App title
  'app.title': 'Ultimate CTV',
};

/**
 * Spanish translations.
 */
export const ES: LocaleDict = {
  // Navigation
  'nav.home': 'Inicio',
  'nav.search': 'Buscar',
  'nav.schedule': 'Programación',
  'nav.continue': 'Continuar',
  'nav.watch_later': 'Ver más tarde',
  'nav.settings': 'Configuración',
  // General
  'loading.content': 'Cargando contenido...',
  back: '← Volver',
  'back.to_list': '← Volver a la lista',
  try_again: 'Intentar de nuevo',
  remove: 'Eliminar',
  yes: 'Sí',
  no: 'No',
  // Error screens
  'error.network.title': 'Error de conexión',
  'error.network.message': 'No se puede conectar al servidor. Comprueba tu conexión a internet.',
  'error.feed.title': 'Error de contenido',
  'error.feed.message': 'No se pudo cargar el contenido. Inténtalo de nuevo más tarde.',
  'error.video.title': 'Error de reproducción',
  'error.video.message': 'No se puede reproducir este contenido.',
  'error.auth.title': 'Error de autenticación',
  'error.auth.message': 'Inicia sesión para continuar.',
  'error.generic.title': 'Error',
  'error.generic.message': 'Algo salió mal. Inténtalo de nuevo.',
  // Video screen errors
  'video.buffering': 'Cargando…',
  'video_error.unexpected':
    'Algo salió mal. Inténtalo de nuevo; si el problema continúa, reinicia la aplicación.',
  'video_error.aborted': 'La reproducción del video se abortó.',
  'video_error.network':
    'Error de red al cargar el video. Comprueba tu conexión e inténtalo de nuevo.',
  'video_error.playback': 'El formato del video no está soportado o está dañado.',
  'video_error.unsupported': 'La fuente del video no está soportada.',
  // Content detail
  'action.play': '▶ Reproducir',
  'action.watch_later': '⏰ Ver más tarde',
  // Search
  'search.placeholder': 'Buscar videos...',
  'search.aria_label': 'Buscar videos',
  'search.no_results': 'No se encontraron resultados',
  // Video screen
  'video.progress_bar': 'Progreso del video',
  // Settings
  'settings.appearance': 'Apariencia',
  'settings.layout': 'Diseño',
  'settings.theme': 'Tema',
  'settings.server': 'Servidor',
  'settings.server_url': 'URL del servidor',
  'settings.server_url_placeholder': 'Introduce la URL del servidor',
  'settings.data': 'Datos',
  'settings.language': 'Idioma',
  'settings.language_label': 'Idioma',
  'settings.clear_cache': 'Borrar caché',
  'settings.clear_cache_desc': 'Borrar todos los datos en caché',
  'settings.clear_cache_confirm':
    '¿Borrar todos los datos en caché? Esto restablecerá las preferencias, ver más tarde y continuar viendo.',
  'settings.privacy': 'Privacidad',
  'settings.share_usage': 'Compartir datos de uso',
  'settings.share_usage_desc':
    'Ayuda a mejorar la aplicación compartiendo informes anónimos de uso y errores.',
  'settings.privacy_note':
    'No se recopilan datos personales. Puedes cambiar esto en cualquier momento.',
  // Layout values
  'layout.leftnav': 'Barra lateral',
  'layout.grid': 'Cuadrícula',
  // Theme values
  'theme.dark': 'Oscuro',
  'theme.light': 'Claro',
  'theme.auto': 'Automático',
  // Schedule
  'schedule.title': 'Programación',
  'schedule.guide': 'Guía de programación',
  'schedule.no_programs': 'No hay programas próximos programados.',
  // Program guide
  'guide.no_programs': 'No hay programas programados.',
  'guide.rec': '● REC',
  // Live stream
  'live.badge': 'EN VIVO',
  'live.watch': 'Ver en vivo',
  'live.rec': '● REC',
  // Continue watching
  'continue.empty': 'No hay contenido recientemente visto.',
  // Home empty state
  'home.empty': 'No hay contenido disponible',
  'home.empty_hint': 'El contenido de tu canal aparecerá aquí.',
  // Watch later
  'watch_later.empty': 'No hay elementos en Ver más tarde',
  // App title
  'app.title': 'Ultimate CTV',
};

export interface I18nInstance {
  /** Translate a key, substituting named params like {name} in the template. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Current active locale. */
  readonly locale: Locale;
  /** Change the active locale and persist to store. */
  setLocale: (locale: Locale) => void;
  /** Get the currently stored locale. */
  getLocale: () => Locale;
}

const LOCALE_KEY = 'ctv_pref_locale';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es'] as const;

const LOKALE_DICTS: Record<Locale, LocaleDict> = { en: EN, es: ES };

/**
 * Substitute named params like {name} in a template, treating param values
 * as literal strings. Uses a replacer callback so that special replacement
 * sequences in the value ($&, $1, $$, $', $`) are not interpreted by
 * String.prototype.replace.
 */
export function substituteSafe(template: string, params: Record<string, string | number>): string {
  let str = template;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), () => String(v));
  }
  return str;
}

/**
 * Pseudo-localization factor. Each translated string is expanded by this
 * multiplier to detect layout overflow and text clipping in CI/E2E runs.
 */
export const PSEUDO_LOCALE_FACTOR = 1.5;

/**
 * Padding characters used to inflate a string. They are visually distinctive
 * (square brackets + middle dot) so that clipped text is obvious to a human
 * reviewing a screenshot or running the app manually.
 */
const PSEUDO_PADDING = '[·]';

/**
 * Compute the length of a code point sequence (not bytes or UTF-16 units).
 * Uses Array.from which iterates by code point.
 */
function codePointLength(str: string): number {
  return Array.from(str).length;
}

/**
 * Pseudo-localize a translated string.
 *
 * Takes the original string and returns an expanded version where each
 * "word" (space-separated token) is followed by N padding repetitions.
 * The total output length is approximately `factor` times the input length.
 *
 * Emoji and unicode symbols are preserved as-is (padding is appended after
 * the full code point, never breaking a surrogate pair).
 *
 * @param str - The original translated string
 * @param factor - Expansion factor (default: PSEUDO_LOCALE_FACTOR = 1.5)
 * @returns A pseudo-localized string approximately `factor` times longer
 */
export function pseudoLocalize(str: string, factor: number = PSEUDO_LOCALE_FACTOR): string {
  if (str.length === 0) return '';
  if (factor <= 1) return str;

  const tokens = str.split(/\s+/).filter((t) => t.length > 0);
  const spaceRuns = str.match(/\s+/g) ?? [];
  const tokenCount = tokens.length;
  const spaceCount = spaceRuns.length;
  if (tokenCount === 0) return str;

  const origLen = codePointLength(str);
  const targetLen = Math.floor(origLen * factor);
  const paddingCharsNeeded = Math.max(0, targetLen - origLen);
  const totalSlots = tokenCount + spaceCount;
  const paddingPerSlot = Math.floor(paddingCharsNeeded / totalSlots);
  const extraCharsNeeded = paddingCharsNeeded - paddingPerSlot * totalSlots;

  const parts: string[] = [];
  let padIdx = 0;

  const appendPads = (): void => {
    const pads = paddingPerSlot + (extraCharsNeeded > padIdx ? 1 : 0);
    if (pads > 0) {
      parts.push(PSEUDO_PADDING.repeat(pads));
    }
    padIdx++;
  };

  let tIdx = 0;
  let sIdx = 0;
  while (tIdx < tokenCount || sIdx < spaceCount) {
    if (tIdx < tokenCount) {
      parts.push(tokens[tIdx]);
      appendPads();
      tIdx++;
    }
    if (sIdx < spaceCount) {
      parts.push(' ');
      appendPads();
      sIdx++;
    }
  }

  return parts.join('');
}

/**
 * Build an i18n instance that returns pseudo-localized strings.
 *
 * Intended for CI/E2E tests and manual overflow checks. The returned instance
 * is a regular I18nInstance whose t() wraps the underlying English
 * translations with pseudoLocalize(). Useful for detecting UI text clipping
 * before store submission.
 *
 * @param factor - Optional expansion factor (default: PSEUDO_LOCALE_FACTOR)
 * @returns An I18nInstance that returns pseudo-localized English strings
 */
export function buildPseudoLocaleInstance(factor: number = PSEUDO_LOCALE_FACTOR): I18nInstance {
  const en = createI18n(undefined, 'en');

  const pseudoT: I18nInstance['t'] = (key, params) => {
    const original = en.t(key, params);
    return pseudoLocalize(original, factor);
  };

  return {
    t: pseudoT,
    get locale(): Locale {
      return 'en';
    },
    setLocale: (): void => {
      // no-op — pseudo-locale is fixed to English
    },
    getLocale: (): Locale => 'en',
  };
}

/**
 * Create an i18n instance.
 *
 * @param store - Persistence store (e.g. localStorage-backed). Pass undefined for a non-persistent instance.
 * @param initialLocale - Override the initial locale (takes precedence over stored value).
 * @returns An I18nInstance with t(), setLocale(), getLocale(), and locale.
 */
export function createI18n(store?: I18nStore, initialLocale?: Locale): I18nInstance {
  let currentLocale: Locale = initialLocale ?? (store?.get(LOCALE_KEY) as Locale | null) ?? 'en';

  // Validate locale
  if (!SUPPORTED_LOCALES.includes(currentLocale)) {
    currentLocale = 'en';
  }

  const t: I18nInstance['t'] = (key, params) => {
    const dict = LOKALE_DICTS[currentLocale] ?? LOKALE_DICTS.en;
    const str = dict[key] ?? EN[key] ?? key; // fall back to EN, then to key itself

    if (params) {
      return substituteSafe(str, params);
    }

    return str;
  };

  const setLocale: I18nInstance['setLocale'] = (locale) => {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    currentLocale = locale;
    if (store) {
      store.set(LOCALE_KEY, locale);
    }
  };

  const getLocale: I18nInstance['getLocale'] = () => currentLocale;

  return {
    t,
    get locale() {
      return currentLocale;
    },
    setLocale,
    getLocale,
  };
}
