import { MESSAGE_TYPES } from '../messages';
import { translateQuickStreaming, getBreakdown } from '../translator';
import type { QuickTranslation, Segment, Breakdown, UsageStats, TranslatedTweet } from '../translator';
import type { Tweet } from '../scraper';
import { estimateCost, calculateCost } from '../cost';
import { formatCost } from '../popup/popup';
import { renderSkeletonContainer } from './skeleton';

export function renderSegmentTable(segments: Segment[]): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'segment-table';

  // Row 1: Chinese characters
  const chineseRow = table.insertRow();
  chineseRow.className = 'chinese-row';
  segments.forEach((seg) => {
    const cell = chineseRow.insertCell();
    cell.textContent = seg.chinese;
  });

  // Row 2: Pinyin
  const pinyinRow = table.insertRow();
  pinyinRow.className = 'pinyin-row';
  segments.forEach((seg) => {
    const cell = pinyinRow.insertCell();
    cell.textContent = seg.pinyin;
  });

  // Row 3: Gloss
  const glossRow = table.insertRow();
  glossRow.className = 'gloss-row';
  segments.forEach((seg) => {
    const cell = glossRow.insertCell();
    cell.textContent = seg.gloss;
  });

  return table;
}

export function renderNotes(notes: string[]): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'notes-section';

  const heading = document.createElement('h4');
  heading.textContent = 'Notes';
  container.appendChild(heading);

  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No notes available';
    empty.className = 'empty-notes';
    container.appendChild(empty);
    return container;
  }

  const list = document.createElement('ul');
  notes.forEach((note) => {
    const item = document.createElement('li');
    item.textContent = note;
    list.appendChild(item);
  });
  container.appendChild(list);

  return container;
}

