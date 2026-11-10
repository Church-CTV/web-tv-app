import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoItem } from '@ctv/core';
import { createContentCard, setFocusState, updateContentCard } from '../../src/ui/ContentCard';
import { initSearchScreen, updateSearchScreen } from '../../src/ui/SearchScreen';
import { loadSearchScreen } from '../../src/screens/SearchScreen';
import { formatOverhangClock } from '../../src/ui/Overhang';

const videos: VideoItem[] = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((title, index) => ({
  id: `video-${index}`,
  title: `${title} Sermon`,
  thumbnail: `/${title}.png`,
  hdPosterUrl: `/${title}.png`,
  sdPosterUrl: '/sd.png',
  shortDescription: '',
  url: '/stream',
  releaseDate: '',
  genres: [],
  content: { duration: 60, videos: [] },
}));

function press(element: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe('Vizio mounted UI interactions', () => {
  let root: HTMLDivElement;
  let dispose: (() => void) | undefined;
  const selected = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  function mount(): HTMLInputElement {
    dispose = initSearchScreen(root, { videos, onVideoSelect: selected });
    return root.querySelector('input')!;
  }

  function query(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('starts with an empty focused query and edits through visible keyboard keys', () => {
    const input = mount();
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('');
    expect(root.querySelectorAll('.content-card')).toHaveLength(0);
    const key = (name: string) => root.querySelector<HTMLButtonElement>(`[data-key="${name}"]`)!;
    key('q').click();
    press(key('w'), 'Enter');
    press(key('space'), ' ');
    expect(input.value).toBe('qw ');
    key('back').click();
    expect(input.value).toBe('qw');
    key('clear').click();
    key('back').click();
    expect(input.value).toBe('');
    key('a').click();
    press(input, 'Escape');
    expect(input.value).toBe('');
    vi.advanceTimersByTime(300);
    expect(root.querySelector('.search-prompt')?.textContent).toContain('Find a message');
    expect(selected).not.toHaveBeenCalled();
  });

  it('debounces the latest query, clears results, and cancels pending work on teardown', () => {
    const input = mount();
    query(input, 'Alpha');
    vi.advanceTimersByTime(200);
    query(input, 'Beta');
    vi.advanceTimersByTime(299);
    expect(root.querySelectorAll('.content-card')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(root.querySelector('.content-card')?.textContent).toBe('Beta Sermon');
    query(input, '');
    vi.advanceTimersByTime(300);
    expect(root.querySelectorAll('.content-card')).toHaveLength(0);
    query(input, 'Alpha');
    dispose!();
    vi.advanceTimersByTime(300);
    expect(root.querySelectorAll('.content-card')).toHaveLength(0);
    query(input, 'Gamma');
    vi.advanceTimersByTime(300);
    expect(root.querySelectorAll('.content-card')).toHaveLength(0);
  });

  it('routes all four arrows through a two-column result grid and activates Enter once', () => {
    const input = mount();
    query(input, 'Sermon');
    vi.advanceTimersByTime(300);
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.content-card'));
    expect(cards).toHaveLength(4);
    cards[0].focus();
    for (const [key, target] of [
      ['ArrowRight', cards[1]],
      ['ArrowDown', cards[3]],
      ['ArrowLeft', cards[2]],
      ['ArrowUp', cards[0]],
    ] as const) {
      expect(press(document.activeElement!, key).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(target);
    }
    press(cards[0], 'ArrowLeft');
    expect(document.activeElement).toBe(input);
    press(cards[0], 'ArrowUp');
    expect(document.activeElement).toBe(input);
    cards[3].focus();
    press(cards[3], 'ArrowDown');
    expect(document.activeElement).toBe(cards[3]);
    press(cards[3], 'ArrowRight');
    expect(document.activeElement).toBe(cards[3]);
    press(cards[3], 'Enter');
    expect(selected).toHaveBeenCalledExactlyOnceWith('video-3');
    press(cards[3], 'a');
    expect(selected).toHaveBeenCalledTimes(1);
    dispose!();
    press(cards[3], 'Enter');
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it('refreshes results with current data and the replacement selection callback', () => {
    const input = mount();
    query(input, 'Alpha');
    vi.advanceTimersByTime(300);
    const replacement = vi.fn();
    updateSearchScreen(
      root.firstElementChild as HTMLDivElement,
      [{ ...videos[0], id: 'new' }],
      replacement
    );
    root.querySelector<HTMLElement>('.content-card')!.click();
    expect(replacement).toHaveBeenCalledExactlyOnceWith('new');
    expect(selected).not.toHaveBeenCalled();
  });

  it('reopens loader search without stale queries or duplicate selection and preserves SD posters', async () => {
    root.id = 'screen-search';
    await loadSearchScreen(videos, selected);
    const oldInput = root.querySelector('input')!;
    query(oldInput, 'Alpha');
    const replacement = vi.fn();
    await loadSearchScreen([{ ...videos[1], hdPosterUrl: '' }], replacement);
    const input = root.querySelector('input')!;
    expect(input).not.toBe(oldInput);
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    vi.advanceTimersByTime(300);
    expect(root.querySelectorAll('.content-card')).toHaveLength(0);
    query(input, 'Beta');
    vi.advanceTimersByTime(300);
    const card = root.querySelector<HTMLElement>('.content-card')!;
    expect(card.querySelector('img')?.getAttribute('src')).toBe('/sd.png');
    press(card, 'Enter');
    expect(replacement).toHaveBeenCalledExactlyOnceWith('video-1', 'Beta Sermon');
    expect(selected).not.toHaveBeenCalled();
    card.click();
    expect(replacement).toHaveBeenCalledTimes(2);
    await loadSearchScreen([], replacement);
  });
});

describe('Vizio live content cards', () => {
  const initial = { videoId: 'one', title: 'First', thumbnail: '/broken.png' };

  it('recovers a failed poster when a replacement video is displayed', () => {
    const card = createContentCard(initial);
    const image = card.querySelector('img')!;
    image.dispatchEvent(new Event('error'));
    expect(image.style.display).toBe('none');
    expect(card.querySelector('.content-card__poster--error')).not.toBeNull();
    updateContentCard(card, { videoId: 'two', title: 'Second', thumbnail: '/good.png' });
    expect(image.style.display).toBe('');
    expect(card.querySelector('.content-card__poster--error')).toBeNull();
    expect(image.getAttribute('src')).toBe('/good.png');
    expect(image.alt).toBe('Second');
    image.dispatchEvent(new Event('error'));
    expect(image.style.display).toBe('none');
  });

  it('updates the accessible title, progress and active state when reusing a card', () => {
    const card = createContentCard({ ...initial, progress: 25, isActive: true });
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('role')).toBe('button');
    expect(card.classList.contains('content-card--active')).toBe(true);
    expect(card.querySelector<HTMLElement>('.content-card__progress')?.style.width).toBe('25%');
    updateContentCard(card, { ...initial, title: 'Second', progress: 60, isActive: false });
    expect(card.getAttribute('aria-label')).toBe('Play Second');
    expect(card.textContent).toBe('Second');
    expect(card.classList.contains('content-card--active')).toBe(false);
    expect(card.querySelector<HTMLElement>('.content-card__progress')?.style.width).toBe('60%');
    updateContentCard(card, { ...initial, progress: 0 });
    expect(card.querySelector('.content-card__progress')).toBeNull();
    updateContentCard(card, { ...initial, progress: 80 });
    expect(card.querySelector<HTMLElement>('.content-card__progress')?.style.width).toBe('80%');
    updateContentCard(card, initial);
    expect(card.querySelector('.content-card__progress')).toBeNull();
    setFocusState(card, true);
    expect(card.classList.contains('content-card--active')).toBe(true);
    setFocusState(card, false);
    expect(card.classList.contains('content-card--active')).toBe(false);
  });
});

describe('Vizio on-screen clock', () => {
  it.each([
    [0, 5, '12:05 AM'],
    [11, 59, '11:59 AM'],
    [12, 0, '12:00 PM'],
    [23, 9, '11:09 PM'],
  ] as const)('formats local %i:%i as %s', (hours, minutes, expected) => {
    expect(formatOverhangClock(new Date(2026, 10, 5, hours, minutes))).toBe(expected);
  });
});
