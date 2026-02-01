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
  
  // Debug: Log what Weibo elements exist on the page
  if (platform.name === 'weibo' && typeof console !== 'undefined') {
    const wbproLists = document.querySelectorAll('.wbpro-list');
    const item1s = document.querySelectorAll('.wbpro-list .item1');
    const item2s = document.querySelectorAll('.wbpro-list .item2');
    console.log(`[WEIBO-DEBUG] Page analysis:`);
    console.log(`  - .wbpro-list containers: ${wbproLists.length}`);
    console.log(`  - .item1 elements: ${item1s.length}`);
    console.log(`  - .item2 elements: ${item2s.length}`);
    console.log(`  - Expected replies: ${item1s.length + item2s.length}`);
    
    // Log each wbpro-list
    wbproLists.forEach((list, i) => {
      const listItem1 = list.querySelector('.item1');
      const listItem2s = list.querySelectorAll('.item2');
      const textPreview = listItem1?.querySelector('.text')?.textContent?.substring(0, 40) || 'no item1';
      console.log(`  - List ${i + 1}: ${listItem2s.length} subreplies, text: "${textPreview}..."`);
    });
  }

  const postSelector = platform.selectors.postContainer;
  const articles = Array.from(document.querySelectorAll(postSelector))
    .filter((article) => !article.parentElement?.closest(postSelector));
    
  if (platform.name === 'weibo' && typeof console !== 'undefined') {
    console.log(`[WEIBO-DEBUG] Articles found by selector "${postSelector}": ${articles.length}`);
    articles.forEach((article, i) => {
      console.log(`  - Article ${i + 1}: ${article.className || article.tagName} (matches .wbpro-list: ${article.matches('.wbpro-list')})`);
    });
  }
  
  const tweets: Tweet[] = [];
  const rowInfos: Array<{ parent: Element | null; index: number }> = [];
  
  // Global counter for Weibo entries to maintain proper ordering
  let weiboEntryCounter = 0;

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

  // Clean up Weibo metadata from text (timestamps, locations, reply counts)
  const sanitizeWeiboText = (value: string): string => {
    return value
      .replace(/Translate content/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/Total of\s+\d+\s+replies?/gi, '')
      .replace(/\b\d{2}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}\b/g, '')
      .replace(/\bfrom\s+\S+/gi, '')
      .replace(/\u6765\u81EA\s*\S+/g, '')  // Remove "来自" (from location)
      .replace(/\b\d+\s*(replies?|\u56DE\u590D|\u8BC4\u8BBA)\b/gi, '')
      .replace(/\u5171?\d+\u6761\u56DE\u590D/g, '')  // Remove "共X条回复"
      .trim();
  };

  // Extract entries from Weibo structured format (.wbpro-list with .item1/.item2)
  const extractWeiboStructuredEntries = (article: Element): Array<{
    author: string;
    text: string;
    timestamp: string;
    inlineReply: boolean;
  }> => {
    if (!article.matches('.wbpro-list')) {
      return [];
    }

    const entries: Array<{ author: string; text: string; timestamp: string; inlineReply: boolean }> = [];
    const debugInfo: string[] = [];
    
    debugInfo.push(`[WEIBO-DEBUG] Processing wbpro-list`);

    const extractEntry = (container: Element | null, inlineReply: boolean): void => {
      if (!container) {
        debugInfo.push(`  - Skipped: container is null`);
        return;
      }
      
      const textEl = container.querySelector('.text');
      if (!textEl) {
        debugInfo.push(`  - Skipped: no .text element found`);
        return;
      }

      // Author is in the <a> tag
      const authorEl = textEl.querySelector('a');
      const author = authorEl?.textContent?.trim() ?? '';
      const rawText = textEl.textContent?.trim() ?? '';

      debugInfo.push(`  - Raw: "${rawText.substring(0, 60)}..."`);
      debugInfo.push(`  - Author: "${author}"`);

      // Get text content and remove author prefix
      let text = rawText;
      // Remove author name and colon from start of text
      if (author && text.startsWith(author)) {
        text = text.slice(author.length).trim();
        if (text.startsWith(':') || text.startsWith('：')) {
          text = text.slice(1).trim();
        }
      }

      const cleanedText = sanitizeWeiboText(text);
      debugInfo.push(`  - Cleaned: "${cleanedText.substring(0, 60)}..."`);

      if (!author) {
        debugInfo.push(`  - REJECTED: no author`);
        return;
      }
      if (!cleanedText) {
        debugInfo.push(`  - REJECTED: no text after cleaning`);
        return;
      }
      if (/\u5171\d+\u6761\u56DE\u590D/.test(cleanedText)) {
        debugInfo.push(`  - REJECTED: matches reply count pattern`);
        return;
      }

      // Extract timestamp from .info element
      const infoText = container.querySelector('.info')?.textContent ?? '';
      const timeMatch = infoText.match(/\b\d{2}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}\b/);
      const timestamp = timeMatch?.[0] ?? '';

      debugInfo.push(`  - ACCEPTED: ${inlineReply ? 'subreply' : 'top-level'}`);
      entries.push({ author, text: cleanedText, timestamp, inlineReply });
    };

    // Extract top-level reply (item1)
    const item1 = article.querySelector('.item1');
    debugInfo.push(`  - Looking for .item1: ${item1 ? 'FOUND' : 'NOT FOUND'}`);
    extractEntry(item1, false);

    // Extract subreplies (item2 within list2)
    const replies = Array.from(article.querySelectorAll('.list2 .item2'));
    debugInfo.push(`  - Found ${replies.length} subreplies (.item2)`);
    replies.forEach((reply, i) => {
      debugInfo.push(`  - Processing subreply ${i + 1}/${replies.length}:`);
      extractEntry(reply, true);
    });

    debugInfo.push(`  - Total entries extracted: ${entries.length}`);
    
    // Output all debug info at once to prevent interleaving
    if (typeof console !== 'undefined') {
      debugInfo.forEach(line => console.log(line));
    }

    return entries;
  };

  articles.forEach((article, index) => {
    if (platform.name === 'weibo') {
      const structured = extractWeiboStructuredEntries(article);
      if (structured.length > 0) {
        structured.forEach((entry) => {
          const entryId = buildFallbackId(entry.text, entry.author, entry.timestamp);
          // Use the article (wbpro-list) itself as parent for proper grouping
          // Use global counter for index to maintain correct order across all wbpro-lists
          const entryRowInfo = { parent: article, index: weiboEntryCounter };
          weiboEntryCounter += 1;
          tweets.push({
            id: entryId,
            text: entry.text,
            author: entry.author,
            timestamp: entry.timestamp,
            isMainPost: index === 0 && weiboEntryCounter === 1,
            hasReplies: platform.hasReplies(article),
            inlineReply: entry.inlineReply,
          });
          rowInfos.push(entryRowInfo);
        });
        return;
      }
    }

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
    const rowInfo = getRowInfo(article);

    // For non-structured Weibo posts, clean the text
    let finalText = text;
    if (platform.name === 'weibo' && text) {
      finalText = sanitizeWeiboText(text);
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

    rowInfos.push(rowInfo);
  });

  // Exclude inline replies (nested replies) from thread scope
  // For Weibo, keep subreplies as they are part of the conversation structure
  let baseTweets = tweets;
  let baseRowInfos = rowInfos;
  const hasInlineReplies = tweets.some((tweet) => tweet.inlineReply);
  if (hasInlineReplies && platform.name !== 'weibo') {
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

  // Final debug output for Weibo
  if (platform.name === 'weibo' && typeof console !== 'undefined') {
    console.log(`[WEIBO-DEBUG] FINAL RESULT:`);
    console.log(`  - Total tweets extracted: ${filteredTweets.length}`);
    console.log(`  - Breakdown:`);
    filteredTweets.forEach((tweet, i) => {
      console.log(`    ${i + 1}. ${tweet.isMainPost ? '[MAIN]' : '[REPLY]'} ${tweet.author}: "${tweet.text.substring(0, 50)}..." ${tweet.inlineReply ? '(subreply)' : ''}`);
    });
  }

  return { tweets: filteredTweets };
}
