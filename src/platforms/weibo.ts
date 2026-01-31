/**
 * Weibo Platform Implementation
 * Handles Weibo specific DOM selectors and URL patterns.
 *
 * NOTE: Weibo's DOM structure varies between desktop and mobile versions.
 * These selectors are based on research and may need adjustment after testing.
 */

import { Platform, PlatformSelectors } from './types';

const WEIBO_HOSTS = ['weibo.com', 'weibo.cn', 'm.weibo.cn'] as const;

// Weibo post detail URL patterns:
// - weibo.com/detail/[id] - new detail page format
// - weibo.com/[uid]/[mid] - legacy user/post format
// - weibo.com/[uid]?refer_flag=... - user profile (not a thread)
const DETAIL_PATH_REGEX = /^\/detail\/(\d+)/;
const LEGACY_POST_REGEX = /^\/(\d+)\/([A-Za-z0-9]+)/;

// TODO: These selectors need verification against actual Weibo DOM
// Weibo uses different class names and structures than Twitter
const WEIBO_SELECTORS: PlatformSelectors = {
  // Main post/weibo container - Weibo uses div with specific classes
  // TODO: Verify these selectors on weibo.com
  postContainer: [
    'article.weibo-main',
    '[class*="weibo-main"]',
    '[class*="wbpro-feed"]',
    '[class*="card-wrap"]',
    '.woo-box-flex[class*="Feed"]',
    '[class*="weibo-detail"]',
    '[data-mid]',
    '[data-id]',
    '.comment-content .card',
    'article',
  ].join(', '),

  // Post text content
  // TODO: Weibo wraps text in spans with @mentions and #topics
  postText: [
    '[class*="detail_wbtext"]',
    '[class*="txt"]',
    '[class*="Feed_body"]',
    '.weibo-text',
    '[class*="weibo-text"]',
    '.cmt-sub-txt',
    '.comment-content .cmt-sub-txt p',
  ].join(', '),

  // Author name - usually in a user card/link
  // TODO: Weibo shows username differently in feed vs detail
  authorName: [
    '[class*="head_name"]',
    '[class*="name"]',
    'a[usercard]',
    '[class*="weibo-user"] a',
    '.m-text-cut',
  ].join(', '),

  // Timestamp - Weibo uses relative times ("5分钟前") or absolute dates
  // TODO: May need to parse Chinese date formats
  timestamp: [
    '[class*="head_time"]',
    '[class*="time"]',
    '[class*="date"]',
    '[class*="weibo-time"]',
    'time',
  ].join(', '),

  // Reply/comment button
  // TODO: Weibo uses "评论" for comment button
  replyButton: '[class*="toolbar_comment"], [action-type="comment"]',

  // Show more replies/comments button
  // TODO: Weibo shows "展开更多" or similar
  showRepliesButton: '[class*="more_comment"], [action-type="more_comment"], [class*="expand"]',

  // Main content column
  // TODO: Weibo's main content area structure
  mainColumn: [
    'article.weibo-main',
    '[class*="weibo-main"]',
    '[class*="main"]',
    '#app',
    '[class*="Frame_main"]',
    '[class*="weibo-detail"]',
  ].join(', '),

  // Cell/item container for individual posts
  // TODO: Weibo's list item wrapper
  cellContainer: '[class*="card"], [class*="list_item"], [class*="Feed_item"], [class*="weibo-detail"], [class*="weibo-main"]',
};

class WeiboPlatform implements Platform {
  readonly name = 'weibo';
  readonly hosts = WEIBO_HOSTS;
  readonly selectors = WEIBO_SELECTORS;

