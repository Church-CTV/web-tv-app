import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadSearchScreen } from '../../src/screens/SearchScreen';

it('presents a full-width rectangular keyboard with a visible remote focus', async () => {
  document.body.innerHTML = '<div id="screen-search"></div>';
  await loadSearchScreen([], vi.fn());
  expect(document.querySelectorAll('.osk-row')).toHaveLength(5);
  expect(document.querySelector('.search-query')?.getAttribute('data-placeholder')).toBeTruthy();
  const css = readFileSync(
    resolve(__dirname, '../../../../shared/styles/search-premium.css'),
    'utf8'
  );
  expect(css).toMatch(/\.osk-row\s*\{[^}]*display:\s*flex/s);
  expect(css).toMatch(/\.osk-key\s*\{[^}]*flex:\s*1/s);
  expect(css).toMatch(/\.osk-key:focus\s*\{[^}]*outline:/s);
});
