import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe.each(['webos', 'tizen', 'vizio'])('%s loaded channel integration', (platform) => {
  it('uses loaded metadata in the header and focuses the first content card', async () => {
    document.body.innerHTML = `<header id="overhang"><h1 class="overhang__title">Chroma Channel</h1></header>
      <nav id="left-nav"></nav><div id="screen-grid" class="screen"><div id="content-grid"></div></div>`;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const values = new Map<string, string>();
    const storage = {
      get: (key: string) => values.get(key) ?? null,
      set: (key: string, value: string) => {
        values.set(key, value);
      },
      remove: (key: string) => {
        values.delete(key);
      },
      getAll: () => Object.fromEntries(values),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          providerName: '  Loaded <Church>  ',
          'January 2026': [
            {
              id: 'first',
              url: 'https://media.example/first.mp4',
              title: 'First sermon',
              thumbnail: '/poster.png',
            },
          ],
        }),
      })
    );
    const { loadMainView } = await import(`../../platforms/${platform}/src/screens/HomeScreen.ts`);
    await loadMainView(storage, null, {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
      onSchedule: vi.fn(),
      onContinueWatching: vi.fn(),
      onWatchLater: vi.fn(),
    });
    expect(document.querySelector('.overhang__title')?.textContent).toBe('Loaded <Church>');
    expect(storage.get('ctv_channel_name')).toBe('Loaded <Church>');
    expect(document.activeElement?.getAttribute('data-video-id')).toBe('first');
  });
});

describe.each(['webos', 'tizen', 'vizio'])('%s pinned clock', (platform) => {
  it.each([
    [0, 5, '12:05 AM'],
    [12, 0, '12:00 PM'],
    [23, 9, '11:09 PM'],
  ])('formats %s:%s from runtime BRS', async (hours, minutes, expected) => {
    const { formatOverhangClock } = await import(`../../platforms/${platform}/src/ui/Overhang.ts`);
    expect(formatOverhangClock(new Date(2026, 0, 1, Number(hours), Number(minutes)))).toBe(
      expected
    );
  });
});

describe.each(['tizen', 'vizio'])('%s focused Home metadata and reload', (platform) => {
  it('updates the focused title/description and activates once after feed reload', async () => {
    document.body.innerHTML =
      '<nav id="left-nav"></nav><div id="screen-grid" class="screen"><div id="content-grid"></div></div>';
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const storage = { get: () => null, set: vi.fn(), remove: vi.fn(), getAll: () => ({}) };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          providerName: 'Church',
          'January 2026': [
            {
              id: 'one',
              title: 'First message',
              shortDescription: 'First description',
              url: 'https://media.example/one.mp4',
            },
            {
              id: 'two',
              title: 'Second message',
              shortDescription: 'Second description',
              url: 'https://media.example/two.mp4',
            },
          ],
        }),
      })
    );
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
    };
    const { loadMainView } = await import(`../../platforms/${platform}/src/screens/HomeScreen.ts`);
    await loadMainView(storage, null, actions);
    await loadMainView(storage, null, actions);
    const cards = document.querySelectorAll<HTMLElement>('#content-grid .content-card');
    cards[1].focus();
    expect(document.querySelector('.focus-meta__title')?.textContent).toBe('Second message');
    expect(document.querySelector('.focus-meta__desc')?.textContent).toBe('Second description');
    cards[1].click();
    expect(actions.onVideoSelect).toHaveBeenCalledTimes(1);
  });
});

describe.each(['webos', 'tizen', 'vizio'])('%s legacy feed titles', (platform) => {
  it('normalizes focused metadata, card names, selection and Search catalog titles', async () => {
    document.body.innerHTML = `<nav id="left-nav"></nav><div id="screen-grid" class="screen">
      <div class="grid-header"><h2 id="grid-header-title" class="grid-header__title"></h2>
      <p id="grid-header-desc"></p></div><div id="content-grid"></div></div>`;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const rawTitle = String.raw`By Faith: Follow \\ Pastor Ken Bushey \\ September 27, 2026`;
    const title = 'By Faith: Follow · Pastor Ken Bushey · September 27, 2026';
    const feed = {
      providerName: 'Church',
      'September 2026': [
        {
          id: 'one',
          title: rawTitle,
          shortDescription: 'Description',
          url: 'https://media.example/one.mp4',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => feed }));
    const actions = {
      onVideoSelect: vi.fn(),
      onSearch: vi.fn(),
      onSettings: vi.fn(),
      onRetry: vi.fn(),
      onFeedLoaded: vi.fn(),
    };
    const { loadMainView } = await import(`../../platforms/${platform}/src/screens/HomeScreen.ts`);
    await loadMainView(
      { get: () => null, set: vi.fn(), remove: vi.fn(), getAll: () => ({}) },
      null,
      actions
    );
    const card = document.querySelector<HTMLElement>('#content-grid .content-card')!;
    card.focus();
    const metadata = platform === 'webos' ? '#grid-header-title' : '.focus-meta__title';
    expect(document.querySelector(metadata)?.textContent).toBe(title);
    expect(card.textContent).not.toContain('\\');
    card.click();
    expect(actions.onVideoSelect).toHaveBeenCalledWith('one', title);
    expect(actions.onFeedLoaded.mock.calls[0][0][0].title).toBe(title);
    expect(feed['September 2026'][0].title).toBe(rawTitle);
  });
});
