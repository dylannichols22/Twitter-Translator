/**
 * Panel Controller for Twitter Translator
 * Manages the translation panel state and coordinates between the panel UI and translation logic.
 */

import { SidePanel, destroyPanel } from './panel';
import { injectPanelStyles, removePanelStyles } from './panel.css';
import { renderTweet as renderTweetCard } from './translate';
import type { Tweet } from '../scraper';
import type { TranslatedTweet, UsageStats, QuickTranslation } from '../translator';

export interface CachedTranslation {
  id: string;
  naturalTranslation: string;
  segments: Array<{ chinese: string; pinyin: string; gloss: string }>;
  notes: string[];
}

export class PanelController {
  private panel: SidePanel;
  private tweets: Tweet[] = [];
  private sourceUrl = '';
  private translationCache: Map<string, CachedTranslation> = new Map();
  private usage: UsageStats = { inputTokens: 0, outputTokens: 0 };
  private knownTweetIds: Set<string> = new Set();
  private loadMoreCallback: (() => void) | null = null;
  private loadMoreBtn: HTMLButtonElement | null = null;

  constructor() {
    injectPanelStyles();
    this.panel = new SidePanel();
  }

  /**
   * Opens the panel.
   */
  open(): void {
    this.panel.open();
  }

  /**
   * Closes the panel.
   */
  close(): void {
    this.panel.close();
  }

  /**
   * Toggles the panel open/closed state.
   */
  toggle(): void {
    this.panel.toggle();
  }

  /**
   * Returns whether the panel is open.
   */
  isOpen(): boolean {
    return this.panel.isOpen();
  }

  /**
   * Sets the tweets to display and the source URL.
   */
  setTweets(tweets: Tweet[], url: string): void {
    this.tweets = tweets;
    this.sourceUrl = url;
  }

  /**
   * Returns the current tweets.
   */
  getTweets(): Tweet[] {
    return this.tweets;
  }

  /**
   * Returns the current source URL.
   */
  getSourceUrl(): string {
    return this.sourceUrl;
  }

  /**
   * Clears all tweets.
   */
  clearTweets(): void {
    this.tweets = [];
    const content = this.panel.getContentContainer();
    if (content) {
      content.innerHTML = '';
    }
  }

  /**
   * Shows loading state.
   */
  showLoading(show: boolean): void {
    this.panel.showLoading(show);
  }

  /**
   * Shows an error message.
   */
  showError(message: string): void {
    this.panel.showError(message);
  }

  /**
   * Shows the empty state for non-thread pages.
   */
  showEmptyState(): void {
    this.panel.showEmptyState();
  }

  /**
   * Caches a translation by tweet ID.
   */
  cacheTranslation(id: string, translation: CachedTranslation): void {
    this.translationCache.set(id, translation);
  }

  /**
   * Gets a cached translation by tweet ID.
   */
  getCachedTranslation(id: string): CachedTranslation | undefined {
    return this.translationCache.get(id);
  }

  /**
   * Clears all cached translations.
   */
  clearCache(): void {
    this.translationCache.clear();
  }

  /**
   * Adds usage stats.
   */
  addUsage(usage: UsageStats): void {
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
  }

  /**
   * Gets the current usage stats.
   */
  getUsage(): UsageStats {
    return { ...this.usage };
  }

  /**
   * Resets usage stats.
   */
  resetUsage(): void {
    this.usage = { inputTokens: 0, outputTokens: 0 };
  }

  /**
   * Updates the footer with usage info.
   */
  updateFooter(): void {
    const totalTokens = this.usage.inputTokens + this.usage.outputTokens;
    this.panel.setFooterContent(`${totalTokens.toLocaleString()} tokens used`);
  }

  /**
   * Scrapes the current page and translates the content.
   * This is called when the panel is opened or the URL changes.
   */
  async scrapeAndTranslate(): Promise<void> {
    // This will be implemented to connect with the scraper and translator
    // For now, just show loading
    this.showLoading(true);

    try {
      // Get settings
      const settings = await browser.runtime.sendMessage({
        type: 'GET_SETTINGS',
      });

      if (!settings?.apiKey) {
        this.showError('Please set your API key in the extension settings');
        return;
      }

      // For now, this is a placeholder that will be connected to the scraper
      this.showLoading(false);
    } catch (error) {
      this.showLoading(false);
      this.showError(error instanceof Error ? error.message : 'Translation failed');
    }
  }

  /**
   * Returns the panel content container.
   */
  getContentContainer(): HTMLElement | null {
    return this.panel.getContentContainer();
  }

  /**
   * Renders a single tweet with its translation.
   */
  renderTweet(tweet: Tweet, translation: CachedTranslation | QuickTranslation): void {
    const container = this.getContentContainer();
    if (!container) return;

    const element = renderTweetCard(tweet, translation);
    container.appendChild(element);
    this.knownTweetIds.add(tweet.id);
  }

  /**
   * Renders multiple tweets with their translations.
   */
  renderTweets(tweets: Tweet[], translations: CachedTranslation[]): void {
    const container = this.getContentContainer();
    if (!container) return;

    container.innerHTML = '';
    this.knownTweetIds.clear();

    for (const tweet of tweets) {
      const translation = translations.find((t) => t.id === tweet.id);
      if (translation) {
        this.renderTweet(tweet, translation);
      }
    }
  }

  /**
   * Returns whether the load more button is currently shown.
   */
  hasLoadMoreButton(): boolean {
    return this.loadMoreBtn !== null && this.loadMoreBtn.parentElement !== null;
  }

  /**
   * Shows or hides the load more button.
   */
  showLoadMoreButton(show: boolean): void {
    const container = this.getContentContainer();
    if (!container) return;

    if (show) {
      if (!this.loadMoreBtn) {
        this.loadMoreBtn = document.createElement('button');
        this.loadMoreBtn.className = 'load-more-btn';
        this.loadMoreBtn.type = 'button';
        this.loadMoreBtn.textContent = 'Load more replies';
        this.loadMoreBtn.addEventListener('click', () => {
          if (this.loadMoreCallback) {
            this.loadMoreCallback();
          }
        });
      }
      if (!this.loadMoreBtn.parentElement) {
        container.appendChild(this.loadMoreBtn);
      }
    } else {
      if (this.loadMoreBtn && this.loadMoreBtn.parentElement) {
        this.loadMoreBtn.remove();
      }
    }
  }

  /**
   * Sets the callback for when load more is clicked.
   */
  setLoadMoreCallback(callback: () => void): void {
    this.loadMoreCallback = callback;
  }

  /**
   * Enables or disables the load more button.
   */
  disableLoadMoreButton(disable: boolean): void {
    if (this.loadMoreBtn) {
      this.loadMoreBtn.disabled = disable;
    }
  }

  /**
   * Appends new tweets without removing existing ones.
   * Skips tweets that are already rendered.
   */
  appendTweets(tweets: Tweet[], translations: CachedTranslation[]): void {
    for (const tweet of tweets) {
      if (this.knownTweetIds.has(tweet.id)) {
        continue;
      }
      const translation = translations.find((t) => t.id === tweet.id);
      if (translation) {
        this.renderTweet(tweet, translation);
      }
    }
  }

  /**
   * Returns the set of known tweet IDs.
   */
  getKnownTweetIds(): Set<string> {
    return new Set(this.knownTweetIds);
  }

  /**
   * Destroys the panel and clears all state.
   */
  destroy(): void {
    this.panel.destroy();
    this.tweets = [];
    this.sourceUrl = '';
    this.translationCache.clear();
    this.usage = { inputTokens: 0, outputTokens: 0 };
    removePanelStyles();
  }
}
