import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMessage, ContentScriptHandler } from './content';
import { MESSAGE_TYPES, Message } from './messages';

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

describe('Content Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    // Default to Twitter URL
    Object.defineProperty(window, 'location', {
      value: { href: 'https://twitter.com/user/status/123' },
      writable: true,
      configurable: true,
    });
  });

  describe('handleMessage', () => {
    it('responds to SCRAPE_PAGE message with scraped tweets', async () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="User-Name">TestUser</div>
          <div data-testid="tweetText"><span>你好世界</span></div>
          <time datetime="2024-01-15T10:30:00.000Z">Jan 15</time>
          <a href="/user/status/123">link</a>
        </article>
      `;

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
      });

      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.tweets).toHaveLength(1);
      expect(response!.tweets![0].text).toBe('你好世界');
    });

    it('includes current URL in response', async () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>测试</span></div>
        </article>
      `;

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
      });

      expect(response).toBeDefined();
      expect(response!.url).toBe('https://twitter.com/user/status/123');
    });


    it('expands replies before scraping when requested', async () => {
      mockRuntime.sendMessage.mockResolvedValue({ commentLimit: 10 });
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>Main</span></div>
        </article>
        <button type="button">Show replies</button>
      `;

      const button = document.querySelector('button');
      button?.addEventListener('click', () => {
        const reply = document.createElement('article');
        reply.setAttribute('data-testid', 'tweet');
        reply.innerHTML = '<div data-testid="tweetText"><span>Reply</span></div>';
        document.body.appendChild(reply);
      });

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: { expandReplies: true },
      });

      expect(response?.success).toBe(true);
      expect(response?.tweets).toHaveLength(1);
      expect(response?.tweets?.[0].text).toBe('Main');
    });

    it('returns existing replies quickly when already rendered', async () => {
      mockRuntime.sendMessage.mockResolvedValue({ commentLimit: 10 });
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>Main</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>Reply</span></div>
        </article>
      `;

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: { expandReplies: true },
      });

      expect(response?.success).toBe(true);
      expect(response?.tweets).toHaveLength(2);
    });

    it('passes scrape options from message data', async () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <a href="/user/status/111"><time datetime="2024-01-15T10:30:00.000Z">Jan 15</time></a>
          <div data-testid="tweetText"><span>主帖</span></div>
        </article>
        <article data-testid="tweet">
          <a href="/user/status/222"><time datetime="2024-01-15T10:31:00.000Z">Jan 15</time></a>
          <div data-testid="tweetText"><span>评论1</span></div>
        </article>
      `;

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: { excludeIds: ['222'], commentLimit: 2 },
      });

      expect(response).toBeDefined();
      expect(response!.success).toBe(true);
      expect(response!.tweets).toHaveLength(1);
      expect(response!.tweets![0].id).toBe('111');
    });

    it('returns error for non-Twitter pages', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/page' },
        writable: true,
        configurable: true,
      });

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
      });

      expect(response).toBeDefined();
      expect(response!.success).toBe(false);
      expect(response!.error).toContain('supported platform');
    });

    it('ignores unknown message types', async () => {
      // Cast to Message to test unknown types at runtime
      const response = await handleMessage({
        type: MESSAGE_TYPES.GET_SETTINGS, // Use a different valid type that content script doesn't handle
      } as Message);

      // GET_SETTINGS is not handled by content script's handleMessage
      expect(response).toBeUndefined();
    });

    it('scrolls to load more when requested', async () => {
      mockRuntime.sendMessage.mockResolvedValue({ commentLimit: 10 });
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>Main</span></div>
        </article>
      `;

      const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {
        const reply = document.createElement('article');
        reply.setAttribute('data-testid', 'tweet');
        reply.innerHTML = '<div data-testid="tweetText"><span>Reply</span></div>';
        document.body.appendChild(reply);
      });

      const response = await handleMessage({
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: { scrollToLoadMore: true, commentLimit: 10, scrollMaxRounds: 2, scrollIdleRounds: 1 },
      });

      expect(response?.success).toBe(true);
      expect(scrollSpy).toHaveBeenCalled();
      scrollSpy.mockRestore();
    });
  });

  describe('ContentScriptHandler', () => {
    it('registers message listener on initialization', () => {
      new ContentScriptHandler();
      expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
    });

    it('scrapes page and sends to background on request', async () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>你好</span></div>
        </article>
      `;

      const handler = new ContentScriptHandler();
      const result = await handler.scrapePage();

      expect(result.success).toBe(true);
      expect(result.tweets).toHaveLength(1);
    });

    it('validates Twitter URL before scraping', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://google.com' },
        writable: true,
        configurable: true,
      });

      const handler = new ContentScriptHandler();
      const result = await handler.scrapePage();

      expect(result.success).toBe(false);
    });

    it('gets comment limit from settings', async () => {
      mockRuntime.sendMessage.mockResolvedValue({ commentLimit: 5 });

      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>主帖</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>评论1</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>评论2</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>评论3</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>评论4</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>评论5</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>评论6</span></div>
        </article>
      `;

      const handler = new ContentScriptHandler();
      const result = await handler.scrapePage();

      // 1 main post + 5 comments (limited by setting)
      expect(result.tweets).toHaveLength(6);
    });
  });
});

