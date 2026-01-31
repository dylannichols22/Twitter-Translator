/**
 * Platform Abstraction Layer
 * Provides a common interface for different social media platforms (Twitter, Weibo, etc.)
 */

/**
 * DOM selectors for extracting content from a platform's page.
 */
export interface PlatformSelectors {
  /** Selector for the main post container element (e.g., tweet article) */
  postContainer: string;
  /** Selector for the post text content element */
  postText: string;
  /** Selector for the author name element */
  authorName: string;
  /** Selector for the timestamp element */
  timestamp: string;
  /** Selector for the reply button element */
  replyButton: string;
  /** Selector for the "show replies" or "show more replies" button */
  showRepliesButton: string;
  /** Selector for the main content column */
  mainColumn: string;
  /** Selector for the cell container wrapping individual posts */
  cellContainer: string;
}

/**
 * Platform interface defining the contract for platform-specific implementations.
 */
export interface Platform {
  /** Platform identifier (e.g., 'twitter', 'weibo') */
  readonly name: string;

  /** List of valid hostnames for this platform (e.g., ['twitter.com', 'x.com']) */
  readonly hosts: readonly string[];

  /** DOM selectors for this platform */
  readonly selectors: PlatformSelectors;

  // ============================================================
  // URL Handling Methods
  // ============================================================

  /**
   * Checks if a URL belongs to this platform.
   * @param url - The URL to check
   * @returns true if the URL is for this platform
   */
  isValidUrl(url: string): boolean;

  /**
   * Checks if a URL is a thread/post detail page URL.
   * @param url - The URL to check
   * @returns true if the URL points to a specific thread/post
   */
  isThreadUrl(url: string): boolean;

  /**
   * Extracts the post ID from a URL.
   * @param url - The URL to extract from
   * @returns The post ID or null if not found
   */
  extractPostId(url: string): string | null;

  /**
   * Normalizes a URL for caching/comparison purposes.
   * Removes unnecessary query params, normalizes hostname, etc.
   * @param url - The URL to normalize
   * @returns The normalized URL
   */
  normalizeUrl(url: string): string;

  // ============================================================
  // Element Methods
  // ============================================================

  /**
   * Extracts the post ID from a post container element.
   * @param element - The post container element
   * @returns The post ID or null if not found
   */
  extractPostIdFromElement(element: Element): string | null;

  /**
   * Checks if a post element has replies/comments.
   * @param element - The post container element
   * @returns true if the post has replies, false if not, undefined if unknown
   */
  hasReplies(element: Element): boolean | undefined;

  /**
   * Checks if a post element is an inline reply (nested reply shown in context).
   * @param element - The post container element
   * @returns true if this is an inline reply
   */
  isInlineReply(element: Element): boolean;

  /**
   * Finds the primary status/post link within a post container.
   * @param element - The post container element
   * @returns The anchor element linking to the post, or null
   */
  findPrimaryPostLink(element: Element): HTMLAnchorElement | null;

  /**
   * Gets the post URL from a post container element.
   * @param element - The post container element
   * @returns The full URL of the post, or undefined
   */
  getPostUrl(element: Element): string | undefined;
}

/**
 * Type for platform names.
 */
export type PlatformName = 'twitter' | 'weibo';
