import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../translator', () => ({
  translateThread: vi.fn(),
}));

import { translateThread } from '../translator';
import {
  renderTweet,
  renderSegmentTable,
  renderNotes,
  TranslateViewController,
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

      expect(firstRow.cells[0].textContent).toBe('今天');
      expect(firstRow.cells[1].textContent).toBe('天气');
      expect(firstRow.cells[2].textContent).toBe('很好');
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
  });

  describe('TranslateViewController', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="tweets-container"></div>
        <div id="loading"></div>
        <div id="error-message"></div>
        <div id="estimated-cost"></div>
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
        if (message.type === 'GET_CACHED_TRANSLATION') return null;
        if (message.type === 'GET_SETTINGS') return { apiKey: '' };
        return null;
      });

      const controller = new TranslateViewController();
      await controller.translate();

      expect(translateThread).not.toHaveBeenCalled();
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
        if (message.type === 'GET_CACHED_TRANSLATION') return cachedResult;
        if (message.type === 'GET_SETTINGS') return { apiKey: 'key' };
        return null;
      });

      const controller = new TranslateViewController();
      await controller.translate();

      expect(translateThread).not.toHaveBeenCalled();
      const tweetsContainer = document.getElementById('tweets-container');
      expect(tweetsContainer?.textContent).toContain('Hello');
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
        if (message.type === 'GET_CACHED_TRANSLATION') return null;
        if (message.type === 'GET_SETTINGS') return { apiKey: 'key' };
        return { success: true };
      });

      vi.mocked(translateThread).mockResolvedValue(result);

      const controller = new TranslateViewController();
      await controller.translate();

      expect(translateThread).toHaveBeenCalled();
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
        type: 'RECORD_USAGE',
        data: { inputTokens: 10, outputTokens: 20 },
      });
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
        type: 'CACHE_TRANSLATION',
        data: {
          url: 'https://twitter.com/user/status/1',
          translation: result,
        },
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
        if (message.type === 'GET_CACHED_TRANSLATION') return null;
        if (message.type === 'GET_SETTINGS') return { apiKey: 'key' };
        return { success: true };
      });

      vi.mocked(translateThread).mockResolvedValue(result);

      const controller = new TranslateViewController();
      await controller.translate();

      const estimated = document.getElementById('estimated-cost');
      expect(estimated?.textContent).toContain('Translation cost:');
    });
  });
});
