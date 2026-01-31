/**
 * Panel Integration
 * Ties together the panel controller, URL watcher, and scraper for a complete
 * side panel experience on Twitter pages.
 */

import { PanelController, CachedTranslation } from './panelController';
import { UrlWatcher, isTwitterThreadUrl, extractThreadId } from './urlWatcher';
import { MESSAGE_TYPES } from '../messages';
import { scrapeTweets, Tweet } from '../scraper';
import { translateQuickStreaming, getBreakdown, Breakdown } from '../translator';
import { renderBreakdownContent } from './breakdown';

export class PanelIntegration {
  private controller: PanelController;
  private urlWatcher: UrlWatcher;
  private apiKey = '';
  private tweets: Tweet[] = [];
  private breakdownCache: Map<string, Breakdown> = new Map();
  private commentLimit: number | undefined;

  constructor() {
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
        if (!this.apiKey) {
          breakdownInner.innerHTML = '<div class="breakdown-error">API key is required for breakdowns</div>';
          breakdownEl.classList.remove('hidden');
          article.classList.add('expanded');
          return;
        }
        // Show loading state
        breakdownInner.innerHTML = '<div class="breakdown-loading">Loading breakdown...</div>';
        breakdownEl.classList.remove('hidden');
        article.classList.add('expanded');

        try {
          const opTweet = this.tweets[0];
          const result = await getBreakdown(tweet.text, this.apiKey, {
            opAuthor: opTweet?.author,
            opText: opTweet?.text,
            opUrl: opTweet?.url,
          });

          // Update usage stats
          this.controller.addUsage(result.usage);
          this.controller.updateFooter();

          // Record additional usage
          await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.RECORD_USAGE,
            data: {
              inputTokens: result.usage.inputTokens,
              outputTokens: result.usage.outputTokens,
            },
          });

          // Cache the breakdown
          this.breakdownCache.set(tweet.id, result.breakdown);
          this.controller.cacheTranslation(tweet.id, {
            id: tweet.id,
            naturalTranslation: cachedTranslation?.naturalTranslation ?? '',
            segments: result.breakdown.segments,
            notes: result.breakdown.notes,
          });

