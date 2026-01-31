/**
 * URL Watcher for Twitter SPA Navigation
 * Detects URL changes and triggers callbacks for re-translation.
 */

const TWITTER_HOSTS = ['twitter.com', 'x.com'];
const STATUS_PATH_REGEX = /^\/[^/]+\/status\/(\d+)/;

/**
 * Checks if a URL is a Twitter/X thread URL.
 */
export function isTwitterThreadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isTwitterHost = TWITTER_HOSTS.some((host) => parsed.hostname.endsWith(host));
    if (!isTwitterHost) return false;

    return STATUS_PATH_REGEX.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Extracts the thread ID from a Twitter URL.
 * Returns null if the URL is not a thread URL.
 */
export function extractThreadId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(STATUS_PATH_REGEX);
    return match ? match[1] : null;
  } catch {
    return null;
  }
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
  private started = false;

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
  }

  /**
   * Stops watching for URL changes.
   */
  stop(): void {
    if (this.debounceTimeoutId !== null) {
      clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
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
   * Returns whether the current URL is a thread URL.
   */
  isThreadUrl(): boolean {
    return isTwitterThreadUrl(this.getCurrentUrl());
  }

  /**
   * Returns the current thread ID, or null if not on a thread page.
   */
  getThreadId(): string | null {
    return extractThreadId(this.getCurrentUrl());
  }

  /**
   * Sets or updates the callback.
   */
  setCallback(callback: UrlChangeCallback): void {
    this.callback = callback;
  }
}
