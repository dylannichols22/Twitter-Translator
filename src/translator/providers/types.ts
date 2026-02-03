import type { Tweet } from '../../scraper';

export interface Segment {
  chinese: string;
  pinyin: string;
  gloss: string;
}

export interface Breakdown {
  segments: Segment[];
  notes: string[];
}

export interface QuickTranslation {
  id: string;
  naturalTranslation: string;
}

export interface TranslatedTweet extends QuickTranslation {
  segments: Segment[];
  notes: string[];
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
}

export interface QuickTranslationResult {
  translations: QuickTranslation[];
  usage: UsageStats;
}

export interface BreakdownResult {
  breakdown: Breakdown;
  usage: UsageStats;
}

export interface TranslationResult {
  translations: TranslatedTweet[];
  usage: UsageStats;
}

export interface QuickStreamCallbacks {
  onTranslation: (translation: QuickTranslation) => void;
  onComplete: (usage: UsageStats) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export interface StreamCallbacks {
  onTranslation: (translation: TranslatedTweet) => void;
  onComplete: (usage: UsageStats) => void;
  onError: (error: Error) => void;
}

export interface BreakdownContext {
  opAuthor?: string;
  opText?: string;
  opUrl?: string;
}

export interface TranslationProvider {
  readonly name: string;
  readonly model: string;

  translateQuickStreaming(
    tweets: Tweet[],
    apiKey: string,
    callbacks: QuickStreamCallbacks
  ): Promise<void>;

  getBreakdown(
    text: string,
    apiKey: string,
    context?: BreakdownContext
  ): Promise<BreakdownResult>;

  translateThreadStreaming(
    tweets: Tweet[],
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<void>;
}