          // Render breakdown using the shared renderer
          breakdownInner.innerHTML = '';
          breakdownInner.appendChild(renderBreakdownContent(result.breakdown));
        } catch (error) {
          breakdownInner.innerHTML = `<div class="breakdown-error">Failed to load breakdown: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
        }
      } else {
        // Use cached breakdown
        const cached = this.breakdownCache.get(tweet.id)!;
        if (breakdownInner.children.length === 0 || breakdownInner.querySelector('.breakdown-loading')) {
          breakdownInner.innerHTML = '';
          breakdownInner.appendChild(renderBreakdownContent(cached));
        }
        breakdownEl.classList.remove('hidden');
        article.classList.add('expanded');
      }
    } else {
      // Collapse
      breakdownEl.classList.add('hidden');
      article.classList.remove('expanded');
    }
  }

  private handleUrlChange(newUrl: string): void {
    if (!this.controller.isOpen()) {
      return;
    }

    console.debug('[Panel] URL changed', {
      newUrl,
      threadId: extractThreadId(newUrl),
    });

    if (isTwitterThreadUrl(newUrl)) {
      // Clear and re-translate
      this.controller.clearTweets();
      this.controller.clearCache();
      this.controller.resetUsage();
      this.breakdownCache.clear();
      this.tweets = [];
      void this.scrapeAndTranslate();
    } else {
      // Show empty state for non-thread pages
      this.controller.showEmptyState();
      this.controller.setLoadMoreEnabled(false);
    }
  }

  /**
   * Toggles the panel open/closed.
   */
  toggle(): void {
    const wasOpen = this.controller.isOpen();
    this.controller.toggle();
    const isOpen = this.controller.isOpen();

    if (isOpen) {
      this.urlWatcher.start();
      // Check if we're on a thread page
      if (isTwitterThreadUrl(window.location.href)) {
        void this.scrapeAndTranslate();
      } else {
        this.controller.showEmptyState();
        this.controller.setLoadMoreEnabled(false);
      }
    } else if (wasOpen) {
      this.urlWatcher.stop();
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
   * Scrapes the current page and translates content.
   */
  private async scrapeAndTranslate(): Promise<void> {
    this.controller.showLoading(true);

    try {
      const targetUrl = window.location.href;
      const targetThreadId = extractThreadId(targetUrl);

      console.debug('[Panel] Starting scrape', {
        targetUrl,
        targetThreadId,
      });

      // Get settings
      const settings = (await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS,
      })) as { apiKey?: string; commentLimit?: number };

      if (!settings?.apiKey) {
        this.controller.showLoading(false);
        this.controller.showError('Please set your API key in the extension settings');
        this.controller.setLoadMoreEnabled(false);
        return;
      }

      this.apiKey = settings.apiKey;
      this.commentLimit = settings.commentLimit;

      const getPrimaryStatusId = (article: Element | null): string | null => {
        if (!article) return null;
        const timeLinks = Array.from(article.querySelectorAll('time'))
          .map((timeEl) => timeEl.closest('a[href*="/status/"]'))
          .filter((link): link is HTMLAnchorElement => !!link);

        for (const link of timeLinks) {
          if (link.closest('article[data-testid="tweet"]') === article) {
            const href = link.getAttribute('href') ?? '';
            const match = href.match(/\/status\/(\d+)/);
            return match ? match[1] : null;
          }
        }

        const links = Array.from(article.querySelectorAll('a[href*="/status/"]'))
          .filter((link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement)
          .filter((link) => link.closest('article[data-testid="tweet"]') === article);
        const href = links[0]?.getAttribute('href') ?? '';
        const match = href.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
      };

      const getThreadIdsInDom = (limit = 12): string[] => {
        const items = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
          .filter((article) => !article.parentElement?.closest('article[data-testid="tweet"]'));
        const ids: string[] = [];
        for (const article of items) {
          const id = getPrimaryStatusId(article);
          if (id) {
            ids.push(id);
            if (ids.length >= limit) break;
          }
        }
        return ids;
      };

      const ensureThreadReady = async (): Promise<boolean> => {
        if (!targetThreadId) {
          return true;
        }

        const start = Date.now();
        const timeoutMs = 8000;
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const getFirstTweetId = (): string | null => {
          const first = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
            .find((article) => !article.parentElement?.closest('article[data-testid="tweet"]')) ?? null;
          return getPrimaryStatusId(first);
        };

        while (Date.now() - start < timeoutMs) {
          if (extractThreadId(window.location.href) !== targetThreadId) {
            console.debug('[Panel] Thread changed during wait', {
              currentUrl: window.location.href,
              targetThreadId,
            });
            return false;
          }
          const firstId = getFirstTweetId();
          const tweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
          const domIds = getThreadIdsInDom();
          console.debug('[Panel] Wait for thread DOM', {
            targetThreadId,
            firstId,
            tweetCount,
            domIds: domIds.slice(0, 6),
          });
          // Only match when the FIRST tweet is the target thread (not just present somewhere in DOM)
          if (firstId === targetThreadId) {
            return true;
          }
          await sleep(200);
        }

        return false;
      };

      let tweets: Tweet[] = [];
      let matchedThread = false;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ready = await ensureThreadReady();
        if (!ready) {
          break;
        }

        const result = scrapeTweets({
          commentLimit: settings.commentLimit,
        });

        tweets = result.tweets;
        console.debug('[Panel] Scrape attempt', {
          attempt,
          targetThreadId,
          firstScrapedId: tweets[0]?.id,
          count: tweets.length,
          scrapedIds: tweets.slice(0, 6).map((tweet) => tweet.id),
          scrapedUrls: tweets.slice(0, 3).map((tweet) => tweet.url),
          firstText: tweets[0]?.text?.slice(0, 120),
        });
        // Only match when the FIRST scraped tweet is the target thread
        const hasTarget = !targetThreadId
          || tweets[0]?.id === targetThreadId
          || (tweets[0]?.url ?? '').includes(`/status/${targetThreadId}`);

        if (hasTarget) {
          matchedThread = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (!matchedThread) {
        console.warn('[Panel] Target thread not detected in scrape, using current thread anyway', {
          targetThreadId,
          firstScrapedId: tweets[0]?.id,
        });
      }

      if (tweets.length === 0) {
        this.controller.showLoading(false);
        this.controller.showEmptyState();
        this.controller.setLoadMoreEnabled(false);
        return;
      }

      this.tweets = tweets;
      this.controller.setTweets(tweets, targetUrl);
      this.controller.setLoadMoreEnabled(true);

      // Translate the tweets
      await translateQuickStreaming(tweets, this.apiKey, {
        onTranslation: (translation) => {
          const tweet = tweets.find((t) => t.id === translation.id);
          if (tweet) {
            const cached: CachedTranslation = {
              id: translation.id,
              naturalTranslation: translation.naturalTranslation,
              segments: [],
              notes: [],
            };
            this.controller.cacheTranslation(translation.id, cached);
            this.controller.renderTweet(tweet, cached);
          }
          // Hide loading after first result
          this.controller.showLoading(false);
        },
        onComplete: async (usage) => {
          this.controller.showLoading(false);
          this.controller.addUsage(usage);
          this.controller.updateFooter();

          // Record usage
          await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.RECORD_USAGE,
            data: {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            },
          });

        },
        onError: (error) => {
          this.controller.showLoading(false);
          this.controller.showError(error.message);
        },
      });
    } catch (error) {
      this.controller.showLoading(false);
      this.controller.showError(error instanceof Error ? error.message : 'Translation failed');
      this.controller.setLoadMoreEnabled(false);
    }
  }

  /**
   * Destroys the integration and cleans up.
   */
  destroy(): void {
    this.urlWatcher.stop();
    this.controller.destroy();
  }

  private resetState(): void {
    this.controller.resetState();
    this.controller.setLoadMoreEnabled(false);
    this.breakdownCache.clear();
    this.tweets = [];
  }

  private async loadMoreReplies(): Promise<void> {
    if (!this.controller.isOpen()) {
      return;
    }

    if (!isTwitterThreadUrl(window.location.href)) {
      this.controller.showEmptyState();
      return;
    }

    if (!this.apiKey) {
      this.controller.showError('Please set your API key in the extension settings');
      return;
    }

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

      if (!response?.success || !response.tweets) {
        this.controller.showError(response?.error || 'Failed to load more replies');
        return;
      }

      const newTweets = response.tweets.filter((tweet) => !knownIds.includes(tweet.id));
      if (newTweets.length === 0) {
        return;
      }

      this.tweets = [...this.tweets, ...newTweets];
      this.controller.setTweets(this.tweets, window.location.href);

      const cachedTranslations: CachedTranslation[] = [];
      const toTranslate: Tweet[] = [];

      for (const tweet of newTweets) {
        const cached = this.controller.getCachedTranslation(tweet.id);
        if (cached) {
          cachedTranslations.push(cached);
        } else {
          toTranslate.push(tweet);
        }
      }

      cachedTranslations.forEach((translation) => {
        const tweet = newTweets.find((t) => t.id === translation.id);
        if (tweet) {
          this.controller.renderTweet(tweet, translation);
        }
      });

      if (toTranslate.length === 0) {
        return;
      }

      await translateQuickStreaming(toTranslate, this.apiKey, {
        onTranslation: (translation) => {
          const tweet = toTranslate.find((t) => t.id === translation.id);
          if (!tweet) return;
          const cached: CachedTranslation = {
            id: translation.id,
            naturalTranslation: translation.naturalTranslation,
            segments: [],
            notes: [],
          };
          this.controller.cacheTranslation(translation.id, cached);
          this.controller.renderTweet(tweet, cached);
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
          this.controller.showError(error.message);
        },
      });
    } finally {
      this.controller.showLoading(false);
      this.controller.setLoadMoreEnabled(true);
    }
  }
}

