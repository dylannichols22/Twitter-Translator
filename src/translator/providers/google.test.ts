import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tweet } from '../../scraper';
import { GoogleProvider } from './google';

describe('GoogleProvider', () => {
  let provider: GoogleProvider;
  const mockTweets: Tweet[] = [
    {
      id: '1',
      text: '今天天气真的很好',
      author: '测试用户',
      timestamp: '2024-01-15T10:30:00.000Z',
      isMainPost: true,
    },
    {
      id: '2',
      text: '是的，适合出去玩',
      author: '回复者',
      timestamp: '2024-01-15T10:35:00.000Z',
      isMainPost: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleProvider();
    globalThis.fetch = vi.fn();
  });

  describe('properties', () => {
    it('has correct name', () => {
      expect(provider.name).toBe('google');
    });

    it('has correct model', () => {
      expect(provider.model).toBe('gemini-2.0-flash');
    });
  });

  describe('translateQuickStreaming', () => {
    it('calls onError when API key is empty', async () => {
      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming(mockTweets, '', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(new Error('API key is required'));
      expect(onTranslation).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('calls onError when tweets array is empty', async () => {
      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming([], 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(new Error('No tweets to translate'));
    });

    it('returns early when signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
        signal: controller.signal,
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onTranslation).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('emits translations from response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        translations: [
                          { id: '1', naturalTranslation: 'The weather is really nice today' },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30,
            },
          }),
      } as Response);

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onTranslation).toHaveBeenCalledWith({
        id: '1',
        naturalTranslation: 'The weather is really nice today',
      });
      expect(onComplete).toHaveBeenCalledWith({
        inputTokens: 10,
        outputTokens: 20,
      });
    });

    it('handles API errors', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('Rate limit exceeded'),
      } as Response);

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('429'),
        })
      );
    });

    it('calls onError when no text in response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{}],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
            },
          }),
      } as Response);

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });

    it('handles AbortError gracefully', async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      vi.mocked(globalThis.fetch).mockRejectedValue(error);

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateQuickStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('getBreakdown', () => {
    it('throws error when API key is empty', async () => {
      await expect(provider.getBreakdown('test', '')).rejects.toThrow(
        'API key is required'
      );
    });

    it('returns breakdown with segments and notes', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        segments: [
                          { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
                          { chinese: '天气', pinyin: 'tiānqì', gloss: 'weather' },
                        ],
                        notes: ['Common weather expression'],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
            },
          }),
      } as Response);

      const result = await provider.getBreakdown('今天天气', 'test-api-key');

      expect(result.breakdown.segments).toHaveLength(2);
      expect(result.breakdown.segments[0].chinese).toBe('今天');
      expect(result.breakdown.segments[0].pinyin).toBe('jīntiān');
      expect(result.breakdown.notes).toContain('Common weather expression');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(20);
    });

    it('includes context in prompt when provided', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        segments: [{ chinese: '是的', pinyin: 'shìde', gloss: 'yes' }],
                        notes: [],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 5,
              candidatesTokenCount: 10,
            },
          }),
      } as Response);

      await provider.getBreakdown('是的', 'test-api-key', {
        opAuthor: 'TestUser',
        opText: 'Original post',
        opUrl: 'https://twitter.com/test',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('TestUser'),
        })
      );
    });

    it('throws error when response has no text', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{}],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
            },
          }),
      } as Response);

      await expect(provider.getBreakdown('test', 'test-api-key')).rejects.toThrow(
        'No text in response'
      );
    });

    it('throws error for invalid JSON response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'invalid json',
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
            },
          }),
      } as Response);

      await expect(provider.getBreakdown('test', 'test-api-key')).rejects.toThrow();
    });
  });

  describe('translateThreadStreaming', () => {
    it('calls onError when API key is empty', async () => {
      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateThreadStreaming(mockTweets, '', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(new Error('API key is required'));
    });

    it('calls onError when tweets array is empty', async () => {
      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateThreadStreaming([], 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(new Error('No tweets to translate'));
    });

    it('emits full translations with segments', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        translations: [
                          {
                            id: '1',
                            naturalTranslation: 'The weather is really nice today',
                            segments: [
                              { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
                            ],
                            notes: ['Weather expression'],
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 200,
            },
          }),
      } as Response);

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateThreadStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onTranslation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          naturalTranslation: 'The weather is really nice today',
          segments: expect.any(Array),
        })
      );
      expect(onComplete).toHaveBeenCalledWith({
        inputTokens: 100,
        outputTokens: 200,
      });
    });

    it('calls onError for invalid response format', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({ invalid: 'response' }),
                    },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
            },
          }),
      } as Response);

      const onTranslation = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      await provider.translateThreadStreaming(mockTweets, 'test-api-key', {
        onTranslation,
        onComplete,
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });
  });
});
