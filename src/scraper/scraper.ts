export interface Tweet {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  isMainPost: boolean;
  parentId?: string;
  depth?: number;
}

export interface ThreadData {
  tweets: Tweet[];
}

export interface ScrapeOptions {
  commentLimit?: number;
  excludeIds?: string[];
  parentId?: string;
}

export function scrapeTweets(options: ScrapeOptions = {}): ThreadData {
  const { commentLimit, excludeIds, parentId } = options;
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  const tweets: Tweet[] = [];

  const getTweetIdFromLink = (href: string): string => {
    const idMatch = href.match(/\/status\/(\d+)/);
    return idMatch ? idMatch[1] : '';
  };

  const getStatusId = (article: Element): string => {
    const timeEl = article.querySelector('time');
    const timeLink = timeEl?.closest('a[href*="/status/"]') as HTMLAnchorElement | null;
    const statusLink = timeLink ?? article.querySelector('a[href*="/status/"]');
    const href = statusLink?.getAttribute('href') ?? '';
    return getTweetIdFromLink(href);
  };

  const getParentId = (article: Element, selfId: string): string | undefined => {
    const dataParentId = article.getAttribute('data-parent-id');
    if (dataParentId) {
      return dataParentId;
    }

    const links = Array.from(article.querySelectorAll('a[href*="/status/"]'));
    const ids = links
      .map((link) => getTweetIdFromLink(link.getAttribute('href') ?? ''))
      .filter((id) => id && id !== selfId);

    return ids.length > 0 ? ids[0] : undefined;
  };

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
    const id = getStatusId(article);
    const parent = getParentId(article, id);

    // First tweet is main post
    const isMainPost = index === 0;

    tweets.push({
      id,
      text,
      author,
      timestamp,
      isMainPost,
      parentId: parent,
    });
  });

  // Apply comment limit (first tweet is main post, rest are comments)
  let limitedTweets = tweets;
  if (commentLimit !== undefined && tweets.length > 1) {
    const mainPost = tweets[0];
    const comments = tweets.slice(1, 1 + commentLimit);
    limitedTweets = [mainPost, ...comments];
  }

  const byId = new Map<string, Tweet>();
  limitedTweets.forEach((tweet) => {
    if (tweet.id) {
      byId.set(tweet.id, tweet);
    }
  });

  const resolveDepth = (tweet: Tweet, stack: Set<string> = new Set()): number => {
    if (typeof tweet.depth === 'number') {
      return tweet.depth;
    }
    if (!tweet.parentId) {
      tweet.depth = tweet.isMainPost ? 0 : 1;
      return tweet.depth;
    }
    if (stack.has(tweet.id)) {
      tweet.depth = 1;
      return tweet.depth;
    }
    const parentTweet = byId.get(tweet.parentId);
    if (!parentTweet) {
      tweet.depth = 1;
      return tweet.depth;
    }
    stack.add(tweet.id);
    tweet.depth = resolveDepth(parentTweet, stack) + 1;
    stack.delete(tweet.id);
    return tweet.depth;
  };

  limitedTweets.forEach((tweet) => {
    resolveDepth(tweet);
  });

  let filteredTweets = limitedTweets;

  if (excludeIds && excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds);
    filteredTweets = filteredTweets.filter((tweet) => !excludeSet.has(tweet.id));
  }

  if (parentId) {
    filteredTweets = filteredTweets.filter((tweet) => tweet.parentId === parentId);
  }

  return { tweets: filteredTweets };
}
