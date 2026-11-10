import mockFeed from '../../../shared/test-fixtures/mock-feed.json';
import { test, expect, waitForAppReady } from './fixtures';

test('inactive screens cannot receive focus after leaving Search', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const key = page.locator('#screen-search .osk-key').first();
  await expect(key).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#screen-settings')).toHaveClass(/screen-active/);
  const receivedFocus = await key.evaluate((element) => {
    (element as HTMLElement).focus();
    return document.activeElement === element;
  });
  expect(receivedFocus).toBe(false);
  await expect(key).toBeHidden();
});

test('HD screens scale the Roku stage without modern CSS zoom arithmetic', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const legacy = document.createElement('style');
      legacy.textContent = '#app { zoom: 1 !important; }';
      document.head.appendChild(legacy);
    });
  });
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Home', exact: true }).focus();
  await expect
    .poll(async () => (await page.locator('.content-card').nth(1).boundingBox())?.width)
    .toBeCloseTo(320, 0);
});

test('playback occupies the stage and hides navigation until Back', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('.content-card').first().click();
  const video = page.locator('#screen-video video').first();
  await expect(video).toBeVisible();
  await expect.poll(async () => Math.round((await video.boundingBox())?.width ?? 0)).toBe(1920);
  await expect.poll(async () => Math.round((await video.boundingBox())?.height ?? 0)).toBe(1080);
  await expect(page.locator('#left-nav .left-nav__item').first()).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#left-nav .left-nav__item').first()).toBeVisible();
  await expect(page.locator('#screen-grid')).toHaveClass(/screen-active/);
});

test('core surfaces work without newer DOM and array APIs', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'replaceChildren', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(Array.prototype, 'flatMap', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await waitForAppReady(page);
  await expect(page.locator('.content-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#screen-search .osk-key').first()).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#screen-settings .settings-channel')).toContainText(
    'Test Church Channel'
  );
  await expect(page.locator('.settings-give__link')).toBeVisible();
});

test('legacy flex-gap fallback preserves the Roku card spacing', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('ctv-no-flex-gap');
      const legacy = document.createElement('style');
      legacy.textContent =
        '.content-category__row, .content-grid__row-videos { gap: 0 !important; }';
      document.head.appendChild(legacy);
    });
  });
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Home', exact: true }).focus();
  await expect
    .poll(async () => {
      const boxes = await page
        .locator('.content-card')
        .evaluateAll((cards) => cards.slice(0, 2).map((card) => card.getBoundingClientRect()));
      return Math.round(boxes[1].left - boxes[0].right);
    })
    .toBe(30);
});

test('Home initially focuses the first playable card', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await expect(page.locator('#content-grid .content-card').first()).toBeFocused();
});

test('Settings content and QR fit within the visible stage without overlap', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const title = page.locator('#screen-settings .settings-screen__title');
  await expect(title).toHaveText('Settings');
  const boxes = await Promise.all([
    title.boundingBox(),
    page.locator('#screen-settings .settings-channel-card').boundingBox(),
    page.locator('#screen-settings .settings-give').boundingBox(),
    page.locator('#screen-settings .settings-give__content').boundingBox(),
    page.locator('#screen-settings .settings-give__qr').boundingBox(),
  ]);
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1920);
    expect(box!.y + box!.height).toBeLessThanOrEqual(1080);
  }
  const [heading, channel, give, content, qr] = boxes.map((box) => box!);
  expect(heading.y + heading.height).toBeLessThanOrEqual(channel.y);
  expect(channel.y + channel.height).toBeLessThanOrEqual(give.y);
  expect(content.x + content.width).toBeLessThanOrEqual(qr.x);
  expect(qr).toMatchObject({ width: 250, height: 250 });
  expect(qr.x + qr.width).toBeLessThanOrEqual(give.x + give.width);
  expect(qr.y + qr.height).toBeLessThanOrEqual(give.y + give.height);
});

test('Home uses the pinned Roku row and poster origin', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Home', exact: true }).focus();
  const poster = await page.locator('.content-card').nth(1).boundingBox();
  expect(poster).toMatchObject({ x: 735, y: 390, width: 480, height: 270 });
  const label = await page
    .locator('.content-grid__row-title, .content-category__title')
    .first()
    .boundingBox();
  expect(label).toMatchObject({ x: 225, y: 330 });
});

