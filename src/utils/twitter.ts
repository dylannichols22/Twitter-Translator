export const TWITTER_HOSTS = ['twitter.com', 'x.com'];

export function isTwitterUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TWITTER_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function normalizeTwitterHostname(hostname: string): string {
  return hostname.replace(/(^|\.)x\.com$/, '$1twitter.com');
}
