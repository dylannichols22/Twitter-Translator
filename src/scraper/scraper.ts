import { getCurrentPlatform, Platform, twitterPlatform } from '../platforms';

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

/**
 * Gets the post container selector for the current platform.
 * Falls back to Twitter selector if platform unknown.
 */
export function getPostSelector(): string {
  const platform = getCurrentPlatform();
  return platform?.selectors.postContainer ?? twitterPlatform.selectors.postContainer;
}

/** @deprecated Use getPostSelector() instead for platform-aware selector */
export const TWEET_SELECTOR = 'article[data-testid="tweet"], div[data-testid="tweet"]';

/**
 * Scrapes posts from the current page using platform-aware selectors.
 */
export function scrapeTweets(options: ScrapeOptions = {}): ThreadData {
  const { commentLimit, excludeIds } = options;

  // Get the current platform (falls back to Twitter if unknown)
  const platform: Platform = getCurrentPlatform() ?? twitterPlatform;

  const postSelector = platform.selectors.postContainer;
  const articles = Array.from(document.querySelectorAll(postSelector))
    .filter((article) => !article.parentElement?.closest(postSelector));
  const tweets: Tweet[] = [];
  const rowInfos: Array<{ parent: Element | null; index: number }> = [];

  const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  };

  const buildFallbackId = (text: string, author: string, timestamp: string): string => {
    const base = `${author}|${timestamp}|${text}`;
    return `fallback-${hashString(base)}`;
  };

  const getRowInfo = (article: Element): { parent: Element | null; index: number } => {
    const cellSelector = platform.selectors.cellContainer;
    const row = article.closest(cellSelector) ?? article.parentElement;
    if (!row || !row.parentElement) {
      return { parent: null, index: -1 };
    }
    const siblings = Array.from(row.parentElement.children);
    return { parent: row.parentElement, index: siblings.indexOf(row) };
  };

  const findWithinOrSelf = (element: Element, selector: string): Element | null =>
    element.querySelector(selector) ?? (element.matches(selector) ? element : null);

  const findFirstTextMatch = (element: Element, selector: string): Element | null => {
    const matches = Array.from(element.querySelectorAll(selector));
    const withText = matches.find((match) => (match.textContent ?? '').trim().length > 0);
    if (withText) return withText;
    return element.matches(selector) && (element.textContent ?? '').trim().length > 0
      ? element
      : null;
  };

  articles.forEach((article, index) => {
    // Extract text using platform selector
    const textEl = findWithinOrSelf(article, platform.selectors.postText);
    const text = textEl?.textContent?.trim() ?? '';

    // Extract author using platform selector
    const authorEl = findFirstTextMatch(article, platform.selectors.authorName);
    let author = authorEl?.textContent?.trim() ?? '';

    // Extract timestamp using platform selector
    const timeEl = findWithinOrSelf(article, platform.selectors.timestamp);
    const timestamp = timeEl?.getAttribute('datetime') ?? timeEl?.textContent?.trim() ?? '';

    // Extract ID using platform method
    const resolvedId = platform.extractPostIdFromElement(article);
    let finalText = text;
    if (!author && platform.name === 'weibo' && text) {
      const match = text.match(/^\s*([^:：]{1,30})[:：]\s*(.+)$/);
      if (match) {
        author = match[1].trim();
        finalText = match[2].trim();
      }
    }

    const id = resolvedId || buildFallbackId(finalText, author, timestamp);

    // Get reply status using platform method
    const hasReplies = platform.hasReplies(article);

    // Get URL using platform method
    const url = platform.getPostUrl(article);

    // Check if inline reply using platform method
    const inlineReply = platform.isInlineReply(article);

    // First tweet is main post
    const isMainPost = index === 0;

    tweets.push({
      id,
      text: finalText,
      author,
      timestamp,
      isMainPost,
      url,
      hasReplies,
      inlineReply,
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
