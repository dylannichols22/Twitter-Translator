import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProvider,
  getProviderDisplayName,
  getProviderModel,
  AVAILABLE_PROVIDERS,
} from './factory';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';
import type { Provider } from '../../storage/storage';

vi.mock('./anthropic', () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    name: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
  })),
}));

vi.mock('./openai', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({
    name: 'openai',
    model: 'gpt-4o-mini',
  })),
}));

vi.mock('./google', () => ({
  GoogleProvider: vi.fn().mockImplementation(() => ({
    name: 'google',
    model: 'gemini-2.0-flash',
  })),
}));

describe('Provider Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AVAILABLE_PROVIDERS', () => {
    it('contains all supported providers', () => {
      expect(AVAILABLE_PROVIDERS).toContain('anthropic');
      expect(AVAILABLE_PROVIDERS).toContain('openai');
      expect(AVAILABLE_PROVIDERS).toContain('google');
      expect(AVAILABLE_PROVIDERS).toHaveLength(3);
    });
  });

  describe('getProvider', () => {
    it('returns AnthropicProvider for anthropic', () => {
      const provider = getProvider('anthropic');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('anthropic');
      expect(AnthropicProvider).toHaveBeenCalledTimes(1);
    });

    it('returns OpenAIProvider for openai', () => {
      const provider = getProvider('openai');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
      expect(OpenAIProvider).toHaveBeenCalledTimes(1);
    });

    it('returns GoogleProvider for google', () => {
      const provider = getProvider('google');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('google');
      expect(GoogleProvider).toHaveBeenCalledTimes(1);
    });

    it('caches provider instances', () => {
      const provider1 = getProvider('anthropic');
      const provider2 = getProvider('anthropic');
      expect(provider1).toBe(provider2);
    });

    it('throws error for unknown provider', () => {
      expect(() => getProvider('unknown' as Provider)).toThrow('Unknown provider: unknown');
    });
  });

  describe('getProviderDisplayName', () => {
    it('returns correct display name for anthropic', () => {
      expect(getProviderDisplayName('anthropic')).toBe('Anthropic (Claude Haiku 4.5)');
    });

    it('returns correct display name for openai', () => {
      expect(getProviderDisplayName('openai')).toBe('OpenAI (GPT-4o mini)');
    });

    it('returns correct display name for google', () => {
      expect(getProviderDisplayName('google')).toBe('Google (Gemini 2.0 Flash)');
    });

    it('returns provider name for unknown provider', () => {
      expect(getProviderDisplayName('unknown' as Provider)).toBe('unknown');
    });
  });

  describe('getProviderModel', () => {
    it('returns correct model for anthropic', () => {
      expect(getProviderModel('anthropic')).toBe('claude-haiku-4-5-20251001');
    });

    it('returns correct model for openai', () => {
      expect(getProviderModel('openai')).toBe('gpt-4o-mini');
    });

    it('returns correct model for google', () => {
      expect(getProviderModel('google')).toBe('gemini-2.0-flash');
    });
  });
});
