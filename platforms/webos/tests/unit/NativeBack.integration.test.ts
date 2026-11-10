import { expect, it, vi } from 'vitest';

it('delegates Home Back to the vendored webOS API, not non-root Back', async () => {
  const platformBack = vi.fn();
  Object.assign(window, { webOS: { platformBack } });
  document.body.innerHTML =
    '<div id="screen-grid" class="screen screen-active"></div><div id="screen-search" class="screen"></div>';
  const app = await import('../../src/App');
  app.handleBackNavigation();
  expect(platformBack).toHaveBeenCalledTimes(1);
  document.getElementById('screen-grid')!.classList.remove('screen-active');
  document.getElementById('screen-search')!.classList.add('screen-active');
  app.handleBackNavigation();
  expect(platformBack).toHaveBeenCalledTimes(1);
  expect(document.getElementById('screen-grid')!.classList.contains('screen-active')).toBe(true);
  platformBack.mockImplementation(() => {
    throw Error('SDK unavailable');
  });
  expect(() => app.handleBackNavigation()).not.toThrow();
});
