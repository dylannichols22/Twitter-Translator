import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tweet } from '../scraper';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

// Import after mock setup
import { translateThread } from './translator';

describe('Translator', () => {
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
  });

  describe('translateThread', () => {
    it('returns translated tweets with natural translation', async () => {
      const mockResponse = {
        translations: [
          {
            id: '1',
            naturalTranslation: 'The weather is really nice today',
            segments: [
              { chinese: '今天', pinyin: 'jīntiān', gloss: 'today' },
              { chinese: '天气', pinyin: 'tiānqì', gloss: 'weather' },
              { chinese: '真的', pinyin: 'zhēnde', gloss: 'really' },
              { chinese: '很好', pinyin: 'hěn hǎo', gloss: 'very good' },
            ],
            notes: ['Common weather expression'],
          },
          {
            id: '2',
            naturalTranslation: "Yes, it's perfect for going out",
            segments: [
              { chinese: '是的', pinyin: 'shìde', gloss: 'yes' },
              { chinese: '适合', pinyin: 'shìhé', gloss: 'suitable for' },
              { chinese: '出去', pinyin: 'chūqù', gloss: 'go out' },
              { chinese: '玩', pinyin: 'wán', gloss: 'play/have fun' },
            ],
            notes: ['玩 is commonly used for any leisure activity'],
          },
        ],
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const result = await translateThread(mockTweets, 'test-api-key');

      expect(result.translations).toHaveLength(2);
      expect(result.translations[0].naturalTranslation).toBe('The weather is really nice today');
      expect(result.translations[0].segments).toHaveLength(4);
      expect(result.translations[0].segments[0].pinyin).toBe('jīntiān');
    });

    it('includes usage statistics in result', async () => {
      const mockResponse = {
        translations: [{
          id: '1',
          naturalTranslation: 'Test',
          segments: [],
          notes: [],
        }],
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: { input_tokens: 150, output_tokens: 300 },
      });

      const result = await translateThread([mockTweets[0]], 'test-api-key');

      expect(result.usage).toBeDefined();
      expect(result.usage.inputTokens).toBe(150);
      expect(result.usage.outputTokens).toBe(300);
    });

    it('throws error when API key is not provided', async () => {
      await expect(translateThread(mockTweets, '')).rejects.toThrow('API key is required');
    });

    it('throws error when tweets array is empty', async () => {
      await expect(translateThread([], 'test-api-key')).rejects.toThrow('No tweets to translate');
    });

    it('handles API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(translateThread(mockTweets, 'test-api-key')).rejects.toThrow('API rate limit exceeded');
    });

    it('uses correct model and parameters', async () => {
      const mockResponse = {
        translations: [{
          id: '1',
          naturalTranslation: 'Test',
          segments: [],
          notes: [],
        }],
      };

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockResponse) }],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      await translateThread([mockTweets[0]], 'test-api-key');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.stringContaining('claude'),
          max_tokens: expect.any(Number),
        })
      );
    });
  });
});
