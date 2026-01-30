import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UrlWatcher, isTwitterThreadUrl, extractThreadId } from './urlWatcher';

describe('UrlWatcher', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.useFakeTimers();
    originalLocation = window.location;

    // Mock window.location
    delete (window as { location?: Location }).location;
    (window as { location: Location }).location = {
      ...originalLocation,
      href: 'http://localhost:3000/user/status/123',
      pathname: '/user/status/123',
    } as Location;
  });

  afterEach(() => {
    vi.useRealTimers();
    (window as { location: Location }).location = originalLocation;
  });

  describe('isTwitterThreadUrl', () => {
    it('returns true for twitter.com status URLs', () => {
      expect(isTwitterThreadUrl('https://twitter.com/user/status/123')).toBe(true);
    });

    it('returns true for x.com status URLs', () => {
      expect(isTwitterThreadUrl('https://x.com/user/status/456')).toBe(true);
    });

    it('returns false for non-status URLs', () => {
      expect(isTwitterThreadUrl('https://twitter.com/user')).toBe(false);
      expect(isTwitterThreadUrl('https://twitter.com/home')).toBe(false);
      expect(isTwitterThreadUrl('https://twitter.com/explore')).toBe(false);
    });

    it('returns false for non-Twitter URLs', () => {
      expect(isTwitterThreadUrl('https://google.com')).toBe(false);
      expect(isTwitterThreadUrl('https://example.com/status/123')).toBe(false);
    });

    it('handles URLs with query params', () => {
      expect(isTwitterThreadUrl('https://twitter.com/user/status/123?s=20')).toBe(true);
    });

    it('handles URLs with hash', () => {
      expect(isTwitterThreadUrl('https://twitter.com/user/status/123#top')).toBe(true);
    });
  });

  describe('extractThreadId', () => {
    it('extracts thread ID from twitter.com URL', () => {
      expect(extractThreadId('https://twitter.com/user/status/123')).toBe('123');
    });

    it('extracts thread ID from x.com URL', () => {
      expect(extractThreadId('https://x.com/user/status/456')).toBe('456');
    });

    it('returns null for non-thread URLs', () => {
      expect(extractThreadId('https://twitter.com/user')).toBeNull();
    });

    it('handles long numeric IDs', () => {
      expect(extractThreadId('https://twitter.com/user/status/1234567890123456789')).toBe('1234567890123456789');
    });
  });

  describe('UrlWatcher class', () => {
    it('creates a watcher instance', () => {
      const watcher = new UrlWatcher();
      expect(watcher).toBeDefined();
      watcher.stop();
    });

    it('callback is called when URL changes', () => {
      const callback = vi.fn();
      const watcher = new UrlWatcher(callback);
      watcher.start();

      // Simulate URL change
      (window.location as { href: string }).href = 'http://localhost:3000/user/status/456';
      (window.location as { pathname: string }).pathname = '/user/status/456';
      history.pushState({}, '', '/user/status/456');

      // Advance timers to trigger check
      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith('http://localhost:3000/user/status/456');

      watcher.stop();
    });

    it('callback is not called when URL stays the same', () => {
      const callback = vi.fn();
      const watcher = new UrlWatcher(callback);
      watcher.start();

      // Advance timers without changing URL
      vi.advanceTimersByTime(500);

      expect(callback).not.toHaveBeenCalled();

      watcher.stop();
    });

    it('debounces rapid URL changes', () => {
      const callback = vi.fn();
      const watcher = new UrlWatcher(callback, 200);
      watcher.start();

      // Simulate rapid URL changes
      (window.location as { href: string }).href = 'http://localhost:3000/user/status/1';
      (window.location as { pathname: string }).pathname = '/user/status/1';
      history.pushState({}, '', '/user/status/1');
      vi.advanceTimersByTime(50);

      (window.location as { href: string }).href = 'http://localhost:3000/user/status/2';
      (window.location as { pathname: string }).pathname = '/user/status/2';
      history.pushState({}, '', '/user/status/2');
      vi.advanceTimersByTime(50);

      (window.location as { href: string }).href = 'http://localhost:3000/user/status/3';
      (window.location as { pathname: string }).pathname = '/user/status/3';
      history.pushState({}, '', '/user/status/3');
      vi.advanceTimersByTime(300);

      // Should only be called once with the final URL
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('http://localhost:3000/user/status/3');

      watcher.stop();
    });

    it('stop() stops watching for changes', () => {
      const callback = vi.fn();
      const watcher = new UrlWatcher(callback);
      watcher.start();
      watcher.stop();

      // Simulate URL change after stopping
      (window.location as { href: string }).href = 'http://localhost:3000/user/status/999';
      history.pushState({}, '', '/user/status/999');
      vi.advanceTimersByTime(500);

      expect(callback).not.toHaveBeenCalled();
    });

    it('getCurrentUrl returns the current URL', () => {
      const watcher = new UrlWatcher();
      expect(watcher.getCurrentUrl()).toBe('http://localhost:3000/user/status/123');
      watcher.stop();
    });

    it('isThreadUrl returns true for thread URLs', () => {
      (window.location as { href: string }).href = 'https://twitter.com/user/status/123';
      (window.location as { pathname: string }).pathname = '/user/status/123';
      const watcher = new UrlWatcher();
      expect(watcher.isThreadUrl()).toBe(true);
      watcher.stop();
    });

    it('isThreadUrl returns false for non-thread URLs', () => {
      (window.location as { href: string }).href = 'https://twitter.com/home';
      (window.location as { pathname: string }).pathname = '/home';

      const watcher = new UrlWatcher();
      expect(watcher.isThreadUrl()).toBe(false);
      watcher.stop();
    });

    it('handles popstate events', () => {
      const callback = vi.fn();
      const watcher = new UrlWatcher(callback);
      watcher.start();

      // Simulate popstate (browser back/forward)
      (window.location as { href: string }).href = 'http://localhost:3000/user/status/789';
      (window.location as { pathname: string }).pathname = '/user/status/789';
      window.dispatchEvent(new PopStateEvent('popstate'));

      vi.advanceTimersByTime(300);

      expect(callback).toHaveBeenCalledWith('http://localhost:3000/user/status/789');

      watcher.stop();
    });

    it('only triggers when path changes, not query params', () => {
      const callback = vi.fn();
      const watcher = new UrlWatcher(callback);
      watcher.start();

      // Change query params only
      (window.location as { href: string }).href = 'http://localhost:3000/user/status/123?s=20';
      history.pushState({}, '', '/user/status/123?s=20');
      vi.advanceTimersByTime(300);

      // Path didn't change, callback should not be called
      expect(callback).not.toHaveBeenCalled();

      watcher.stop();
    });
  });
});
