export interface Tweet {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  isMainPost: boolean;
}

export interface ThreadData {
  tweets: Tweet[];
}

export interface ScrapeOptions {
  commentLimit?: number;
}

export function scrapeTweets(options: ScrapeOptions = {}): ThreadData {
  const { commentLimit } = options;
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets: Tweet[] = [];

  articles.forEach((article, index) => {
    // Extract text
    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    const text = tweetTextEl?.textContent?.trim() ?? '';

    // Extract author
    const userNameEl = article.querySelector('[data-testid="User-Name"]');
    const author = userNameEl?.textContent?.trim() ?? '';

    // Extract timestamp
    const timeEl = article.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') ?? '';

    // Extract ID from status link
    const statusLink = article.querySelector('a[href*="/status/"]');
    const href = statusLink?.getAttribute('href') ?? '';
    const idMatch = href.match(/\/status\/(\d+)/);
    const id = idMatch ? idMatch[1] : '';

    // First tweet is main post
    const isMainPost = index === 0;

    tweets.push({
      id,
      text,
      author,
      timestamp,
      isMainPost,
    });
  });

  // Apply comment limit (first tweet is main post, rest are comments)
  if (commentLimit !== undefined && tweets.length > 1) {
    const mainPost = tweets[0];
    const comments = tweets.slice(1, 1 + commentLimit);
    return { tweets: [mainPost, ...comments] };
  }

  return { tweets };
}
