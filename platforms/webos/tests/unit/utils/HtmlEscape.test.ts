/**
 * HtmlEscape — unit tests for HTML escape utilities.
 * Tests escapeHtml and escapeAttr functions used across all UI components.
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr } from '../../../src/utils/HtmlEscape';

describe('HtmlEscape', () => {
  describe('escapeHtml', () => {
    it('returns the input unchanged when no special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('escapes ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('escapes less-than sign', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes greater-than sign', () => {
      expect(escapeHtml('5 > 3')).toBe('5 &gt; 3');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    });

    it('escapes all special characters together', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('handles strings with no special chars', () => {
      expect(escapeHtml('normal text with spaces and numbers 123')).toBe(
        'normal text with spaces and numbers 123'
      );
    });

    it('escapes single quotes but not in escapeHtml', () => {
      // Single quotes are NOT escaped by escapeHtml
      expect(escapeHtml("it's")).toBe("it's");
    });
  });

  describe('escapeAttr', () => {
    it('returns the input unchanged when no special characters', () => {
      expect(escapeAttr('Hello World')).toBe('Hello World');
    });

    it('escapes ampersand and single quotes', () => {
      expect(escapeAttr("Tom & 'Jerry'")).toBe('Tom &amp; &#39;Jerry&#39;');
    });

    it('escapes all HTML entities plus single quotes', () => {
      expect(escapeAttr('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty string', () => {
      expect(escapeAttr('')).toBe('');
    });

    it('combines escapeHtml + single-quote escaping', () => {
      // escapeAttr first calls escapeHtml then adds single-quote escaping
      const input = '<img src="x" onerror=\'alert(1)\'>';
      const result = escapeAttr(input);
      // Must contain HTML-escaped < and >
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      // Must contain escaped single quotes
      expect(result).toContain('&#39;');
    });

    it('is suitable for HTML attribute values', () => {
      // Common attribute value with quotes
      expect(escapeAttr('value with "quotes" and \'apostrophe\'')).toBe(
        'value with &quot;quotes&quot; and &#39;apostrophe&#39;'
      );
    });
  });

  describe('safety invariance', () => {
    it('double-escaping produces nested entities (expected behavior)', () => {
      const input = '<test>';
      const single = escapeHtml(input);
      const double = escapeHtml(escapeHtml(input));
      // Double-escaping should not equal single-escaping
      expect(double).not.toBe(single);
      // But it should be safe (no raw < or >)
      expect(double).not.toContain('<');
      expect(double).not.toContain('>');
    });

    it('escapeAttr double-escaping is safe (no raw characters)', () => {
      const input = '<test>';
      const double = escapeAttr(escapeAttr(input));
      // All characters should be escaped
      expect(double).not.toContain('<');
      expect(double).not.toContain('>');
      expect(double).not.toContain('"');
      expect(double).not.toContain("'");
    });
  });
});
