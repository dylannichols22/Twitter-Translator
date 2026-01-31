import { MESSAGE_TYPES } from '../messages';
import { translateQuickStreaming, getBreakdown } from '../translator';
import type { QuickTranslation, Breakdown, UsageStats, TranslatedTweet } from '../translator';
import type { Tweet } from '../scraper';
import { estimateCost, calculateCost } from '../cost';
import { formatCost } from '../popup/popup';
import { renderSkeletonContainer } from './skeleton';
import {
  renderSegmentTable,
  renderNotes,
  groupSegmentsForTables,
  renderBreakdownContent,
} from './breakdown';
import { createPostSaveButton } from './saveButton';

export { renderSegmentTable, renderNotes, groupSegmentsForTables };

const getGutterClass = (tweet: Tweet): string => {
  const hasGroupStart = typeof tweet.groupStart === 'boolean';
  const hasGroupEnd = typeof tweet.groupEnd === 'boolean';
  if (!hasGroupStart && !hasGroupEnd) return '';
  const start = tweet.groupStart ?? false;
  const end = tweet.groupEnd ?? false;
  if (start && end) return 'gutter-single';
  if (start) return 'gutter-start';
  if (end) return 'gutter-end';
  return 'gutter-middle';
};

export function renderTweet(
  tweet: Tweet,
  translation: QuickTranslation | TranslatedTweet,
  onToggleBreakdown?: (article: HTMLElement, breakdown: HTMLElement) => void
): HTMLElement {
  const formatTimestamp = (timestampValue: string): string => {
    if (!timestampValue) return '';
    const parsed = new Date(timestampValue);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
  };

  const article = document.createElement('article');
  const inlineClass = tweet.inlineReply ? 'inline-reply' : '';
  const hasRepliesClass = tweet.hasReplies ? 'has-replies' : '';
  const isReplyClass = !tweet.isMainPost ? 'is-reply' : '';
  const groupStartClass = tweet.groupStart ? 'group-start' : '';
  const groupEndClass = tweet.groupEnd ? 'group-end' : '';
  const gutterClass = getGutterClass(tweet);
  article.className = `tweet-card ${tweet.isMainPost ? 'main-post' : 'reply'} ${inlineClass} ${hasRepliesClass} ${isReplyClass} ${groupStartClass} ${groupEndClass} ${gutterClass}`.trim().replace(/\s+/g, ' ');
  article.dataset.tweetId = tweet.id;

  // Header (clickable to expand)
  const shell = document.createElement('div');
  shell.className = 'tweet-shell';

  const avatar = document.createElement('div');
  avatar.className = 'tweet-avatar';
  const initials = (tweet.author || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
  avatar.textContent = initials;
  shell.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'tweet-body';

  const header = document.createElement('div');
  header.className = 'tweet-header';

  const author = document.createElement('span');
  author.className = 'tweet-author';
  author.textContent = tweet.author || 'Unknown';
  header.appendChild(author);

  const timestamp = document.createElement('span');
  timestamp.className = 'tweet-timestamp';
  const formattedTimestamp = formatTimestamp(tweet.timestamp);
  if (formattedTimestamp) {
    timestamp.textContent = formattedTimestamp;
  }
  header.appendChild(timestamp);

  body.appendChild(header);

  // Translation
  const translationEl = document.createElement('div');
  translationEl.className = 'tweet-translation';
  translationEl.textContent = translation.naturalTranslation;
  body.appendChild(translationEl);

  // Original text
  const original = document.createElement('div');
  original.className = 'tweet-original';
  original.textContent = tweet.text;
  body.appendChild(original);

  // Breakdown container (initially hidden) with inner wrapper for CSS grid animation
  const breakdown = document.createElement('div');
  breakdown.className = 'tweet-breakdown hidden';
  const breakdownInner = document.createElement('div');
  breakdownInner.className = 'breakdown-inner';
  breakdown.appendChild(breakdownInner);
  body.appendChild(breakdown);

  if ('segments' in translation && 'notes' in translation) {
    const breakdownContent = renderBreakdownContent({
      segments: translation.segments,
      notes: translation.notes,
    });
    breakdownInner.appendChild(breakdownContent);
  }

  const defaultToggle = () => {
    const isHidden = breakdown.classList.contains('hidden');
    breakdown.classList.toggle('hidden', !isHidden);
    article.classList.toggle('expanded', isHidden);
  };

  header.addEventListener('click', () => {
    if (onToggleBreakdown) {
      onToggleBreakdown(article, breakdown);
      return;
    }
    defaultToggle();
  });

  const actions = document.createElement('div');
  actions.className = 'tweet-actions';

  const breakdownToggle = document.createElement('button');
  breakdownToggle.className = 'tweet-action-btn tweet-breakdown-toggle';
  breakdownToggle.type = 'button';
  breakdownToggle.textContent = 'Breakdown';
  breakdownToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (onToggleBreakdown) {
      onToggleBreakdown(article, breakdown);
      return;
    }
    defaultToggle();
  });
  actions.appendChild(breakdownToggle);

  // Add Save Post button if we have segments
  if ('segments' in translation && translation.segments.length > 0) {
    const savePostBtn = createPostSaveButton({
      segments: translation.segments.map((s) => ({
        chinese: s.chinese,
        pinyin: s.pinyin,
        gloss: s.gloss,
      })),
      notes: 'notes' in translation ? translation.notes : [],
      naturalTranslation: translation.naturalTranslation,
      metadata: {
        tweetId: tweet.id,
        tweetUrl: tweet.url,
        author: tweet.author,
        timestamp: tweet.timestamp,
      },
    });
    actions.appendChild(savePostBtn);
  }

  body.appendChild(actions);

  shell.appendChild(body);
  article.appendChild(shell);

  return article;
}

