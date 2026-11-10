/**
 * Vizio App — Root application integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showScreen, hideScreen } from '../../src/App';

describe('Vizio App Integration', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-container"></div>
      <div id="screen-grid" class="screen screen-active">Main</div>
      <div id="screen-search" class="screen">Search</div>
      <div id="screen-schedule" class="screen">Schedule</div>
      <div id="screen-continue-watching" class="screen">Continue Watching</div>
      <div id="screen-watch-later" class="screen">Watch Later</div>
      <div id="screen-settings" class="screen">Settings</div>
      <div id="screen-content-detail" class="screen">Detail</div>
      <div id="screen-video" class="screen">Video</div>
      <div id="screen-error" class="screen">Error</div>
    `;
  });

  it('shows a screen by id', () => {
    showScreen('screen-search');
    expect(document.getElementById('screen-search')?.className).toContain('screen-active');
  });

  it('hides a screen by id', () => {
    showScreen('screen-search');
    hideScreen('screen-search');
    expect(document.getElementById('screen-search')?.className).not.toContain('screen-active');
  });

  it('switches between screens', () => {
    showScreen('screen-search');
    showScreen('screen-schedule');
    expect(document.getElementById('screen-search')?.className).not.toContain('screen-active');
    expect(document.getElementById('screen-schedule')?.className).toContain('screen-active');
  });
});
