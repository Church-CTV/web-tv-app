/**
 * FocusManager — D-pad navigation focus management.
 * Provides focusNext/focusPrev on container elements, handles focus traps.
 */

interface FocusableElement extends HTMLElement {
  tabindex?: string | number;
  focus(): void;
  blur(): void;
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'video',
  'contenteditable',
].join(', ');

// Track focus index per container to handle jsdom quirks
const focusIndexMap = new WeakMap<HTMLElement, number>();

/**
 * Create a focus manager for a container element.
 * Handles D-pad navigation within the container.
 */
export function createFocusManager(container: HTMLElement): {
  focusNext(): void;
  focusPrev(): void;
  focusFirst(): void;
  focusLast(): void;
  getCurrentFocus(): FocusableElement | null;
  hasFocus(element: FocusableElement): boolean;
} {
  const getFocusableElements = (): FocusableElement[] => {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)) as FocusableElement[];
  };

  const getFocusIndex = (): number => {
    const elements = getFocusableElements();
    // Use tracked index first, then fall back to DOM
    const tracked = focusIndexMap.get(container);
    if (tracked !== undefined && tracked < elements.length) return tracked;
    // Fallback: check :focus selector or activeElement
    const current = container.querySelector(':focus') as FocusableElement | null;
    if (current) {
      const idx = elements.indexOf(current);
      if (idx >= 0) return idx;
    }
    if (container.contains(document.activeElement)) {
      const idx = elements.indexOf(document.activeElement as FocusableElement);
      if (idx >= 0) return idx;
    }
    return 0;
  };

  const setFocusIndex = (idx: number): void => {
    focusIndexMap.set(container, idx);
  };

  return {
    focusNext(): void {
      const elements = getFocusableElements();
      if (elements.length === 0) return;
      const idx = getFocusIndex();
      const nextIdx = (idx + 1) % elements.length;
      setFocusIndex(nextIdx);
      elements[nextIdx]?.focus();
    },

    focusPrev(): void {
      const elements = getFocusableElements();
      if (elements.length === 0) return;
      const idx = getFocusIndex();
      const prevIdx = idx <= 0 ? elements.length - 1 : idx - 1;
      setFocusIndex(prevIdx);
      elements[prevIdx]?.focus();
    },

    focusFirst(): void {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        setFocusIndex(0);
        elements[0]?.focus();
      }
    },

    focusLast(): void {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        setFocusIndex(elements.length - 1);
        elements[elements.length - 1]?.focus();
      }
    },

    getCurrentFocus(): FocusableElement | null {
      const idx = getFocusIndex();
      const elements = getFocusableElements();
      return elements[idx] ?? null;
    },

    hasFocus(element: FocusableElement): boolean {
      const elements = getFocusableElements();
      const idx = getFocusIndex();
      return elements[idx] === element;
    },
  };
}

/**
 * Apply CSS focus styles programmatically (for JS-driven focus ring).
 */
export function applyFocusStyle(element: FocusableElement, focused: boolean): void {
  if (focused) {
    element.classList.add('focused');
    element.classList.remove('unfocused');
  } else {
    element.classList.remove('focused');
    element.classList.add('unfocused');
  }
}
