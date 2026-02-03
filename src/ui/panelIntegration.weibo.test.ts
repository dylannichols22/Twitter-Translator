import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeTweets } from '../scraper/scraper';
import { PanelIntegration } from './panelIntegration';
import { destroyPanel } from './panel';

// Mock browser APIs
const mockRuntime = {
  sendMessage: vi.fn(),
};

const mockTabs = {
  sendMessage: vi.fn(),
};

(globalThis as unknown as { browser: unknown }).browser = {
  runtime: mockRuntime,
  tabs: mockTabs,
};

describe('PanelIntegration Weibo Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockRuntime.sendMessage.mockResolvedValue({ apiKey: 'test-key', commentLimit: 10 });
  });

  afterEach(() => {
    destroyPanel();
  });

  it('extracts same Weibo entries as scraper for panel sync', () => {
    // Set up Weibo detail page FIRST (before creating PanelIntegration)
    Object.defineProperty(window, 'location', {
      value: { 
        href: 'https://weibo.com/3036474003/QpvUKvcOp',
        origin: 'https://weibo.com',
        pathname: '/3036474003/QpvUKvcOp'
      },
      writable: true,
      configurable: true,
    });

    // Create Weibo DOM structure with proper selectors
    document.body.innerHTML = `
      <div id="app">
        <article class="woo-panel-main">
          <div class="_wbtext_abc">Main post content</div>
          <h4 class="m-text-cut">MainAuthor</h4>
          <span class="head_time">26-1-29 17:00</span>
        </article>
        <div class="wbpro-list">
          <div class="item1">
            <div class="text"><a>TopUser</a>:<span>Top reply</span></div>
            <div class="info">26-1-29 17:45</div>
          </div>
          <div class="list2">
            <div class="item2">
              <div class="text"><a>SubUser1</a>:<span>First sub reply</span></div>
              <div class="info">26-1-29 17:46</div>
            </div>
            <div class="item2">
              <div class="text"><a>SubUser2</a>:<span>Second sub reply</span></div>
              <div class="info">26-1-29 17:47</div>
            </div>
          </div>
        </div>
        <div class="wbpro-list">
          <div class="item1">
            <div class="text"><a>AnotherUser</a>:<span>Another top reply</span></div>
            <div class="info">26-1-29 18:00</div>
          </div>
        </div>
      </div>
    `;

    // Scrape using scraper.ts
    const scraperResult = scrapeTweets();
    
    // Scrape using panelIntegration's getMainColumnTweetIds
    // Note: Create integration AFTER setting up URL and DOM
    const integration = new PanelIntegration();

    const mainColumnIds = (integration as unknown as {
      getMainColumnTweetIds: () => Set<string>;
    }).getMainColumnTweetIds();

    // Both should find the same number of entries
    expect(mainColumnIds.size).toBe(scraperResult.tweets.length);
    expect(scraperResult.tweets.length).toBe(5);

    // Every scraper tweet ID should be in mainColumnIds
    scraperResult.tweets.forEach(tweet => {
      expect(mainColumnIds.has(tweet.id)).toBe(true);
    });

    integration.destroy();
  });

  it('includes all subreplies in correct order', () => {
    Object.defineProperty(window, 'location', {
      value: { 
        href: 'https://weibo.com/3036474003/QpvUKvcOp',
        origin: 'https://weibo.com'
      },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <main>
        <article class="woo-panel-main">
          <div class="_wbtext_abc">Main post</div>
          <h4 class="m-text-cut">Author</h4>
        </article>
        <div class="wbpro-list">
          <div class="item1">
            <div class="text"><a>Reply1</a>:<span>First reply</span></div>
            <div class="info">26-1-29 17:45</div>
          </div>
          <div class="list2">
            <div class="item2">
              <div class="text"><a>Sub1</a>:<span>Subreply 1</span></div>
              <div class="info">26-1-29 17:46</div>
            </div>
            <div class="item2">
              <div class="text"><a>Sub2</a>:<span>Subreply 2</span></div>
              <div class="info">26-1-29 17:47</div>
            </div>
            <div class="item2">
              <div class="text"><a>Sub3</a>:<span>Subreply 3</span></div>
              <div class="info">26-1-29 17:48</div>
            </div>
          </div>
        </div>
      </main>
    `;

    const result = scrapeTweets();
    
    // Should have: main + 1 top-level + 3 subreplies = 5 total
    expect(result.tweets).toHaveLength(5);
    
    // Check order: main, top-level, sub1, sub2, sub3
    expect(result.tweets[0].text).toBe('Main post');
    expect(result.tweets[1].text).toBe('First reply');
    expect(result.tweets[2].text).toBe('Subreply 1');
    expect(result.tweets[3].text).toBe('Subreply 2');
    expect(result.tweets[4].text).toBe('Subreply 3');
    
    // Check inlineReply flags
    expect(result.tweets[1].inlineReply).toBe(false);
    expect(result.tweets[2].inlineReply).toBe(true);
    expect(result.tweets[3].inlineReply).toBe(true);
    expect(result.tweets[4].inlineReply).toBe(true);
  });
});
