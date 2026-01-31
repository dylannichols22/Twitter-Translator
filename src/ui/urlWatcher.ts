/**
 * URL Watcher for SPA Navigation
 * Detects URL changes and triggers callbacks for re-translation.
 * Works with multiple platforms (Twitter, Weibo, etc.)
 */

import { isThreadUrl as platformIsThreadUrl, extractPostId } from '../platforms';

/**
 * Checks if a URL is a thread URL on any supported platform.
 * @deprecated Use isThreadUrl from '../platforms' instead
 */
export function isTwitterThreadUrl(url: string): boolean {
  return platformIsThreadUrl(url);
}

/**
 * Extracts the thread/post ID from a URL on any supported platform.
 * Returns null if the URL is not a thread URL.
 * @deprecated Use extractPostId from '../platforms' instead
 */
export function extractThreadId(url: string): string | null {
  return extractPostId(url);
}

/**
 * Extracts just the path from a URL for comparison.
 * This ignores query params and hash.
 */
function getPathname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

export type UrlChangeCallback = (newUrl: string) => void;

/**
 * Watches for URL changes in a Twitter SPA.
 * Uses multiple detection methods for reliability:
 * 1. History API hooks (pushState/replaceState)
 * 2. popstate event listener (back/forward)
 * 3. Polling fallback (catches any missed navigation)
 */
export class UrlWatcher {
  private callback: UrlChangeCallback | null;
  private debounceMs: number;
  private lastUrl: string;
  private lastPathname: string;
  private debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private popstateHandler: (() => void) | null = null;
  private originalPushState: History['pushState'] | null = null;
  private originalReplaceState: History['replaceState'] | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private started = false;

  // Polling interval in ms - checks URL periodically as fallback
  private static readonly POLL_INTERVAL_MS = 500;

  constructor(callback?: UrlChangeCallback, debounceMs = 200) {
    this.callback = callback ?? null;
    this.debounceMs = debounceMs;
    this.lastUrl = window.location.href;
    this.lastPathname = getPathname(this.lastUrl);
  }

  /**
   * Starts watching for URL changes.
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.lastUrl = window.location.href;
    this.lastPathname = getPathname(this.lastUrl);

    // Hook History API
    if (!this.originalPushState) {
      this.originalPushState = history.pushState;
    }
    if (!this.originalReplaceState) {
      this.originalReplaceState = history.replaceState;
    }

    history.pushState = (...args) => {
      this.originalPushState?.apply(history, args);
      this.checkUrlChange();
    };

    history.replaceState = (...args) => {
      this.originalReplaceState?.apply(history, args);
      this.checkUrlChange();
    };

    // Listen for popstate (browser back/forward)
    this.popstateHandler = () => {
      this.checkUrlChange();
    };
    window.addEventListener('popstate', this.popstateHandler);

    // Polling fallback - catches navigation that bypasses our hooks
    // Twitter may cache history.pushState before our hooks are installed
    this.pollIntervalId = setInterval(() => {
      this.checkUrlChange();
    }, UrlWatcher.POLL_INTERVAL_MS);
  }

  /**
   * Stops watching for URL changes.
   */
  stop(): void {
    if (this.debounceTimeoutId !== null) {
      clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
    }

    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }

    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }

    this.started = false;
  }

  /**
   * Checks if the URL has changed and triggers callback if so.
   */
  private checkUrlChange(): void {
    const currentUrl = window.location.href;
    const currentPathname = getPathname(currentUrl);

    // Only trigger if path changes (ignore query params / hash changes)
    if (currentPathname !== this.lastPathname) {
      this.lastUrl = currentUrl;
      this.lastPathname = currentPathname;
      this.scheduleCallback(currentUrl);
    }
  }

  /**
   * Schedules the callback with debouncing.
   */
  private scheduleCallback(url: string): void {
    if (this.debounceTimeoutId !== null) {
      clearTimeout(this.debounceTimeoutId);
    }

    this.debounceTimeoutId = setTimeout(() => {
      if (this.callback) {
        this.callback(url);
      }
      this.debounceTimeoutId = null;
    }, this.debounceMs);
  }

  /**
   * Returns the current URL.
   */
  getCurrentUrl(): string {
    return window.location.href;
  }

  /**
   * Returns whether the current URL is a thread URL on any supported platform.
   */
  isThreadUrl(): boolean {
    return platformIsThreadUrl(this.getCurrentUrl());
  }

  /**
   * Returns the current thread/post ID, or null if not on a thread page.
   */
  getThreadId(): string | null {
    return extractPostId(this.getCurrentUrl());
  }

  /**
   * Sets or updates the callback.
   */
  setCallback(callback: UrlChangeCallback): void {
    this.callback = callback;
  }
}