  // ============================================================
  // URL Handling Methods
  // ============================================================

  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return WEIBO_HOSTS.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      );
    } catch {
      return false;
    }
  }

  isThreadUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const isWeiboHost = WEIBO_HOSTS.some((host) => parsed.hostname.endsWith(host));
      if (!isWeiboHost) return false;

      // Check for detail page format: /detail/[id]
      if (DETAIL_PATH_REGEX.test(parsed.pathname)) {
        return true;
      }

      // Check for legacy format: /[uid]/[mid]
      if (LEGACY_POST_REGEX.test(parsed.pathname)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  extractPostId(url: string): string | null {
    try {
      const parsed = new URL(url);

      // Try detail page format first: /detail/[id]
      const detailMatch = parsed.pathname.match(DETAIL_PATH_REGEX);
      if (detailMatch) {
        return detailMatch[1];
      }

      // Try legacy format: /[uid]/[mid]
      const legacyMatch = parsed.pathname.match(LEGACY_POST_REGEX);
      if (legacyMatch) {
        // Return the mid (post ID) which is the second capture group
        return legacyMatch[2];
      }

      return null;
    } catch {
      return null;
    }
  }

  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Normalize mobile URLs to desktop
      const normalizedHost = parsed.hostname
        .replace(/^m\./, '')
        .replace(/\.cn$/, '.com');
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
    // TODO: Weibo stores post IDs in various data attributes
    // Common patterns: data-mid, mid attribute, or in action URLs

    // Try common Weibo ID attributes
    const idAttributes = ['data-mid', 'mid', 'data-id', 'data-oid'];
    for (const attr of idAttributes) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      if (/^\d+$/.test(value)) return value;
      if (/^[A-Za-z0-9]{6,}$/.test(value)) return value;
    }

    // Try to find ID in links within the element
    const links = element.querySelectorAll(
      'a[href*="/detail/"], a[href*="/status/"], a[href*="m.weibo.cn/detail/"]'
    );
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      const detailMatch = href.match(/\/detail\/(\d+)/);
      if (detailMatch) return detailMatch[1];
      const mobileMatch = href.match(/m\.weibo\.cn\/detail\/(\d+)/);
      if (mobileMatch) return mobileMatch[1];
    }

    // Try action-data attribute which sometimes contains mid
    const actionData = element.getAttribute('action-data');
    if (actionData) {
      const midMatch = actionData.match(/mid=([A-Za-z0-9]+)/);
      if (midMatch) return midMatch[1];
    }

    // Fallback: check id attribute if it looks like a numeric/b62 post id
    const elementId = element.getAttribute('id');
    if (elementId && !/[._:\-]/.test(elementId)) {
      if (/^\d+$/.test(elementId)) return elementId;
      if (/^[A-Za-z0-9]{6,}$/.test(elementId)) return elementId;
    }

    // Final fallback: use URL for known detail pages (e.g., m.weibo.cn/detail/ID)
    if (element.matches('article.weibo-main, [class*="weibo-main"]')) {
      const fromUrl = this.extractPostId(window.location.href);
      if (fromUrl) return fromUrl;
    }

    return null;
  }

  hasReplies(element: Element): boolean | undefined {
    // TODO: Weibo shows comment count differently
    // Usually as "评论 123" or just a number next to comment icon

    const commentBtn = element.querySelector(this.selectors.replyButton);
    if (!commentBtn) return undefined;

    const text = commentBtn.textContent ?? '';
    // Extract number from text like "评论 123" or just "123"
    const match = text.match(/(\d+)/);
    if (match) {
      return Number.parseInt(match[1], 10) > 0;
    }

    return undefined;
  }

  isInlineReply(element: Element): boolean {
    // TODO: Determine how Weibo structures inline replies
    // Weibo typically shows replies in a separate comments section
    // rather than inline like Twitter

    const hasExpandButton = (el: Element | null): boolean => {
      if (!el) return false;
      const hasBtn = !!el.querySelector(this.selectors.showRepliesButton);
      if (hasBtn) return true;
      const text = el.textContent?.toLowerCase() ?? '';
      // Chinese for "show more" patterns
      return text.includes('展开') || text.includes('更多') || text.includes('show');
    };

    const cell = element.closest(this.selectors.cellContainer);
    if (hasExpandButton(cell?.previousElementSibling ?? null)) {
      return true;
    }

    if (hasExpandButton(element.previousElementSibling)) {
      return true;
    }

    return false;
  }

  findPrimaryPostLink(element: Element): HTMLAnchorElement | null {
    // TODO: Weibo's post links may be structured differently
    // Look for links to detail pages or with specific attributes

    // Try to find links to detail pages
    const detailLinks = element.querySelectorAll('a[href*="/detail/"]');
    for (const link of detailLinks) {
      if (link instanceof HTMLAnchorElement) {
        return link;
      }
    }

    // Look for timestamp links (common pattern for post links)
    const timeEl = element.querySelector(this.selectors.timestamp);
    if (timeEl) {
      const parentLink = timeEl.closest('a');
      if (parentLink instanceof HTMLAnchorElement) {
        return parentLink;
      }
    }

    // Try to find any link that looks like a post URL
    const allLinks = element.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.getAttribute('href') ?? '';
      if (href.includes('/detail/') || LEGACY_POST_REGEX.test(href)) {
        if (link instanceof HTMLAnchorElement) {
          return link;
        }
      }
    }

    return null;
  }

  getPostUrl(element: Element): string | undefined {
    const link = this.findPrimaryPostLink(element);
    const href = link?.getAttribute('href') ?? '';
    if (!href) return undefined;
    if (href.startsWith('http')) return href;
    return `https://weibo.com${href}`;
  }
}

/** Singleton instance of the Weibo platform */
export const weiboPlatform = new WeiboPlatform();

export default weiboPlatform;
