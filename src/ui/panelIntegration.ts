/**
 * Panel Integration
 * Ties together the panel controller, URL watcher, and scraper for a complete
 * side panel experience on Twitter pages.
 *
 * Architecture: Navigation Gate + Sync Loop (Hybrid Pattern)
 * - Navigation boundary: beginNavigation() -> gateThreadReady()
 * - Steady-state sync: startSyncLoop() -> sync() -> translateAndRender()
 */

import { PanelController, CachedTranslation } from './panelController';
import { UrlWatcher } from './urlWatcher';
import { MESSAGE_TYPES } from '../messages';
import { scrapeTweets, Tweet } from '../scraper';
import { translateQuickStreaming, getBreakdown, Breakdown } from '../translator';
import { renderBreakdownContent } from './breakdown';
import { clearElement, setText } from './dom';
import { getCurrentPlatform, isThreadUrl, extractPostId, twitterPlatform, Platform } from '../platforms';

export class PanelIntegration {
  private controller: PanelController;
  private urlWatcher: UrlWatcher;
  private apiKey = '';
  private tweets: Tweet[] = [];
  private breakdownCache: Map<string, Breakdown> = new Map();
  private commentLimit: number | undefined;
  private platform: Platform;

  // Navigation token for rejecting stale work
  private navToken = 0;

  // AbortController for canceling in-flight operations
  private abortController: AbortController | null = null;

  // Current thread tracking
  private activeSourceUrl: string | null = null;
  private activeThreadId: string | null = null;

  // Breakdown request tracking
  private breakdownsInFlight: Set<string> = new Set();

  // Sync loop state
  private syncObserver: MutationObserver | null = null;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SYNC_DEBOUNCE_MS = 150;

  // Track tweets currently being translated
  private currentTweets: Map<string, Tweet> = new Map();
  private translationsInFlight: Set<string> = new Set();

  constructor() {
    this.platform = getCurrentPlatform() ?? twitterPlatform;
    this.controller = new PanelController();
    this.urlWatcher = new UrlWatcher((newUrl) => {
      this.handleUrlChange(newUrl);
    });

    this.setupBreakdownToggle();
    this.controller.setLoadMoreHandler(() => {
      void this.loadMoreReplies();
    });
  }

  /**
   * Sets up the breakdown toggle callback for lazy loading.
   */
  private setupBreakdownToggle(): void {
    this.controller.setBreakdownToggleCallback((article, breakdownEl, tweet) => {
      void this.toggleBreakdown(article, breakdownEl, tweet);
    });
  }

