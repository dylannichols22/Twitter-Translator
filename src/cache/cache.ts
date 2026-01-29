import type { TranslationResult } from '../translator';

export class SessionCache {
  private cache: Map<string, TranslationResult> = new Map();

  get(url: string): TranslationResult | undefined {
    const key = SessionCache.generateCacheKey(url);
    return this.cache.get(key);
  }

  set(url: string, translation: TranslationResult): void {
    const key = SessionCache.generateCacheKey(url);
    this.cache.set(key, translation);
  }

  has(url: string): boolean {
    const key = SessionCache.generateCacheKey(url);
    return this.cache.has(key);
  }

  delete(url: string): void {
    const key = SessionCache.generateCacheKey(url);
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  static generateCacheKey(url: string): string {
    try {
      const parsed = new URL(url);

      // Normalize twitter.com and x.com to same domain
      const normalizedHost = parsed.hostname.replace('x.com', 'twitter.com');

      // Extract pathname without query params
      const pathname = parsed.pathname;

      return `${normalizedHost}${pathname}`;
    } catch {
      // If URL parsing fails, use the raw URL
      return url;
    }
  }
}

// Singleton instance for the extension
export const translationCache = new SessionCache();
