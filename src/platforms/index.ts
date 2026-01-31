/**
 * Platform Detection and Routing
 * Provides utilities for detecting and retrieving the appropriate platform.
 */

import { Platform, PlatformName } from './types';
import { twitterPlatform } from './twitter';
import { weiboPlatform } from './weibo';

/** Map of all available platforms by name */
const platforms: Record<PlatformName, Platform> = {
  twitter: twitterPlatform,
  weibo: weiboPlatform,
};

/** Array of all platform instances for iteration */
const allPlatforms: Platform[] = [twitterPlatform, weiboPlatform];

/**
 * Detects which platform a URL belongs to.
 * @param url - The URL to check
 * @returns The matching Platform, or null if not supported
 */
export function detectPlatform(url: string): Platform | null {
  for (const platform of allPlatforms) {
    if (platform.isValidUrl(url)) {
      return platform;
    }
  }
  return null;
}

/**
 * Gets a platform by name.
 * @param name - The platform name ('twitter' or 'weibo')
 * @returns The Platform instance
 */
export function getPlatform(name: PlatformName): Platform {
  return platforms[name];
}

/**
 * Gets the current platform based on window.location.
 * Should only be called from content scripts (browser context).
 * @returns The current Platform, or null if not on a supported platform
 */
export function getCurrentPlatform(): Platform | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return detectPlatform(window.location.href);
}

/**
 * Checks if a URL is a valid platform URL (any supported platform).
 * @param url - The URL to check
 * @returns true if the URL belongs to any supported platform
 */
export function isSupportedPlatformUrl(url: string): boolean {
  return detectPlatform(url) !== null;
}

/**
 * Checks if a URL is a thread/post detail page on any supported platform.
 * @param url - The URL to check
 * @returns true if the URL is a thread/post page
 */
export function isThreadUrl(url: string): boolean {
  const platform = detectPlatform(url);
  return platform ? platform.isThreadUrl(url) : false;
}

/**
 * Extracts the post ID from a URL on any supported platform.
 * @param url - The URL to extract from
 * @returns The post ID or null if not found
 */
export function extractPostId(url: string): string | null {
  const platform = detectPlatform(url);
  return platform ? platform.extractPostId(url) : null;
}

/**
 * Normalizes a URL for caching/comparison on any supported platform.
 * @param url - The URL to normalize
 * @returns The normalized URL, or the original if platform unknown
 */
export function normalizeUrl(url: string): string {
  const platform = detectPlatform(url);
  return platform ? platform.normalizeUrl(url) : url;
}

// Re-export everything for convenience
export { Platform, PlatformName, PlatformSelectors } from './types';
export { twitterPlatform } from './twitter';
export { weiboPlatform } from './weibo';
