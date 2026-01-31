import type { TranslationResult } from '../translator';
import { normalizeUrl } from '../platforms';

export interface CacheContext {
  commentLimit?: number;
}

export class SessionCache {
  private cache: Map<string, TranslationResult> = new Map();
  private storagePrefix = 'tt-translation-cache:';

  private hasSessionStorage(): boolean {
    return typeof browser !== 'undefined' && !!browser.storage?.session;
  }

  private storageKey(key: string): string {
    return `${this.storagePrefix}${key}`;
  }

  async get(url: string, context?: CacheContext): Promise<TranslationResult | undefined> {
    const key = SessionCache.generateCacheKey(url, context);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (!this.hasSessionStorage()) {
      return undefined;
    }

    const result = await browser.storage.session.get([this.storageKey(key)]);
    const value = result[this.storageKey(key)] as TranslationResult | undefined;
    if (value) {
      this.cache.set(key, value);
    }
    return value;
  }

  async set(url: string, translation: TranslationResult, context?: CacheContext): Promise<void> {
    const key = SessionCache.generateCacheKey(url, context);
    this.cache.set(key, translation);

    if (!this.hasSessionStorage()) {
      return;
    }

    await browser.storage.session.set({
      [this.storageKey(key)]: translation,
    });
  }

  async has(url: string, context?: CacheContext): Promise<boolean> {
    const key = SessionCache.generateCacheKey(url, context);
    if (this.cache.has(key)) {
      return true;
    }

    if (!this.hasSessionStorage()) {
      return false;
    }

    const result = await browser.storage.session.get([this.storageKey(key)]);
    return typeof result[this.storageKey(key)] !== 'undefined';
  }

  async delete(url: string, context?: CacheContext): Promise<void> {
    const key = SessionCache.generateCacheKey(url, context);
    this.cache.delete(key);

    if (!this.hasSessionStorage()) {
      return;
    }

    await browser.storage.session.remove(this.storageKey(key));
  }

  async clear(): Promise<void> {
    this.cache.clear();

    if (!this.hasSessionStorage()) {
      return;
    }

    const all = await browser.storage.session.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(this.storagePrefix));
    if (keys.length > 0) {
      await browser.storage.session.remove(keys);
    }
  }

  async size(): Promise<number> {
    if (this.cache.size > 0) {
      return this.cache.size;
    }

    if (!this.hasSessionStorage()) {
      return 0;
    }

    const all = await browser.storage.session.get(null);
    return Object.keys(all).filter((key) => key.startsWith(this.storagePrefix)).length;
  }

  static generateCacheKey(url: string, context?: CacheContext): string {
    const limit = typeof context?.commentLimit === 'number' ? context.commentLimit : 'default';
    try {
      // Use platform-aware URL normalization
      const normalizedUrl = normalizeUrl(url);
      // Remove protocol for cache key
      const withoutProtocol = normalizedUrl.replace(/^https?:\/\//, '');
      return `${withoutProtocol}::limit=${limit}`;
    } catch {
      // If URL parsing fails, use the raw URL
      return `${url}::limit=${limit}`;
    }
  }
}

// Singleton instance for the extension
export const translationCache = new SessionCache();
