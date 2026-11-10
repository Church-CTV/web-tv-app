import { describe, it, expect } from 'vitest';
import { loadSettingsScreen } from '../../platforms/vizio/src/screens/SettingsScreen';
import { initSearchScreen } from '../../platforms/vizio/src/ui/SearchScreen';

describe('pinned Roku product surfaces', () => {
  it('settings renders a configured Give link without unrelated preference controls', async () => {
    document.body.innerHTML = '<div id="screen-settings"></div>';
    await loadSettingsScreen({
      get: (key: string) => key === 'givingUrl' ? 'https://example.org/give' : null,
      set: () => {},
      remove: () => {},
      getAll: () => ({}),
    });
    expect(document.querySelector('#screen-settings')?.textContent).toContain('Give');
    expect(document.querySelector('#setting-server-url')).toBeNull();
    expect(document.querySelector('.settings-give__link')).toBe(document.activeElement);
  });
  it.each([null, '', 'javascript:alert(1)', 'http://example.org/give', 'https://example.org/\" onclick=\"bad'])('settings fails closed for unconfigured or unsafe giving URL %s', async (givingUrl) => {
    document.body.innerHTML = '<div id="screen-settings"></div>';
    await loadSettingsScreen({ get: () => givingUrl, set: () => {}, remove: () => {}, getAll: () => ({}) });
    expect(document.querySelector('.settings-give__link')).toBeNull();
  });
  it('search supplies an accessible on-screen keyboard and opens on the query', () => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    const dispose = initSearchScreen(root, { videos: [], onVideoSelect: () => {} });
    expect(root.querySelectorAll('.osk-key').length).toBeGreaterThan(26);
    expect(root.querySelector('[role="searchbox"]')).toBe(document.activeElement);
    dispose();
  });
});

it('on-screen keyboard edits the accessible query and teardown cancels pending search', () => {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const dispose = initSearchScreen(root, { videos: [], onVideoSelect: () => {} });
  const input = root.querySelector<HTMLInputElement>('[role="searchbox"]')!;
  root.querySelector<HTMLButtonElement>('[data-key="q"]')!.click();
  root.querySelector<HTMLButtonElement>('[data-key="w"]')!.click();
  expect(input.value).toBe('qw');
  root.querySelector<HTMLButtonElement>('[data-key="back"]')!.click();
  expect(input.value).toBe('q');
  root.querySelector<HTMLButtonElement>('[data-key="clear"]')!.click();
  expect(input.value).toBe('');
  dispose();
});

it('search loader preserves the result poster URL and selection', async () => {
  const { loadSearchScreen } = await import('../../platforms/vizio/src/screens/SearchScreen');
  const { vi } = await import('vitest');
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="screen-search"></div>';
  const selected = vi.fn();
  await loadSearchScreen(
    [
      {
        id: 'one',
        title: 'Sermon',
        shortDescription: '',
        hdPosterUrl: '/poster.png',
        sdPosterUrl: '/poster.png',
      },
    ],
    selected
  );
  const input = document.querySelector<HTMLInputElement>('[role="searchbox"]')!;
  input.value = 'Sermon';
  input.dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(301);
  const card = document.querySelector<HTMLElement>('.content-card')!;
  expect(card.querySelector('img')?.getAttribute('src')).toBe('/poster.png');
  card.focus();
  card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(selected).toHaveBeenCalledWith('one', 'Sermon');
  card.click();
  expect(selected).toHaveBeenCalledWith('one', 'Sermon');
  vi.useRealTimers();
});
