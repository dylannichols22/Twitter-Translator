import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tweet } from '../../scraper';

const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  })),
}));

import { AnthropicProvider } from './anthropic';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
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
    provider = new AnthropicProvider();
  });

  describe('properties', () => {
    it('has correct name', () => {
      expect(provider.name).toBe('anthropic');
    });

    it('has correct model', () => {
      expect(provider.model).toBe('claude-haiku-4-5-20251001');
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

    it('emits translations from stream', async () => {
      const translationJson = JSON.stringify({
        translations: [
          { id: '1', naturalTranslation: 'The weather is really nice today' },
        ],
      });

      const streamHandlers: { text?: (text: string) => void } = {};

      mockStream.mockImplementation(() => ({
        on: (event: string, handler: (text: string) => void) => {
          if (event === 'text') {
            streamHandlers.text = handler;
          }
        },
        finalMessage: () =>
          new Promise((resolve) => {
            // Simulate streaming by calling text handler with full JSON
            setTimeout(() => {
              streamHandlers.text?.(translationJson);
              resolve({ usage: { input_tokens: 10, output_tokens: 20 } });
            }, 0);
          }),
        controller: { abort: vi.fn() },
      }));

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

    it('falls back to non-streaming when streaming fails', async () => {
      mockStream.mockImplementation(() => {
        throw new Error('Stream error');
      });

      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              translations: [
                { id: '1', naturalTranslation: 'Fallback translation' },
              ],
            }),
          },
        ],
        usage: { input_tokens: 15, output_tokens: 25 },
      });

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
        naturalTranslation: 'Fallback translation',
      });
      expect(onComplete).toHaveBeenCalledWith({
        inputTokens: 15,
        outputTokens: 25,
      });
    });

    it('handles AbortError gracefully', async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      mockStream.mockImplementation(() => {
        throw error;
      });

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
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              segments: [
                { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
                { chinese: '天气', pinyin: 'tiānqì', gloss: 'weather' },
              ],
              notes: ['Common weather expression'],
            }),
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const result = await provider.getBreakdown('今天天气', 'test-api-key');

      expect(result.breakdown.segments).toHaveLength(2);
      expect(result.breakdown.segments[0].chinese).toBe('今天');
      expect(result.breakdown.segments[0].pinyin).toBe('jīntiān');
      expect(result.breakdown.notes).toContain('Common weather expression');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(20);
    });

    it('includes context in prompt when provided', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              segments: [{ chinese: '是的', pinyin: 'shìde', gloss: 'yes' }],
              notes: [],
            }),
          },
        ],
        usage: { input_tokens: 5, output_tokens: 10 },
      });

      await provider.getBreakdown('是的', 'test-api-key', {
        opAuthor: 'TestUser',
        opText: 'Original post',
        opUrl: 'https://twitter.com/test',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('OP author: TestUser'),
            }),
          ]),
        })
      );
    });

    it('recovers segments from truncated JSON response', async () => {
      const truncated = `\`\`\`json
{
  "segments": [
    { "chinese": "本來", "pinyin": "běnlái", "gloss": "originally" },
    { "chinese": "就是", "pinyin": "jiùshì", "gloss": "is; that's it" }
`;

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: truncated }],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const result = await provider.getBreakdown('test', 'test-api-key');

      expect(result.breakdown.segments).toHaveLength(2);
      expect(result.breakdown.segments[0].chinese).toBe('本來');
    });

    it('throws error when no text content in response', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      await expect(provider.getBreakdown('test', 'test-api-key')).rejects.toThrow(
        'No text response from API'
      );
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
      const translationJson = JSON.stringify({
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
      });

      const streamHandlers: { text?: (text: string) => void } = {};

      mockStream.mockImplementation(() => ({
        on: (event: string, handler: (text: string) => void) => {
          if (event === 'text') {
            streamHandlers.text = handler;
          }
        },
        finalMessage: () =>
          new Promise((resolve) => {
            setTimeout(() => {
              streamHandlers.text?.(translationJson);
              resolve({ usage: { input_tokens: 100, output_tokens: 200 } });
            }, 0);
          }),
        controller: { abort: vi.fn() },
      }));

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
      const streamHandlers: { text?: (text: string) => void } = {};

      mockStream.mockImplementation(() => ({
        on: (event: string, handler: (text: string) => void) => {
          if (event === 'text') {
            streamHandlers.text = handler;
          }
        },
        finalMessage: () =>
          new Promise((resolve) => {
            setTimeout(() => {
              // Send invalid JSON that won't have translations array
              streamHandlers.text?.(JSON.stringify({ invalid: 'response' }));
              resolve({ usage: { input_tokens: 10, output_tokens: 20 } });
            }, 0);
          }),
        controller: { abort: vi.fn() },
      }));

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