export class TranslateViewController {
  private tweetsContainer: HTMLElement | null;
  private loadingEl: HTMLElement | null;
  private errorEl: HTMLElement | null;
  private estimatedCostEl: HTMLElement | null;
  private tweets: Tweet[] = [];
  private sourceUrl = '';
  private apiKey = '';
  private totalUsage: UsageStats = { inputTokens: 0, outputTokens: 0 };
  private translatedIds: Set<string> = new Set();
  private knownTweetIds: Set<string> = new Set();
  private cachedTranslations: TranslatedTweet[] = [];
  private translationBuffer: Map<string, TranslatedTweet> = new Map();
  private tweetIndexById: Map<string, number> = new Map();
  private commentLimit: number | undefined;
  private initPromise: Promise<void>;
  private cachedTranslationById: Map<string, TranslatedTweet> = new Map();

  // Track which breakdowns have been loaded
  private breakdownCache: Map<string, Breakdown> = new Map();
  private currentlyExpanded: HTMLElement | null = null;

  constructor() {
    this.tweetsContainer = document.getElementById('tweets-container');
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error-message');
    this.estimatedCostEl = document.getElementById('estimated-cost');

    this.initPromise = this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    try {
      const params = new URLSearchParams(window.location.search);
      const payloadKey = params.get('payloadKey');

      if (payloadKey && typeof browser !== 'undefined') {
        const payloadStorage = browser.storage?.session ?? browser.storage?.local;
        const result = payloadStorage ? await payloadStorage.get([payloadKey]) : {};
        const data = (result as Record<string, unknown>)[payloadKey] as
          | { tweets?: Tweet[]; url?: string; sourceTabId?: number }
          | undefined;
        if (data) {
          this.setThreadData(data.tweets ?? [], data.url ?? '');
        }
        await payloadStorage?.remove(payloadKey);
        return;
      }

      const dataStr = params.get('data');
      if (dataStr) {
        let parsed: { tweets?: Tweet[]; url?: string; sourceTabId?: number } | null = null;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          parsed = JSON.parse(decodeURIComponent(dataStr));
        }
        if (parsed) {
          this.setThreadData(parsed.tweets ?? [], parsed.url ?? '');
        }
      }
    } catch (error) {
      console.error('Failed to parse URL params:', error);
    }
  }

  getTweets(): Tweet[] {
    return this.tweets;
  }

  showLoading(show: boolean): void {
    if (this.loadingEl) {
      this.loadingEl.classList.toggle('hidden', !show);
    }
    if (this.tweetsContainer) {
      if (show) {
        // Add skeleton cards for visual loading state
        this.tweetsContainer.appendChild(renderSkeletonContainer(3));
      } else {
        // Remove skeleton cards
        const skeletons = this.tweetsContainer.querySelectorAll('.tweet-skeleton');
        skeletons.forEach((skeleton) => skeleton.remove());
      }
    }
  }

  showError(message: string): void {
    if (this.errorEl) {
      this.errorEl.textContent = message;
      this.errorEl.classList.remove('hidden');
    }
  }

  showProgress(progress: { completed: number; total: number }): void {
    if (this.loadingEl) {
      const progressText = this.loadingEl.querySelector('.loading-progress');
      if (progressText) {
        if (progress.total > 0) {
          progressText.textContent = `Translating ${progress.completed} of ${progress.total}...`;
        } else {
          progressText.textContent = 'Translating content...';
        }
      }
    }
  }

  showEstimatedCost(): void {
    if (!this.estimatedCostEl || this.tweets.length === 0) return;

    const allText = this.tweets.map((t) => t.text).join('\n');
    const estimate = estimateCost(allText);

    this.estimatedCostEl.textContent = `Estimated cost: ${formatCost(estimate.estimatedCost)}`;
  }

  private updateCostDisplay(): void {
    if (this.estimatedCostEl) {
      const actualCost = calculateCost(this.totalUsage.inputTokens, this.totalUsage.outputTokens);
      this.estimatedCostEl.textContent = `Translation cost: ${formatCost(actualCost)}`;
    }
  }

  private renderQuickTweet(tweet: Tweet, translation: QuickTranslation): HTMLElement {
    return renderTweet(tweet, translation, (article, breakdown) => {
      void this.toggleBreakdown(article, tweet, breakdown);
    });
  }

  private renderCachedTweet(tweet: Tweet, translation: TranslatedTweet): HTMLElement {
    return renderTweet(tweet, translation, (article, breakdown) => {
      void this.toggleBreakdown(article, tweet, breakdown);
    });
  }

  private renderTranslationInOrder(tweet: Tweet, translation: QuickTranslation | TranslatedTweet): void {
    if (!this.tweetsContainer) return;
    const existing = this.tweetsContainer.querySelector(
      `.tweet-card[data-tweet-id="${tweet.id}"]`
    );
    if (existing) return;

    const element = 'segments' in translation
      ? this.renderCachedTweet(tweet, translation)
      : this.renderQuickTweet(tweet, translation);

    const targetIndex = this.tweetIndexById.get(tweet.id) ?? Number.MAX_SAFE_INTEGER;
    const cards = Array.from(this.tweetsContainer.querySelectorAll<HTMLElement>('.tweet-card'));
    const next = cards.find((card) => {
      const id = card.dataset.tweetId ?? '';
      const index = this.tweetIndexById.get(id) ?? Number.MAX_SAFE_INTEGER;
      return index > targetIndex;
    });

    if (next) {
      this.tweetsContainer.insertBefore(element, next);
    } else {
      this.tweetsContainer.appendChild(element);
    }
  }

  private async toggleBreakdown(article: HTMLElement, tweet: Tweet, breakdownEl: HTMLElement): Promise<void> {
    const isExpanding = breakdownEl.classList.contains('hidden');
    const cachedTranslation = this.cachedTranslationById.get(tweet.id);

    // Accordion: collapse currently expanded card if different
    if (isExpanding && this.currentlyExpanded && this.currentlyExpanded !== article) {
      const prevBreakdown = this.currentlyExpanded.querySelector('.tweet-breakdown');
      if (prevBreakdown) {
        prevBreakdown.classList.add('hidden');
        this.currentlyExpanded.classList.remove('expanded');
      }
    }

    if (isExpanding) {
      const breakdownInner = breakdownEl.querySelector('.breakdown-inner') || breakdownEl;

      // Check if breakdown already loaded
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
          this.totalUsage.inputTokens += result.usage.inputTokens;
          this.totalUsage.outputTokens += result.usage.outputTokens;
          this.updateCostDisplay();

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
          this.cachedTranslationById.set(tweet.id, {
            id: tweet.id,
            naturalTranslation: cachedTranslation?.naturalTranslation ?? '',
            segments: result.breakdown.segments,
            notes: result.breakdown.notes,
          });

          // Render breakdown
          breakdownInner.innerHTML = '';
          breakdownInner.appendChild(renderBreakdownContent(result.breakdown));
        } catch (error) {
          breakdownInner.innerHTML = `<div class="breakdown-error">Failed to load breakdown: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
        }
      } else {
        // Use cached breakdown
        const cached = this.breakdownCache.get(tweet.id)!;
        if (breakdownInner.children.length === 0) {
          breakdownInner.appendChild(renderBreakdownContent(cached));
        }
        breakdownEl.classList.remove('hidden');
        article.classList.add('expanded');
      }

      this.currentlyExpanded = article;
    } else {
      // Collapse
      breakdownEl.classList.add('hidden');
      article.classList.remove('expanded');
      this.currentlyExpanded = null;
    }
  }

  async translate(): Promise<void> {
    await this.initPromise;

    if (this.tweets.length === 0) {
      this.showError('No tweets to translate');
      return;
    }

    const settings = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SETTINGS,
    });

    this.apiKey = settings?.apiKey ?? '';
    this.commentLimit = typeof settings?.commentLimit === 'number' ? settings.commentLimit : undefined;

    const cached = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CACHED_TRANSLATION,
      data: {
        url: this.sourceUrl,
        commentLimit: this.commentLimit,
      },
    });

    if (cached && this.tweetsContainer) {
      const cachedResult = cached as {
        translations: TranslatedTweet[];
        usage: UsageStats;
      };
      this.tweetsContainer.innerHTML = '';
      this.cachedTranslations = [];
      this.cachedTranslationById.clear();
      const byId = new Map(cachedResult.translations.map((t) => [t.id, t]));
      for (const tweet of this.tweets) {
        const translation = byId.get(tweet.id);
        if (!translation) continue;
        this.renderTranslationInOrder(tweet, translation);
        this.translatedIds.add(translation.id);
        this.cachedTranslations.push(translation);
        this.cachedTranslationById.set(translation.id, translation);
        if (translation.segments.length > 0) {
          this.breakdownCache.set(translation.id, {
            segments: translation.segments,
            notes: translation.notes,
          });
        }
      }
      this.totalUsage = cachedResult.usage;
      this.updateCostDisplay();
      this.showLoading(false);
      return;
    }

    // Get API key
    if (!this.apiKey) {
      this.showError('Please set your API key in the extension settings');
      return;
    }

    this.showLoading(true);
    this.showEstimatedCost();

    // Clear container for streaming results
    if (this.tweetsContainer) {
      this.tweetsContainer.innerHTML = '';
    }

    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
    this.cachedTranslations = [];
    this.translationBuffer.clear();

    await translateQuickStreaming(this.tweets, this.apiKey, {
      onTranslation: (translation) => {
        const tweet = this.tweets.find((t) => t.id === translation.id);
        if (tweet && this.tweetsContainer) {
          this.renderTranslationInOrder(tweet, translation);
        }
        this.translatedIds.add(translation.id);
        const cachedTranslation: TranslatedTweet = {
          id: translation.id,
          naturalTranslation: translation.naturalTranslation,
          segments: [],
          notes: [],
        };
        this.translationBuffer.set(translation.id, cachedTranslation);
        this.cachedTranslationById.set(translation.id, cachedTranslation);
        // Hide loading after first result
        this.showLoading(false);
      },
      onComplete: async (usage) => {
        this.showLoading(false);
        this.totalUsage = usage;
        this.updateCostDisplay();

        // Record initial translation usage
        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.RECORD_USAGE,
          data: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          },
        });

        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.CACHE_TRANSLATION,
          data: {
            url: this.sourceUrl,
            commentLimit: this.commentLimit,
            translation: {
              translations: this.tweets
                .map((tweet) => this.translationBuffer.get(tweet.id))
                .filter((entry): entry is TranslatedTweet => !!entry),
              usage,
            },
          },
        });
      },
      onError: (error) => {
        this.showLoading(false);
        this.showError(error.message);
      },
    });
  }

  private setThreadData(tweets: Tweet[], url: string): void {
    this.tweets = tweets;
    this.sourceUrl = url;
    this.knownTweetIds = new Set(tweets.map((tweet) => tweet.id));
    this.tweetIndexById = new Map(tweets.map((tweet, index) => [tweet.id, index]));
  }

  private mergeTweets(newTweets: Tweet[]): void {
    newTweets.forEach((tweet) => {
      if (!this.knownTweetIds.has(tweet.id)) {
        this.knownTweetIds.add(tweet.id);
        this.tweets.push(tweet);
        this.tweetIndexById.set(tweet.id, this.tweets.length - 1);
      }
    });
  }

  private async translateNewTweets(newTweets: Tweet[]): Promise<void> {
    if (newTweets.length === 0) {
      this.showLoading(false);
      return;
    }

    if (!this.apiKey) {
      this.showError('Please set your API key in the extension settings');
      return;
    }

    this.showLoading(true);

    await translateQuickStreaming(newTweets, this.apiKey, {
      onTranslation: (translation) => {
        const tweet = newTweets.find((t) => t.id === translation.id);
        if (tweet) {
          this.renderTranslationInOrder(tweet, translation);
        }
        this.translatedIds.add(translation.id);
        const cachedTranslation: TranslatedTweet = {
          id: translation.id,
          naturalTranslation: translation.naturalTranslation,
          segments: [],
          notes: [],
        };
        this.translationBuffer.set(translation.id, cachedTranslation);
        this.cachedTranslationById.set(translation.id, cachedTranslation);
        this.showLoading(false);
      },
      onComplete: async (usage) => {
        this.showLoading(false);
        this.totalUsage.inputTokens += usage.inputTokens;
        this.totalUsage.outputTokens += usage.outputTokens;
        this.updateCostDisplay();

        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.RECORD_USAGE,
          data: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          },
        });

        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.CACHE_TRANSLATION,
          data: {
            url: this.sourceUrl,
            commentLimit: this.commentLimit,
            translation: {
              translations: this.tweets
                .map((tweet) => this.translationBuffer.get(tweet.id))
                .filter((entry): entry is TranslatedTweet => !!entry),
              usage: this.totalUsage,
            },
          },
        });
      },
      onError: (error) => {
        this.showLoading(false);
        this.showError(error.message);
      },
    });
  }

  // Reply-thread navigation intentionally removed for now to avoid janky UX.
}

// Initialize when DOM is ready
if (typeof document !== 'undefined' && document.readyState !== 'loading') {
  const controller = new TranslateViewController();
  controller.translate();
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new TranslateViewController();
    controller.translate();
  });
}

