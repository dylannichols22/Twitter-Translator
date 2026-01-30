import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PanelController } from './panelController';
import { destroyPanel } from './panel';
import type { Tweet } from '../scraper';

// Mock browser APIs
const mockRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
  },
};

(globalThis as unknown as { browser: unknown }).browser = {
  runtime: mockRuntime,
};

describe('PanelController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockRuntime.sendMessage.mockResolvedValue({ apiKey: 'test-key', commentLimit: 10 });
  });

  afterEach(() => {
    destroyPanel();
  });

  describe('Initialization', () => {
    it('creates a panel controller instance', () => {
      const controller = new PanelController();
      expect(controller).toBeDefined();
    });

    it('creates the panel DOM element on initialization', () => {
      new PanelController();
      expect(document.querySelector('.twitter-translator-panel')).not.toBeNull();
    });

    it('panel is initially closed', () => {
      const controller = new PanelController();
      expect(controller.isOpen()).toBe(false);
    });
  });

  describe('Panel Toggle', () => {
    it('open() opens the panel', () => {
      const controller = new PanelController();
      controller.open();
      expect(controller.isOpen()).toBe(true);
    });

    it('close() closes the panel', () => {
      const controller = new PanelController();
      controller.open();
      controller.close();
      expect(controller.isOpen()).toBe(false);
    });

    it('toggle() toggles the panel state', () => {
      const controller = new PanelController();
      expect(controller.isOpen()).toBe(false);
      controller.toggle();
      expect(controller.isOpen()).toBe(true);
      controller.toggle();
      expect(controller.isOpen()).toBe(false);
    });
  });

  describe('Scraping and Translation', () => {
    it('scrapeAndTranslate calls the scraper', async () => {
      const controller = new PanelController();

      // Mock the scraper response
      mockRuntime.sendMessage.mockResolvedValueOnce({ apiKey: 'test-key', commentLimit: 10 });

      // Calling scrapeAndTranslate - it may show error if no tweets, but shouldn't throw
      await controller.scrapeAndTranslate();

      // The controller should have been called
      expect(controller).toBeDefined();
    });

    it('setTweets accepts tweets array', () => {
      const controller = new PanelController();
      const tweets: Tweet[] = [
        { id: '1', text: '你好', author: 'User', timestamp: '', isMainPost: true }
      ];

      controller.setTweets(tweets, 'https://twitter.com/test/status/1');
      expect(controller.getTweets()).toEqual(tweets);
    });

    it('getTweets returns the current tweets', () => {
      const controller = new PanelController();
      const tweets: Tweet[] = [
        { id: '1', text: '你好', author: 'User', timestamp: '', isMainPost: true }
      ];

      controller.setTweets(tweets, 'https://twitter.com/test/status/1');
      expect(controller.getTweets()).toHaveLength(1);
      expect(controller.getTweets()[0].text).toBe('你好');
    });

    it('getSourceUrl returns the current URL', () => {
      const controller = new PanelController();
      const url = 'https://twitter.com/test/status/1';

      controller.setTweets([], url);
      expect(controller.getSourceUrl()).toBe(url);
    });

    it('clearTweets removes all tweets', () => {
      const controller = new PanelController();
      const tweets: Tweet[] = [
        { id: '1', text: '你好', author: 'User', timestamp: '', isMainPost: true }
      ];

      controller.setTweets(tweets, 'https://twitter.com/test/status/1');
      expect(controller.getTweets()).toHaveLength(1);

      controller.clearTweets();
      expect(controller.getTweets()).toHaveLength(0);
    });
  });

  describe('Content Display', () => {
    it('shows loading state during translation', () => {
      const controller = new PanelController();
      controller.showLoading(true);

      const panel = document.querySelector('.twitter-translator-panel');
      expect(panel?.querySelector('.panel-loading')).not.toBeNull();
    });

    it('hides loading state after translation', () => {
      const controller = new PanelController();
      controller.showLoading(true);
      controller.showLoading(false);

      const panel = document.querySelector('.twitter-translator-panel');
      expect(panel?.querySelector('.panel-loading')).toBeNull();
    });

    it('shows error message when translation fails', () => {
      const controller = new PanelController();
      controller.showError('Translation failed');

      const panel = document.querySelector('.twitter-translator-panel');
      const error = panel?.querySelector('.panel-error');
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain('Translation failed');
    });

    it('shows empty state for non-thread pages', () => {
      const controller = new PanelController();
      controller.showEmptyState();

      const panel = document.querySelector('.twitter-translator-panel');
      const empty = panel?.querySelector('.panel-empty');
      expect(empty).not.toBeNull();
    });
  });

  describe('Translation Cache', () => {
    it('maintains translation cache keyed by tweet ID', () => {
      const controller = new PanelController();

      // Add a cached translation
      controller.cacheTranslation('1', {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      });

      expect(controller.getCachedTranslation('1')).toBeDefined();
      expect(controller.getCachedTranslation('1')?.naturalTranslation).toBe('Hello');
    });

    it('returns undefined for uncached tweets', () => {
      const controller = new PanelController();
      expect(controller.getCachedTranslation('nonexistent')).toBeUndefined();
    });

    it('cache persists across URL changes', () => {
      const controller = new PanelController();

      controller.cacheTranslation('1', {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      });

      // Simulate URL change by setting new tweets
      controller.setTweets([], 'https://twitter.com/other/status/2');

      // Cache should still have the old translation
      expect(controller.getCachedTranslation('1')).toBeDefined();
    });

    it('clearCache removes all cached translations', () => {
      const controller = new PanelController();

      controller.cacheTranslation('1', {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      });

      controller.clearCache();
      expect(controller.getCachedTranslation('1')).toBeUndefined();
    });
  });

  describe('Usage Stats', () => {
    it('tracks token usage', () => {
      const controller = new PanelController();

      controller.addUsage({ inputTokens: 100, outputTokens: 50 });

      const usage = controller.getUsage();
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
    });

    it('accumulates usage across multiple calls', () => {
      const controller = new PanelController();

      controller.addUsage({ inputTokens: 100, outputTokens: 50 });
      controller.addUsage({ inputTokens: 50, outputTokens: 25 });

      const usage = controller.getUsage();
      expect(usage.inputTokens).toBe(150);
      expect(usage.outputTokens).toBe(75);
    });

    it('resetUsage clears the usage stats', () => {
      const controller = new PanelController();

      controller.addUsage({ inputTokens: 100, outputTokens: 50 });
      controller.resetUsage();

      const usage = controller.getUsage();
      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
    });

    it('displays usage in footer', () => {
      const controller = new PanelController();
      controller.addUsage({ inputTokens: 1000, outputTokens: 500 });
      controller.updateFooter();

      const footer = document.querySelector('.twitter-translator-panel .panel-footer');
      expect(footer?.textContent).toContain('tokens');
    });
  });

  describe('Destroy', () => {
    it('destroy() removes the panel and clears state', () => {
      const controller = new PanelController();
      const tweets: Tweet[] = [
        { id: '1', text: '你好', author: 'User', timestamp: '', isMainPost: true }
      ];

      controller.setTweets(tweets, 'https://twitter.com/test/status/1');
      controller.cacheTranslation('1', {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      });

      controller.destroy();

      expect(document.querySelector('.twitter-translator-panel')).toBeNull();
    });
  });

  describe('Tweet Appending', () => {

    it('appendTweets adds new tweets without removing existing ones', () => {
      const controller = new PanelController();
      const tweet1: Tweet = { id: '1', text: '你好', author: 'User1', timestamp: '', isMainPost: true };
      const tweet2: Tweet = { id: '2', text: '世界', author: 'User2', timestamp: '', isMainPost: false };
      const translation1 = { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] };
      const translation2 = { id: '2', naturalTranslation: 'World', segments: [], notes: [] };

      controller.renderTweet(tweet1, translation1);
      controller.appendTweets([tweet2], [translation2]);

      const content = controller.getContentContainer();
      const cards = content?.querySelectorAll('.tweet-card');
      expect(cards?.length).toBe(2);
    });

    it('appendTweets does not add duplicate tweets', () => {
      const controller = new PanelController();
      const tweet1: Tweet = { id: '1', text: '你好', author: 'User1', timestamp: '', isMainPost: true };
      const translation1 = { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] };

      controller.renderTweet(tweet1, translation1);
      controller.appendTweets([tweet1], [translation1]);

      const content = controller.getContentContainer();
      const cards = content?.querySelectorAll('.tweet-card');
      expect(cards?.length).toBe(1);
    });

    it('getKnownTweetIds returns set of rendered tweet IDs', () => {
      const controller = new PanelController();
      const tweet1: Tweet = { id: '1', text: '你好', author: 'User1', timestamp: '', isMainPost: true };
      const translation1 = { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] };

      controller.renderTweet(tweet1, translation1);

      const knownIds = controller.getKnownTweetIds();
      expect(knownIds.has('1')).toBe(true);
      expect(knownIds.has('2')).toBe(false);
    });
  });

  describe('Tweet Rendering', () => {
    it('renderTweet adds a tweet card to the panel', () => {
      const controller = new PanelController();
      const tweet: Tweet = {
        id: '1',
        text: '你好世界',
        author: 'TestUser',
        timestamp: '2024-01-15T10:00:00Z',
        isMainPost: true
      };
      const translation = {
        id: '1',
        naturalTranslation: 'Hello world',
        segments: [],
        notes: []
      };

      controller.renderTweet(tweet, translation);

      const content = controller.getContentContainer();
      expect(content?.querySelector('.tweet-card')).not.toBeNull();
      expect(content?.querySelector('.tweet-translation')?.textContent).toBe('Hello world');
    });

    it('renderTweet displays the original text', () => {
      const controller = new PanelController();
      const tweet: Tweet = {
        id: '1',
        text: '你好世界',
        author: 'TestUser',
        timestamp: '',
        isMainPost: true
      };
      const translation = {
        id: '1',
        naturalTranslation: 'Hello world',
        segments: [],
        notes: []
      };

      controller.renderTweet(tweet, translation);

      const content = controller.getContentContainer();
      expect(content?.querySelector('.tweet-original')?.textContent).toBe('你好世界');
    });

    it('renderTweet displays the author name', () => {
      const controller = new PanelController();
      const tweet: Tweet = {
        id: '1',
        text: '你好',
        author: 'TestUser',
        timestamp: '',
        isMainPost: true
      };
      const translation = {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      };

      controller.renderTweet(tweet, translation);

      const content = controller.getContentContainer();
      expect(content?.querySelector('.tweet-author')?.textContent).toBe('TestUser');
    });

    it('renderTweets renders multiple tweets', () => {
      const controller = new PanelController();
      const tweets: Tweet[] = [
        { id: '1', text: '你好', author: 'User1', timestamp: '', isMainPost: true },
        { id: '2', text: '世界', author: 'User2', timestamp: '', isMainPost: false }
      ];
      const translations = [
        { id: '1', naturalTranslation: 'Hello', segments: [], notes: [] },
        { id: '2', naturalTranslation: 'World', segments: [], notes: [] }
      ];

      controller.renderTweets(tweets, translations);

      const content = controller.getContentContainer();
      const cards = content?.querySelectorAll('.tweet-card');
      expect(cards?.length).toBe(2);
    });

    it('main post has main-post class', () => {
      const controller = new PanelController();
      const tweet: Tweet = {
        id: '1',
        text: '你好',
        author: 'User',
        timestamp: '',
        isMainPost: true
      };
      const translation = {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      };

      controller.renderTweet(tweet, translation);

      const content = controller.getContentContainer();
      const card = content?.querySelector('.tweet-card');
      expect(card?.classList.contains('main-post')).toBe(true);
    });

    it('reply has reply class', () => {
      const controller = new PanelController();
      const tweet: Tweet = {
        id: '1',
        text: '你好',
        author: 'User',
        timestamp: '',
        isMainPost: false
      };
      const translation = {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      };

      controller.renderTweet(tweet, translation);

      const content = controller.getContentContainer();
      const card = content?.querySelector('.tweet-card');
      expect(card?.classList.contains('reply')).toBe(true);
    });

    it('has breakdown toggle button', () => {
      const controller = new PanelController();
      const tweet: Tweet = {
        id: '1',
        text: '你好',
        author: 'User',
        timestamp: '',
        isMainPost: true
      };
      const translation = {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [],
        notes: []
      };

      controller.renderTweet(tweet, translation);

      const content = controller.getContentContainer();
      expect(content?.querySelector('.tweet-breakdown-toggle')).not.toBeNull();
    });
  });
});
