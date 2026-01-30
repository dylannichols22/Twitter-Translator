export interface Tweet {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  isMainPost: boolean;
  url?: string;
  hasReplies?: boolean;
  inlineReply?: boolean;
  groupStart?: boolean;
  groupEnd?: boolean;
}

export interface ThreadData {
  tweets: Tweet[];
}

export interface ScrapeOptions {
  commentLimit?: number;
  excludeIds?: string[];
  expandReplies?: boolean;
  scrollToLoadMore?: boolean;
  scrollMaxRounds?: number;
  scrollIdleRounds?: number;
}

export function scrapeTweets(options: ScrapeOptions = {}): ThreadData {
  const { commentLimit, excludeIds } = options;
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    .filter((article) => !article.parentElement?.closest('article[data-testid="tweet"]'));
  const tweets: Tweet[] = [];
  const rowInfos: Array<{ parent: Element | null; index: number }> = [];

  const getTweetIdFromLink = (href: string): string => {
    const idMatch = href.match(/\/status\/(\d+)/);
    return idMatch ? idMatch[1] : '';
  };

  const findPrimaryStatusLink = (article: Element): HTMLAnchorElement | null => {
    const timeLinks = Array.from(article.querySelectorAll('time'))
      .map((timeEl) => timeEl.closest('a[href*="/status/"]'))
      .filter((link): link is HTMLAnchorElement => !!link);

    for (const link of timeLinks) {
      if (link.closest('article[data-testid="tweet"]') === article) {
        return link;
      }
    }

    const links = Array.from(article.querySelectorAll('a[href*="/status/"]'))
      .filter((link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement)
      .filter((link) => link.closest('article[data-testid="tweet"]') === article);

    return links[0] ?? null;
  };

  const getStatusLink = (article: Element): HTMLAnchorElement | null => {
    return findPrimaryStatusLink(article);
  };

  const getStatusId = (article: Element): string => {
    const statusLink = getStatusLink(article);
    const href = statusLink?.getAttribute('href') ?? '';
    return getTweetIdFromLink(href);
  };

  const getStatusUrl = (article: Element): string | undefined => {
    const statusLink = getStatusLink(article);
    const href = statusLink?.getAttribute('href') ?? '';
    if (!href) return undefined;
    if (href.startsWith('http')) return href;
    return `${window.location.origin}${href}`;
  };

  const getReplyCount = (article: Element): number | undefined => {
    const replyButton = article.querySelector('[data-testid="reply"]');
    if (!replyButton) return undefined;

    const label = replyButton.getAttribute('aria-label') ?? replyButton.textContent ?? '';
    const match = label.match(/(\d+)/);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
    return undefined;
  };

  const isInlineReply = (article: Element): boolean => {
    const hasShowReplies = (el: Element | null): boolean => {
      if (!el) return false;
      const hasTestId = !!el.querySelector('[data-testid="showMoreReplies"],[data-testid="showReplies"]');
      if (hasTestId) return true;
      const text = el.textContent?.toLowerCase() ?? '';
      return text.includes('show replies') || text.includes('show more replies');
    };

    const cell = article.closest('[data-testid="cellInnerDiv"]');
    if (hasShowReplies(cell?.previousElementSibling ?? null)) {
      return true;
    }

    if (hasShowReplies(article.previousElementSibling)) {
      return true;
    }

    return false;
  };

  const getRowInfo = (article: Element): { parent: Element | null; index: number } => {
    const row = article.closest('[data-testid="cellInnerDiv"]') ?? article.parentElement;
    if (!row || !row.parentElement) {
      return { parent: null, index: -1 };
    }
    const siblings = Array.from(row.parentElement.children);
    return { parent: row.parentElement, index: siblings.indexOf(row) };
  };

  const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  };

  const buildFallbackId = (text: string, author: string, timestamp: string, index: number): string => {
    const base = `${author}|${timestamp}|${text}|${index}`;
    return `fallback-${hashString(base)}`;
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
    const resolvedId = getStatusId(article);
    const id = resolvedId || buildFallbackId(text, author, timestamp, index);
    const replyCount = getReplyCount(article);
    const url = getStatusUrl(article);

    // First tweet is main post
    const isMainPost = index === 0;

    tweets.push({
      id,
      text,
      author,
      timestamp,
      isMainPost,
      url,
      hasReplies: replyCount === undefined ? undefined : replyCount > 0,
      inlineReply: isInlineReply(article),
    });

    rowInfos.push(getRowInfo(article));
  });

  // Exclude inline replies (nested replies) from thread scope
  let baseTweets = tweets;
  let baseRowInfos = rowInfos;
  if (tweets.some((tweet) => tweet.inlineReply)) {
    const nextTweets: Tweet[] = [];
    const nextRows: Array<{ parent: Element | null; index: number }> = [];
    tweets.forEach((tweet, idx) => {
      if (!tweet.inlineReply) {
        nextTweets.push(tweet);
        nextRows.push(rowInfos[idx]);
      }
    });
    baseTweets = nextTweets;
    baseRowInfos = nextRows;
  }

  // Apply comment limit (first tweet is main post, rest are comments)
  let limitedTweets = baseTweets;
  let limitedRowInfos = baseRowInfos;
  if (commentLimit !== undefined && baseTweets.length > 1) {
    const mainPost = baseTweets[0];
    const comments = baseTweets.slice(1, 1 + commentLimit);
    limitedTweets = [mainPost, ...comments];
    limitedRowInfos = [baseRowInfos[0], ...baseRowInfos.slice(1, 1 + commentLimit)];
  }

  const excludeSet = excludeIds && excludeIds.length > 0 ? new Set(excludeIds) : undefined;
  const rowsByParent = new WeakMap<Element, Map<number, { id: string; excluded: boolean }>>();
  limitedTweets.forEach((tweet, idx) => {
    const row = limitedRowInfos[idx];
    if (!row.parent || row.index < 0) return;
    let rows = rowsByParent.get(row.parent);
    if (!rows) {
      rows = new Map();
      rowsByParent.set(row.parent, rows);
    }
    rows.set(row.index, { id: tweet.id, excluded: excludeSet?.has(tweet.id) ?? false });
  });

  let filteredTweets = limitedTweets;
  let filteredRowInfos = limitedRowInfos;

  if (excludeSet && excludeSet.size > 0) {
    const nextTweets: Tweet[] = [];
    const nextRows: Array<{ parent: Element | null; index: number }> = [];
    filteredTweets.forEach((tweet, idx) => {
      if (!excludeSet.has(tweet.id)) {
        nextTweets.push(tweet);
        nextRows.push(filteredRowInfos[idx]);
      }
    });
    filteredTweets = nextTweets;
    filteredRowInfos = nextRows;
  }

  const areAdjacent = (
    prev: { parent: Element | null; index: number } | undefined,
    curr: { parent: Element | null; index: number } | undefined
  ): boolean => {
    if (!prev || !curr) return false;
    if (!prev.parent || !curr.parent) return false;
    if (prev.index < 0 || curr.index < 0) return false;
    if (prev.parent !== curr.parent) return false;
    const rows = rowsByParent.get(curr.parent);
    if (!rows) return false;
    const prevRow = rows.get(prev.index);
    const currRow = rows.get(curr.index);
    if (!prevRow || !currRow) return false;
    if (prevRow.excluded || currRow.excluded) return false;
    return curr.index === prev.index + 1;
  };

  const hasRowNeighbor = (
    curr: { parent: Element | null; index: number } | undefined,
    direction: -1 | 1
  ): boolean => {
    if (!curr || !curr.parent || curr.index < 0) return false;
    const rows = rowsByParent.get(curr.parent);
    if (!rows) return false;
    const neighbor = rows.get(curr.index + direction);
    return !!neighbor && !neighbor.excluded;
  };

  filteredTweets.forEach((tweet, idx) => {
    const prev = filteredRowInfos[idx - 1];
    const curr = filteredRowInfos[idx];
    const next = filteredRowInfos[idx + 1];
    const hasPrev = areAdjacent(prev, curr) || hasRowNeighbor(curr, -1);
    const hasNext = areAdjacent(curr, next) || hasRowNeighbor(curr, 1);
    tweet.groupStart = !hasPrev;
    tweet.groupEnd = !hasNext;
  });

  return { tweets: filteredTweets };
}