function renderBreakdownContent(breakdown: Breakdown): DocumentFragment {
  const fragment = document.createDocumentFragment();

  // Split segments into chunks of max 8 for readability
  const chunkSize = 8;
  for (let i = 0; i < breakdown.segments.length; i += chunkSize) {
    const chunk = breakdown.segments.slice(i, i + chunkSize);
    const wrapper = document.createElement('div');
    wrapper.className = 'segment-table-wrapper';
    wrapper.appendChild(renderSegmentTable(chunk));
    fragment.appendChild(wrapper);
  }

  fragment.appendChild(renderNotes(breakdown.notes));
  return fragment;
}

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
  onToggleBreakdown?: (article: HTMLElement, breakdown: HTMLElement) => void,
  onLoadChildren?: (tweet: Tweet) => void
): HTMLElement {
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
  if (tweet.timestamp) {
    timestamp.textContent = new Date(tweet.timestamp).toLocaleString();
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

  if (!tweet.isMainPost && tweet.hasReplies !== false) {
    const loadChildren = document.createElement('button');
    loadChildren.className = 'tweet-action-btn tweet-load-children';
    loadChildren.type = 'button';
    loadChildren.textContent = 'Show replies';
    loadChildren.addEventListener('click', (event) => {
      event.stopPropagation();
      onLoadChildren?.(tweet);
    });
    actions.appendChild(loadChildren);
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
  private loadMoreBtn: HTMLButtonElement | null;
  private backBtn: HTMLButtonElement | null;
  private tweets: Tweet[] = [];
  private sourceUrl = '';
  private apiKey = '';
  private sourceTabId: number | null = null;
  private historyStack: Array<{ tweets: Tweet[]; url: string; scrollTop: number }> = [];
  private totalUsage: UsageStats = { inputTokens: 0, outputTokens: 0 };
  private translatedIds: Set<string> = new Set();
  private knownTweetIds: Set<string> = new Set();
  private cachedTranslations: TranslatedTweet[] = [];
  private commentLimit = 0;
  private isLoadingMore = false;

  // Track which breakdowns have been loaded
  private breakdownCache: Map<string, Breakdown> = new Map();
  private currentlyExpanded: HTMLElement | null = null;

  constructor() {
    this.tweetsContainer = document.getElementById('tweets-container');
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error-message');
    this.estimatedCostEl = document.getElementById('estimated-cost');
    this.loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
    this.backBtn = document.querySelector('.nav-back') as HTMLButtonElement | null;

    this.parseUrlParams();
    this.initializeControls();
  }

  private parseUrlParams(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const dataStr = params.get('data');
      if (dataStr) {
        const data = JSON.parse(decodeURIComponent(dataStr));
        this.tweets = data.tweets || [];
        this.sourceUrl = data.url || '';
        this.sourceTabId = typeof data.sourceTabId === 'number' ? data.sourceTabId : null;
        this.tweets.forEach((tweet) => {
          if (tweet.id) {
            this.knownTweetIds.add(tweet.id);
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse URL params:', error);
    }
  }

  private initializeControls(): void {
    if (this.loadMoreBtn) {
      this.loadMoreBtn.addEventListener('click', () => {
        void this.loadMoreReplies();
      });
    }
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => {
        void this.goBack();
      });
      this.updateBackButton();
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
    }, (targetTweet) => {
      void this.openReplyThread(targetTweet);
    });
  }

  private renderCachedTweet(tweet: Tweet, translation: TranslatedTweet): HTMLElement {
    return renderTweet(tweet, translation, (article, breakdown) => {
      void this.toggleBreakdown(article, tweet, breakdown);
    }, (targetTweet) => {
      void this.openReplyThread(targetTweet);
    });
  }

  private appendTranslation(tweet: Tweet, translation: QuickTranslation | TranslatedTweet): void {
    if (!this.tweetsContainer) return;
    const element = 'segments' in translation
      ? this.renderCachedTweet(tweet, translation)
      : this.renderQuickTweet(tweet, translation);
    this.tweetsContainer.appendChild(element);
  }

  private async toggleBreakdown(article: HTMLElement, tweet: Tweet, breakdownEl: HTMLElement): Promise<void> {
    const isExpanding = breakdownEl.classList.contains('hidden');

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
    if (this.tweets.length === 0) {
      this.showError('No tweets to translate');
      return;
    }

    const cached = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CACHED_TRANSLATION,
      data: this.sourceUrl,
    });

    if (cached && this.tweetsContainer) {
      const cachedResult = cached as {
        translations: TranslatedTweet[];
        usage: UsageStats;
      };
      this.tweetsContainer.innerHTML = '';
      this.cachedTranslations = cachedResult.translations;
      for (const translation of cachedResult.translations) {
        const tweet = this.tweets.find((t) => t.id === translation.id);
        if (tweet) {
          this.appendTranslation(tweet, translation);
          this.translatedIds.add(translation.id);
        }
      }
      this.totalUsage = cachedResult.usage;
      this.updateCostDisplay();
      this.showLoading(false);
      this.showLoadMore(true);
      return;
    }

    // Get API key
    const settings = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SETTINGS,
    });

    if (!settings.apiKey) {
      this.showError('Please set your API key in the extension settings');
      return;
    }

    this.apiKey = settings.apiKey;
    this.commentLimit = settings.commentLimit ?? 0;

    this.showLoading(true);
    this.showEstimatedCost();

    // Clear container for streaming results
    if (this.tweetsContainer) {
      this.tweetsContainer.innerHTML = '';
    }

    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
    this.cachedTranslations = [];

    await translateQuickStreaming(this.tweets, this.apiKey, {
      onTranslation: (translation) => {
        const tweet = this.tweets.find((t) => t.id === translation.id);
        if (tweet && this.tweetsContainer) {
          this.appendTranslation(tweet, translation);
        }
        this.translatedIds.add(translation.id);
        this.cachedTranslations.push({
          id: translation.id,
          naturalTranslation: translation.naturalTranslation,
          segments: [],
          notes: [],
        });
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
            translation: {
              translations: this.cachedTranslations,
              usage,
            },
          },
        });
        this.showLoadMore(true);
      },
      onError: (error) => {
        this.showLoading(false);
        this.showError(error.message);
      },
    });
  }

  private showLoadMore(show: boolean): void {
    if (!this.loadMoreBtn) return;
    this.loadMoreBtn.classList.toggle('hidden', !show);
  }

  private showOverlayLoading(show: boolean): void {
    if (this.loadingEl) {
      this.loadingEl.classList.toggle('hidden', !show);
    }
    document.body?.classList.toggle('loading-overlay', show);
  }

  private updateBackButton(): void {
    if (!this.backBtn) return;
    this.backBtn.disabled = this.historyStack.length === 0;
    this.backBtn.classList.toggle('disabled', this.historyStack.length === 0);
  }

  private resetTranslationState(): void {
    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
    this.translatedIds.clear();
    this.cachedTranslations = [];
    this.breakdownCache.clear();
    this.currentlyExpanded = null;
  }

  private setThreadData(tweets: Tweet[], url: string): void {
    this.tweets = tweets;
    this.sourceUrl = url;
    this.knownTweetIds = new Set(tweets.map((tweet) => tweet.id));
  }

  private pushHistory(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    this.historyStack.push({
      tweets: this.tweets,
      url: this.sourceUrl,
      scrollTop,
    });
    this.updateBackButton();
  }

  private async goBack(): Promise<void> {
    const previous = this.historyStack.pop();
    if (!previous) return;

    if (this.sourceTabId) {
      await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.NAVIGATE_TAB,
        data: { tabId: this.sourceTabId, url: previous.url },
      });
    }

    this.updateBackButton();
    this.resetTranslationState();
    if (this.tweetsContainer) {
      this.tweetsContainer.innerHTML = '';
    }
    this.setThreadData(previous.tweets, previous.url);
    await this.translate();

    requestAnimationFrame(() => {
      window.scrollTo(0, previous.scrollTop);
    });
  }

  private mergeTweets(newTweets: Tweet[]): void {
    newTweets.forEach((tweet) => {
      if (!this.knownTweetIds.has(tweet.id)) {
        this.knownTweetIds.add(tweet.id);
        this.tweets.push(tweet);
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
          this.appendTranslation(tweet, translation);
        }
        this.translatedIds.add(translation.id);
        this.cachedTranslations.push({
          id: translation.id,
          naturalTranslation: translation.naturalTranslation,
          segments: [],
          notes: [],
        });
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
            translation: {
              translations: this.cachedTranslations,
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

  private async loadMoreReplies(): Promise<void> {
    if (this.isLoadingMore || !this.sourceUrl) return;
    this.isLoadingMore = true;
    if (this.loadMoreBtn) {
      this.loadMoreBtn.disabled = true;
    }

    const nextLimit = (this.commentLimit || this.tweets.length) + 10;
    this.commentLimit = nextLimit;

    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.SCRAPE_MORE,
      data: {
        url: this.sourceUrl,
        commentLimit: nextLimit,
        excludeIds: Array.from(this.knownTweetIds),
      },
    });

    if (!response?.success || !response.tweets) {
      this.showError(response?.error || 'Failed to load more replies');
      this.isLoadingMore = false;
      if (this.loadMoreBtn) {
        this.loadMoreBtn.disabled = false;
      }
      return;
    }

    const responseTweets = response.tweets as Tweet[];
    const freshTweets = responseTweets.filter((tweet) => !this.knownTweetIds.has(tweet.id));
    if (freshTweets.length === 0) {
      this.showLoadMore(false);
      this.isLoadingMore = false;
      if (this.loadMoreBtn) {
        this.loadMoreBtn.disabled = false;
      }
      return;
    }

    this.mergeTweets(freshTweets);
    const untranslated = freshTweets.filter((tweet) => !this.translatedIds.has(tweet.id));

    if (untranslated.length === 0) {
      this.showLoadMore(false);
      this.isLoadingMore = false;
      if (this.loadMoreBtn) {
        this.loadMoreBtn.disabled = false;
      }
      return;
    }

    await this.translateNewTweets(untranslated);

    this.isLoadingMore = false;
    if (this.loadMoreBtn) {
      this.loadMoreBtn.disabled = false;
    }
  }

  private async openReplyThread(parentTweet: Tweet): Promise<void> {
    if (this.isLoadingMore) return;

    if (!parentTweet.url) {
      this.showError('No reply thread available for this post');
      return;
    }

    if (this.sourceTabId) {
      this.isLoadingMore = true;
      const replyLimit = this.commentLimit > 0 ? this.commentLimit : undefined;

      this.pushHistory();
      this.showOverlayLoading(true);

      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.NAVIGATE_AND_SCRAPE,
        data: {
          tabId: this.sourceTabId,
          url: parentTweet.url,
          commentLimit: replyLimit,
        },
      });

      if (!response?.success || !response.tweets) {
        this.showError(response?.error || 'Failed to open reply thread');
        this.historyStack.pop();
        this.updateBackButton();
        this.showOverlayLoading(false);
        this.isLoadingMore = false;
        return;
      }

      const responseTweets = response.tweets as Tweet[];
      const childReplies = responseTweets.filter((tweet) => !tweet.isMainPost);
      if (responseTweets.length === 0 || childReplies.length === 0) {
        this.showError('No replies to show');
        this.historyStack.pop();
        this.updateBackButton();
        this.showOverlayLoading(false);
        this.isLoadingMore = false;
        return;
      }

      this.resetTranslationState();
      if (this.tweetsContainer) {
        this.tweetsContainer.innerHTML = '';
      }
      this.setThreadData(responseTweets, response.url || parentTweet.url);
      this.showLoadMore(true);
      this.showOverlayLoading(false);
      await this.translate();
      this.isLoadingMore = false;
      return;
    }

    this.isLoadingMore = true;

    const replyLimit = this.commentLimit > 0 ? this.commentLimit : undefined;

    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.SCRAPE_CHILD_REPLIES,
      data: {
        url: this.sourceUrl,
        threadUrl: parentTweet.url,
        commentLimit: replyLimit,
      },
    });

    if (!response?.success || !response.tweets) {
      this.showError(response?.error || 'Failed to open reply thread');
      this.isLoadingMore = false;
      return;
    }

    const responseTweets = response.tweets as Tweet[];
    const childReplies = responseTweets.filter((tweet) => !tweet.isMainPost);
    if (responseTweets.length === 0 || childReplies.length === 0) {
      this.showError('No replies to show');
      this.isLoadingMore = false;
      return;
    }

    await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.OPEN_TRANSLATE_PAGE,
      data: {
        tweets: responseTweets,
        url: parentTweet.url,
      },
    });

    this.isLoadingMore = false;
  }
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