  /**
   * Handles breakdown toggle - loads breakdown on demand.
   */
  private async toggleBreakdown(
    article: HTMLElement,
    breakdownEl: HTMLElement,
    tweet: Tweet
  ): Promise<void> {
    const isExpanding = breakdownEl.classList.contains('hidden');
    const cachedTranslation = this.controller.getCachedTranslation(tweet.id);

    if (isExpanding) {
      const breakdownInner = breakdownEl.querySelector('.breakdown-inner') || breakdownEl;

      // Check if breakdown already loaded in cache
      if (!this.breakdownCache.has(tweet.id)) {
        if (cachedTranslation && cachedTranslation.segments.length > 0) {
          this.breakdownCache.set(tweet.id, {
            segments: cachedTranslation.segments,
            notes: cachedTranslation.notes,
          });
        }
      }

      if (!this.breakdownCache.has(tweet.id)) {
        // Prevent duplicate breakdown requests
        if (this.breakdownsInFlight.has(tweet.id)) {
          breakdownEl.classList.remove('hidden');
          article.classList.add('expanded');
          return;
        }

        if (!this.apiKey) {
          clearElement(breakdownInner);
          const error = document.createElement('div');
          error.className = 'breakdown-error';
          setText(error, 'API key is required for breakdowns');
          breakdownInner.appendChild(error);
          breakdownEl.classList.remove('hidden');
          article.classList.add('expanded');
          return;
        }

        this.breakdownsInFlight.add(tweet.id);

        // Show loading state
        clearElement(breakdownInner);
        const loading = document.createElement('div');
        loading.className = 'breakdown-loading';
        setText(loading, 'Loading breakdown...');
        breakdownInner.appendChild(loading);
        breakdownEl.classList.remove('hidden');
        article.classList.add('expanded');

        try {
          const opTweet = this.tweets[0];
          const result = await getBreakdown(tweet.text, this.apiKey, {
            opAuthor: opTweet?.author,
            opText: opTweet?.text,
            opUrl: opTweet?.url,
          });

          this.controller.addUsage(result.usage);
          this.controller.updateFooter();

          await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.RECORD_USAGE,
            data: {
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
            },
          });

          this.breakdownCache.set(tweet.id, result.breakdown);
          this.controller.cacheTranslation(tweet.id, {
            id: tweet.id,
            naturalTranslation: cachedTranslation?.naturalTranslation ?? '',
            segments: result.breakdown.segments,
            notes: result.breakdown.notes,
          });

          clearElement(breakdownInner);
          breakdownInner.appendChild(renderBreakdownContent(result.breakdown));
        } catch (error) {
          clearElement(breakdownInner);
          const errorEl = document.createElement('div');
          errorEl.className = 'breakdown-error';
          const message = error instanceof Error ? error.message : 'Unknown error';
          setText(errorEl, `Failed to load breakdown: ${message}`);
          breakdownInner.appendChild(errorEl);
        } finally {
          this.breakdownsInFlight.delete(tweet.id);
        }
      } else {
        const cached = this.breakdownCache.get(tweet.id)!;
        if (breakdownInner.children.length === 0 || breakdownInner.querySelector('.breakdown-loading')) {
          clearElement(breakdownInner);
          breakdownInner.appendChild(renderBreakdownContent(cached));
        }
        breakdownEl.classList.remove('hidden');
        article.classList.add('expanded');
      }
    } else {
      breakdownEl.classList.add('hidden');
      article.classList.remove('expanded');
    }
  }

  // ============================================================
  // PHASE 1: Navigation Boundary
  // ============================================================

  /**
   * Entry point for navigation changes.
   * Increments navToken, aborts in-flight work, resets state, shows loading.
   */
  private beginNavigation(): void {
    // Increment navigation token to invalidate all in-flight work
    this.navToken += 1;
    const token = this.navToken;

    console.debug('[Panel] beginNavigation', { navToken: token });

    // Abort any in-flight operations
    this.abortController?.abort();
    this.abortController = new AbortController();

    // Stop sync loop
    this.stopSyncLoop();

    // Reset state
    this.resetState();

    // Show loading
    this.controller.showLoading(true);
  }

  /**
   * Waits for the thread DOM to be ready.
   * Returns true if URL /status/{id} matches the primary DOM tweet id.
   * Times out after 8 seconds.
   */
  private async gateThreadReady(targetThreadId: string | null, token: number): Promise<boolean> {
    if (!targetThreadId) {
      return true;
    }

    const start = Date.now();
    const timeoutMs = 8000;
    const pollMs = 150;

    const getMainColumn = (): Element | null => {
      const mainSelector = this.platform.selectors.mainColumn;
      return document.querySelector(mainSelector)
        || document.querySelector('[role="main"]')
        || document.querySelector('main');
    };

    const postSelector = this.platform.selectors.postContainer;
    const getPrimaryTweetId = (): string | null => {
      const main = getMainColumn();
      if (!main) return null;

      // Get first article in main column (not nested)
      const articles = main.querySelectorAll(postSelector);
      for (const article of articles) {
        // Skip nested posts (quotes)
        if (article.parentElement?.closest(postSelector)) {
          continue;
        }
        const id = this.platform.extractPostIdFromElement(article);
        if (id) return id;
      }
      return null;
    };

    while (Date.now() - start < timeoutMs) {
      // Check if navigation was superseded
      if (token !== this.navToken) {
        console.debug('[Panel] gateThreadReady: navToken changed', { token, current: this.navToken });
        return false;
      }

      // Check if abort was requested
      if (this.abortController?.signal.aborted) {
        return false;
      }

      // Check if URL still matches
      const currentThreadId = extractPostId(window.location.href);
      if (currentThreadId !== targetThreadId) {
        console.debug('[Panel] gateThreadReady: URL changed', { targetThreadId, currentThreadId });
        return false;
      }

      // Check if primary tweet matches
      const primaryId = getPrimaryTweetId();
      console.debug('[Panel] gateThreadReady polling', { targetThreadId, primaryId });

      if (primaryId === targetThreadId) {
        return true;
      }

      const visibleIds = this.getMainColumnTweetIds();
      if (visibleIds.has(targetThreadId)) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    // Timeout - show error
    console.warn('[Panel] gateThreadReady: timeout', { targetThreadId });
    return false;
  }

  // ============================================================
  // PHASE 2: Sync Loop
  // ============================================================

  /**
   * Starts the sync loop with a MutationObserver on the main column.
   */
  private startSyncLoop(token: number): void {
    if (token !== this.navToken) return;

    this.stopSyncLoop();

    const mainSelector = this.platform.selectors.mainColumn;
    const main = document.querySelector(mainSelector)
      || document.querySelector('[role="main"]')
      || document.querySelector('main');

    if (!main) {
      console.warn('[Panel] startSyncLoop: no main column found');
      return;
    }

    console.debug('[Panel] startSyncLoop started', { token });

    // Set up MutationObserver
    this.syncObserver = new MutationObserver(() => {
      this.debouncedSync(token);
    });

    this.syncObserver.observe(main, {
      childList: true,
      subtree: true,
    });

    // Initial sync
    void this.sync(token);
  }

  /**
   * Stops the sync loop.
   */
  private stopSyncLoop(): void {
    if (this.syncObserver) {
      this.syncObserver.disconnect();
      this.syncObserver = null;
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
  }

  /**
   * Debounced sync call.
   */
  private debouncedSync(token: number): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      void this.sync(token);
    }, PanelIntegration.SYNC_DEBOUNCE_MS);
  }

  /**
   * Idempotent sync loop.
   * Scrapes main column, diffs by id, renders skeletons, translates new tweets.
   */
  private async sync(token: number): Promise<void> {
    // Check navToken at start
    if (token !== this.navToken) return;

    // Scrape main column only
    const visible = this.scrapeMainColumnTweets();
    const visibleIds = new Set(visible.map((t) => t.id));

    // Recheck navToken after scrape
    if (token !== this.navToken) return;

    console.debug('[Panel] sync', {
      visibleCount: visible.length,
      currentCount: this.currentTweets.size,
      token
    });

    // If panel just opened and no tweets found, show loading or empty
    if (visible.length === 0) {
      if (this.currentTweets.size === 0) {
        // Still waiting for tweets
        return;
      }
      // Tweets disappeared (navigation in progress?)
      this.controller.showLoading(true);
      return;
    }

    // Hide loading since we have tweets
    this.controller.showLoading(false);

    // Track if we made any changes
    let hasChanges = false;

    // Remove tweets no longer visible
    for (const id of this.currentTweets.keys()) {
      if (!visibleIds.has(id)) {
        this.currentTweets.delete(id);
        this.controller.removeTweet(id);
        hasChanges = true;
      }
    }

    // Add new tweets
    const newTweets: Tweet[] = [];
    for (const tweet of visible) {
      if (!this.currentTweets.has(tweet.id)) {
        this.currentTweets.set(tweet.id, tweet);
        this.controller.renderSkeleton(tweet);
        newTweets.push(tweet);
        hasChanges = true;
      }
    }

    // Reorder to match DOM
    this.controller.reorderTweets(visible.map((t) => t.id));

    // Only update tweetIndexById when tweets actually changed
    if (hasChanges) {
      this.controller.setTweets(visible, this.activeSourceUrl || window.location.href);
      this.tweets = visible;
    }

    // Translate new tweets
    for (const tweet of newTweets) {
      void this.translateAndRender(tweet, token);
    }
  }

  /**
   * Gets the set of tweet IDs visible in the main column (not nested/quotes).
   */
  private getMainColumnTweetIds(): Set<string> {
    const mainSelector = this.platform.selectors.mainColumn;
    const main = document.querySelector(mainSelector)
      || document.querySelector('[role="main"]')
      || document.querySelector('main');

    if (!main) {
      return new Set();
    }

    const ids = new Set<string>();
    const postSelector = this.platform.selectors.postContainer;
    const articles = main.querySelectorAll(postSelector);

    for (const article of articles) {
      // Skip nested posts (quotes)
      if (article.parentElement?.closest(postSelector)) {
        continue;
      }

      const id = this.platform.extractPostIdFromElement(article);
      if (id) {
        ids.add(id);
      }
    }

    return ids;
  }

  /**
   * Scrapes tweets from the main column only.
   * Uses the original scrapeTweets() to preserve grouping metadata (for connecting lines),
   * then filters to only tweets visible in the main column.
   */
  private scrapeMainColumnTweets(): Tweet[] {
    // First, get the set of IDs visible in main column
    const mainColumnIds = this.getMainColumnTweetIds();

    if (mainColumnIds.size === 0) {
      return [];
    }

    // Use original scraper to get rich metadata (grouping, etc.)
    const result = scrapeTweets({
      commentLimit: this.commentLimit,
    });

    // Filter to only tweets in main column, preserving order
    return result.tweets.filter((tweet) => mainColumnIds.has(tweet.id));
  }

  /**
   * Checks all rejection rules before rendering.
   * Returns false if render should be rejected.
   */
  private shouldRender(tweetId: string, token: number): boolean {
    // REQ: navToken must match
    if (token !== this.navToken) return false;

    // REQ: tweet must still be visible
    if (!this.currentTweets.has(tweetId)) return false;

    // REQ: panel must be open
    if (!this.controller.isOpen()) return false;

    // REQ: sourceUrl must match current URL
    if (this.activeSourceUrl && window.location.href !== this.activeSourceUrl) return false;

    // REQ: sourceThreadId must match current URL thread ID
    if (this.activeThreadId) {
      const currentThreadId = extractPostId(window.location.href);
      if (currentThreadId !== this.activeThreadId) return false;
      // Note: We do NOT check primaryDomId here because when viewing a child tweet,
      // Twitter shows parent tweets above it for context. The URL points to the child,
      // but the first DOM tweet is the parent. The gate already verified thread readiness.
    }

    return true;
  }

  /**
   * Translates a tweet and renders it.
   * Cache-aware: uses cached translation if available.
   * Visibility-checked: verifies tweet still visible, navToken, URL, and threadId match before render.
   */
  private async translateAndRender(tweet: Tweet, token: number): Promise<void> {
    console.debug('[Panel] translateAndRender start', {
      tweetId: tweet.id,
      token,
      navToken: this.navToken,
      shouldRender: this.shouldRender(tweet.id, token),
      activeThreadId: this.activeThreadId,
      currentUrl: window.location.href,
    });

    // Check cache first
    const cached = this.controller.getCachedTranslation(tweet.id);
    if (cached) {
      // Verify still valid before render
      if (!this.shouldRender(tweet.id, token)) {
        console.debug('[Panel] translateAndRender: cached but shouldRender=false', { tweetId: tweet.id });
        return;
      }

      this.controller.updateTweet(tweet, cached);
      return;
    }

    // Prevent duplicate translation requests
    if (this.translationsInFlight.has(tweet.id)) {
      console.debug('[Panel] translateAndRender: already in flight', { tweetId: tweet.id });
      return;
    }
    this.translationsInFlight.add(tweet.id);

    try {
      if (!this.apiKey) {
        // Try to get API key
        const settings = (await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_SETTINGS,
        })) as { apiKey?: string; commentLimit?: number };

        if (token !== this.navToken) return;

        if (!settings?.apiKey) {
          this.controller.showError('Please set your API key in the extension settings');
          return;
        }
        this.apiKey = settings.apiKey;
        this.commentLimit = settings.commentLimit;
      }

      // Translate single tweet
      await translateQuickStreaming([tweet], this.apiKey, {
        signal: this.abortController?.signal,
        onTranslation: (translation) => {
          console.debug('[Panel] onTranslation', {
            tweetId: translation.id,
            token,
            navToken: this.navToken,
            shouldRender: this.shouldRender(tweet.id, token),
          });

          // Verify all rejection rules before render
          if (!this.shouldRender(tweet.id, token)) {
            console.debug('[Panel] onTranslation: rejected by shouldRender', { tweetId: tweet.id });
            return;
          }

          const cachedTranslation: CachedTranslation = {
            id: translation.id,
            naturalTranslation: translation.naturalTranslation,
            segments: [],
            notes: [],
          };
          this.controller.cacheTranslation(translation.id, cachedTranslation);
          this.controller.updateTweet(tweet, cachedTranslation);
          console.debug('[Panel] onTranslation: updateTweet called', { tweetId: tweet.id });
        },
        onComplete: async (usage) => {
          this.controller.addUsage(usage);
          this.controller.updateFooter();

          await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.RECORD_USAGE,
            data: {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            },
          });
        },
        onError: (error) => {
          console.warn('[Panel] onError', { tweetId: tweet.id, error: error.message });
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.warn('[Panel] translateAndRender error', error);
    } finally {
      this.translationsInFlight.delete(tweet.id);
    }
  }

  // ============================================================
  // URL Change Handler (Entry Point)
  // ============================================================

  private handleUrlChange(newUrl: string): void {
    if (!this.controller.isOpen()) {
      return;
    }

    // Update platform based on new URL
    this.platform = getCurrentPlatform() ?? twitterPlatform;

    console.debug('[Panel] URL changed', {
      newUrl,
      threadId: extractPostId(newUrl),
    });

    // Start navigation flow
    this.beginNavigation();
    const token = this.navToken;

    if (!isThreadUrl(newUrl)) {
      this.controller.showLoading(false);
      this.controller.showEmptyState();
      this.controller.setLoadMoreEnabled(false);
      return;
    }

    const targetThreadId = extractPostId(newUrl);
    this.activeSourceUrl = newUrl;
    this.activeThreadId = targetThreadId;

    // Gate on thread readiness, then start sync loop
    void this.gateAndSync(targetThreadId, token);
  }

  /**
   * Gates on thread readiness then starts sync loop.
   */
  private async gateAndSync(targetThreadId: string | null, token: number): Promise<void> {
    // Get API key first
    try {
      const settings = (await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS,
      })) as { apiKey?: string; commentLimit?: number };

      if (token !== this.navToken) return;

      if (!settings?.apiKey) {
        this.controller.showLoading(false);
        this.controller.showError('Please set your API key in the extension settings');
        this.controller.setLoadMoreEnabled(false);
        return;
      }

      this.apiKey = settings.apiKey;
      this.commentLimit = settings.commentLimit;
    } catch {
      if (token !== this.navToken) return;
      this.controller.showLoading(false);
      this.controller.showError('Failed to load settings');
      return;
    }

    // Wait for thread to be ready
    const ready = await this.gateThreadReady(targetThreadId, token);

    if (token !== this.navToken) return;

    if (!ready) {
      this.controller.showLoading(false);
      this.controller.showError('Unable to detect thread. Please refresh the page.');
      this.controller.setLoadMoreEnabled(false);
      return;
    }

    // Start sync loop
    this.controller.setLoadMoreEnabled(true);
    this.startSyncLoop(token);
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Toggles the panel open/closed.
   */
  toggle(): void {
    const wasOpen = this.controller.isOpen();
    this.controller.toggle();
    const isPanelOpen = this.controller.isOpen();

    if (isPanelOpen) {
      this.platform = getCurrentPlatform() ?? twitterPlatform;
      this.urlWatcher.start();
      if (isThreadUrl(window.location.href)) {
        this.handleUrlChange(window.location.href);
      } else {
        this.controller.showEmptyState();
        this.controller.setLoadMoreEnabled(false);
      }
    } else if (wasOpen) {
      this.urlWatcher.stop();
      this.stopSyncLoop();
      this.resetState();
    }
  }

  /**
   * Opens the panel.
   */
  open(): void {
    if (!this.controller.isOpen()) {
      this.toggle();
    }
  }

  /**
   * Closes the panel.
   */
  close(): void {
    if (this.controller.isOpen()) {
      this.toggle();
    }
  }

  /**
   * Returns whether the panel is open.
   */
  isOpen(): boolean {
    return this.controller.isOpen();
  }

  /**
   * Destroys the integration and cleans up.
   */
  destroy(): void {
    this.stopSyncLoop();
    this.urlWatcher.stop();
    this.controller.destroy();
  }

  private resetState(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.activeSourceUrl = null;
    this.activeThreadId = null;
    this.breakdownsInFlight.clear();
    this.tweets = [];
    this.currentTweets.clear();
    this.translationsInFlight.clear();
    this.controller.resetState();
    this.controller.setLoadMoreEnabled(false);
  }

  /**
   * Manual load more (optional feature).
   */
  private async loadMoreReplies(): Promise<void> {
    if (!this.controller.isOpen()) {
      return;
    }

    if (window.location.href !== this.activeSourceUrl) {
      this.handleUrlChange(window.location.href);
      return;
    }

    if (!isThreadUrl(window.location.href)) {
      this.controller.showEmptyState();
      return;
    }

    if (!this.apiKey) {
      this.controller.showError('Please set your API key in the extension settings');
      return;
    }

    const token = this.navToken;

    this.controller.setLoadMoreEnabled(false);
    this.controller.showLoading(true);

    try {
      const knownIds = Array.from(this.controller.getKnownTweetIds());
      const response = (await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.SCRAPE_MORE,
        data: {
          url: window.location.href,
          commentLimit: this.commentLimit,
          excludeIds: knownIds,
          scrollToLoadMore: true,
          scrollMaxRounds: 8,
          scrollIdleRounds: 2,
        },
      })) as { success: boolean; tweets?: Tweet[]; error?: string };

      if (token !== this.navToken) return;

      if (!response?.success || !response.tweets) {
        this.controller.showError(response?.error || 'Failed to load more replies');
        return;
      }

      // Trigger a sync to pick up any new tweets
      void this.sync(token);
    } finally {
      if (token === this.navToken) {
        this.controller.showLoading(false);
        this.controller.setLoadMoreEnabled(true);
      }
    }
  }
}
