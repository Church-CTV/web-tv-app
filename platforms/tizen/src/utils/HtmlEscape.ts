/**
 * HTML escape utilities — centralized XSS protection helpers.
 * Used across all UI components to safely render user-provided strings.
 */

/**
 * Escape HTML special characters in a string to prevent XSS.
 * Replaces &, <, >, and " with their HTML entity equivalents.
 *
 * @param str - The string to escape
 * @returns The HTML-escaped string
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape a string for safe use inside HTML attribute values.
 * Combines HTML escaping with single-quote escaping for attribute safety.
 *
 * @param str - The string to escape
 * @returns The attribute-escaped string
 */
export function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
