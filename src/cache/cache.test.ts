import { describe, it, expect, beforeEach } from 'vitest';
import { SessionCache } from './cache';
import type { TranslationResult } from '../translator';

describe('SessionCache', () => {
  let cache: SessionCache;

  const mockTranslation: TranslationResult = {
    translations: [
      {
        id: '1',
        naturalTranslation: 'Hello',
        segments: [{ chinese: '你好', pinyin: 'nǐhǎo', gloss: 'hello' }],
        notes: [],
      },
    ],
    usage: { inputTokens: 100, outputTokens: 200 },
  };

  beforeEach(() => {
    cache = new SessionCache();
  });

  describe('get and set', () => {
    it('stores and retrieves translations by URL', async () => {
      await cache.set('https://twitter.com/user/status/123', mockTranslation);
      const result = await cache.get('https://twitter.com/user/status/123');
      expect(result).toEqual(mockTranslation);
    });

    it('returns undefined for non-existent entries', async () => {
      const result = await cache.get('https://twitter.com/nonexistent');
      expect(result).toBeUndefined();
    });

    it('overwrites existing entries with same key', async () => {
      const updatedTranslation: TranslationResult = {
        ...mockTranslation,
        translations: [
          {
            id: '2',
            naturalTranslation: 'Updated',
            segments: [],
            notes: [],
          },
        ],
      };

      await cache.set('https://twitter.com/user/status/123', mockTranslation);
      await cache.set('https://twitter.com/user/status/123', updatedTranslation);

      const result = await cache.get('https://twitter.com/user/status/123');
      expect(result?.translations[0].naturalTranslation).toBe('Updated');
    });
  });

  describe('has', () => {
    it('returns true for cached URLs', async () => {
      await cache.set('https://twitter.com/user/status/123', mockTranslation);
      await expect(cache.has('https://twitter.com/user/status/123')).resolves.toBe(true);
    });

    it('returns false for non-cached URLs', async () => {
      await expect(cache.has('https://twitter.com/nonexistent')).resolves.toBe(false);
    });
  });

  describe('delete', () => {
    it('removes cached entry', async () => {
      await cache.set('https://twitter.com/user/status/123', mockTranslation);
      await cache.delete('https://twitter.com/user/status/123');
      await expect(cache.has('https://twitter.com/user/status/123')).resolves.toBe(false);
    });

    it('does nothing for non-existent entries', async () => {
      await expect(cache.delete('https://twitter.com/nonexistent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('removes all cached entries', async () => {
      await cache.set('https://twitter.com/user/status/123', mockTranslation);
      await cache.set('https://twitter.com/user/status/456', mockTranslation);

      await cache.clear();

      await expect(cache.has('https://twitter.com/user/status/123')).resolves.toBe(false);
      await expect(cache.has('https://twitter.com/user/status/456')).resolves.toBe(false);
      await expect(cache.size()).resolves.toBe(0);
    });
  });

  describe('size', () => {
    it('returns number of cached entries', async () => {
      await expect(cache.size()).resolves.toBe(0);

      await cache.set('https://twitter.com/user/status/123', mockTranslation);
      await expect(cache.size()).resolves.toBe(1);

      await cache.set('https://twitter.com/user/status/456', mockTranslation);
      await expect(cache.size()).resolves.toBe(2);
    });
  });

  describe('generateCacheKey', () => {
    it('normalizes URLs for consistent caching', () => {
      const key1 = SessionCache.generateCacheKey('https://twitter.com/user/status/123');
      const key2 = SessionCache.generateCacheKey('https://x.com/user/status/123');

      // Both Twitter and X URLs for same status should have same key
      expect(key1).toBe(key2);
    });

    it('handles URLs with query parameters', () => {
      const key1 = SessionCache.generateCacheKey('https://twitter.com/user/status/123?ref=home');
      const key2 = SessionCache.generateCacheKey('https://twitter.com/user/status/123');

      // Query params should be ignored for caching
      expect(key1).toBe(key2);
    });

    it('handles different paths differently', () => {
      const key1 = SessionCache.generateCacheKey('https://twitter.com/user/status/123');
      const key2 = SessionCache.generateCacheKey('https://twitter.com/user/status/456');

      expect(key1).not.toBe(key2);
    });

    it('includes comment limit in cache key', () => {
      const key1 = SessionCache.generateCacheKey('https://twitter.com/user/status/123', {
        commentLimit: 10,
      });
      const key2 = SessionCache.generateCacheKey('https://twitter.com/user/status/123', {
        commentLimit: 50,
      });

      expect(key1).not.toBe(key2);
    });
  });
});
