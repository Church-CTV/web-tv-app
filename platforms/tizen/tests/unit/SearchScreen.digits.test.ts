import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadSearchScreen } from '../../src/screens/SearchScreen';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="screen-search" class="screen-active"></div>';
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

it('navigates the accessible digits row and searches a year using only D-pad and Enter', async () => {
  const selected = vi.fn();
  await loadSearchScreen(
    [
      {
        id: 'year',
        title: '2024',
        shortDescription: '',
        hdPosterUrl: 'poster',
        sdPosterUrl: 'poster',
      },
    ],
    selected
  );
  const key = (value: string) =>
    document.querySelector<HTMLButtonElement>(`.osk-key[data-key="${value}"]`)!;
  const press = (value: string) =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })
    );
  const digits = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.osk-row:first-child button')
  );
  expect(digits.map((button) => button.textContent)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '0',
  ]);
  expect(digits.every((button) => button.type === 'button' && button.tabIndex === 0)).toBe(true);
  key('q').focus();
  const consumed = new KeyboardEvent('keydown', {
    key: 'ArrowUp',
    bubbles: true,
    cancelable: true,
  });
  consumed.preventDefault();
  key('q').dispatchEvent(consumed);
  expect(document.activeElement).toBe(key('q'));
  press('ArrowUp');
  expect(document.activeElement).toBe(key('1'));
  press('ArrowRight');
  press('Enter');
  for (let n = 0; n < 8; n++) press('ArrowRight');
  expect(document.activeElement).toBe(key('0'));
  press('Enter');
  for (let n = 0; n < 8; n++) press('ArrowLeft');
  press('Enter');
  press('ArrowRight');
  press('ArrowRight');
  press('Enter');
  const query = document.querySelector<HTMLInputElement>('.search-screen__input');
  expect(query ? query.value : document.querySelector('.search-query')?.textContent).toBe('2024');
  vi.advanceTimersByTime(350);
  expect(document.querySelector('[data-video-id="year"]')).toBeTruthy();
  key('back').focus();
  press('Enter');
  expect(query ? query.value : document.querySelector('.search-query')?.textContent).toBe('202');
  key('clear').focus();
  press('Enter');
  expect(query ? query.value : document.querySelector('.search-query')?.textContent).toBe('');
  const back = vi.fn();
  document.getElementById('screen-search')!.addEventListener('keydown', back);
  press('Escape');
  expect(back).toHaveBeenCalledTimes(1);
});

it('positions the shipped visible query at the common canvas anchor', async () => {
  await loadSearchScreen([], vi.fn());
  const visibleQuery = document.querySelector('.search-query');
  expect(visibleQuery?.hasAttribute('hidden')).toBe(false);
  expect(document.querySelector('.search-input')?.hasAttribute('hidden')).toBe(true);
  const css = readFileSync(
    resolve(__dirname, '../../../../shared/styles/search-premium.css'),
    'utf8'
  );
  const rules = Array.from(css.matchAll(/#screen-search \.search-query,[\s\S]*?\{([^}]+)\}/g));
  expect(rules.length).toBeGreaterThan(0);
  expect(rules.at(-1)![1]).toMatch(/left:\s*130px/);
  expect(rules.at(-1)![1]).toMatch(/top:\s*220px/);
  expect(rules.at(-1)![1]).toMatch(/position:\s*absolute/);
});

it('does not activate a key when Enter was already consumed', async () => {
  await loadSearchScreen([], vi.fn());
  const key = document.querySelector<HTMLButtonElement>('.osk-key[data-key="q"]')!;
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  event.preventDefault();
  key.dispatchEvent(event);
  const input = document.querySelector<HTMLInputElement>('.search-screen__input');
  expect(input ? input.value : document.querySelector('.search-query')?.textContent).toBe('');
});
