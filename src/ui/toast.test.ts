import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastManager, type ToastType } from './toast';

describe('Toast Notifications', () => {
  let toastManager: ToastManager;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    toastManager = new ToastManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ToastManager initialization', () => {
    it('creates a toast container in the document body', () => {
      const container = document.querySelector('.toast-container');
      expect(container).toBeTruthy();
    });

    it('toast container has correct accessibility attributes', () => {
      const container = document.querySelector('.toast-container');
      expect(container?.getAttribute('role')).toBe('status');
      expect(container?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('show', () => {
    it('shows toast with message', () => {
      toastManager.show({ message: 'Translation complete', type: 'success' });
      const toast = document.querySelector('.toast');
      expect(toast?.textContent).toContain('Translation complete');
    });

    it('applies correct class for success type', () => {
      toastManager.show({ message: 'Success', type: 'success' });
      const toast = document.querySelector('.toast');
      expect(toast?.classList.contains('toast-success')).toBe(true);
    });

    it('applies correct class for error type', () => {
      toastManager.show({ message: 'Failed', type: 'error' });
      const toast = document.querySelector('.toast');
      expect(toast?.classList.contains('toast-error')).toBe(true);
    });

    it('applies correct class for info type', () => {
      toastManager.show({ message: 'Info', type: 'info' });
      const toast = document.querySelector('.toast');
      expect(toast?.classList.contains('toast-info')).toBe(true);
    });

    it('includes dismiss button', () => {
      toastManager.show({ message: 'Test', type: 'info' });
      const dismissBtn = document.querySelector('.toast-dismiss');
      expect(dismissBtn).toBeTruthy();
      expect(dismissBtn?.getAttribute('aria-label')).toBe('Dismiss');
    });

    it('auto-dismisses after default duration', () => {
      toastManager.show({ message: 'Test', type: 'info' });
      expect(document.querySelector('.toast')).toBeTruthy();

      // Advance timer past default duration (4000ms) + animation time
      vi.advanceTimersByTime(4500);

      // Toast should start dismiss animation
      const toast = document.querySelector('.toast');
      expect(toast?.style.animation).toContain('toast-slide-out');
    });

    it('auto-dismisses after custom duration', () => {
      toastManager.show({ message: 'Test', type: 'info', duration: 1000 });
      expect(document.querySelector('.toast')).toBeTruthy();

      vi.advanceTimersByTime(1500);

      const toast = document.querySelector('.toast');
      expect(toast?.style.animation).toContain('toast-slide-out');
    });

    it('can be manually dismissed by clicking button', () => {
      toastManager.show({ message: 'Test', type: 'info' });
      const dismissBtn = document.querySelector('.toast-dismiss') as HTMLButtonElement;

      dismissBtn.click();

      const toast = document.querySelector('.toast');
      expect(toast?.style.animation).toContain('toast-slide-out');
    });

    it('can show multiple toasts', () => {
      toastManager.show({ message: 'First', type: 'success' });
      toastManager.show({ message: 'Second', type: 'error' });
      toastManager.show({ message: 'Third', type: 'info' });

      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(3);
    });
  });
});
