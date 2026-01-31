/**
 * Twitter Platform Implementation
 * Handles Twitter/X specific DOM selectors and URL patterns.
 */

import { Platform, PlatformSelectors } from './types';

const TWITTER_HOSTS = ['twitter.com', 'x.com'] as const;

const STATUS_PATH_REGEX = /^\/[^/]+\/status\/(\d+)/;

const TWEET_ID_ATTRIBUTES = ['data-tweet-id', 'data-item-id', 'data-id', 'id'] as const;

const TWITTER_SELECTORS: PlatformSelectors = {
  postContainer: 'article[data-testid="tweet"], div[data-testid="tweet"]',
  postText: '[data-testid="tweetText"]',
  authorName: '[data-testid="User-Name"]',
  timestamp: 'time',
  replyButton: '[data-testid="reply"]',
  showRepliesButton: '[data-testid="showMoreReplies"],[data-testid="showReplies"]',
  mainColumn: 'main[role="main"]',
  cellContainer: '[data-testid="cellInnerDiv"]',
};

class TwitterPlatform implements Platform {
  readonly name = 'twitter';
  readonly hosts = TWITTER_HOSTS;
  readonly selectors = TWITTER_SELECTORS;

  // ============================================================
  // URL Handling Methods
  // ============================================================

  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return TWITTER_HOSTS.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      );
    } catch {
      return false;
    }
  }

  isThreadUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const isTwitterHost = TWITTER_HOSTS.some((host) => parsed.hostname.endsWith(host));
      if (!isTwitterHost) return false;
      return STATUS_PATH_REGEX.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  extractPostId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(STATUS_PATH_REGEX);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Normalize x.com to twitter.com
      const normalizedHost = parsed.hostname.replace(/(^|\.)x\.com$/, '$1twitter.com');
      // Keep only the path (no query params or hash)
      return `https://${normalizedHost}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  // ============================================================
  // Element Methods
  // ============================================================

  extractPostIdFromElement(element: Element): string | null {
    // Try attribute-based ID extraction first
    for (const attr of TWEET_ID_ATTRIBUTES) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const match = value.match(/(\d{5,})/);
      if (match) return match[1];
    }

    // Fall back to link-based extraction
    const link = this.findPrimaryPostLink(element);
    if (link) {
      const href = link.getAttribute('href') ?? '';
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }

    // Try any status link within the element
    const statusLink = element.querySelector('a[href*="/status/"]');
    if (statusLink) {
      const href = statusLink.getAttribute('href') ?? '';
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }

    return null;
  }

  hasReplies(element: Element): boolean | undefined {
    const replyButton = element.querySelector(this.selectors.replyButton);
    if (!replyButton) return undefined;

    const label = replyButton.getAttribute('aria-label') ?? replyButton.textContent ?? '';
    const match = label.match(/(\d+)/);
    if (match) {
      return Number.parseInt(match[1], 10) > 0;
    }
    return undefined;
  }

  isInlineReply(element: Element): boolean {
    const hasShowReplies = (el: Element | null): boolean => {
      if (!el) return false;
      const hasTestId = !!el.querySelector(this.selectors.showRepliesButton);
      if (hasTestId) return true;
      const text = el.textContent?.toLowerCase() ?? '';
      return text.includes('show replies') || text.includes('show more replies');
    };

    const cell = element.closest(this.selectors.cellContainer);
    if (hasShowReplies(cell?.previousElementSibling ?? null)) {
      return true;
    }

    if (hasShowReplies(element.previousElementSibling)) {
      return true;
    }

    return false;
  }

  findPrimaryPostLink(element: Element): HTMLAnchorElement | null {
    // Find time elements and get their parent status links
    const timeLinks = Array.from(element.querySelectorAll('time'))
      .map((timeEl) => timeEl.closest('a[href*="/status/"]'))
      .filter((link): link is HTMLAnchorElement => !!link);

    // Return the first link that belongs directly to this element (not nested)
    for (const link of timeLinks) {
      if (link.closest('[data-testid="tweet"]') === element) {
        return link;
      }
    }

    // Fall back to any status links directly in this element
    const links = Array.from(element.querySelectorAll('a[href*="/status/"]'))
      .filter((link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement)
      .filter((link) => link.closest('[data-testid="tweet"]') === element);

    return links[0] ?? null;
  }

  getPostUrl(element: Element): string | undefined {
    const link = this.findPrimaryPostLink(element);
    const href = link?.getAttribute('href') ?? '';
    if (!href) return undefined;
    if (href.startsWith('http')) return href;
    return `${window.location.origin}${href}`;
  }
}

/** Singleton instance of the Twitter platform */
export const twitterPlatform = new TwitterPlatform();

export default twitterPlatform;
