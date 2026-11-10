/**
 * Tizen visibility screen helpers — unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showScreen, hideScreen } from '../../src/screens/visibility';

describe('Tizen visibility', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="screen-grid" class="screen">Home</div>
      <div id="screen-search" class="screen">Search</div>
      <div id="screen-schedule" class="screen">Schedule</div>
      <div id="screen-continue-watching" class="screen">CW</div>
      <div id="screen-video" class="screen">Video</div>
    `;
  });

  it('shows a screen by id', () => {
    showScreen('screen-search');
    expect(document.getElementById('screen-search')?.className).toContain('screen-active');
  });

  it('hides all other screens when showing one', () => {
    showScreen('screen-search');
    expect(document.getElementById('screen-grid')?.className).not.toContain('screen-active');
    expect(document.getElementById('screen-schedule')?.className).not.toContain('screen-active');
  });

  it('switches between screens', () => {
    showScreen('screen-search');
    showScreen('screen-schedule');
    expect(document.getElementById('screen-search')?.className).not.toContain('screen-active');
    expect(document.getElementById('screen-schedule')?.className).toContain('screen-active');
  });

  it('hides a screen', () => {
    showScreen('screen-search');
    hideScreen('screen-search');
    expect(document.getElementById('screen-search')?.className).not.toContain('screen-active');
  });

  it('does nothing when hiding a nonexistent screen', () => {
    expect(() => hideScreen('nonexistent')).not.toThrow();
  });

  it('does nothing when showing a nonexistent screen', () => {
    expect(() => showScreen('nonexistent')).not.toThrow();
  });
});
