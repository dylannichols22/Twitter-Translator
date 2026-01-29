import { MESSAGE_TYPES } from '../messages';
import { translateQuickStreaming, getBreakdown } from '../translator';
import type { QuickTranslation, Segment, Breakdown, UsageStats } from '../translator';
import type { Tweet } from '../scraper';
import { estimateCost, calculateCost } from '../cost';
import { formatCost } from '../popup/popup';

export function renderSegmentTable(segments: Segment[]): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'segment-table-wrapper';

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

  wrapper.appendChild(table);
  return wrapper;
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
    fragment.appendChild(renderSegmentTable(chunk));
  }

  fragment.appendChild(renderNotes(breakdown.notes));
  return fragment;
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

  // Track which breakdowns have been loaded
  private breakdownCache: Map<string, Breakdown> = new Map();
  private currentlyExpanded: HTMLElement | null = null;

  constructor() {
    this.tweetsContainer = document.getElementById('tweets-container');
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error-message');
    this.estimatedCostEl = document.getElementById('estimated-cost');

    this.parseUrlParams();
  }

  private parseUrlParams(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const dataStr = params.get('data');
      if (dataStr) {
        const data = JSON.parse(decodeURIComponent(dataStr));
        this.tweets = data.tweets || [];
        this.sourceUrl = data.url || '';
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
  }

  showError(message: string): void {
    if (this.errorEl) {
      this.errorEl.textContent = message;
      this.errorEl.classList.remove('hidden');
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
    const article = document.createElement('article');
    article.className = `tweet-card ${tweet.isMainPost ? 'main-post' : 'reply'}`;
    article.dataset.tweetId = tweet.id;

    // Header (clickable to expand)
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

    article.appendChild(header);

    // Translation
    const translationEl = document.createElement('div');
    translationEl.className = 'tweet-translation';
    translationEl.textContent = translation.naturalTranslation;
    article.appendChild(translationEl);

    // Original text
    const original = document.createElement('div');
    original.className = 'tweet-original';
    original.textContent = tweet.text;
    article.appendChild(original);

    // Breakdown container (initially empty, loaded on demand)
    const breakdown = document.createElement('div');
    breakdown.className = 'tweet-breakdown hidden';
    article.appendChild(breakdown);

    // Click header to expand/collapse and load breakdown
    header.addEventListener('click', () => this.toggleBreakdown(article, tweet, breakdown));

    return article;
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
      // Check if breakdown already loaded
      if (!this.breakdownCache.has(tweet.id)) {
        // Show loading state
        breakdownEl.innerHTML = '<div class="breakdown-loading">Loading breakdown...</div>';
        breakdownEl.classList.remove('hidden');
        article.classList.add('expanded');

        try {
          const result = await getBreakdown(tweet.text, this.apiKey);

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
          breakdownEl.innerHTML = '';
          breakdownEl.appendChild(renderBreakdownContent(result.breakdown));
        } catch (error) {
          breakdownEl.innerHTML = `<div class="breakdown-error">Failed to load breakdown: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
        }
      } else {
        // Use cached breakdown
        const cached = this.breakdownCache.get(tweet.id)!;
        if (breakdownEl.children.length === 0) {
          breakdownEl.appendChild(renderBreakdownContent(cached));
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

    // Get API key
    const settings = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SETTINGS,
    });

    if (!settings.apiKey) {
      this.showError('Please set your API key in the extension settings');
      return;
    }

    this.apiKey = settings.apiKey;

    this.showLoading(true);
    this.showEstimatedCost();

    // Clear container for streaming results
    if (this.tweetsContainer) {
      this.tweetsContainer.innerHTML = '';
    }

    this.totalUsage = { inputTokens: 0, outputTokens: 0 };

    await translateQuickStreaming(this.tweets, this.apiKey, {
      onTranslation: (translation) => {
        const tweet = this.tweets.find((t) => t.id === translation.id);
        if (tweet && this.tweetsContainer) {
          const element = this.renderQuickTweet(tweet, translation);
          this.tweetsContainer.appendChild(element);
        }
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
      },
      onError: (error) => {
        this.showLoading(false);
        this.showError(error.message);
      },
    });
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
