import type { Provider } from '../../storage/storage';
import type { TranslationProvider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';

const providers: Map<Provider, TranslationProvider> = new Map();

export function getProvider(providerName: Provider): TranslationProvider {
  let provider = providers.get(providerName);
  
  if (!provider) {
    switch (providerName) {
      case 'anthropic':
        provider = new AnthropicProvider();
        break;
      case 'openai':
        provider = new OpenAIProvider();
        break;
      case 'google':
        provider = new GoogleProvider();
        break;
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
    providers.set(providerName, provider);
  }
  
  return provider;
}

export function getProviderDisplayName(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'Anthropic (Claude Haiku 4.5)';
    case 'openai':
      return 'OpenAI (GPT-4o mini)';
    case 'google':
      return 'Google (Gemini 2.0 Flash)';
    default:
      return provider;
  }
}

export function getProviderModel(provider: Provider): string {
  const p = getProvider(provider);
  return p.model;
}

export const AVAILABLE_PROVIDERS: Provider[] = ['anthropic', 'openai', 'google'];
