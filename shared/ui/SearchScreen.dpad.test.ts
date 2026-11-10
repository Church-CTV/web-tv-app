/**
 * Shared SearchScreen D-pad focus movement.
 *
 * Why this file exists: the D-pad handler used to bind with
 * `container.addEventListener('keydown', ...)` on the screen container
 * (`shared/ui/SearchScreen.ts:51`), and a screen container is a permanent app-shell
 * node (`#screen-search`). Vizio re-mounts the search screen on every open
 * (`platforms/vizio/src/screens/SearchScreen.ts:35`), and replacing a node's
 * *children* does not remove listeners attached to the node itself, so each open
 * stacked another handler on the same element. After two opens one Right arrow
 * moved focus two cards, and Enter fired the selection twice.
 *
 * Contract: opening the search screen any number of times leaves exactly one D-pad
 * handler live, so one key press moves focus exactly one card and one Enter selects
 * exactly once.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSearchScreen, type SearchScreenProps } from './SearchScreen';
import type { VideoItem } from '@ctv/core';

const videos = [
  { id: 'a1', title: 'Alpha', shortDescription: '' },
  { id: 'a2', title: 'Alpha Beta', shortDescription: '' },
  { id: 'a3', title: 'Alpha Gamma', shortDescription: '' },
] as unknown as VideoItem[];

/** Mimic one user open of the search screen on a persistent container. */
function openSearch(container: HTMLElement, onSelect: (id: string) => void): void {
  const props: SearchScreenProps = { videos, onVideoSelect: onSelect };
  initSearchScreen(container as HTMLDivElement, props);
}

function search(container: HTMLElement, term: string): void {
  const input = container.querySelector('#search-input') as HTMLInputElement;
  input.value = term;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  vi.advanceTimersByTime(400);
}

function cards(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('#search-results [data-video-id]'));
}

function press(key: string): void {
  (document.activeElement as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
}

describe('SearchScreen D-pad handler lifetime', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'screen-search';
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders the real result cards for a query', () => {
    openSearch(container, () => {});
    search(container, 'alpha');
    expect(cards(container)).toHaveLength(3);
  });

  it('moves focus exactly one card per Right arrow', () => {
    openSearch(container, () => {});
    search(container, 'alpha');
    const list = cards(container);
    (list[0] as HTMLElement).focus();
    press('ArrowRight');
    const after = cards(container).indexOf(document.activeElement ?? new HTMLElement());
    expect(after).toBe(1);
  });

  it('still moves one card after the screen is opened a second time', () => {
    // Vizio calls its loader on every open; the container element survives, so the
    // second open used to leave two keydown handlers on it.
    openSearch(container, () => {});
    openSearch(container, () => {});
    search(container, 'alpha');
    const list = cards(container);
    (list[0] as HTMLElement).focus();
    press('ArrowRight');
    const after = cards(container).indexOf(document.activeElement ?? new HTMLElement());
    expect(after).toBe(1);
  });

  it('selects exactly once with Enter after the screen is opened a second time', () => {
    const calls: string[] = [];
    openSearch(container, (id) => calls.push(id));
    openSearch(container, (id) => calls.push(id));
    search(container, 'alpha');
    (cards(container)[0] as HTMLElement).focus();
    press('Enter');
    expect(calls).toHaveLength(1);
  });

  it('hands back a cleanup that detaches the handler', () => {
    // A loader that un-mounts the screen must be able to stop the D-pad handler
    // without waiting for the node to be garbage collected.
    const calls: string[] = [];
    const dispose = initSearchScreen(container, { videos, onVideoSelect: (id) => calls.push(id) });
    search(container, 'alpha');
    (cards(container)[0] as HTMLElement).focus();
    press('Enter');
    expect(calls).toHaveLength(1);
    dispose();
    press('Enter');
    expect(calls).toHaveLength(1);
  });
});
