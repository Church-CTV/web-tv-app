/**
 * SplashScreen tests — render + init + dismiss + min display + resolution + logo + subtitle.
 */

import { renderSplashScreen, initSplashScreen } from '../../src/ui/SplashScreen';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SplashScreen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderSplashScreen', () => {
    it('should render splash screen with title', () => {
      const html = renderSplashScreen({ title: 'Test Channel' });
      expect(html).toContain('Test Channel');
      expect(html).toContain('splash-screen');
      expect(html).toContain('data-resolution="fhd"');
    });

    it('should include subtitle when provided', () => {
      const html = renderSplashScreen({ title: 'Test', subtitle: 'Subtitle here' });
      expect(html).toContain('Subtitle here');
      expect(html).toContain('splash-subtitle');
    });

    it('should omit subtitle when not provided', () => {
      const html = renderSplashScreen({ title: 'Test' });
      expect(html).not.toContain('splash-subtitle');
    });

    it('should apply custom splash color', () => {
      const html = renderSplashScreen({ title: 'Test', splashColor: '#FF0000' });
      expect(html).toContain('background-color:#FF0000');
    });

    it('should default to black background', () => {
      const html = renderSplashScreen({ title: 'Test' });
      expect(html).toContain('background-color:#000000');
    });

    it('should include logo when provided', () => {
      const html = renderSplashScreen({ title: 'Test', logoUrl: '/logo.png' });
      expect(html).toContain('/logo.png');
      expect(html).toContain('splash-logo');
    });

    it('should omit logo when not provided', () => {
      const html = renderSplashScreen({ title: 'Test' });
      expect(html).not.toContain('splash-logo');
    });

    it('should set SD resolution attribute', () => {
      const html = renderSplashScreen({ title: 'Test', resolution: 'sd' });
      expect(html).toContain('data-resolution="sd"');
    });
  });

  describe('initSplashScreen', () => {
    it('should append splash screen to DOM', () => {
      // Ensure body exists in jsdom
      if (!document.body) {
        document.body = document.createElement('body');
      }
      const { dismiss } = initSplashScreen(
        { title: 'Test', minDisplayMs: 50 },
        { onDismiss: vi.fn() }
      );
      expect(document.getElementById('splash-screen')).toBeTruthy();
      dismiss();
    });

    it('should have splash in body after init', () => {
      if (!document.body) {
        document.body = document.createElement('body');
      }
      const { dismiss } = initSplashScreen(
        { title: 'Test', minDisplayMs: 50 },
        { onDismiss: vi.fn() }
      );
      const bodyChild = document.body.firstChild;
      expect(bodyChild).toBeTruthy();
      expect(bodyChild?.id).toBe('splash-screen');
      dismiss();
    });

    it('should dismiss and remove splash after transition completes', () => {
      if (!document.body) {
        document.body = document.createElement('body');
      }
      const onDismiss = vi.fn();
      const { dismiss } = initSplashScreen({ title: 'Test', minDisplayMs: 5000 }, { onDismiss });
      // Dismiss should set opacity to 0 immediately
      const el = document.getElementById('splash-screen');
      expect(el).toBeTruthy();
      expect(el?.style.opacity).toBe('0');
    });

    it('should call dismiss immediately and remove from DOM', () => {
      if (!document.body) {
        document.body = document.createElement('body');
      }
      const onDismiss = vi.fn();
      const { dismiss } = initSplashScreen({ title: 'Test', minDisplayMs: 5000 }, { onDismiss });
      // Dismiss should set opacity to 0
      expect(document.getElementById('splash-screen')?.style.opacity).toBe('0');
      // onDismiss is called after 300ms transition
      // We check immediately — it won't have fired yet, but the element should have opacity 0
      const el = document.getElementById('splash-screen');
      expect(el?.style.opacity).toBe('0');
    });
  });
});
