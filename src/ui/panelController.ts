/**
 * Panel Controller for Twitter Translator
 * Manages the translation panel state and coordinates between the panel UI and translation logic.
 */

import { SidePanel } from './panel';
import { injectPanelStyles, removePanelStyles } from './panel.css';
import { renderTweet as renderTweetCard } from './translate';
import type { Tweet } from '../scraper';
import type { UsageStats, QuickTranslation } from '../translator';

export interface CachedTranslation {
  id: string;
  naturalTranslation: string;
  segments: Array<{ chinese: string; pinyin: string; gloss: string }>;
  notes: string[];
}

export type BreakdownToggleCallback = (
  article: HTMLElement,
  breakdown: HTMLElement,
  tweet: Tweet
) => void;

export class PanelController {
  private panel: SidePanel;
  private tweets: Tweet[] = [];
  private sourceUrl = '';
  private translationCache: Map<string, CachedTranslation> = new Map();
  private usage: UsageStats = { inputTokens: 0, outputTokens: 0 };
  private knownTweetIds: Set<string> = new Set();
  private breakdownToggleCallback: BreakdownToggleCallback | null = null;
  private tweetIndexById: Map<string, number> = new Map();

  constructor() {
    injectPanelStyles();
    this.panel = new SidePanel();
    this.setLoadMoreEnabled(false);
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
    this.tweetIndexById = new Map(tweets.map((tweet, index) => [tweet.id, index]));
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
    this.knownTweetIds.clear();
    this.tweetIndexById.clear();
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

    const onToggleBreakdown = this.breakdownToggleCallback
      ? (article: HTMLElement, breakdown: HTMLElement) => {
          this.breakdownToggleCallback!(article, breakdown, tweet);
        }
      : undefined;

    const element = renderTweetCard(tweet, translation, onToggleBreakdown);
    const targetIndex = this.tweetIndexById.get(tweet.id);
    if (typeof targetIndex !== 'number') {
      container.appendChild(element);
    } else {
      const cards = Array.from(container.querySelectorAll<HTMLElement>('.tweet-card'));
      const next = cards.find((card) => {
        const id = card.dataset.tweetId ?? '';
        const index = this.tweetIndexById.get(id);
        return typeof index === 'number' && index > targetIndex;
      });
      if (next) {
        container.insertBefore(element, next);
      } else {
        container.appendChild(element);
      }
    }
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
    this.tweetIndexById = new Map(tweets.map((tweet, index) => [tweet.id, index]));

    for (const tweet of tweets) {
      const translation = translations.find((t) => t.id === tweet.id);
      if (translation) {
        this.renderTweet(tweet, translation);
      }
    }
  }

  /**
   * Sets the callback for when breakdown is toggled.
   */
  setBreakdownToggleCallback(callback: BreakdownToggleCallback): void {
    this.breakdownToggleCallback = callback;
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
      if (!this.tweetIndexById.has(tweet.id)) {
        this.tweetIndexById.set(tweet.id, this.tweetIndexById.size);
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
    this.knownTweetIds.clear();
    this.tweetIndexById.clear();
    this.usage = { inputTokens: 0, outputTokens: 0 };
    removePanelStyles();
  }

  resetState(): void {
    this.clearTweets();
    this.clearCache();
    this.resetUsage();
    this.sourceUrl = '';
    this.panel.setFooterContent('');
  }

  setLoadMoreHandler(handler: (() => void) | null): void {
    const button = this.panel.getLoadMoreButton();
    if (!button) return;
    button.onclick = handler;
  }

  setLoadMoreEnabled(enabled: boolean): void {
    const button = this.panel.getLoadMoreButton();
    if (!button) return;
    button.disabled = !enabled;
  }
}