test('Search title fits the stage and paints above the header background', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const title = page.locator('#screen-search .search-screen__title');
  await expect(title).toBeVisible();
  expect(await title.boundingBox()).toMatchObject({ x: 130, y: 128 });
  expect(
    await title.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.x + 10, box.y + 10) === element;
    })
  ).toBe(true);
});

test('remote-only Search can enter a year without duplicate activation', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('#screen-search .osk-key[data-key="2"]').focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('#screen-search .osk-key[data-key="0"]')).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#screen-search .osk-key[data-key="4"]')).toBeFocused();
  await page.keyboard.press('Enter');
  const visibleQuery = page.locator('#screen-search .search-query');
  if (await visibleQuery.count()) await expect(visibleQuery).toHaveText('2024');
  else await expect(page.locator('#screen-search input').first()).toHaveValue('2024');
});

test('poster layout works on the supported engine without CSS inset', async ({ page }) => {
  await page.route('**/*.css', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/\binset\s*:[^;}]+;?/g, '');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await waitForAppReady(page);
  const card = page.locator('.content-card').first();
  const poster = card.locator('.content-card__poster');
  await expect
    .poll(() => poster.evaluate((element) => Math.round(element.getBoundingClientRect().width)))
    .toBe(480);
  await expect
    .poll(() => poster.evaluate((element) => Math.round(element.getBoundingClientRect().height)))
    .toBe(270);
});

test('Home handles each D-pad press exactly once', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  const cards = page.locator('#content-grid .content-card');
  await expect(cards.first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(2)).toBeFocused();
});

test('Home presents the focused title and description with a stable card size', async ({
  page,
}) => {
  await page.route(/\/feed\/?$/, async (route) => {
    const feed = JSON.parse(JSON.stringify(mockFeed));
    const month = Object.values(feed).find((value) => Array.isArray(value)) as {
      title: string;
      shortDescription: string;
    }[];
    month[0].title = 'A focused message';
    month[0].shortDescription = 'A clear description of the focused message.';
    await route.fulfill({ json: feed });
  });
  await page.goto('/');
  await waitForAppReady(page);
  const card = page.locator('#content-grid .content-card').first();
  await expect(card).toBeFocused();
  const meta = page.locator('.grid-header, .focus-meta').first();
  await expect(meta).toBeVisible();
  await expect(meta).toContainText('A focused message');
  await expect(meta).toContainText('A clear description of the focused message.');
  expect(await card.boundingBox()).toMatchObject({ width: 480, height: 270 });
});

test('rectangular Search keys keep their spacing on legacy flex engines', async ({ page }) => {
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () =>
      document.documentElement.classList.add('ctv-no-flex-gap')
    )
  );
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const gap = await page
    .locator('.osk-row')
    .first()
    .evaluate((row) => {
      const keys = row.querySelectorAll('.osk-key');
      return keys[1].getBoundingClientRect().left - keys[0].getBoundingClientRect().right;
    });
  expect(gap).toBeCloseTo(8, 0);
});

test('Search provides useful guidance before typing and after Clear', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find a message', exact: true })).toBeVisible();
  await page.locator('.osk-key[data-key="q"]').click();
  await expect(page.getByRole('heading', { name: 'Find a message', exact: true })).toBeHidden();
  await page.locator('.osk-key[data-key="clear"]').click();
  await expect(page.getByRole('heading', { name: 'Find a message', exact: true })).toBeVisible();
});

test('Search keyboard and guidance fit without overlap', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const keyboard = (await page.locator('#screen-search .osk').boundingBox())!;
  const guidance = (await page.locator('#screen-search .search-prompt').boundingBox())!;
  expect(keyboard.x + keyboard.width).toBeLessThanOrEqual(guidance.x);
  for (const box of [keyboard, guidance]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1920);
    expect(box.y + box.height).toBeLessThanOrEqual(1080);
  }
  const keys = await page.locator('#screen-search .osk-key').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    })
  );
  expect(keys.length).toBeGreaterThan(26);
  for (const key of keys) {
    expect(key.width).toBeGreaterThan(0);
    expect(key.height).toBe(64);
    expect(key.x).toBeGreaterThanOrEqual(keyboard.x);
    expect(key.y).toBeGreaterThanOrEqual(keyboard.y);
    expect(key.x + key.width).toBeLessThanOrEqual(keyboard.x + keyboard.width);
    expect(key.y + key.height).toBeLessThanOrEqual(keyboard.y + keyboard.height);
  }
});
