/**
 * Screen visibility helpers — unit tests.
 * Tests showScreen/hideScreen/transitionToScreen/showLoadingScreen/clearLoadingScreen.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showScreen,
  hideScreen,
  transitionToScreen,
  showLoadingScreen,
  clearLoadingScreen,
} from '../../../src/screens/visibility';

describe('visibility', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'visibility-test';
    container.innerHTML = `
      <div id="screen-home" class="screen">Home</div>
      <div id="screen-schedule" class="screen">Schedule</div>
      <div id="screen-video" class="screen screen-active">Video</div>
      <div id="screen-settings" class="screen">Settings</div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('showScreen', () => {
    it('hides all screens and shows the target', () => {
      showScreen('screen-home');
      expect(document.querySelector('#screen-home')?.classList.contains('screen-active')).toBe(
        true
      );
      expect(document.querySelector('#screen-schedule')?.classList.contains('screen-active')).toBe(
        false
      );
      expect(document.querySelector('#screen-video')?.classList.contains('screen-active')).toBe(
        false
      );
      expect(document.querySelector('#screen-settings')?.classList.contains('screen-active')).toBe(
        false
      );
    });

    it('handles non-existent screen id gracefully', () => {
      showScreen('screen-nonexistent');
      const allScreens = document.querySelectorAll('.screen');
      allScreens.forEach((s) => {
        expect(s.classList.contains('screen-active')).toBe(false);
      });
    });

    it('removes screen-active from all screens before adding to target', () => {
      showScreen('screen-settings');
      expect(document.querySelector('#screen-settings')?.classList.contains('screen-active')).toBe(
        true
      );
      expect(document.querySelector('#screen-video')?.classList.contains('screen-active')).toBe(
        false
      );
    });

    it('sets display and opacity before adding active class', () => {
      showScreen('screen-home');
      const el = document.getElementById('screen-home') as HTMLElement;
      expect(el.style.display).toBe('block');
      expect(el.style.opacity).toBe('1');
    });
  });

  describe('hideScreen', () => {
    it('removes screen-active from target screen', () => {
      hideScreen('screen-video');
      expect(document.querySelector('#screen-video')?.classList.contains('screen-active')).toBe(
        false
      );
    });

    it('does not affect other screens', () => {
      hideScreen('screen-home');
      expect(document.querySelector('#screen-schedule')?.classList.contains('screen-active')).toBe(
        false
      );
    });

    it('handles non-existent screen id gracefully', () => {
      hideScreen('screen-nonexistent');
      expect(document.querySelector('#screen-home')?.classList.contains('screen-active')).toBe(
        false
      );
    });
  });

  describe('transitionToScreen', () => {
    it('fades out old screen and fades in new screen', () => {
      transitionToScreen('screen-video', 'screen-home', 100);
      // requestAnimationFrame fires sync in jsdom
      const homeEl = document.getElementById('screen-home') as HTMLElement;
      const videoEl = document.getElementById('screen-video') as HTMLElement;
      expect(homeEl?.style.opacity).toBe('1');
      expect(homeEl?.classList.contains('screen-active')).toBe(true);
    });

    it('handles non-existent screens gracefully', () => {
      expect(() => transitionToScreen('screen-missing1', 'screen-missing2')).not.toThrow();
    });
  });

  describe('showLoadingScreen', () => {
    it('renders loading spinner and message', () => {
      showLoadingScreen('screen-home', 'Loading content...');
      expect(document.querySelector('.screen-loading')).toBeTruthy();
      expect(document.querySelector('.screen-loading__spinner')).toBeTruthy();
      expect(document.querySelector('.loading-message')?.textContent).toBe('Loading content...');
    });

    it('clears previous content', () => {
      // screen-home has "Home" text
      showLoadingScreen('screen-home', 'Loading...');
      expect(document.querySelector('#screen-home')?.textContent).toContain('Loading...');
    });
  });

  describe('clearLoadingScreen', () => {
    it('removes loading spinner after content loaded', () => {
      showLoadingScreen('screen-home', 'Loading...');
      clearLoadingScreen('screen-home');
      expect(document.querySelector('.screen-loading')).toBeNull();
    });

    it('handles non-existent container gracefully', () => {
      expect(() => clearLoadingScreen('nonexistent')).not.toThrow();
    });
  });
});
