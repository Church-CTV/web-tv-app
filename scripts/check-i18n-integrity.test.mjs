import { describe, it, expect } from 'vitest';
import {
  extractTranslationKeys,
  extractDictKeys,
  checkI18nIntegrity,
} from './check-i18n-integrity.mjs';

/**
 * Helper: build a fake I18n.ts source from parts for unit tests.
 * @param {string} unionKeys - comma-separated keys for the TranslationKey union
 * @param {Record<string, string>} enDict - English dict entries
 * @param {Record<string, string>} esDict - Spanish dict entries
 */
function buildSource(unionKeys, enDict, esDict) {
  const unionLines = unionKeys.map((k) => `  | '${k}'`).join('\n');
  const enEntries = Object.entries(enDict)
    .map(([k, v]) => `  '${k}': '${v}',`)
    .join('\n');
  const esEntries = Object.entries(esDict)
    .map(([k, v]) => `  '${k}': '${v}',`)
    .join('\n');

  return `/**
 * I18n
 */

export type TranslationKey =
${unionLines}
;

type LocaleDict = Record<TranslationKey, string>;

export const EN: LocaleDict = {
${enEntries}
};

export const ES: LocaleDict = {
${esEntries}
};
`;
}

describe('check-i18n-integrity', () => {
  describe('extractTranslationKeys()', () => {
    it('extracts keys from a TranslationKey union block', () => {
      const src = buildSource(
        ['nav.home', 'nav.search', 'back'],
        { 'nav.home': 'Home', 'nav.search': 'Search', back: 'Back' },
        { 'nav.home': 'Inicio', 'nav.search': 'Buscar', back: 'Volver' }
      );
      const keys = extractTranslationKeys(src);
      expect(keys).toContain('nav.home');
      expect(keys).toContain('nav.search');
      expect(keys).toContain('back');
      expect(keys).toHaveLength(3);
    });

    it('returns empty array when no union block found', () => {
      const keys = extractTranslationKeys('no union here');
      expect(keys).toEqual([]);
    });

    it('handles keys with underscores in both segments', () => {
      const src = `export type TranslationKey =
  | 'video_error.unexpected'
  | 'watch_later.empty'
  | 'nav.home'
;`;
      const keys = extractTranslationKeys(src);
      expect(keys).toEqual(['video_error.unexpected', 'watch_later.empty', 'nav.home']);
    });
  });

  describe('extractDictKeys()', () => {
    it('extracts keys from a const EN dict', () => {
      const src = buildSource(['a.b'], { 'a.b': 'x' }, { 'a.b': 'y' });
      const keys = extractDictKeys(src, 'EN');
      expect(keys).toEqual(['a.b']);
    });

    it('extracts keys from a const ES dict', () => {
      const src = buildSource(
        ['a.b', 'c.d'],
        { 'a.b': 'x', 'c.d': 'y' },
        { 'a.b': 'x', 'c.d': 'y' }
      );
      const keys = extractDictKeys(src, 'ES');
      expect(keys).toContain('a.b');
      expect(keys).toContain('c.d');
    });

    it('returns empty array when dict not found', () => {
      const keys = extractDictKeys('no dict here', 'EN');
      expect(keys).toEqual([]);
    });
  });

  describe('checkI18nIntegrity()', () => {
    it('passes when all three sources are in sync', () => {
      const src = buildSource(
        ['nav.home', 'back'],
        { 'nav.home': 'Home', back: 'Back' },
        { 'nav.home': 'Inicio', back: 'Volver' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('fails when union has a key missing from EN dict', () => {
      const src = buildSource(
        ['nav.home', 'nav.search', 'missing.key'],
        { 'nav.home': 'Home', 'nav.search': 'Search' },
        { 'nav.home': 'Inicio', 'nav.search': 'Buscar' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.some((e) => e.includes('missing.key'))).toBe(true);
    });

    it('fails when union has a key missing from ES dict', () => {
      const src = buildSource(
        ['nav.home', 'missing.key'],
        { 'nav.home': 'Home', 'missing.key': 'Missing' },
        { 'nav.home': 'Inicio' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.some((e) => e.includes('missing.key'))).toBe(true);
    });

    it('fails when EN dict has an extra key not in union', () => {
      const src = buildSource(
        ['nav.home'],
        { 'nav.home': 'Home', 'extra.key': 'Extra' },
        { 'nav.home': 'Inicio' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.some((e) => e.includes('extra.key'))).toBe(true);
    });

    it('fails when ES dict has an extra key not in union', () => {
      const src = buildSource(
        ['nav.home'],
        { 'nav.home': 'Home' },
        { 'nav.home': 'Inicio', 'extra.key': 'Extra' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.some((e) => e.includes('extra.key'))).toBe(true);
    });

    it('fails when EN and ES have different key sets (EN has key ES lacks)', () => {
      const src = buildSource(
        ['nav.home', 'only.en'],
        { 'nav.home': 'Home', 'only.en': 'EN only' },
        { 'nav.home': 'Inicio' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.some((e) => e.includes('only.en'))).toBe(true);
    });

    it('fails when ES has a key EN lacks', () => {
      const src = buildSource(
        ['nav.home', 'only.es'],
        { 'nav.home': 'Home' },
        { 'nav.home': 'Inicio', 'only.es': 'ES only' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.some((e) => e.includes('only.es'))).toBe(true);
    });

    it('fails on duplicate keys in EN dict', () => {
      const src = `export type TranslationKey =
  | 'a.b'
  | 'c.d'
;
export const EN: LocaleDict = {
  'a.b': 'Home',
  'a.b': 'Duplicate',
  'c.d': 'Other',
};`;
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(
        result.errors.some((e) => e.includes('a.b') && e.toLowerCase().includes('duplicate'))
      ).toBe(true);
    });

    it('reports all errors, not just the first', () => {
      const src = buildSource(
        ['nav.home', 'missing1', 'missing2'],
        { 'nav.home': 'Home', extra1: 'X' },
        { 'nav.home': 'Inicio', extra2: 'Y' }
      );
      const result = checkI18nIntegrity(src);
      expect(result.pass).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
