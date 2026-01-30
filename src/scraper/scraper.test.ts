import { describe, it, expect, beforeEach } from 'vitest';
import { scrapeTweets } from './scraper';

describe('Twitter Scraper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('scrapeTweets', () => {
    it('extracts tweet text from data-testid="tweetText"', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText">
            <span>你好世界</span>
          </div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].text).toBe('你好世界');
    });

    it('extracts author name from User-Name', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="User-Name">
            <span>测试用户</span>
          </div>
          <div data-testid="tweetText">
            <span>测试内容</span>
          </div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].author).toBe('测试用户');
    });

    it('extracts timestamp from time element', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <time datetime="2024-01-15T10:30:00.000Z">Jan 15</time>
          <div data-testid="tweetText">
            <span>测试</span>
          </div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].timestamp).toBe('2024-01-15T10:30:00.000Z');
    });

    it('extracts multiple tweets in order', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>第一条</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>第二条</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>第三条</span></div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets).toHaveLength(3);
      expect(result.tweets[0].text).toBe('第一条');
      expect(result.tweets[1].text).toBe('第二条');
      expect(result.tweets[2].text).toBe('第三条');
    });

    it('respects comment limit parameter', () => {
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
      `;

      const result = scrapeTweets({ commentLimit: 2 });
      // First tweet is the main post, then limit applies to comments
      expect(result.tweets).toHaveLength(3); // 1 main + 2 comments
    });

    it('identifies main post vs replies', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>主帖内容</span></div>
        </article>
        <article data-testid="tweet">
          <div data-testid="tweetText"><span>回复内容</span></div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].isMainPost).toBe(true);
      expect(result.tweets[1].isMainPost).toBe(false);
    });

    it('returns empty array when no tweets found', () => {
      document.body.innerHTML = '<div>No tweets here</div>';

      const result = scrapeTweets();
      expect(result.tweets).toHaveLength(0);
    });

    it('handles tweets with empty text gracefully', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <div data-testid="tweetText"></div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].text).toBe('');
    });

    it('extracts tweet ID from article or link', () => {
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://twitter.com' },
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <article data-testid="tweet" aria-labelledby="id__123">
          <a href="/user/status/1234567890">
            <time datetime="2024-01-15T10:30:00.000Z">Jan 15</time>
          </a>
          <div data-testid="tweetText"><span>测试</span></div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].id).toBe('1234567890');
      expect(result.tweets[0].url).toBe('https://twitter.com/user/status/1234567890');
    });
    it('filters out excluded tweet IDs', () => {
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

      const result = scrapeTweets({ excludeIds: ['222'] });
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].id).toBe('111');
    });


    it('detects replies count for tweet', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <a href="/user/status/200"><time datetime="2024-01-15T10:30:00.000Z">Jan 15</time></a>
          <div data-testid="tweetText"><span>ä¸»å¸–</span></div>
          <div data-testid="reply" aria-label="2 Replies"></div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].hasReplies).toBe(true);
    });

    it('marks inline replies when preceded by a show replies cell', () => {
      document.body.innerHTML = `
        <div data-testid="cellInnerDiv">
          <button type="button">Show replies</button>
        </div>
        <div data-testid="cellInnerDiv">
          <article data-testid="tweet">
            <a href="/user/status/300"><time datetime="2024-01-15T10:30:00.000Z">Jan 15</time></a>
            <div data-testid="tweetText"><span>Inline reply</span></div>
          </article>
        </div>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].inlineReply).toBe(true);
    });

    it('marks no replies when reply count is zero', () => {
      document.body.innerHTML = `
        <article data-testid="tweet">
          <a href="/user/status/201"><time datetime="2024-01-15T10:30:00.000Z">Jan 15</time></a>
          <div data-testid="tweetText"><span>ä¸»å¸–</span></div>
          <div data-testid="reply" aria-label="0 Replies"></div>
        </article>
      `;

      const result = scrapeTweets();
      expect(result.tweets[0].hasReplies).toBe(false);
    });

    it('marks group boundaries when non-tweet rows separate replies', () => {
      document.body.innerHTML = `
        <div data-testid="cellInnerDiv">
          <article data-testid="tweet">
            <div data-testid="tweetText"><span>First</span></div>
          </article>
        </div>
        <div data-testid="cellInnerDiv">
          <article data-testid="tweet">
            <div data-testid="tweetText"><span>Second</span></div>
          </article>
        </div>
        <div data-testid="cellInnerDiv">
          <button type="button">Show replies</button>
        </div>
        <div data-testid="cellInnerDiv">
          <article data-testid="tweet">
            <div data-testid="tweetText"><span>Third</span></div>
          </article>
        </div>
      `;

      const result = scrapeTweets();
      expect(result.tweets).toHaveLength(3);
      expect(result.tweets[0].groupStart).toBe(true);
      expect(result.tweets[0].groupEnd).toBe(false);
      expect(result.tweets[1].groupStart).toBe(false);
      expect(result.tweets[1].groupEnd).toBe(true);
      expect(result.tweets[2].groupStart).toBe(true);
      expect(result.tweets[2].groupEnd).toBe(true);
    });

    it('keeps group continuity when adjacent rows are excluded', () => {
      document.body.innerHTML = `
        <div data-testid="cellInnerDiv">
          <article data-testid="tweet">
            <a href="/user/status/10"><time datetime="2024-01-15T10:30:00.000Z">Jan 15</time></a>
            <div data-testid="tweetText"><span>First</span></div>
          </article>
        </div>
        <div data-testid="cellInnerDiv">
          <article data-testid="tweet">
            <a href="/user/status/11"><time datetime="2024-01-15T10:31:00.000Z">Jan 15</time></a>
            <div data-testid="tweetText"><span>Second</span></div>
          </article>
        </div>
      `;

      const result = scrapeTweets({ excludeIds: ['10'] });
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].id).toBe('11');
      expect(result.tweets[0].groupStart).toBe(false);
      expect(result.tweets[0].groupEnd).toBe(true);
    });
  });
});

