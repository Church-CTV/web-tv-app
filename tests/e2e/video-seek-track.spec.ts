import { test, expect, waitForAppReady } from './fixtures';

test('the seek track stays full width as playback advances', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  await page.locator('.content-card').first().click();
  const video = page.locator('#screen-video video');
  await expect(video).toBeVisible();
  await page.waitForFunction(() => {
    const video = document.querySelector('#screen-video video') as HTMLVideoElement;
    return Number.isFinite(video.duration) && video.duration > 0;
  });
  await video.evaluate((element: HTMLVideoElement) => {
    element.pause();
    element.currentTime = element.duration / 4;
    element.dispatchEvent(new Event('timeupdate'));
  });
  const track = page.locator('.video-screen__progress');
  const geometry = await track.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    available:
      element.parentElement!.clientWidth -
      parseFloat(getComputedStyle(element.parentElement!).paddingLeft) -
      parseFloat(getComputedStyle(element.parentElement!).paddingRight),
  }));
  expect(geometry.width).toBeCloseTo(geometry.available, 0);
  await track.click({ position: { x: geometry.width * 0.75, y: 3 } });
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime / element.duration)
    )
    .toBeCloseTo(0.75, 1);
});
