import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../translator', () => ({
  translateQuickStreaming: vi.fn(),
  getBreakdown: vi.fn(),
}));

import { translateQuickStreaming, getBreakdown } from '../translator';
import {
  renderTweet,
  renderSegmentTable,
  renderNotes,
  TranslateViewController,
  groupSegmentsForTables,
} from './translate';
import type { TranslatedTweet, Segment } from '../translator';
import type { Tweet } from '../scraper';

// Mock browser APIs
const mockRuntime = {
  sendMessage: vi.fn(),
};

(globalThis as unknown as { browser: unknown }).browser = {
  runtime: mockRuntime,
};

describe('Translation View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('renderSegmentTable', () => {
    const segments: Segment[] = [
      { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
      { chinese: '天气', pinyin: 'tiānqì', gloss: 'weather' },
      { chinese: '很好', pinyin: 'hěn hǎo', gloss: 'very good' },
    ];

    it('creates a table with three rows', () => {
      const table = renderSegmentTable(segments);

      expect(table.tagName).toBe('TABLE');
      expect(table.rows.length).toBe(3);
    });

    it('first row contains Chinese characters', () => {
      const table = renderSegmentTable(segments);
      const firstRow = table.rows[0];

      // Cells now contain save icons, so use toContain instead of toBe
      expect(firstRow.cells[0].textContent).toContain('今天');
      expect(firstRow.cells[1].textContent).toContain('天气');
      expect(firstRow.cells[2].textContent).toContain('很好');
    });

    it('second row contains pinyin', () => {
      const table = renderSegmentTable(segments);
      const secondRow = table.rows[1];

      expect(secondRow.cells[0].textContent).toBe('jīntiān');
      expect(secondRow.cells[1].textContent).toBe('tiānqì');
      expect(secondRow.cells[2].textContent).toBe('hěn hǎo');
    });

    it('third row contains glosses', () => {
      const table = renderSegmentTable(segments);
      const thirdRow = table.rows[2];

      expect(thirdRow.cells[0].textContent).toBe('today');
      expect(thirdRow.cells[1].textContent).toBe('weather');
      expect(thirdRow.cells[2].textContent).toBe('very good');
    });

    it('handles empty segments array', () => {
      const table = renderSegmentTable([]);
      expect(table.rows.length).toBe(3);
      expect(table.rows[0].cells.length).toBe(0);
    });
  });

  describe('renderNotes', () => {
    it('creates a list of notes', () => {
      const notes = ['Note 1', 'Note 2', 'Note 3'];
      const container = renderNotes(notes);

      expect(container.tagName).toBe('DIV');
      const items = container.querySelectorAll('li');
      expect(items.length).toBe(3);
    });

    it('renders note content correctly', () => {
      const notes = ['Cultural context: This is a common expression'];
      const container = renderNotes(notes);

      const item = container.querySelector('li');
      expect(item?.textContent).toBe('Cultural context: This is a common expression');
    });

    it('handles empty notes array', () => {
      const container = renderNotes([]);
      expect(container.querySelector('p')?.textContent).toContain('No notes');
    });
  });

  describe('groupSegmentsForTables', () => {
    it('starts a new table on sentence-ending punctuation', () => {
      const segments: Segment[] = [
        { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
        { chinese: '很棒。', pinyin: 'hěn bàng', gloss: 'great.' },
        { chinese: '真的', pinyin: 'zhēnde', gloss: 'really' },
        { chinese: '不错！', pinyin: 'búcuò', gloss: 'nice!' },
      ];

      const groups = groupSegmentsForTables(segments, 8);
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(2);
      expect(groups[1]).toHaveLength(2);
    });

    it('splits long sentences by max segment count', () => {
      const segments: Segment[] = Array.from({ length: 10 }, (_, i) => ({
        chinese: `词${i + 1}`,
        pinyin: `c${i + 1}`,
        gloss: `w${i + 1}`,
      }));

      const groups = groupSegmentsForTables(segments, 4);
      expect(groups).toHaveLength(3);
      expect(groups[0]).toHaveLength(4);
      expect(groups[1]).toHaveLength(4);
      expect(groups[2]).toHaveLength(2);
    });
  });

  describe('renderTweet', () => {
    const mockTweet: Tweet = {
      id: '123',
      text: '今天天气很好',
      author: 'TestUser',
      timestamp: '2024-01-15T10:30:00.000Z',
      isMainPost: true,
    };

    const mockTranslation: TranslatedTweet = {
      id: '123',
      naturalTranslation: 'The weather is nice today',
      segments: [
        { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
        { chinese: '天气', pinyin: 'tiānqì', gloss: 'weather' },
        { chinese: '很好', pinyin: 'hěn hǎo', gloss: 'very good' },
      ],
      notes: ['Common greeting'],
    };

    it('renders original text and translation', () => {
      const element = renderTweet(mockTweet, mockTranslation);

      expect(element.textContent).toContain('今天天气很好');
      expect(element.textContent).toContain('The weather is nice today');
    });

    it('includes author name', () => {
      const element = renderTweet(mockTweet, mockTranslation);
      expect(element.textContent).toContain('TestUser');
    });

    it('omits invalid timestamps', () => {
      const badTimestampTweet = { ...mockTweet, timestamp: 'not-a-date' };
      const element = renderTweet(badTimestampTweet, mockTranslation);
      expect(element.textContent).not.toContain('Invalid Date');
    });

    it('has expandable breakdown section', () => {
      const element = renderTweet(mockTweet, mockTranslation);

      const breakdown = element.querySelector('.tweet-breakdown');
      expect(breakdown).toBeTruthy();
      expect(breakdown?.classList.contains('hidden')).toBe(true);
    });

    it('expands breakdown on click', () => {
      const element = renderTweet(mockTweet, mockTranslation);
      document.body.appendChild(element);

      const header = element.querySelector('.tweet-header');
      header?.dispatchEvent(new Event('click'));

      const breakdown = element.querySelector('.tweet-breakdown');
      expect(breakdown?.classList.contains('hidden')).toBe(false);
    });

    it('marks main post differently than replies', () => {
      const mainElement = renderTweet(mockTweet, mockTranslation);
      expect(mainElement.classList.contains('main-post')).toBe(true);

      const replyTweet = { ...mockTweet, isMainPost: false };
      const replyElement = renderTweet(replyTweet, mockTranslation);
      expect(replyElement.classList.contains('main-post')).toBe(false);
    });


    it('breakdown section has inner wrapper for CSS grid animation', () => {
      const element = renderTweet(mockTweet, mockTranslation);
      const breakdown = element.querySelector('.tweet-breakdown');
      const inner = breakdown?.querySelector('.breakdown-inner');
      expect(inner).toBeTruthy();
    });

    it('uses expanded class for toggle instead of just removing hidden', () => {
      const element = renderTweet(mockTweet, mockTranslation);
      document.body.appendChild(element);

      const header = element.querySelector('.tweet-header');
      const breakdown = element.querySelector('.tweet-breakdown');

      // Initially hidden
      expect(breakdown?.classList.contains('hidden')).toBe(true);

      // Click to expand
      header?.dispatchEvent(new Event('click'));
      expect(element.classList.contains('expanded')).toBe(true);

      // Click to collapse
      header?.dispatchEvent(new Event('click'));
      expect(element.classList.contains('expanded')).toBe(false);
    });

    it('adds has-replies class to main post with replies', () => {
      const mainWithReplies = { ...mockTweet, isMainPost: true, hasReplies: true };
      const element = renderTweet(mainWithReplies, mockTranslation);
      expect(element.classList.contains('has-replies')).toBe(true);
    });

    it('does not add has-replies class when hasReplies is false', () => {
      const mainNoReplies = { ...mockTweet, isMainPost: true, hasReplies: false };
      const element = renderTweet(mainNoReplies, mockTranslation);
      expect(element.classList.contains('has-replies')).toBe(false);
    });

    it('adds is-reply class to reply tweets', () => {
      const replyTweet = { ...mockTweet, isMainPost: false };
      const element = renderTweet(replyTweet, mockTranslation);
      expect(element.classList.contains('is-reply')).toBe(true);
    });

    it('does not add is-reply class to main post', () => {
      const element = renderTweet(mockTweet, mockTranslation);
      expect(element.classList.contains('is-reply')).toBe(false);
    });

    it('adds gutter classes based on group boundaries', () => {
      const startTweet = { ...mockTweet, groupStart: true, groupEnd: false };
      const startElement = renderTweet(startTweet, mockTranslation);
      expect(startElement.classList.contains('gutter-start')).toBe(true);
      expect(startElement.classList.contains('gutter-end')).toBe(false);

      const middleTweet = { ...mockTweet, groupStart: false, groupEnd: false };
      const middleElement = renderTweet(middleTweet, mockTranslation);
      expect(middleElement.classList.contains('gutter-middle')).toBe(true);

      const endTweet = { ...mockTweet, groupStart: false, groupEnd: true };
      const endElement = renderTweet(endTweet, mockTranslation);
      expect(endElement.classList.contains('gutter-end')).toBe(true);
      expect(endElement.classList.contains('gutter-start')).toBe(false);
    });

    it('uses gutter-single when a group has only one tweet', () => {
      const singleTweet = { ...mockTweet, groupStart: true, groupEnd: true };
      const element = renderTweet(singleTweet, mockTranslation);
      expect(element.classList.contains('gutter-single')).toBe(true);
    });
  });

  describe('TranslateViewController', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="tweets-container"></div>
        <div id="loading">
          <div class="spinner"></div>
          <p class="loading-progress">Translating content...</p>
        </div>
        <div id="error-message"></div>
        <div id="estimated-cost"></div>
        <div id="usage-today"></div>
      `;

      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
        configurable: true,
      });
    });

    it('parses URL parameters for tweet data', () => {
      const tweetData = {
        tweets: [{ id: '1', text: '你好', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      // Mock URL search params using Object.defineProperty
      const searchValue = `?data=${encodeURIComponent(JSON.stringify(tweetData))}`;
      Object.defineProperty(window, 'location', {
        value: { search: searchValue },
        writable: true,
        configurable: true,
      });

      const controller = new TranslateViewController();
      expect(controller.getTweets()).toHaveLength(1);
    });

    it('shows loading state while translating', () => {
      const controller = new TranslateViewController();
      controller.showLoading(true);

      const loading = document.getElementById('loading');
      expect(loading?.classList.contains('hidden')).toBe(false);
    });

    it('shows skeleton cards when loading starts', () => {
      const tweetsContainer = document.getElementById('tweets-container');
      const controller = new TranslateViewController();
      controller.showLoading(true);

      const skeletons = tweetsContainer?.querySelectorAll('.tweet-skeleton');
      expect(skeletons?.length).toBeGreaterThan(0);
    });

    it('removes skeleton cards when loading ends', () => {
      const tweetsContainer = document.getElementById('tweets-container');
      const controller = new TranslateViewController();
      controller.showLoading(true);
      controller.showLoading(false);

      const skeletons = tweetsContainer?.querySelectorAll('.tweet-skeleton');
      expect(skeletons?.length).toBe(0);
    });

    it('hides loading state when done', () => {
      const controller = new TranslateViewController();
      controller.showLoading(false);

      const loading = document.getElementById('loading');
      expect(loading?.classList.contains('hidden')).toBe(true);
    });

    it('shows error message on failure', () => {
      const controller = new TranslateViewController();
      controller.showError('Translation failed');

      const error = document.getElementById('error-message');
      expect(error?.textContent).toContain('Translation failed');
    });

    it('shows progress text during translation', () => {
      const controller = new TranslateViewController();
      controller.showProgress({ completed: 3, total: 10 });

      const progress = document.querySelector('.loading-progress');
      expect(progress?.textContent).toBe('Translating 3 of 10...');
    });

    it('shows default text when progress is reset', () => {
      const controller = new TranslateViewController();
      controller.showProgress({ completed: 0, total: 0 });

      const progress = document.querySelector('.loading-progress');
      expect(progress?.textContent).toBe('Translating content...');
    });

    it('shows estimated cost for current tweets', () => {
      const tweetData = {
        tweets: [{ id: '1', text: '你好', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      Object.defineProperty(window, 'location', {
        value: { search: `?data=${encodeURIComponent(JSON.stringify(tweetData))}` },
        writable: true,
        configurable: true,
      });

      const controller = new TranslateViewController();
      controller.showEstimatedCost();

      const estimated = document.getElementById('estimated-cost');
      expect(estimated?.textContent).toContain('Estimated cost:');
    });

    it('shows today usage summary when available', async () => {
      mockRuntime.sendMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'GET_USAGE_STATS') {
          return { today: { inputTokens: 100, outputTokens: 50, cost: 0.01, count: 2 } };
        }
        return null;
      });

      new TranslateViewController();

      await new Promise((resolve) => setTimeout(resolve, 0));

      const usage = document.getElementById('usage-today');
      expect(usage?.textContent).toContain('Today: 150 tokens');
      expect(usage?.textContent).toContain('Avg: 75 tokens/request');
    });

    it('shows error when API key is missing', async () => {
      const tweetData = {
        tweets: [{ id: '1', text: '你好', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      Object.defineProperty(window, 'location', {
        value: { search: `?data=${encodeURIComponent(JSON.stringify(tweetData))}` },
        writable: true,
        configurable: true,
      });

      mockRuntime.sendMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'GET_SETTINGS') return { apiKey: '' };
        if (message.type === 'GET_CACHED_TRANSLATION') return null;
        return null;
      });

      const controller = new TranslateViewController();
      await controller.translate();

      expect(translateQuickStreaming).not.toHaveBeenCalled();
      const error = document.getElementById('error-message');
      expect(error?.textContent).toContain('API key');
    });

    it('renders cached translation without calling API', async () => {
      const tweetData = {
        tweets: [{ id: '1', text: '你好', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      Object.defineProperty(window, 'location', {
        value: { search: `?data=${encodeURIComponent(JSON.stringify(tweetData))}` },
        writable: true,
        configurable: true,
      });

      const cachedResult = {
        translations: [
          { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] },
        ],
        usage: { inputTokens: 10, outputTokens: 20 },
      };

      mockRuntime.sendMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'GET_SETTINGS') return { apiKey: 'key', commentLimit: 10 };
        if (message.type === 'GET_CACHED_TRANSLATION') return cachedResult;
        return null;
      });

      const controller = new TranslateViewController();
      await controller.translate();

      expect(translateQuickStreaming).not.toHaveBeenCalled();
      const tweetsContainer = document.getElementById('tweets-container');
      expect(tweetsContainer?.textContent).toContain('Hello');
    });

    it('uses cached breakdown without re-fetching', async () => {
      const tweetData = {
        tweets: [{ id: '1', text: 'ä½ å¥½', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      Object.defineProperty(window, 'location', {
        value: { search: `?data=${encodeURIComponent(JSON.stringify(tweetData))}` },
        writable: true,
        configurable: true,
      });

      const cachedResult = {
        translations: [
          {
            id: '1',
            naturalTranslation: 'Hello',
            segments: [{ chinese: 'ä½ ', pinyin: 'nÇ', gloss: 'you' }],
            notes: ['Note'],
          },
        ],
        usage: { inputTokens: 10, outputTokens: 20 },
      };

      mockRuntime.sendMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'GET_SETTINGS') return { apiKey: '' };
        if (message.type === 'GET_CACHED_TRANSLATION') return cachedResult;
        return null;
      });

      const controller = new TranslateViewController();
      await controller.translate();

      const header = document.querySelector('.tweet-header');
      header?.dispatchEvent(new Event('click'));

      expect(getBreakdown).not.toHaveBeenCalled();
    });

    it('records usage and caches translation on success', async () => {
      const tweetData = {
        tweets: [{ id: '1', text: '你好', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      Object.defineProperty(window, 'location', {
        value: { search: `?data=${encodeURIComponent(JSON.stringify(tweetData))}` },
        writable: true,
        configurable: true,
      });

      const result = {
        translations: [
          { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] },
        ],
        usage: { inputTokens: 10, outputTokens: 20 },
      };

      mockRuntime.sendMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'GET_SETTINGS') return { apiKey: 'key', commentLimit: 10 };
        if (message.type === 'GET_CACHED_TRANSLATION') return null;
        return { success: true };
      });

      vi.mocked(translateQuickStreaming).mockImplementation(
        async (_tweets, _apiKey, callbacks) => {
          callbacks.onTranslation(result.translations[0]);
          await callbacks.onComplete(result.usage);
        }
      );

      const controller = new TranslateViewController();
      await controller.translate();

      expect(translateQuickStreaming).toHaveBeenCalled();
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
        type: 'RECORD_USAGE',
        data: { inputTokens: 10, outputTokens: 20 },
      });
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
        type: 'CACHE_TRANSLATION',
        data: expect.objectContaining({
          url: 'https://twitter.com/user/status/1',
        }),
      });
    });

    it('shows actual cost after translation completes', async () => {
      const tweetData = {
        tweets: [{ id: '1', text: 'test', author: 'Test', timestamp: '', isMainPost: true }],
        url: 'https://twitter.com/user/status/1',
      };

      Object.defineProperty(window, 'location', {
        value: { search: `?data=${encodeURIComponent(JSON.stringify(tweetData))}` },
        writable: true,
        configurable: true,
      });

      const result = {
        translations: [
          { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] },
        ],
        usage: { inputTokens: 10, outputTokens: 20 },
      };

      mockRuntime.sendMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'GET_SETTINGS') return { apiKey: 'key', commentLimit: 10 };
        if (message.type === 'GET_CACHED_TRANSLATION') return null;
        return { success: true };
      });

      vi.mocked(translateQuickStreaming).mockImplementation(
        async (_tweets, _apiKey, callbacks) => {
          callbacks.onTranslation(result.translations[0]);
          callbacks.onComplete(result.usage);
        }
      );

      const controller = new TranslateViewController();
      await controller.translate();

      const estimated = document.getElementById('estimated-cost');
      expect(estimated?.textContent).toContain('Translation cost:');
    });
  });
});
