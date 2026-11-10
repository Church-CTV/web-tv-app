/**
 * K4b — CTV-compatible confirmation dialog (TDD RED → GREEN).
 *
 * Native `confirm()` doesn't render properly on LG webOS, Samsung Tizen, and
 * Vizio SmartCast platforms. Destructive actions that depend on it will
 * silently fail on real CTV hardware.
 *
 * This test defines the required behavior of a CTV-compatible ConfirmDialog
 * that uses HTML elements (focusable, navigable, accessible) instead of the
 * native browser dialog.
 *
 * Functions under test:
 *  - createConfirmDialog: creates a confirm dialog element with title, message,
 *    and confirm/cancel buttons
 *  - showConfirmDialog: displays the dialog in the DOM
 *  - disposeConfirmDialog: removes the dialog from the DOM
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createConfirmDialog,
  showConfirmDialog,
  disposeConfirmDialog,
  type ConfirmDialogConfig,
  type ConfirmDialogCallbacks,
  type ConfirmDialogResult,
} from '@ctv/shared/ui/ConfirmDialog';

function makeConfig(overrides: Partial<ConfirmDialogConfig> = {}): ConfirmDialogConfig {
  return {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    ...overrides,
  };
}

describe('ConfirmDialog (CTV-compatible)', () => {
  let originalBody: string;
  let originalConfirm: Window['confirm'];

  beforeEach(() => {
    originalBody = document.body.innerHTML;
    document.body.innerHTML = '<div id="screen-grid" class="screen screen-active"></div>';
    // Reset native confirm mock — CTV dialog must NOT call this.
    originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    document.body.innerHTML = originalBody;
    window.confirm = originalConfirm;
  });

  describe('createConfirmDialog', () => {
    it('should create a dialog element with role=dialog and aria-modal', () => {
      const result = createConfirmDialog(makeConfig());

      expect(result.overlay).toBeDefined();
      expect(result.overlay.classList).toContain('confirm-dialog__overlay');
      expect(result.dialog).toBeDefined();
      expect(result.dialog.getAttribute('role')).toBe('dialog');
      expect(result.dialog.getAttribute('aria-modal')).toBe('true');
      expect(result.dialog.getAttribute('aria-labelledby')).toBeTruthy();
      expect(result.dialog.getAttribute('aria-describedby')).toBeTruthy();
    });

    it('should have a title element matching the provided title', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Clear All Items?' }));

      expect(result.title).toBeDefined();
      expect(result.title.textContent).toBe('Clear All Items?');
      expect(result.title.tagName).toBe('H2');
    });

    it('should have a message element matching the provided message', () => {
      const result = createConfirmDialog(makeConfig({ message: 'This action cannot be undone.' }));

      expect(result.message).toBeDefined();
      expect(result.message.textContent).toBe('This action cannot be undone.');
      expect(result.message.tagName).toBe('P');
    });

    it('should have a confirm button with the provided label', () => {
      const result = createConfirmDialog(makeConfig({ confirmLabel: 'Yes' }));

      expect(result.confirmBtn).toBeDefined();
      expect(result.confirmBtn.textContent).toBe('Yes');
      expect(result.confirmBtn.getAttribute('type')).toBe('button');
    });

    it('should have a cancel button with the provided label', () => {
      const result = createConfirmDialog(makeConfig({ cancelLabel: 'No' }));

      expect(result.cancelBtn).toBeDefined();
      expect(result.cancelBtn.textContent).toBe('No');
      expect(result.cancelBtn.getAttribute('type')).toBe('button');
    });

    it('should have default labels when not specified', () => {
      const result = createConfirmDialog(makeConfig());

      expect(result.confirmBtn.textContent).toBe('Confirm');
      expect(result.cancelBtn.textContent).toBe('Cancel');
    });
  });

  describe('showConfirmDialog', () => {
    it('should add the dialog to the DOM', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      showConfirmDialog(result, {});

      expect(document.body.contains(result.overlay)).toBe(true);
    });

    it('should focus the confirm button by default', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      showConfirmDialog(result, {});

      expect(document.activeElement).toBe(result.confirmBtn);
    });

    it('should trap focus within the dialog on Tab', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      showConfirmDialog(result, {});

      // From confirm button, Tab should move to cancel button
      result.confirmBtn.focus();
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      result.confirmBtn.dispatchEvent(tabEvent);

      expect(document.activeElement).toBe(result.cancelBtn);

      // From cancel button, Tab should move back to confirm button
      const tabEvent2 = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      result.cancelBtn.dispatchEvent(tabEvent2);

      expect(document.activeElement).toBe(result.confirmBtn);

      disposeConfirmDialog(result);
    });

    it('should call onConfirm when confirm button is clicked', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      showConfirmDialog(result, { onConfirm, onCancel });
      result.confirmBtn.click();

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      showConfirmDialog(result, { onConfirm, onCancel });
      result.cancelBtn.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should remove the dialog from DOM after onConfirm', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      const onConfirm = vi.fn();

      showConfirmDialog(result, { onConfirm });
      result.confirmBtn.click();

      expect(document.body.contains(result.overlay)).toBe(false);
    });

    it('should remove the dialog from DOM after onCancel', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      const onCancel = vi.fn();

      showConfirmDialog(result, { onCancel });
      result.cancelBtn.click();

      expect(document.body.contains(result.overlay)).toBe(false);
    });
  });

  describe('Escape key handling', () => {
    it('should call onCancel when Escape key is pressed', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      showConfirmDialog(result, { onConfirm, onCancel });

      // Simulate Escape key press on the overlay
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      result.overlay.dispatchEvent(event);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(document.body.contains(result.overlay)).toBe(false);
    });
  });

  describe('disposeConfirmDialog', () => {
    it('should remove the dialog from the DOM', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      showConfirmDialog(result, {});
      expect(document.body.contains(result.overlay)).toBe(true);

      disposeConfirmDialog(result);
      expect(document.body.contains(result.overlay)).toBe(false);
    });
  });

  describe('CTV compatibility', () => {
    it('should work without native confirm() dialog', () => {
      vi.clearAllMocks();

      const result = createConfirmDialog(
        makeConfig({
          title: 'Clear Cache?',
          message: 'This will remove all cached data.',
        })
      );

      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      showConfirmDialog(result, { onConfirm, onCancel });
      result.confirmBtn.click();

      // Native confirm should never be called
      expect(window.confirm).not.toHaveBeenCalled();
      // But our HTML dialog should have worked
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should have proper ARIA attributes for screen readers', () => {
      const result = createConfirmDialog(
        makeConfig({ title: 'Confirm Action', message: 'Are you sure?' })
      );

      expect(result.dialog.getAttribute('role')).toBe('dialog');
      expect(result.dialog.getAttribute('aria-modal')).toBe('true');

      const labelId = result.dialog.getAttribute('aria-labelledby');
      const descId = result.dialog.getAttribute('aria-describedby');

      expect(labelId).toBeTruthy();
      expect(descId).toBeTruthy();

      const titleEl = result.overlay.querySelector(`#${labelId}`);
      const messageEl = result.overlay.querySelector(`#${descId}`);

      expect(titleEl).toBeTruthy();
      expect(messageEl).toBeTruthy();
      expect(titleEl?.textContent).toBe('Confirm Action');
      expect(messageEl?.textContent).toBe('Are you sure?');
    });

    it('should be navigable with keyboard only', () => {
      const result = createConfirmDialog(makeConfig({ title: 'Test' }));

      showConfirmDialog(result, {});

      // Both buttons should be focusable
      expect(result.confirmBtn.tabIndex).toBe(0);
      expect(result.cancelBtn.tabIndex).toBe(0);

      // Simulate keyboard navigation
      result.confirmBtn.focus();
      expect(document.activeElement).toBe(result.confirmBtn);

      result.cancelBtn.focus();
      expect(document.activeElement).toBe(result.cancelBtn);

      disposeConfirmDialog(result);
    });
  });
});
