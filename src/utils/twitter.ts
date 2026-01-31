import { twitterPlatform } from '../platforms';

/**
 * @deprecated Use twitterPlatform.hosts from '../platforms' instead
 */
export const TWITTER_HOSTS = ['twitter.com', 'x.com'];

/**
 * Checks if a URL is a Twitter/X URL.
 * @deprecated Use isSupportedPlatformUrl from '../platforms' for platform-agnostic check,
 * or twitterPlatform.isValidUrl for Twitter-specific check.
 */
export function isTwitterUrl(url: string): boolean {
  return twitterPlatform.isValidUrl(url);
}

/**
 * Normalizes x.com hostnames to twitter.com.
 * @deprecated Use twitterPlatform.normalizeUrl from '../platforms' instead
 */
export function normalizeTwitterHostname(hostname: string): string {
  return hostname.replace(/(^|\.)x\.com$/, '$1twitter.com');
}
