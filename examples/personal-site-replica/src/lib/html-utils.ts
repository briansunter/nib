import type { Element, ElementContent, RootContent, Text } from 'hast';

/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parse a JSON value stored in a `data-*` attribute, returning `fallback`
 * when the attribute is missing, empty, not valid JSON, or (when an `isValid`
 * guard is supplied) when the parsed shape fails validation. Centralizes the
 * `JSON.parse(el.dataset[key] ?? '...')`-in-try/catch pattern used by the
 * map/board client modules. The optional guard turns the DOM trust boundary
 * into a checked one instead of an unchecked `as T` cast.
 */
export function parseDatasetJSON<T>(
  el: HTMLElement,
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T,
): T {
  const raw = el.dataset[key];
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Recursively extract text content from a HAST node.
 */
export function extractTextFromHast(
  node: RootContent | ElementContent,
): string {
  if (node.type === 'text') return (node as Text).value;
  if (node.type === 'element') {
    const parts: string[] = [];
    for (const child of (node as Element).children) {
      parts.push(extractTextFromHast(child));
    }
    return parts.join('');
  }
  return '';
}
