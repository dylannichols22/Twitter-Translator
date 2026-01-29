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
    it('stores and retrieves translations by URL', () => {
      cache.set('https://twitter.com/user/status/123', mockTranslation);
      const result = cache.get('https://twitter.com/user/status/123');
      expect(result).toEqual(mockTranslation);
    });

    it('returns undefined for non-existent entries', () => {
      const result = cache.get('https://twitter.com/nonexistent');
      expect(result).toBeUndefined();
    });

    it('overwrites existing entries with same key', () => {
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

      cache.set('https://twitter.com/user/status/123', mockTranslation);
      cache.set('https://twitter.com/user/status/123', updatedTranslation);

      const result = cache.get('https://twitter.com/user/status/123');
      expect(result?.translations[0].naturalTranslation).toBe('Updated');
    });
  });

  describe('has', () => {
    it('returns true for cached URLs', () => {
      cache.set('https://twitter.com/user/status/123', mockTranslation);
      expect(cache.has('https://twitter.com/user/status/123')).toBe(true);
    });

    it('returns false for non-cached URLs', () => {
      expect(cache.has('https://twitter.com/nonexistent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes cached entry', () => {
      cache.set('https://twitter.com/user/status/123', mockTranslation);
      cache.delete('https://twitter.com/user/status/123');
      expect(cache.has('https://twitter.com/user/status/123')).toBe(false);
    });

    it('does nothing for non-existent entries', () => {
      expect(() => cache.delete('https://twitter.com/nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('removes all cached entries', () => {
      cache.set('https://twitter.com/user/status/123', mockTranslation);
      cache.set('https://twitter.com/user/status/456', mockTranslation);

      cache.clear();

      expect(cache.has('https://twitter.com/user/status/123')).toBe(false);
      expect(cache.has('https://twitter.com/user/status/456')).toBe(false);
      expect(cache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('returns number of cached entries', () => {
      expect(cache.size()).toBe(0);

      cache.set('https://twitter.com/user/status/123', mockTranslation);
      expect(cache.size()).toBe(1);

      cache.set('https://twitter.com/user/status/456', mockTranslation);
      expect(cache.size()).toBe(2);
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
  });
});
