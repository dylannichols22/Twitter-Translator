import { MESSAGE_TYPES } from '../messages';
import { translateThreadStreaming } from '../translator';
import type { TranslatedTweet, Segment, TranslationResult, UsageStats } from '../translator';
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

export function renderTweet(tweet: Tweet, translation: TranslatedTweet): HTMLElement {
  const article = document.createElement('article');
  article.className = `tweet-card ${tweet.isMainPost ? 'main-post' : 'reply'}`;

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

  // Expandable breakdown
  const breakdown = document.createElement('div');
  breakdown.className = 'tweet-breakdown hidden';

  // Split segments into chunks of max 6 for readability
  const chunkSize = 6;
  for (let i = 0; i < translation.segments.length; i += chunkSize) {
    const chunk = translation.segments.slice(i, i + chunkSize);
    breakdown.appendChild(renderSegmentTable(chunk));
  }

  breakdown.appendChild(renderNotes(translation.notes));
  article.appendChild(breakdown);

  // Click to expand/collapse
  header.addEventListener('click', () => {
    breakdown.classList.toggle('hidden');
    article.classList.toggle('expanded');
  });

  return article;
}

export class TranslateViewController {
  private tweetsContainer: HTMLElement | null;
  private loadingEl: HTMLElement | null;
  private errorEl: HTMLElement | null;
  private estimatedCostEl: HTMLElement | null;
  private tweets: Tweet[] = [];
  private sourceUrl = '';
  private translations: TranslatedTweet[] = [];

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

  private renderSingleTweet(translation: TranslatedTweet): void {
    if (!this.tweetsContainer) return;

    const tweet = this.tweets.find((t) => t.id === translation.id);
    if (tweet) {
      const element = renderTweet(tweet, translation);
      this.tweetsContainer.appendChild(element);
    }
  }

  async translate(): Promise<void> {
    if (this.tweets.length === 0) {
      this.showError('No tweets to translate');
      return;
    }

    // Check for cached translation
    const cached = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CACHED_TRANSLATION,
      data: this.sourceUrl,
    });

    if (cached) {
      this.renderTranslations(cached);
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

    this.showLoading(true);
    this.showEstimatedCost();

    // Clear container for streaming results
    if (this.tweetsContainer) {
      this.tweetsContainer.innerHTML = '';
    }

    this.translations = [];

    await translateThreadStreaming(this.tweets, settings.apiKey, {
      onTranslation: (translation) => {
        this.translations.push(translation);
        this.renderSingleTweet(translation);
        // Hide loading after first result
        this.showLoading(false);
      },
      onComplete: async (usage) => {
        this.showLoading(false);

        // Update cost display
        if (this.estimatedCostEl) {
          const actualCost = calculateCost(usage.inputTokens, usage.outputTokens);
          this.estimatedCostEl.textContent = `Translation cost: ${formatCost(actualCost)}`;
        }

        // Record usage
        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.RECORD_USAGE,
          data: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          },
        });

        // Cache translation
        const result: TranslationResult = {
          translations: this.translations,
          usage,
        };
        await browser.runtime.sendMessage({
          type: MESSAGE_TYPES.CACHE_TRANSLATION,
          data: {
            url: this.sourceUrl,
            translation: result,
          },
        });
      },
      onError: (error) => {
        this.showLoading(false);
        this.showError(error.message);
      },
    });
  }

  private renderTranslations(result: TranslationResult): void {
    if (!this.tweetsContainer) return;

    this.tweetsContainer.innerHTML = '';

    // Show actual cost
    if (this.estimatedCostEl) {
      const actualCost = calculateCost(result.usage.inputTokens, result.usage.outputTokens);
      this.estimatedCostEl.textContent = `Translation cost: ${formatCost(actualCost)}`;
    }

    this.tweets.forEach((tweet) => {
      const translation = result.translations.find((t) => t.id === tweet.id);
      if (translation) {
        const element = renderTweet(tweet, translation);
        this.tweetsContainer?.appendChild(element);
      }
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
